/**
 * Open Library integration.
 *
 *  - searchOpenLibrary(q, limit)  → light book records for the search dropdown
 *  - fetchOpenLibraryWork(key)    → description + extra subjects, used at import time
 *
 * The Open Library JSON API is public, no key required. We pass a UA header
 * to be polite and rely on Next.js fetch cache for short-lived re-use.
 *
 * Reference: https://openlibrary.org/dev/docs/api/search
 */

const SEARCH_URL = "https://openlibrary.org/search.json";
const WORK_BASE = "https://openlibrary.org";
const COVER_BASE = "https://covers.openlibrary.org/b/id";
const UA = { "User-Agent": "Readquest/1.0 (+https://readquest)" };

type OLSearchDoc = {
  key: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  subject?: string[];
  isbn?: string[];
  number_of_pages_median?: number;
  ratings_average?: number;
  ratings_count?: number;
};

export type OLBookResult = {
  source: "openlibrary";
  olKey: string;
  title: string;
  authors: string;
  thumbnail: string;
  categories: string;
  publishedYear?: number;
  isbn?: string;
  numPages?: number;
  averageRating?: number;
  ratingsCount?: number;
};

export async function searchOpenLibrary(
  q: string,
  limit = 8
): Promise<OLBookResult[]> {
  const query = q.trim();
  if (!query) return [];

  const url = new URL(SEARCH_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(Math.min(20, Math.max(1, limit))));
  url.searchParams.set(
    "fields",
    [
      "key",
      "title",
      "author_name",
      "first_publish_year",
      "cover_i",
      "subject",
      "isbn",
      "number_of_pages_median",
      "ratings_average",
      "ratings_count",
    ].join(",")
  );

  try {
    const res = await fetch(url, {
      headers: UA,
      // Next.js will cache identical search URLs for 5 minutes — typical typing
      // produces lots of redundant queries.
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { docs?: OLSearchDoc[] };
    return (data.docs ?? [])
      .filter((d) => d.title && d.key)
      .map(toResult);
  } catch (err) {
    console.warn("[openlibrary] search failed", err);
    return [];
  }
}

function toResult(d: OLSearchDoc): OLBookResult {
  return {
    source: "openlibrary",
    olKey: d.key,
    title: (d.title ?? "").trim(),
    authors: (d.author_name ?? []).slice(0, 3).join(", "),
    thumbnail: d.cover_i ? `${COVER_BASE}/${d.cover_i}-M.jpg` : "",
    categories: (d.subject ?? []).slice(0, 5).join(", "),
    publishedYear: d.first_publish_year,
    isbn: (d.isbn ?? []).find((s) => s.length === 13) ?? (d.isbn ?? [])[0],
    numPages: d.number_of_pages_median,
    averageRating: d.ratings_average,
    ratingsCount: d.ratings_count,
  };
}

type OLWorkDoc = {
  description?: string | { value?: string };
  subjects?: string[];
};

/**
 * Pulls the long-form description and richer subjects for a work — those
 * aren't included in search docs. We only call this at adoption time so a
 * book search stays fast.
 */
export async function fetchOpenLibraryWork(
  key: string
): Promise<{ description: string; categories: string }> {
  const normalized = key.startsWith("/") ? key : `/${key}`;
  if (!/^\/works\/OL[A-Z0-9]+/.test(normalized)) {
    return { description: "", categories: "" };
  }
  try {
    const res = await fetch(`${WORK_BASE}${normalized}.json`, {
      headers: UA,
      next: { revalidate: 86400 },
    });
    if (!res.ok) return { description: "", categories: "" };
    const data = (await res.json()) as OLWorkDoc;
    const description =
      typeof data.description === "string"
        ? data.description
        : (data.description?.value ?? "");
    return {
      description: cleanDescription(description),
      categories: (data.subjects ?? []).slice(0, 6).join(", "),
    };
  } catch (err) {
    console.warn("[openlibrary] work fetch failed", err);
    return { description: "", categories: "" };
  }
}

function cleanDescription(s: string) {
  // Open Library descriptions sometimes include trailing source attribution.
  return s
    .replace(/\(\[source\]\([^)]+\)\)/g, "")
    .replace(/\[source\][^\n]*$/i, "")
    .trim();
}
