"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  ExternalLink,
  Flame,
  Globe,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { useInfiniteScroll } from "@/lib/hooks/useInfiniteScroll";

type BookRow = {
  id: string;
  slug?: string;
  title: string;
  authors?: string;
  categories?: string;
  thumbnail?: string;
  publishedYear?: number;
  averageRating?: number;
};

type OLResult = {
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

type Category = { label: string; count: number };

type Community = {
  id: string;
  slug: string;
  title: string;
  authors: string;
  thumbnail: string;
  category: string;
  postCount: number;
  commentCount: number;
  engagedUsers: number;
  lastActivityAt: string;
};

const PAGE_SIZE = 24;

export default function ExplorePage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [books, setBooks] = useState<BookRow[]>([]);
  const [olResults, setOlResults] = useState<OLResult[]>([]);
  const [adoptingKey, setAdoptingKey] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [communitiesLoading, setCommunitiesLoading] = useState(true);
  const seqRef = useRef(0);
  const seenRef = useRef<Set<string>>(new Set());
  const prevQRef = useRef(q);
  const prevCategoryRef = useRef(category);

  const fetchBooks = useCallback(
    async ({
      cursor,
      reset,
      qOverride,
      categoryOverride,
    }: {
      cursor?: string | null;
      reset?: boolean;
      qOverride?: string;
      categoryOverride?: string;
    } = {}) => {
      const seq = ++seqRef.current;
      const params = new URLSearchParams();
      const qVal = qOverride ?? q;
      const catVal = categoryOverride ?? category;
      if (qVal.trim()) params.set("q", qVal.trim());
      if (catVal.trim()) params.set("category", catVal.trim());
      params.set("limit", String(PAGE_SIZE));
      if (cursor && !reset) params.set("cursor", cursor);

      if (reset) {
        setInitialLoading(true);
        setBooks([]);
        setNextCursor(null);
        seenRef.current = new Set();
      } else {
        setLoadingMore(true);
      }

      const res = await fetch(`/api/books?${params}`, { cache: "no-store" });
      if (seq !== seqRef.current) return;
      const data = (await res.json().catch(() => ({}))) as {
        books?: BookRow[];
        openLibrary?: OLResult[];
        nextCursor?: string | null;
      };
      const fresh = (data.books ?? []).filter((b) => !seenRef.current.has(b.id));
      fresh.forEach((b) => seenRef.current.add(b.id));
      if (reset) {
        setBooks(fresh);
        setOlResults(data.openLibrary ?? []);
      } else {
        setBooks((prev) => [...prev, ...fresh]);
      }
      setNextCursor(data.nextCursor ?? null);
      if (reset) setInitialLoading(false);
      else setLoadingMore(false);
    },
    [q, category]
  );

  useEffect(() => {
    void fetchBooks({ reset: true });
    void (async () => {
      const res = await fetch("/api/books/categories", { cache: "no-store" });
      if (res.ok) {
        const d = (await res.json()) as { categories?: Category[] };
        setCategories(d.categories ?? []);
      }
    })();
    void (async () => {
      setCommunitiesLoading(true);
      const res = await fetch("/api/books/communities?limit=6", {
        cache: "no-store",
      });
      if (res.ok) {
        const d = (await res.json()) as { communities?: Community[] };
        setCommunities(d.communities ?? []);
      }
      setCommunitiesLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Search as the user types (debounced).
  useEffect(() => {
    if (prevQRef.current === q) return;
    prevQRef.current = q;
    if (q.trim()) setInitialLoading(true);
    const t = setTimeout(() => {
      void fetchBooks({ reset: true });
    }, 280);
    return () => clearTimeout(t);
  }, [q, fetchBooks]);

  // Category chips apply immediately.
  useEffect(() => {
    if (prevCategoryRef.current === category) return;
    prevCategoryRef.current = category;
    void fetchBooks({ reset: true });
  }, [category, fetchBooks]);

  function submitSearch(e?: FormEvent) {
    e?.preventDefault();
    void fetchBooks({ reset: true });
  }

  function clearFilters() {
    setQ("");
    setCategory("");
    prevQRef.current = "";
    prevCategoryRef.current = "";
    void fetchBooks({ reset: true, qOverride: "", categoryOverride: "" });
  }

  /**
   * Adopt an Open Library result into our database, then navigate to it.
   * Idempotent: if a sibling adopted the same book a moment ago we land on
   * the existing one instead of duplicating.
   */
  async function adoptAndOpen(result: OLResult) {
    if (adoptingKey) return;
    setAdoptingKey(result.olKey);
    try {
      const res = await fetch("/api/books/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          olKey: result.olKey,
          title: result.title,
          authors: result.authors,
          thumbnail: result.thumbnail,
          categories: result.categories,
          publishedYear: result.publishedYear,
          isbn: result.isbn,
          numPages: result.numPages,
          averageRating: result.averageRating,
          ratingsCount: result.ratingsCount,
        }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        setAdoptingKey(null);
        return;
      }
      const data = (await res.json()) as {
        book: { id: string; slug: string };
      };
      router.push(`/book/${data.book.slug || data.book.id}`);
    } catch {
      setAdoptingKey(null);
    }
  }

  const loadMore = useCallback(() => {
    if (!nextCursor || loadingMore || initialLoading) return;
    void fetchBooks({ cursor: nextCursor });
  }, [nextCursor, loadingMore, initialLoading, fetchBooks]);

  const sentinelRef = useInfiniteScroll({
    onLoadMore: loadMore,
    hasMore: Boolean(nextCursor),
    loading: loadingMore || initialLoading,
  });

  const triggerIndex = useMemo(
    () => Math.max(0, books.length - 5),
    [books.length]
  );

  const featuredCategories = categories.slice(0, 12);
  const isSearching = q.trim().length > 0 || category.trim().length > 0;

  // The "results" block — books grid, OL fallback, and the section header.
  // We render it conditionally at one of two positions depending on whether
  // the user is actively searching, without duplicating the JSX.
  const resultsSection = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <p className="text-sm font-semibold text-foreground">
          {category
            ? `Books in ${category}`
            : q
              ? `Results for “${q}”`
              : "Everything"}
        </p>
        <button
          type="button"
          onClick={() => setOpenCreate((v) => !v)}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold shadow-[var(--shadow-soft)] hover:bg-hover"
        >
          <Plus size={14} aria-hidden />
          Add a book
        </button>
      </div>

      {openCreate ? (
        <NewBookInline onDone={() => setOpenCreate(false)} />
      ) : null}

      <div>
        {initialLoading ? (
          <BookGridSkeleton />
        ) : books.length === 0 && olResults.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border p-10 text-center">
            <Sparkles size={20} aria-hidden className="mx-auto text-muted" />
            <p className="mt-3 text-base font-semibold">No matches</p>
            <p className="mt-1 text-sm text-muted">
              Try a different word — or be the first to add it.
            </p>
            <button
              type="button"
              onClick={() => setOpenCreate(true)}
              className="mt-4 inline-flex rounded-full px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-pop)]"
              style={{ background: "var(--gradient-brand)" }}
            >
              Add a book
            </button>
          </div>
        ) : (
          <>
            {books.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                {books.map((b, i) => (
                  <div
                    key={b.id}
                    ref={i === triggerIndex ? sentinelRef : undefined}
                    className="animate-fade"
                    style={{ animationDelay: `${Math.min(i * 25, 200)}ms` }}
                  >
                    <BookCard
                      book={b}
                      onOpen={() => router.push(`/book/${b.slug || b.id}`)}
                    />
                  </div>
                ))}
              </div>
            ) : null}
            {nextCursor ? <BookGridSkeleton small /> : null}
          </>
        )}
      </div>

      {olResults.length > 0 ? (
        <OpenLibrarySection
          q={q}
          results={olResults}
          adoptingKey={adoptingKey}
          hasLocal={books.length > 0}
          onAdopt={(r) => void adoptAndOpen(r)}
        />
      ) : null}
    </>
  );

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-2 pb-12 sm:px-4">
      <header
        className="relative overflow-hidden rounded-[28px] border border-border bg-card p-6 shadow-[var(--shadow-soft)] sm:p-8"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full blur-3xl opacity-50"
          style={{ background: "var(--gradient-brand)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-16 bottom-0 h-48 w-48 rounded-full blur-3xl opacity-40"
          style={{ background: "var(--gradient-warm)" }}
        />
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
          discover
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-[34px]">
          Explore <span className="gradient-brand-text">stories</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted sm:text-[15px]">
          Search by title, author, or vibe. Follow books to make Home feel
          personal.
        </p>

        <form onSubmit={submitSearch} className="relative mt-6 max-w-2xl">
          <Search
            size={18}
            aria-hidden
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            value={q}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
            placeholder="Search titles, authors, themes…"
            aria-label="Search"
            className="w-full rounded-full border border-border bg-background py-3.5 pl-12 pr-10 text-[15px] shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
          />
          {initialLoading && q.trim() ? (
            <span
              aria-hidden
              className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2"
            >
              <RefreshCw size={16} className="animate-spin text-muted" />
            </span>
          ) : null}
        </form>

        {category ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted">Filtering:</span>
            <span
              className="inline-flex items-center gap-2 rounded-full bg-pill px-3 py-1 font-semibold"
            >
              {category}
              <button
                type="button"
                onClick={clearFilters}
                aria-label="Clear filter"
                className="rounded-full p-0.5 hover:bg-hover"
              >
                <X size={12} />
              </button>
            </span>
          </div>
        ) : null}
      </header>

      {/* When the user is searching or has a category active, results jump
          to the top — communities + shelves slide below so the user doesn't
          have to scroll past discovery content to see what they asked for. */}
      {isSearching ? resultsSection : null}

      <CommunitiesPanel
        communities={communities}
        loading={communitiesLoading}
        onOpen={(c) => router.push(`/book/${c.slug || c.id}`)}
      />

      {featuredCategories.length ? (
        <section aria-label="Categories" className="-mx-2 px-2 sm:mx-0 sm:px-0">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Shelves
            </h2>
            {category ? (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-semibold text-muted hover:text-foreground"
              >
                Clear
              </button>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {featuredCategories.map((c, i) => {
              const active = category.toLowerCase() === c.label.toLowerCase();
              const palette = [
                "var(--brand-1)",
                "var(--brand-2)",
                "var(--brand-3)",
                "var(--brand-coral)",
                "var(--brand-amber)",
                "var(--brand-mint)",
              ];
              const accent = palette[i % palette.length];
              return (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => {
                    const next = active ? "" : c.label;
                    setCategory(next);
                  }}
                  className={`group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "border-transparent text-white"
                      : "border-border bg-card text-foreground/85 hover:bg-hover"
                  }`}
                  style={
                    active
                      ? { background: accent, boxShadow: "var(--shadow-soft)" }
                      : undefined
                  }
                  aria-pressed={active}
                >
                  <span
                    aria-hidden
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: active ? "rgba(255,255,255,0.85)" : accent }}
                  />
                  {c.label}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {!isSearching ? resultsSection : null}
    </section>
  );
}

function OpenLibrarySection({
  q,
  results,
  adoptingKey,
  hasLocal,
  onAdopt,
}: {
  q: string;
  results: OLResult[];
  adoptingKey: string | null;
  hasLocal: boolean;
  onAdopt: (r: OLResult) => void;
}) {
  return (
    <section
      aria-label="Found on Open Library"
      className="rounded-[28px] border border-dashed border-border bg-card/60 p-5 shadow-[var(--shadow-soft)] sm:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            <Globe
              size={13}
              aria-hidden
              className="text-emerald-500 dark:text-emerald-300"
            />
            From Open Library
          </p>
          <h2 className="mt-1 text-base font-semibold sm:text-lg">
            {hasLocal
              ? "Looking for something else?"
              : `Books matching "${q}"`}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Not yet in Readquest. Tap one to pull it into our library and open
            its book room — we&apos;ll save the title, cover, and details for
            everyone.
          </p>
        </div>
        <a
          href="https://openlibrary.org"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-semibold text-muted hover:bg-hover"
        >
          openlibrary.org
          <ExternalLink size={11} aria-hidden />
        </a>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {results.map((r) => (
          <OpenLibraryCard
            key={r.olKey}
            result={r}
            adopting={adoptingKey === r.olKey}
            disabled={!!adoptingKey && adoptingKey !== r.olKey}
            onOpen={() => onAdopt(r)}
          />
        ))}
      </div>
    </section>
  );
}

function OpenLibraryCard({
  result,
  adopting,
  disabled,
  onOpen,
}: {
  result: OLResult;
  adopting: boolean;
  disabled: boolean;
  onOpen: () => void;
}) {
  const author = result.authors.split(/[,;]/)[0]?.trim() ?? "";
  const primaryCat = result.categories.split(/[,;]/)[0]?.trim() ?? "";

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled || adopting}
      className="group relative flex flex-col overflow-hidden rounded-[22px] border border-border bg-card text-left shadow-[var(--shadow-soft)] outline-none transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-emerald-400/70 disabled:opacity-60"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-pill">
        {result.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={result.thumbnail.replace(/^http:/, "https:")}
            alt=""
            className="h-full w-full object-cover transition group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center p-4 text-center text-sm font-bold text-white"
            style={{ background: "var(--gradient-cool)" }}
          >
            {result.title}
          </div>
        )}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/95 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
          <Globe size={10} aria-hidden /> Open Library
        </span>
        {primaryCat ? (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold text-foreground/80 shadow">
            {primaryCat.length > 16 ? `${primaryCat.slice(0, 16)}…` : primaryCat}
          </span>
        ) : null}
        {adopting ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
            <RefreshCw size={20} aria-hidden className="animate-spin" />
          </div>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 text-[14px] font-semibold leading-snug">
          {result.title}
        </p>
        {author ? (
          <p className="line-clamp-1 text-[12px] text-muted">{author}</p>
        ) : null}
        <div className="mt-auto flex items-center gap-2 pt-2 text-[11px] text-muted">
          {result.publishedYear ? <span>{result.publishedYear}</span> : null}
          {result.averageRating ? (
            <span className="inline-flex items-center gap-1">
              <span aria-hidden>★</span>
              {result.averageRating.toFixed(1)}
            </span>
          ) : null}
          <span className="ml-auto inline-flex items-center gap-0.5 font-semibold text-emerald-600 dark:text-emerald-300">
            {adopting ? "Adding…" : "Open"}
            <ExternalLink size={10} aria-hidden />
          </span>
        </div>
      </div>
    </button>
  );
}

function CommunitiesPanel({
  communities,
  loading,
  onOpen,
}: {
  communities: Community[];
  loading: boolean;
  onOpen: (c: Community) => void;
}) {
  if (loading) {
    return (
      <section aria-label="Active book communities">
        <PanelHeader />
        <div className="-mx-2 mt-3 flex gap-3 overflow-x-auto px-2 pb-2 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="min-w-[260px] shrink-0 rounded-2xl border border-border bg-card p-3 sm:min-w-0"
            >
              <div className="flex gap-3">
                <div className="h-[78px] w-[54px] shrink-0 rounded-lg skeleton-shimmer" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-3/4 rounded skeleton-shimmer" />
                  <div className="h-3 w-1/2 rounded skeleton-shimmer" />
                  <div className="h-3 w-2/3 rounded skeleton-shimmer" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!communities.length) return null;

  return (
    <section aria-label="Active book communities">
      <PanelHeader />
      <div className="-mx-2 mt-3 flex gap-3 overflow-x-auto px-2 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
        {communities.map((c, i) => (
          <CommunityCard
            key={c.id}
            community={c}
            rank={i + 1}
            onOpen={() => onOpen(c)}
          />
        ))}
      </div>
    </section>
  );
}

function PanelHeader() {
  return (
    <div className="flex items-end justify-between gap-3 px-1">
      <div>
        <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          <Flame
            size={13}
            aria-hidden
            className="text-amber-500 dark:text-amber-300"
          />
          Active book communities
        </p>
        <h2 className="mt-1 text-base font-semibold sm:text-lg">
          Where readers are talking right now
        </h2>
      </div>
    </div>
  );
}

function rankAccent(rank: number): string {
  if (rank === 1) return "var(--brand-amber)";
  if (rank === 2) return "var(--brand-2)";
  if (rank === 3) return "var(--brand-coral)";
  if (rank === 4) return "var(--brand-mint)";
  if (rank === 5) return "var(--brand-3)";
  return "var(--brand-1)";
}

function CommunityCard({
  community,
  rank,
  onOpen,
}: {
  community: Community;
  rank: number;
  onOpen: () => void;
}) {
  const author = community.authors?.split(/[,;]/)[0]?.trim() ?? "";
  const accent = rankAccent(rank);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative flex min-w-[260px] shrink-0 items-stretch gap-3 overflow-hidden rounded-2xl border border-border bg-card p-3 text-left shadow-[var(--shadow-soft)] outline-none transition hover:-translate-y-0.5 hover:border-border hover:shadow-lg focus-visible:ring-2 focus-visible:ring-sky-400/70 sm:min-w-0"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-0.5"
        style={{ background: accent }}
      />
      <div className="relative h-[78px] w-[54px] shrink-0 overflow-hidden rounded-lg bg-pill ring-1 ring-border/60">
        {community.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={community.thumbnail.replace(/^http:/, "https:")}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.05]"
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center p-1 text-center text-[10px] font-bold text-white"
            style={{ background: "var(--gradient-brand)" }}
          >
            {community.title.slice(0, 18)}
          </div>
        )}
        <span
          aria-hidden
          className="absolute -top-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-white shadow"
          style={{ background: accent }}
        >
          {rank}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <p className="line-clamp-2 text-[13.5px] font-semibold leading-snug">
          {community.title}
        </p>
        {author ? (
          <p className="mt-0.5 line-clamp-1 text-[11px] text-muted">
            by {author}
          </p>
        ) : null}
        {community.category ? (
          <p className="mt-0.5 line-clamp-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
            {community.category}
          </p>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-2 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1 rounded-full bg-pill px-1.5 py-0.5 font-semibold text-foreground/85">
            <MessageSquare size={11} aria-hidden />
            <span className="tabular-nums">{community.postCount}</span>
            <span>posts</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-pill px-1.5 py-0.5 font-semibold text-foreground/85">
            <Users size={11} aria-hidden />
            <span className="tabular-nums">{community.engagedUsers}</span>
            <span>{community.engagedUsers === 1 ? "reader" : "readers"}</span>
          </span>
        </div>
      </div>
    </button>
  );
}

function BookCard({ book, onOpen }: { book: BookRow; onOpen: () => void }) {
  const author = book.authors?.split(";")[0].slice(0, 40);
  const primaryCat = book.categories?.split(",")[0]?.trim();
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex h-full w-full flex-col overflow-hidden rounded-[22px] border border-border bg-card text-left shadow-[var(--shadow-soft)] outline-none transition hover:-translate-y-1 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-sky-400/70"
    >
      <div className="relative w-full overflow-hidden bg-pill aspect-[2/3]">
        {book.thumbnail ? (
          <Image
            src={book.thumbnail.replace(/^http:/, "https:")}
            alt=""
            fill
            className="object-cover transition group-hover:scale-[1.03]"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 220px"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center p-4 text-center text-base font-bold text-white"
            style={{ background: "var(--gradient-brand)" }}
          >
            {book.title}
          </div>
        )}
        {primaryCat ? (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold text-foreground/80 shadow">
            {primaryCat}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 text-[14px] font-semibold leading-snug">
          {book.title}
        </p>
        {author ? (
          <p className="line-clamp-1 text-[12px] text-muted">{author}</p>
        ) : null}
        <div className="mt-auto flex items-center gap-2 pt-2 text-[11px] text-muted">
          {book.publishedYear ? <span>{book.publishedYear}</span> : null}
          {book.averageRating ? (
            <span className="inline-flex items-center gap-1">
              <span aria-hidden>★</span>
              {book.averageRating.toFixed(1)}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function BookGridSkeleton({ small = false }: { small?: boolean }) {
  const count = small ? 4 : 8;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-[22px] border border-border bg-card"
        >
          <div className="aspect-[2/3] skeleton-shimmer" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-3/4 rounded skeleton-shimmer" />
            <div className="h-3 w-1/2 rounded skeleton-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}

function NewBookInline({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [cats, setCats] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [alert, setAlert] = useState<{
    type: "error" | "success";
    message: string;
    existingBookId?: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setAlert(null);
    setSaving(true);
    const res = await fetch("/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        authors,
        categories: cats,
        description,
        thumbnail: thumbnail.trim() || undefined,
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { book: { id: string; slug?: string } };
      onDone();
      window.location.href = `/book/${data.book.slug || data.book.id}`;
      return;
    }
    if (res.status === 401) {
      setAlert({ type: "error", message: "Sign in to add a book." });
    } else if (res.status === 409) {
      const data = (await res.json()) as {
        error?: string;
        existingBookId?: string;
      };
      setAlert({
        type: "error",
        message:
          data.error ?? "A book with this title and author already exists.",
        existingBookId: data.existingBookId,
      });
    } else if (res.status === 400) {
      const data = (await res.json()) as Record<string, string[] | undefined>;
      setAlert({
        type: "error",
        message: data.thumbnail?.[0] ?? "Check the form fields and try again.",
      });
    } else {
      setAlert({ type: "error", message: "Something went wrong. Try again." });
    }
    setSaving(false);
  }

  return (
    <div
      className="rounded-[28px] border border-border bg-card p-5 shadow-[var(--shadow-soft)] sm:p-6"
    >
      {saving ? <LoadingIndicator label="Saving book…" /> : null}
      <form
        onSubmit={(e) => void submit(e)}
        className={`grid gap-4 sm:grid-cols-2 ${saving ? "pointer-events-none opacity-40" : ""}`}
      >
        <div className="sm:col-span-2 flex items-center justify-between">
          <p className="text-base font-semibold">Add a new book</p>
          <button
            type="button"
            onClick={onDone}
            className="rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-hover"
          >
            Close
          </button>
        </div>

        <FormField label="Title">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputCls}
            placeholder="e.g. Pachinko"
          />
        </FormField>
        <FormField label="Author(s)">
          <input
            value={authors}
            onChange={(e) => setAuthors(e.target.value)}
            className={inputCls}
            placeholder="e.g. Min Jin Lee"
          />
        </FormField>
        <FormField label="Categories (comma separated)">
          <input
            value={cats}
            onChange={(e) => setCats(e.target.value)}
            className={inputCls}
            placeholder="Fiction, Historical"
          />
        </FormField>
        <FormField label="Cover image URL (optional)">
          <input
            type="url"
            value={thumbnail}
            onChange={(e) => setThumbnail(e.target.value)}
            className={inputCls}
            placeholder="https://…"
          />
        </FormField>
        <FormField label="Synopsis" wide>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`${inputCls} resize-y`}
            placeholder="What is it about? Why does it matter?"
          />
        </FormField>

        {alert ? (
          <div
            role="alert"
            className="sm:col-span-2 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs font-medium text-red-700 dark:text-red-300"
          >
            <p>{alert.message}</p>
            {alert.existingBookId ? (
              <Link
                href={`/book/${alert.existingBookId}`}
                className="mt-2 inline-block font-semibold underline"
              >
                View existing book
              </Link>
            ) : null}
          </div>
        ) : null}

        <div className="sm:col-span-2 flex flex-wrap gap-3">
          <button
            type="submit"
            className="rounded-full px-5 py-2 text-sm font-semibold text-white shadow-[var(--shadow-pop)]"
            style={{ background: "var(--gradient-brand)" }}
          >
            Save book
          </button>
          <button
            type="button"
            onClick={onDone}
            className="rounded-full border border-border px-5 py-2 text-sm font-semibold hover:bg-hover"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70";

function FormField({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block space-y-1 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
