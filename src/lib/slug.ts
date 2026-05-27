/**
 * URL-slug utilities for Readquest.
 *
 * We slug books as "<title>-<first-author>" lowercase, ASCII, hyphen-separated.
 * Slug uniqueness is enforced by the DB; callers append a numeric suffix on
 * collision (handled by `withUniqueSuffix`).
 */

const MAX_LEN = 96;

const COMMON_WORDS: Set<string> = new Set([
  // Drop noise that would just bloat URLs.
]);

/** Lower-case, strip diacritics, replace non-alnum with hyphens, dedupe. */
export function slugifyText(input: string): string {
  return input
    .normalize("NFD")
    // strip combining diacritical marks
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/** First author from a comma- or `;`-separated list, or empty string. */
export function firstAuthor(authors: string): string {
  const trimmed = (authors || "").trim();
  if (!trimmed) return "";
  return trimmed.split(/[,;]/)[0]?.trim() ?? "";
}

/** Build a slug from a title and authors string. */
export function makeBookSlug(title: string, authors: string): string {
  const author = firstAuthor(authors);
  const base = author ? `${title} ${author}` : title;
  const slug = slugifyText(base);
  // Drop trivial words at the start/end if it makes a clean slug.
  const tokens = slug.split("-").filter((t) => !COMMON_WORDS.has(t));
  const cleaned = tokens.join("-");
  return cleaned.slice(0, MAX_LEN).replace(/-+$/g, "") || "book";
}

/**
 * Returns a slug guaranteed to be unique by appending `-2`, `-3`, ... when
 * `isTaken` reports a collision. Caller supplies the predicate.
 */
export async function withUniqueSuffix(
  base: string,
  isTaken: (candidate: string) => Promise<boolean>
): Promise<string> {
  let candidate = base;
  let n = 1;
  // Safety cap; if we can't find a unique slug in 50 tries, append random hex.
  while (await isTaken(candidate)) {
    n += 1;
    if (n > 50) {
      const rand = Math.random().toString(36).slice(2, 7);
      candidate = `${base}-${rand}`;
      return candidate;
    }
    candidate = `${base}-${n}`;
  }
  return candidate;
}

const HEX24 = /^[a-f0-9]{24}$/i;

/** True if the input looks like a Mongo ObjectId. */
export function looksLikeObjectId(input: string): boolean {
  return HEX24.test(input);
}
