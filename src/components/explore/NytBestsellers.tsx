"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookText,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Newspaper,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import type { NytBook, NytList, NytListName } from "@/lib/nyt";

/**
 * "From The New York Times" — bestseller recommendations on Home.
 *
 * One `/api/nyt/overview` call supplies the top 5 books for every list (so tab
 * switching is instant and cheap), `/api/nyt/names` orders + labels the tabs,
 * and "See full list" lazily pulls the full ~15-book list for a category.
 * Tapping a book adopts it into the TGC library and opens its book room.
 */

type ListLite = Pick<NytList, "encodedName" | "displayName" | "books">;

// Surface the lists readers care about most, in a sensible order. Anything not
// listed here falls in afterwards, alphabetically.
const PRIORITY: string[] = [
  "combined-print-and-e-book-fiction",
  "combined-print-and-e-book-nonfiction",
  "hardcover-fiction",
  "hardcover-nonfiction",
  "young-adult-hardcover",
  "childrens-middle-grade-hardcover",
  "paperback-trade-fiction",
  "advice-how-to-and-miscellaneous",
];

export function NytBestsellers() {
  const router = useRouter();
  const [lists, setLists] = useState<Record<string, ListLite>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [active, setActive] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [adoptingIsbn, setAdoptingIsbn] = useState<string | null>(null);
  const [fullLists, setFullLists] = useState<Record<string, NytBook[]>>({});
  const [expanding, setExpanding] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState({ left: false, right: false });

  /** Keep the arrow buttons in sync with the rail's scroll position. */
  const updateScrollState = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    setCanScroll({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);

  const nudge = useCallback((dir: -1 | 1) => {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({
      left: dir * Math.round(el.clientWidth * 0.85),
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [ovRes, nameRes] = await Promise.all([
          fetch("/api/nyt/overview"),
          fetch("/api/nyt/names"),
        ]);
        const ov = (await ovRes.json().catch(() => ({}))) as {
          lists?: NytList[];
        };
        const nm = (await nameRes.json().catch(() => ({}))) as {
          names?: NytListName[];
        };
        if (cancelled) return;

        const map: Record<string, ListLite> = {};
        for (const l of ov.lists ?? []) {
          if (l.encodedName && l.books.length) {
            map[l.encodedName] = {
              encodedName: l.encodedName,
              displayName: l.displayName,
              books: l.books,
            };
          }
        }

        const present = Object.keys(map);
        if (present.length === 0) {
          setFailed(true);
          setLoading(false);
          return;
        }

        // Order tabs: names API order first (priority pinned), then leftovers.
        const namedOrder = (nm.names ?? [])
          .map((n) => n.encodedName)
          .filter((e) => map[e]);
        const ranked = [...new Set([...present])].sort((a, b) => {
          const pa = PRIORITY.indexOf(a);
          const pb = PRIORITY.indexOf(b);
          if (pa !== -1 || pb !== -1) {
            return (pa === -1 ? 999 : pa) - (pb === -1 ? 999 : pb);
          }
          const ia = namedOrder.indexOf(a);
          const ib = namedOrder.indexOf(b);
          if (ia !== ib) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
          return map[a].displayName.localeCompare(map[b].displayName);
        });

        setLists(map);
        setOrder(ranked);
        setActive(ranked[0] ?? "");
        setLoading(false);
      } catch {
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeList = active ? lists[active] : undefined;

  const books = useMemo(() => {
    if (!active) return [];
    return showAll && fullLists[active] ? fullLists[active] : activeList?.books ?? [];
  }, [active, showAll, fullLists, activeList]);

  // Re-measure whenever the rail's content or the viewport changes.
  useEffect(() => {
    updateScrollState();
    window.addEventListener("resize", updateScrollState);
    return () => window.removeEventListener("resize", updateScrollState);
  }, [books, loading, updateScrollState]);

  function selectTab(encoded: string) {
    setActive(encoded);
    setShowAll(false);
    railRef.current?.scrollTo({ left: 0, behavior: "smooth" });
  }

  const expand = useCallback(async () => {
    if (!active) return;
    if (fullLists[active]) {
      setShowAll(true);
      return;
    }
    setExpanding(true);
    try {
      const res = await fetch(`/api/nyt/list?name=${encodeURIComponent(active)}`);
      const data = (await res.json().catch(() => ({}))) as { list?: NytList };
      if (data.list?.books?.length) {
        setFullLists((prev) => ({ ...prev, [active]: data.list!.books }));
        setShowAll(true);
      }
    } finally {
      setExpanding(false);
    }
  }, [active, fullLists]);

  async function adopt(book: NytBook) {
    if (adoptingIsbn) return;
    const id = book.isbn13 || book.isbn10 || book.title;
    setAdoptingIsbn(id);
    try {
      const res = await fetch("/api/books/import/nyt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: book.title,
          author: book.author,
          description: book.description,
          isbn13: book.isbn13,
          isbn10: book.isbn10,
          thumbnail: book.thumbnail,
          publisher: book.publisher,
          category: activeList?.displayName ?? "",
        }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        setAdoptingIsbn(null);
        return;
      }
      const data = (await res.json()) as { book: { id: string; slug: string } };
      router.push(`/book/${data.book.slug || data.book.id}`);
    } catch {
      setAdoptingIsbn(null);
    }
  }

  if (failed) return null;

  return (
    <section aria-label="New York Times bestsellers">
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            <Newspaper
              size={13}
              aria-hidden
              className="text-rose-500 dark:text-rose-300"
            />
            From The New York Times
          </p>
          <h2 className="mt-1 text-base font-semibold sm:text-lg">
            This week&apos;s bestsellers
          </h2>
        </div>
        <a
          href="https://www.nytimes.com/books/best-sellers/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-semibold text-muted hover:bg-hover"
        >
          NYT
          <ExternalLink size={11} aria-hidden />
        </a>
      </div>

      {loading ? (
        <NytSkeleton />
      ) : (
        <>
          {/* Category tabs */}
          <div className="-mx-2 mt-3 flex gap-2 overflow-x-auto px-2 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
            {order.map((encoded) => {
              const isActive = encoded === active;
              return (
                <button
                  key={encoded}
                  type="button"
                  onClick={() => selectTab(encoded)}
                  aria-pressed={isActive}
                  className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                    isActive
                      ? "border-transparent text-white shadow-[var(--shadow-soft)]"
                      : "border-border bg-card text-foreground/80 hover:bg-hover"
                  }`}
                  style={
                    isActive
                      ? { background: "var(--gradient-brand)" }
                      : undefined
                  }
                >
                  {lists[encoded]?.displayName ?? encoded}
                </button>
              );
            })}
          </div>

          {/* Book rail — streaming-app style: soft gradient fades melt the
              clipped cards into the page at each scrollable edge, and the
              paddles glide in over them when the pointer is on the rail.
              Pointer/desktop only; phones keep the plain swipe rail. */}
          <div className="group/rail relative mt-3">
            <div
              ref={railRef}
              onScroll={updateScrollState}
              className="-mx-2 flex gap-3 overflow-x-auto px-2 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0"
            >
              {books.map((b) => {
                const id = b.isbn13 || b.isbn10 || b.title;
                return (
                  <NytBookCard
                    key={id}
                    book={b}
                    adopting={adoptingIsbn === id}
                    disabled={!!adoptingIsbn && adoptingIsbn !== id}
                    onOpen={() => void adopt(b)}
                  />
                );
              })}
            </div>

            <RailEdgeFade side="left" visible={canScroll.left} />
            <RailEdgeFade side="right" visible={canScroll.right} />
            <RailPaddle
              side="left"
              visible={canScroll.left}
              onClick={() => nudge(-1)}
            />
            <RailPaddle
              side="right"
              visible={canScroll.right}
              onClick={() => nudge(1)}
            />
          </div>

          {/* See full list */}
          {!showAll && activeList ? (
            <div className="mt-1 px-1">
              <button
                type="button"
                onClick={() => void expand()}
                disabled={expanding}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-hover disabled:opacity-60"
              >
                {expanding ? (
                  <RefreshCw size={13} aria-hidden className="animate-spin" />
                ) : (
                  <TrendingUp size={13} aria-hidden />
                )}
                See the full list
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

/**
 * Soft gradient veil at a scrollable edge of the rail: melts the clipped
 * cards into the page background (instead of a hard cut) and doubles as the
 * "there's more this way" hint. Fades away at the ends of the rail.
 */
function RailEdgeFade({
  side,
  visible,
}: {
  side: "left" | "right";
  visible: boolean;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-y-0 z-[5] hidden w-14 transition-opacity duration-500 sm:block ${
        side === "left" ? "left-0" : "right-0"
      } ${visible ? "opacity-100" : "opacity-0"}`}
      style={{
        background: `linear-gradient(to ${side === "left" ? "right" : "left"}, var(--bg) 8%, color-mix(in srgb, var(--bg) 55%, transparent) 55%, transparent)`,
      }}
    />
  );
}

/**
 * Edge paddle for the book rail. Stays out of the way until the pointer is
 * over the rail, then glides in from its edge; presses feel springy via
 * scale micro-interactions. Hidden entirely on touch-first (compact) sizes
 * where swiping is the natural gesture, and fades out (with the edge veil)
 * when the rail can't scroll further that way.
 */
function RailPaddle({
  side,
  visible,
  onClick,
}: {
  side: "left" | "right";
  visible: boolean;
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  const slideAway = side === "left" ? "-translate-x-2" : "translate-x-2";
  return (
    <button
      type="button"
      aria-label={side === "left" ? "Scroll back" : "Scroll forward"}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      onClick={onClick}
      className={`absolute top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-card/95 text-foreground/85 shadow-[0_6px_24px_-6px_rgba(15,23,42,0.35)] ring-1 ring-border/60 backdrop-blur-md transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] hover:scale-110 hover:text-foreground hover:shadow-[0_10px_30px_-6px_rgba(14,165,233,0.35)] hover:ring-[color-mix(in_srgb,var(--brand-1)_45%,var(--border))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/80 active:scale-90 active:duration-100 sm:flex ${
        side === "left" ? "left-1.5" : "right-1.5"
      } ${
        visible
          ? `opacity-0 group-hover/rail:translate-x-0 group-hover/rail:opacity-100 focus-visible:translate-x-0 focus-visible:opacity-100 ${slideAway} group-hover/rail:[transition-delay:40ms]`
          : `pointer-events-none opacity-0 ${slideAway}`
      }`}
    >
      <Icon
        size={17}
        aria-hidden
        strokeWidth={2.4}
        className={`transition-transform duration-300 ${
          side === "left"
            ? "group-hover/rail:-translate-x-px"
            : "group-hover/rail:translate-x-px"
        }`}
      />
    </button>
  );
}

function NytBookCard({
  book,
  adopting,
  disabled,
  onOpen,
}: {
  book: NytBook;
  adopting: boolean;
  disabled: boolean;
  onOpen: () => void;
}) {
  const author = book.author.replace(/^by\s+/i, "").split(/\s+and\s+/i)[0];

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled || adopting}
      className="group relative flex w-[150px] shrink-0 flex-col overflow-hidden rounded-[22px] border border-border bg-card text-left shadow-[var(--shadow-soft)] outline-none transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-rose-400/70 disabled:opacity-60 sm:w-[160px]"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-pill">
        {book.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={book.thumbnail}
            alt=""
            className="h-full w-full object-cover transition group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center p-3 text-center text-xs font-bold text-white"
            style={{ background: "var(--gradient-warm)" }}
          >
            {book.title}
          </div>
        )}
        <span className="absolute left-2 top-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-rose-500/95 px-1.5 text-[11px] font-black text-white shadow">
          #{book.rank}
        </span>
        {book.weeksOnList > 0 ? (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold text-foreground/80 shadow">
            {book.weeksOnList}w
          </span>
        ) : null}
        {adopting ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
            <RefreshCw size={20} aria-hidden className="animate-spin" />
          </div>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 text-[13.5px] font-semibold leading-snug">
          {book.title}
        </p>
        {author ? (
          <p className="line-clamp-1 text-[11.5px] text-muted">{author}</p>
        ) : null}
        <span className="mt-auto inline-flex items-center gap-1 pt-2 text-[11px] font-semibold text-rose-600 dark:text-rose-300">
          {adopting ? (
            "Adding…"
          ) : (
            <>
              <BookText size={11} aria-hidden /> Open
            </>
          )}
        </span>
      </div>
    </button>
  );
}

function NytSkeleton() {
  return (
    <>
      <div className="-mx-2 mt-3 flex gap-2 px-2 sm:mx-0 sm:px-0">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="h-7 w-28 shrink-0 rounded-full skeleton-shimmer"
          />
        ))}
      </div>
      <div className="-mx-2 mt-3 flex gap-3 px-2 sm:mx-0 sm:px-0">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="w-[150px] shrink-0 overflow-hidden rounded-[22px] border border-border bg-card sm:w-[160px]"
          >
            <div className="aspect-[2/3] skeleton-shimmer" />
            <div className="space-y-2 p-3">
              <div className="h-3 w-3/4 rounded skeleton-shimmer" />
              <div className="h-3 w-1/2 rounded skeleton-shimmer" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
