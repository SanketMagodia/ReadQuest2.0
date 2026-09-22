const COVER_HOSTS = [
  "books.google.com",
  "books.googleusercontent.com",
  "googleusercontent.com",
  "covers.openlibrary.org",
  "openlibrary.org",
  "archive.org",
];

/** Book jackets we are willing to fetch for a gist snapshot. */
export function isAllowedCoverUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase();
    return COVER_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}
