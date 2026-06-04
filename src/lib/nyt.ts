/**
 * New York Times Books API integration.
 *
 *  - getNytOverview()    → top 5 books for *every* bestseller list (1 call)
 *  - getNytListNames()   → all list names + display names + frequency
 *  - getNytList(name)    → the full (~15 book) list for one category
 *  - getNytReviews(opts) → NYT book reviews by ISBN / title / author
 *
 * The Books API only needs the API key (passed as `?api-key=`). The "secret"
 * is for OAuth-style apps and is unused here.
 *
 * Rate limits are tight (~500/day, ~5/min) and the lists only change weekly,
 * so every call leans on the Next.js fetch cache via `next.revalidate`.
 *
 * Reference: https://developer.nytimes.com/docs/books-product/1/overview
 */

const BASE = "https://api.nytimes.com/svc/books/v3";
const FETCH_TIMEOUT_MS = 6_000;

// ── Normalized public types ─────────────────────────────────────────────────

export type NytBook = {
  rank: number;
  rankLastWeek: number;
  weeksOnList: number;
  title: string;
  author: string;
  description: string;
  publisher: string;
  isbn13: string;
  isbn10: string;
  thumbnail: string;
  amazonUrl: string;
};

export type NytList = {
  listId: number;
  name: string;
  encodedName: string;
  displayName: string;
  /** "WEEKLY" | "MONTHLY" */
  frequency: string;
  books: NytBook[];
};

export type NytListName = {
  name: string;
  encodedName: string;
  displayName: string;
  /** "WEEKLY" | "MONTHLY" */
  frequency: string;
};

export type NytReview = {
  url: string;
  byline: string;
  summary: string;
  publicationDate: string;
  bookTitle: string;
  bookAuthor: string;
};

// ── Raw API shapes (only the fields we use) ─────────────────────────────────

type RawBook = {
  rank?: number;
  rank_last_week?: number;
  weeks_on_list?: number;
  title?: string;
  author?: string;
  description?: string;
  publisher?: string;
  primary_isbn13?: string;
  primary_isbn10?: string;
  book_image?: string;
  amazon_product_url?: string;
};

type RawList = {
  list_id?: number;
  list_name?: string;
  list_name_encoded?: string;
  display_name?: string;
  updated?: string;
  books?: RawBook[];
};

// ── Internals ───────────────────────────────────────────────────────────────

function apiKey(): string | null {
  return process.env.NYT_BOOKS_API_KEY?.trim() || null;
}

function isNetworkTimeout(err: unknown) {
  if (!(err instanceof Error)) return false;
  return err.name === "AbortError" || /timeout/i.test(err.message);
}

async function nytFetch<T>(
  path: string,
  searchParams: Record<string, string>,
  revalidate: number
): Promise<T | null> {
  const key = apiKey();
  if (!key) {
    console.warn("[nyt] NYT_BOOKS_API_KEY is not set — skipping NYT request");
    return null;
  }

  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(searchParams)) {
    if (v) url.searchParams.set(k, v);
  }
  url.searchParams.set("api-key", key);

  try {
    const res = await fetch(url, {
      next: { revalidate },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[nyt] ${path} responded ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    if (!isNetworkTimeout(err)) {
      console.warn(`[nyt] request to ${path} failed`);
    }
    return null;
  }
}

function toBook(b: RawBook): NytBook {
  return {
    rank: b.rank ?? 0,
    rankLastWeek: b.rank_last_week ?? 0,
    weeksOnList: b.weeks_on_list ?? 0,
    title: (b.title ?? "").trim(),
    author: (b.author ?? "").trim(),
    description: (b.description ?? "").trim(),
    publisher: (b.publisher ?? "").trim(),
    isbn13: (b.primary_isbn13 ?? "").trim(),
    isbn10: (b.primary_isbn10 ?? "").trim(),
    thumbnail: (b.book_image ?? "").replace(/^http:/, "https:"),
    amazonUrl: (b.amazon_product_url ?? "").trim(),
  };
}

function toList(l: RawList): NytList {
  return {
    listId: l.list_id ?? 0,
    name: (l.list_name ?? "").trim(),
    encodedName: (l.list_name_encoded ?? "").trim(),
    displayName: (l.display_name ?? l.list_name ?? "").trim(),
    frequency: (l.updated ?? "").trim(),
    books: (l.books ?? [])
      .filter((b) => b.title)
      .map(toBook),
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Top 5 books for every Best Sellers list — one request, cached ~6h. */
export async function getNytOverview(publishedDate?: string): Promise<NytList[]> {
  const data = await nytFetch<{ results?: { lists?: RawList[] } }>(
    "/lists/overview.json",
    publishedDate ? { published_date: publishedDate } : {},
    21_600
  );
  return (data?.results?.lists ?? []).map(toList).filter((l) => l.books.length);
}

/** Every Best Sellers list name (weekly + monthly), cached ~24h. */
export async function getNytListNames(): Promise<NytListName[]> {
  const data = await nytFetch<{
    results?: Array<{
      list_name?: string;
      list_name_encoded?: string;
      display_name?: string;
      updated?: string;
    }>;
  }>("/lists/names.json", {}, 86_400);

  return (data?.results ?? [])
    .filter((r) => r.list_name_encoded)
    .map((r) => ({
      name: (r.list_name ?? "").trim(),
      encodedName: (r.list_name_encoded ?? "").trim(),
      displayName: (r.display_name ?? r.list_name ?? "").trim(),
      frequency: (r.updated ?? "").trim(),
    }));
}

/** The full (~15 book) list for a single category, cached ~6h. */
export async function getNytList(
  encodedName: string,
  date = "current"
): Promise<NytList | null> {
  const safeName = encodedName.trim();
  if (!safeName) return null;
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "current";

  const data = await nytFetch<{ results?: RawList }>(
    `/lists/${safeDate}/${encodeURIComponent(safeName)}.json`,
    {},
    21_600
  );
  if (!data?.results) return null;
  return toList(data.results);
}

/** NYT book reviews by ISBN (preferred), title, or author. Cached ~24h. */
export async function getNytReviews(opts: {
  isbn?: string;
  title?: string;
  author?: string;
}): Promise<NytReview[]> {
  const params: Record<string, string> = {};
  if (opts.isbn?.trim()) params.isbn = opts.isbn.trim();
  else if (opts.title?.trim()) params.title = opts.title.trim();
  else if (opts.author?.trim()) params.author = opts.author.trim();
  if (Object.keys(params).length === 0) return [];

  const data = await nytFetch<{
    results?: Array<{
      url?: string;
      byline?: string;
      summary?: string;
      publication_dt?: string;
      book_title?: string;
      book_author?: string;
    }>;
  }>("/reviews.json", params, 86_400);

  return (data?.results ?? [])
    .filter((r) => r.url)
    .map((r) => ({
      url: (r.url ?? "").trim(),
      byline: (r.byline ?? "").trim(),
      summary: (r.summary ?? "").trim(),
      publicationDate: (r.publication_dt ?? "").trim(),
      bookTitle: (r.book_title ?? "").trim(),
      bookAuthor: (r.book_author ?? "").trim(),
    }));
}
