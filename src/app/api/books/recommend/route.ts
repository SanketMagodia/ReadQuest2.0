import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppSession } from "@/lib/session";
import { groqChat, isGroqConfigured, GroqError } from "@/lib/groq";
import { resolveBooks, type BookCandidate } from "@/lib/book-match";

export const maxDuration = 60;

const schema = z.object({
  vibe: z.string().trim().min(3).max(600),
});

const PICK_COUNT = 6;

/**
 * Very small in-process throttle. Each recommendation is one LLM call plus a
 * handful of Open Library lookups, so we cap bursts per identity. Serverless
 * instances each keep their own window — good enough to stop a hammering tab,
 * and it never blocks a normal reader.
 */
const RATE_LIMIT = { windowMs: 60_000, max: 6 };
const hits = new Map<string, number[]>();

function rateLimited(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter(
    (t) => now - t < RATE_LIMIT.windowMs
  );
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 500) {
    for (const [k, v] of hits) {
      if (!v.some((t) => now - t < RATE_LIMIT.windowMs)) hits.delete(k);
    }
  }
  return recent.length > RATE_LIMIT.max;
}

const SYSTEM = [
  "You are the most well-read librarian alive: part critic, part matchmaker.",
  "A reader describes a feeling, mood, situation, or comparison. You answer with REAL published books that match the FEELING they described, not just its keywords.",
  "",
  "Curation rules:",
  `- Recommend exactly ${PICK_COUNT} books.`,
  "- Every title must be a real, published book written by that exact author. Never invent a book, an author, or an attribution. If unsure, choose a book you are certain about.",
  "- Balance the list: 2 widely-loved sure things, 3 under-the-radar gems that most lists miss, and exactly 1 bold wildcard that reframes what they asked for.",
  "- Never repeat an author. Prefer a spread of eras and voices.",
  "- Non-fiction, memoir, essays, poetry, or graphic novels are welcome when they genuinely serve the vibe.",
  "- Avoid the same handful of titles that appear on every recommendation list unless one is a perfect fit.",
  "",
  "For each book:",
  '- "why": ONE complete sentence of 14 to 24 words, addressed to the reader as "you". Name the specific feeling, image, or craft choice that makes it fit THEIR words. Never a plot summary, never blurb language, never "if you liked X".',
  '  Good: "You get the exact ache of a city that stays indifferent while you quietly rebuild yourself in it."',
  '  Too short, do not do this: "You crave tranquil insight." / "A quiet, moving read."',
  '- "tag": a 2-3 word lowercase mood label, e.g. "quiet devastation", "slow-burn dread", "found family warmth".',
  '- "match": integer 60-99, how strongly it fits their description. Only the single best fit may exceed 95.',
  "",
  'Also write "echo": one complete sentence of 10 to 18 words reflecting back what they are really asking for. Warm and perceptive, never flattering, never a fragment, never repeating their words verbatim.',
  '  Good echo: "You want the loneliness of a new city, but written with enough tenderness to be bearable."',
  "",
  "Use the reader's own language for the response. Prefer the best-known English-language title of each book.",
  "",
  "Respond with STRICT JSON only, shaped exactly like:",
  '{"echo":"...","picks":[{"title":"...","author":"...","why":"...","tag":"...","match":93}]}',
].join("\n");

type RawPick = {
  title?: unknown;
  author?: unknown;
  why?: unknown;
  tag?: unknown;
  match?: unknown;
};

function str(v: unknown, max: number) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** Models occasionally wrap JSON in prose or fences despite instructions. */
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

/** AI book recommendations from a free-text description of a vibe. */
export async function POST(req: Request) {
  if (!isGroqConfigured()) {
    return NextResponse.json(
      { error: "Recommendations are not available right now." },
      { status: 503 }
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Tell us a little more about what you're in the mood for." },
      { status: 400 }
    );
  }

  const session = await getAppSession();
  const identity =
    session?.user?.id ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "anon";
  if (rateLimited(identity)) {
    return NextResponse.json(
      { error: "That's a lot of ideas at once — give it a minute and try again." },
      { status: 429 }
    );
  }

  const { vibe } = parsed.data;

  let completion: string;
  try {
    completion = await groqChat(
      [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `The reader says:\n"${vibe}"\n\nRecommend their ${PICK_COUNT} books now.`,
        },
      ],
      { temperature: 0.9, maxTokens: 1400, json: true }
    );
  } catch (err) {
    const message =
      err instanceof GroqError || err instanceof Error
        ? err.message
        : "AI request failed";
    console.error("[recommend] groq failed:", message);
    return NextResponse.json(
      { error: "Our librarian is thinking too hard. Try again in a moment." },
      { status: 502 }
    );
  }

  const data = parseJsonObject(completion) as {
    echo?: unknown;
    picks?: RawPick[];
  } | null;

  const rawPicks = Array.isArray(data?.picks) ? data.picks : [];
  const candidates: (BookCandidate & {
    why: string;
    tag: string;
    match: number;
  })[] = [];
  const seenAuthors = new Set<string>();

  for (const p of rawPicks) {
    const title = str(p.title, 200);
    const author = str(p.author, 160);
    if (!title || !author) continue;
    const authorKey = author.toLowerCase();
    if (seenAuthors.has(authorKey)) continue;
    seenAuthors.add(authorKey);

    const match = Number(p.match);
    candidates.push({
      title,
      author,
      why: str(p.why, 240),
      tag: str(p.tag, 40).toLowerCase(),
      match: Number.isFinite(match) ? Math.min(99, Math.max(50, match)) : 80,
    });
    if (candidates.length >= PICK_COUNT) break;
  }

  if (!candidates.length) {
    return NextResponse.json(
      { error: "Couldn't find a good match for that — try describing it differently." },
      { status: 502 }
    );
  }

  const resolved = await resolveBooks(
    candidates.map(({ title, author }) => ({ title, author }))
  );

  // Drop anything we couldn't verify in our catalog or on Open Library: an
  // unopenable card is worse than a shorter list.
  const picks = resolved
    .map((book, i) => ({ ...book, ...candidates[i] }))
    .filter((p) => p.source !== "unresolved")
    .map((p) => ({
      source: p.source,
      id: p.id,
      slug: p.slug,
      olKey: p.olKey,
      title: p.title,
      authors: p.authors,
      thumbnail: p.thumbnail,
      categories: p.categories,
      publishedYear: p.publishedYear,
      averageRating: p.averageRating,
      ratingsCount: p.ratingsCount,
      isbn: p.isbn,
      numPages: p.numPages,
      why: p.why,
      tag: p.tag,
      match: p.match,
    }));

  if (!picks.length) {
    return NextResponse.json(
      { error: "Couldn't track down those books — try describing the vibe another way." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    echo: str(data?.echo, 200),
    picks,
  });
}
