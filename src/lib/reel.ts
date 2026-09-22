import { Types, type PipelineStage } from "mongoose";
import connectDB from "@/lib/db";
import Book, { type BookDoc } from "@/models/Book";
import BookFollow from "@/models/BookFollow";
import BookSummary from "@/models/BookSummary";
import ReadList from "@/models/ReadList";
import ReelImpression from "@/models/ReelImpression";
import { llmChat, isLlmConfigured, LlmError } from "@/lib/llm";

/** Cards handed to the client per request. */
export const REEL_BATCH = 6;

/** How many books the ranker gets to choose from. */
const CANDIDATE_POOL = 36;

/** Cards in the instant opening run, before the ranker has answered. */
export const STARTER_BATCH = 3;

/** Books the hourly starter rotation draws from. */
const STARTER_POOL = 48;

export type ReelCard = {
  id: string;
  slug: string;
  title: string;
  authors: string;
  thumbnail: string;
  description: string;
  categories: string;
  publishedYear: number | null;
  averageRating: number | null;
  numPages: number | null;
  /** One line, written for this reader, on why the card is in front of them. */
  hook: string;
  /** 2–3 word mood label from the ranker. */
  tag: string;
  /**
   * The full summary markdown, shipped with the card so the reader starts on
   * page one instead of watching a spinner. Candidates are summary-gated, so
   * this is only ever empty if a summary was deleted mid-flight.
   */
  summary: string;
};

type TasteProfile = {
  categories: string[];
  loved: string[];
  skipped: string[];
};

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitCategories(raw: string | undefined): string[] {
  return (raw || "")
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * What we know about this reader's taste, assembled from the shelves they
 * keep and the cards they've already judged. Titles are carried alongside
 * categories because the ranker reasons far better about "you loved Pachinko"
 * than about "you read 3 Historical Fiction books".
 */
async function buildTasteProfile(userId: string): Promise<TasteProfile> {
  const uid = new Types.ObjectId(userId);

  const [follows, readlist, impressions] = await Promise.all([
    BookFollow.find({ user: uid }).select("book").lean(),
    ReadList.find({ user: uid }).select("book status").lean(),
    ReelImpression.find({ user: uid })
      .select("book action")
      .sort({ updatedAt: -1 })
      .limit(120)
      .lean(),
  ]);

  const lovedIds = new Set<string>([
    ...follows.map((f) => f.book.toString()),
    ...readlist.map((r) => r.book.toString()),
    ...impressions
      .filter((i) => i.action === "read" || i.action === "saved")
      .map((i) => i.book.toString()),
  ]);
  const skippedIds = impressions
    .filter((i) => i.action === "skipped")
    .map((i) => i.book.toString());

  const lookupIds = [...lovedIds, ...skippedIds]
    .slice(0, 80)
    .map((id) => new Types.ObjectId(id));
  const books = lookupIds.length
    ? await Book.find({ _id: { $in: lookupIds } })
        .select("title authors categories")
        .lean()
    : [];

  const byId = new Map(books.map((b) => [b._id.toString(), b]));
  const label = (id: string) => {
    const b = byId.get(id);
    if (!b) return "";
    const author = (b.authors || "").split(/[,;]/)[0]?.trim();
    return author ? `${b.title} — ${author}` : b.title;
  };

  const freq: Record<string, number> = {};
  for (const id of lovedIds) {
    for (const c of splitCategories(byId.get(id)?.categories)) {
      freq[c] = (freq[c] || 0) + 1;
    }
  }

  return {
    categories: Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([c]) => c),
    loved: [...lovedIds].map(label).filter(Boolean).slice(0, 12),
    skipped: skippedIds.map(label).filter(Boolean).slice(0, 8),
  };
}

/**
 * Books this reader hasn't judged yet, drawn only from the ones that already
 * have a generated summary — a card is only worth putting in the reel if its
 * gist opens instantly. `npm run summarize-books` is what grows this set, so
 * the reel is as deep as that batch has gotten.
 *
 * Candidates are drawn category-first so the ranker gets a pool that's already
 * in the right neighbourhood, then topped up with broadly popular titles so a
 * reader with a narrow shelf still sees something outside it.
 */
async function buildCandidatePool(
  userId: string,
  profile: TasteProfile,
  extraExcluded: string[]
): Promise<BookDoc[]> {
  const uid = new Types.ObjectId(userId);

  const [impressions, readlist, follows] = await Promise.all([
    ReelImpression.find({ user: uid }).select("book").lean(),
    ReadList.find({ user: uid }).select("book").lean(),
    BookFollow.find({ user: uid }).select("book").lean(),
  ]);

  const excluded = new Set<string>([
    ...impressions.map((i) => i.book.toString()),
    ...readlist.map((r) => r.book.toString()),
    ...follows.map((f) => f.book.toString()),
    ...extraExcluded.filter((id) => Types.ObjectId.isValid(id)),
  ]);
  const excludedIds = [...excluded].map((id) => new Types.ObjectId(id));

  /**
   * Driven from the summary collection rather than from books, so the scan is
   * proportional to how many summaries exist instead of to the whole library.
   */
  const summarizedBooks = async (
    bookMatch: PipelineStage.Match["$match"],
    limit: number
  ): Promise<BookDoc[]> => {
    const rows = await BookSummary.aggregate([
      { $match: { book: { $nin: excludedIds } } },
      {
        $lookup: {
          from: Book.collection.name,
          localField: "book",
          foreignField: "_id",
          as: "book",
        },
      },
      { $unwind: "$book" },
      { $replaceRoot: { newRoot: "$book" } },
      { $match: bookMatch },
      { $sort: { ratingsCount: -1, averageRating: -1 } },
      { $limit: limit },
    ]);
    return rows as BookDoc[];
  };

  const base = { description: { $exists: true, $ne: "" } };

  const pool: BookDoc[] = [];
  const taken = new Set<string>();
  const absorb = (rows: BookDoc[]) => {
    for (const b of rows) {
      const id = b._id.toString();
      if (taken.has(id)) continue;
      taken.add(id);
      pool.push(b);
    }
  };

  if (profile.categories.length) {
    const catRegex = new RegExp(
      profile.categories.map(escapeRegex).join("|"),
      "i"
    );
    absorb(
      await summarizedBooks(
        { ...base, categories: { $regex: catRegex } },
        CANDIDATE_POOL
      )
    );
  }

  if (pool.length < CANDIDATE_POOL) {
    absorb(await summarizedBooks(base, CANDIDATE_POOL * 2));
  }

  // Shuffle so two visits in the same hour don't replay the same order.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, CANDIDATE_POOL);
}

const RANKER_SYSTEM = [
  "You are a reader's private book curator. You are handed that reader's taste and a numbered shelf of candidates, and you decide what to put in front of them next.",
  "",
  "Rules:",
  `- Choose exactly ${REEL_BATCH} candidates, ordered best-first.`,
  "- Only use the numbers given to you. Never invent a book.",
  "- Order for a satisfying run, not a monotonous one: open with the strongest fit, and make sure at least one pick stretches them somewhere adjacent to their taste.",
  "- Never pick two books by the same author.",
  "- Avoid anything close to what they recently skipped.",
  "",
  "For each pick:",
  '- "hook": ONE complete sentence of 12 to 22 words, addressed to the reader as "you". Name the specific feeling or idea waiting for them. Never a plot summary, never blurb language.',
  '  Good: "You get a marriage unravelling in real time, told so plainly it stops feeling like fiction."',
  '  Too vague, do not do this: "A beautiful and moving story you will love."',
  '- "tag": a 2-3 word lowercase mood label, e.g. "quiet devastation", "slow-burn dread".',
  "",
  "Respond with STRICT JSON only, shaped exactly like:",
  '{"picks":[{"i":3,"hook":"...","tag":"..."}]}',
].join("\n");

function parseJsonObject(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function describeReader(profile: TasteProfile): string {
  const lines: string[] = [];
  if (profile.loved.length) {
    lines.push(`Books they follow, shelved, or finished:\n- ${profile.loved.join("\n- ")}`);
  }
  if (profile.categories.length) {
    lines.push(`Genres they keep returning to: ${profile.categories.join(", ")}`);
  }
  if (profile.skipped.length) {
    lines.push(`Recently swiped away: ${profile.skipped.join("; ")}`);
  }
  if (!lines.length) {
    lines.push(
      "This reader is brand new — nothing on their shelves yet. Pick widely loved, immediately gripping books across different genres."
    );
  }
  return lines.join("\n\n");
}

function describeCandidates(pool: BookDoc[]): string {
  return pool
    .map((b, i) => {
      const author = (b.authors || "").split(/[,;]/)[0]?.trim() || "unknown";
      const cats = splitCategories(b.categories).slice(0, 3).join(", ");
      const blurb = (b.description || "").replace(/\s+/g, " ").slice(0, 220);
      return `${i}. ${b.title} — ${author}${cats ? ` [${cats}]` : ""}\n   ${blurb}`;
    })
    .join("\n");
}

/**
 * Heuristic ordering used when the ranker is unavailable. The reel must never
 * come back empty just because OpenRouter is having a bad minute.
 */
function fallbackRank(pool: BookDoc[], profile: TasteProfile): BookDoc[] {
  const wanted = new Set(profile.categories.map((c) => c.toLowerCase()));
  return [...pool]
    .sort((a, b) => {
      const score = (x: BookDoc) =>
        splitCategories(x.categories).filter((c) => wanted.has(c.toLowerCase()))
          .length;
      const diff = score(b) - score(a);
      if (diff !== 0) return diff;
      return (b.ratingsCount ?? 0) - (a.ratingsCount ?? 0);
    })
    .slice(0, REEL_BATCH);
}

type RankedPick = { book: BookDoc; hook: string; tag: string };

async function rankWithLlm(
  pool: BookDoc[],
  profile: TasteProfile
): Promise<RankedPick[] | null> {
  if (!isLlmConfigured()) return null;

  let completion: string;
  try {
    completion = await llmChat(
      [
        { role: "system", content: RANKER_SYSTEM },
        {
          role: "user",
          content: `THE READER\n${describeReader(profile)}\n\nCANDIDATES\n${describeCandidates(
            pool
          )}\n\nChoose their next ${REEL_BATCH} now.`,
        },
      ],
      { temperature: 0.8, maxTokens: 1200, json: true }
    );
  } catch (err) {
    const message = err instanceof LlmError || err instanceof Error ? err.message : String(err);
    console.warn("[reel] ranker unavailable, falling back:", message);
    return null;
  }

  const data = parseJsonObject(completion) as {
    picks?: Array<{ i?: unknown; hook?: unknown; tag?: unknown }>;
  } | null;
  const raw = Array.isArray(data?.picks) ? data.picks : [];
  if (!raw.length) return null;

  const picks: RankedPick[] = [];
  const usedIndexes = new Set<number>();
  const usedAuthors = new Set<string>();

  for (const p of raw) {
    const i = Number(p.i);
    if (!Number.isInteger(i) || i < 0 || i >= pool.length) continue;
    if (usedIndexes.has(i)) continue;
    const book = pool[i];
    const authorKey = (book.authors || "").split(/[,;]/)[0]?.trim().toLowerCase();
    if (authorKey && usedAuthors.has(authorKey)) continue;
    usedIndexes.add(i);
    if (authorKey) usedAuthors.add(authorKey);
    picks.push({
      book,
      hook: typeof p.hook === "string" ? p.hook.trim().slice(0, 240) : "",
      tag: typeof p.tag === "string" ? p.tag.trim().toLowerCase().slice(0, 40) : "",
    });
    if (picks.length >= REEL_BATCH) break;
  }

  return picks.length ? picks : null;
}

function toCard(
  book: BookDoc,
  hook: string,
  tag: string,
  summary: string
): ReelCard {
  return {
    id: book._id.toString(),
    slug: book.slug ?? book._id.toString(),
    title: book.title,
    authors: book.authors ?? "",
    thumbnail: book.thumbnail ?? "",
    description: book.description ?? "",
    categories: book.categories ?? "",
    publishedYear: book.publishedYear ?? null,
    averageRating: book.averageRating ?? null,
    numPages: book.numPages ?? null,
    hook,
    tag,
    summary,
  };
}

async function summaryByBook(books: BookDoc[]): Promise<Map<string, string>> {
  const rows = await BookSummary.find({ book: { $in: books.map((b) => b._id) } })
    .select("book content")
    .lean();
  return new Map(rows.map((s) => [s.book.toString(), s.content as string]));
}

/**
 * The starter rotation: the same well-reviewed, already-summarized books for
 * everyone, reshuffled each hour. Held in module memory because it's identical
 * across readers, so the opening cards cost one query per hour per instance
 * rather than one per visit.
 */
let starterCache: { hour: number; books: BookDoc[] } | null = null;

function currentHour(): number {
  return Math.floor(Date.now() / 3_600_000);
}

async function starterPool(): Promise<BookDoc[]> {
  const hour = currentHour();
  if (starterCache?.hour === hour) return starterCache.books;

  const rows = (await BookSummary.aggregate([
    {
      $lookup: {
        from: Book.collection.name,
        localField: "book",
        foreignField: "_id",
        as: "book",
      },
    },
    { $unwind: "$book" },
    { $replaceRoot: { newRoot: "$book" } },
    { $match: { description: { $exists: true, $ne: "" } } },
    { $sort: { ratingsCount: -1, averageRating: -1 } },
    { $limit: STARTER_POOL },
  ])) as BookDoc[];

  starterCache = { hour, books: rows };
  return rows;
}

/**
 * The opening cards, served without waiting on the ranker.
 *
 * The personalized run takes an LLM round-trip, which is the whole of the
 * wait a reader used to sit through before the first gist appeared. These
 * come straight from the hourly rotation instead, and the client swaps in
 * ranked cards behind them once `buildReel` answers.
 */
export async function buildStarterReel(
  userId: string,
  exclude: string[] = []
): Promise<ReelCard[]> {
  await connectDB();

  const pool = await starterPool();
  if (!pool.length) return [];

  // Everyone gets the same three per hour, so the rotation stays shared, but
  // anything this reader already judged is stepped over rather than replayed.
  const seen = new Set<string>([
    ...(
      await ReelImpression.find({ user: new Types.ObjectId(userId) })
        .select("book")
        .lean()
    ).map((i) => i.book.toString()),
    ...exclude,
  ]);

  const offset = currentHour() % pool.length;
  const picked: BookDoc[] = [];
  for (let n = 0; n < pool.length && picked.length < STARTER_BATCH; n++) {
    const book = pool[(offset + n) % pool.length];
    if (seen.has(book._id.toString())) continue;
    picked.push(book);
  }
  if (!picked.length) return [];

  const contentByBook = await summaryByBook(picked);
  return picked.map((book) =>
    toCard(book, "", "", contentByBook.get(book._id.toString()) ?? "")
  );
}

/**
 * A random run of already-summarized books.
 *
 * Used once a reader has judged everything the ranker can still offer, so the
 * gist reel stays full instead of ending on an empty screen. `exclude` is only
 * the cards already on screen — earlier impressions are fair game again.
 */
export async function buildRandomReel(exclude: string[] = []): Promise<ReelCard[]> {
  await connectDB();

  const excludedIds = exclude
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  const rows = (await BookSummary.aggregate([
    ...(excludedIds.length ? [{ $match: { book: { $nin: excludedIds } } }] : []),
    { $sample: { size: REEL_BATCH * 4 } },
    {
      $lookup: {
        from: Book.collection.name,
        localField: "book",
        foreignField: "_id",
        as: "book",
      },
    },
    { $unwind: "$book" },
    { $replaceRoot: { newRoot: "$book" } },
    { $match: { description: { $exists: true, $ne: "" } } },
    { $limit: REEL_BATCH },
  ])) as BookDoc[];

  if (!rows.length) return [];

  const contentByBook = await summaryByBook(rows);
  return rows.map((book) =>
    toCard(book, "", "", contentByBook.get(book._id.toString()) ?? "")
  );
}

/**
 * The next run of cards for a reader.
 *
 * `exclude` carries ids the client already holds but hasn't reported on yet,
 * so a fast scroller never gets the same book twice inside one session.
 */
export async function buildReel(
  userId: string,
  exclude: string[] = []
): Promise<ReelCard[]> {
  await connectDB();

  const profile = await buildTasteProfile(userId);
  const pool = await buildCandidatePool(userId, profile, exclude);
  if (!pool.length) return [];

  const ranked =
    (await rankWithLlm(pool, profile)) ??
    fallbackRank(pool, profile).map((book) => ({ book, hook: "", tag: "" }));

  const contentByBook = await summaryByBook(ranked.map((r) => r.book));

  return ranked.map(({ book, hook, tag }) =>
    toCard(book, hook, tag, contentByBook.get(book._id.toString()) ?? "")
  );
}
