/** Central brand + SEO strings for The Gist Club (TGC). */

export const BRAND_NAME = "The Gist Club";
export const BRAND_SHORT = "TGC";
export const BRAND_TAGLINE = "Books, quotes, threads";

export const BRAND_TITLE = `${BRAND_NAME} — ${BRAND_TAGLINE}`;
export const BRAND_TITLE_TEMPLATE = `%s · ${BRAND_SHORT}`;

export const BRAND_DESCRIPTION =
  "The Gist Club (TGC) is a reader-first social space for book lovers: share quotes, join threaded discussions, discover bestsellers, and follow the books that move you.";

export const SEO_KEYWORDS = [
  "The Gist Club",
  "TGC",
  "book quotes",
  "reading community",
  "book discussion",
  "book threads",
  "reader social network",
  "book discovery",
  "daily reading quest",
  "book summaries",
] as const;

/** Page title — short TGC suffix for inner pages. */
export function pageTitle(page: string): string {
  return `${page} · ${BRAND_SHORT}`;
}
