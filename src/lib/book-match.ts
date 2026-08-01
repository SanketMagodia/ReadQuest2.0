import { Types } from "mongoose";
import connectDB from "@/lib/db";
import Book from "@/models/Book";
import { searchOpenLibrary } from "@/lib/openlibrary";

/**
 * Resolves free-text (title, author) pairs — typically produced by the LLM
 * recommender — into books the reader can actually open.
 *
 * Three outcomes per pick, in preference order:
 *   local        → already in our library; links straight to its book room
 *   openlibrary  → real book we don't have yet; adopted on click via /api/books/import
 *   unresolved   → we couldn't verify it anywhere, so the caller can drop it
 */

export type BookCandidate = { title: string; author: string };

export type ResolvedBook = {
  source: "local" | "openlibrary" | "unresolved";
  title: string;
  authors: string;
  thumbnail: string;
  categories: string;
  /** Present when source === "local". */
  id?: string;
  slug?: string;
  /** Present when source === "openlibrary". */
  olKey?: string;
  isbn?: string;
  numPages?: number;
  publishedYear?: number;
  averageRating?: number;
  ratingsCount?: number;
};

type BookLean = {
  _id: Types.ObjectId;
  slug?: string;
  title?: string;
  authors?: string;
  categories?: string;
  thumbnail?: string;
  publishedYear?: number;
  averageRating?: number;
};

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Lowercase, strip punctuation/articles/subtitles so titles compare loosely. */
function normalizeTitle(raw: string) {
  return raw
    .toLowerCase()
    .split(":")[0]
    .replace(/\(.*?\)/g, "")
    .replace(/^(the|a|an)\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Compare on surname — LLMs and catalogs disagree on initials and middle names. */
function surnameOf(raw: string) {
  const first = raw.split(/[,;&]| and /i)[0]?.trim() ?? "";
  const parts = first.split(/\s+/).filter(Boolean);
  return (parts[parts.length - 1] ?? "").toLowerCase().replace(/[^a-z]/g, "");
}

function sameBook(a: BookCandidate, title: string, authors: string) {
  if (normalizeTitle(title) !== normalizeTitle(a.title)) return false;
  const wanted = surnameOf(a.author);
  if (!wanted) return true;
  return authors.toLowerCase().includes(wanted);
}

/** Look every candidate up in our own catalog with a single query. */
async function matchLocal(candidates: BookCandidate[]) {
  await connectDB();
  const rows = (await Book.find({
    $or: candidates.map((c) => ({
      title: { $regex: new RegExp(`^${escapeRegex(c.title.split(":")[0].trim())}`, "i") },
    })),
  })
    .select("_id slug title authors categories thumbnail publishedYear averageRating")
    .limit(candidates.length * 6)
    .lean()) as unknown as BookLean[];

  const found = new Map<number, ResolvedBook>();
  candidates.forEach((c, i) => {
    const hit = rows.find((r) => sameBook(c, r.title ?? "", r.authors ?? ""));
    if (!hit) return;
    found.set(i, {
      source: "local",
      id: hit._id.toString(),
      slug: hit.slug ?? "",
      title: hit.title ?? c.title,
      authors: hit.authors ?? c.author,
      thumbnail: hit.thumbnail ?? "",
      categories: hit.categories ?? "",
      publishedYear: hit.publishedYear,
      averageRating: hit.averageRating,
    });
  });
  return found;
}

function hasLatinLetters(s: string) {
  return /[a-z]/i.test(s);
}

/**
 * Verify a single candidate against Open Library (gives us a cover + key).
 *
 * Open Library work records are sometimes filed under a translated edition, so
 * a correct title can come back with an author in another script (Murakami as
 * 村上春樹). Those are still the right book, so we accept them but keep the
 * recommender's Latin-script author name for display.
 */
async function matchOpenLibrary(
  c: BookCandidate
): Promise<ResolvedBook | null> {
  // A fielded query is far more precise than dumping title + author into `q`,
  // and it means Open Library itself has vouched for the author.
  const fielded = `title:"${c.title.replace(/"/g, "")}" author:"${c.author.replace(/"/g, "")}"`;
  let results = await searchOpenLibrary(fielded, 5);
  let authorVouched = results.length > 0;
  if (!results.length) {
    results = await searchOpenLibrary(`${c.title} ${c.author}`.trim(), 5);
    authorVouched = false;
  }
  if (!results.length) return null;

  const wantedTitle = normalizeTitle(c.title);
  const scored = results
    .filter((r) => normalizeTitle(r.title) === wantedTitle)
    .map((r) => ({
      r,
      // 3: surname confirmed · 2: author in another script, title matches
      // 1: title matches but the Latin-script author does not
      score: sameBook(c, r.title, r.authors)
        ? 3
        : hasLatinLetters(r.authors)
          ? 1
          : 2,
    }))
    // A score of 1 is a different author with the same title unless the
    // fielded search already confirmed the author. Dropping it is better than
    // linking the reader to the wrong book.
    .filter((s) => s.score > 1 || authorVouched)
    .sort(
      (a, b) =>
        b.score - a.score || (b.r.thumbnail ? 1 : 0) - (a.r.thumbnail ? 1 : 0)
    );

  const best = scored[0];
  if (!best) return null;

  return {
    source: "openlibrary",
    olKey: best.r.olKey,
    title: best.r.title,
    authors: best.score === 3 ? best.r.authors : c.author || best.r.authors,
    thumbnail: best.r.thumbnail,
    categories: best.r.categories,
    publishedYear: best.r.publishedYear,
    isbn: best.r.isbn,
    numPages: best.r.numPages,
    averageRating: best.r.averageRating,
    ratingsCount: best.r.ratingsCount,
  };
}

/**
 * Resolve every candidate, preferring our own catalog and falling back to
 * Open Library. Order is preserved so the LLM's ranking survives.
 */
export async function resolveBooks(
  candidates: BookCandidate[]
): Promise<ResolvedBook[]> {
  if (!candidates.length) return [];

  const local = await matchLocal(candidates);

  const resolved = await Promise.all(
    candidates.map(async (c, i) => {
      const hit = local.get(i);
      if (hit) return hit;
      try {
        return await matchOpenLibrary(c);
      } catch {
        return null;
      }
    })
  );

  return resolved.map<ResolvedBook>((r, i) => {
    if (r) return r;
    const c = candidates[i];
    return {
      source: "unresolved",
      title: c.title,
      authors: c.author,
      thumbnail: "",
      categories: "",
    };
  });
}
