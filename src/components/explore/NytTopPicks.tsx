"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Newspaper, RefreshCw } from "lucide-react";
import type { NytBook, NytList } from "@/lib/nyt";

/**
 * "NYT top books" — a compact, ranked, *scrollable* list of the headline NYT
 * bestsellers that sits beside the Daily Quest and stretches to match its
 * height (the inner list scrolls so the card never grows taller than the quest).
 *
 * It pulls the full (~15 book) flagship list so the scroller has something to
 * scroll, and falls back to the cached overview's top 5 if that call fails.
 * Covers are hidden on portrait/mobile so the card fits next to the quest.
 * Tapping a row adopts the book and opens its book room.
 */

const FLAGSHIP = "combined-print-and-e-book-fiction";

export function NytTopPicks() {
  const router = useRouter();
  const [books, setBooks] = useState<NytBook[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [adoptingId, setAdoptingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        let list: NytList | null = null;
        const res = await fetch(`/api/nyt/list?name=${FLAGSHIP}`);
        if (res.ok) {
          const d = (await res.json().catch(() => ({}))) as { list?: NytList };
          list = d.list ?? null;
        }
        if (!list) {
          const ov = await fetch("/api/nyt/overview");
          const d = (await ov.json().catch(() => ({}))) as {
            lists?: NytList[];
          };
          const lists = d.lists ?? [];
          list =
            lists.find((l) => l.encodedName === FLAGSHIP) ?? lists[0] ?? null;
        }
        if (cancelled) return;
        if (!list?.books.length) {
          setFailed(true);
        } else {
          setBooks(list.books);
          setDisplayName(list.displayName);
        }
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function adopt(book: NytBook) {
    if (adoptingId) return;
    const id = book.isbn13 || book.isbn10 || book.title;
    setAdoptingId(id);
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
          category: displayName,
        }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        setAdoptingId(null);
        return;
      }
      const data = (await res.json()) as { book: { id: string; slug: string } };
      router.push(`/book/${data.book.slug || data.book.id}`);
    } catch {
      setAdoptingId(null);
    }
  }

  if (failed) return null;

  return (
    <section
      aria-label="NYT top books"
      className="relative flex h-full min-h-[13rem] flex-col overflow-hidden layout-wide:min-h-[18rem]"
    >
      <div className="flex shrink-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted sm:text-[11px] sm:tracking-[0.18em]">
            <Newspaper
              size={12}
              aria-hidden
              className="text-rose-500 dark:text-rose-300"
            />
            Bestsellers
          </p>
          <h2 className="mt-0.5 truncate text-[15px] font-bold leading-snug sm:text-base">
            Top 5 Today
          </h2>
        </div>
        <a
          href="https://www.nytimes.com/books/best-sellers/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View on nytimes.com"
          className="hidden shrink-0 items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-semibold text-muted hover:bg-hover sm:inline-flex"
        >
          NYT
          <ExternalLink size={10} aria-hidden />
        </a>
      </div>

      <div className="relative mt-2 min-h-0 flex-1 sm:mt-3">
        {loading ? (
          <TopPicksSkeleton />
        ) : (
          <ol className="absolute inset-0 divide-y divide-border/60 overflow-y-auto overscroll-contain pr-0.5 [scrollbar-width:thin]">
            {books.slice(0, 5).map((b) => {
              const id = b.isbn13 || b.isbn10 || b.title;
              const author = b.author
                .replace(/^by\s+/i, "")
                .split(/\s+and\s+/i)[0];
              const adopting = adoptingId === id;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => void adopt(b)}
                    disabled={!!adoptingId}
                    className="group flex w-full items-center gap-2 py-2 text-left outline-none transition hover:bg-foreground/[0.03] focus-visible:bg-foreground/[0.04] disabled:opacity-60 sm:gap-3"
                  >
                    <span
                      className="flex w-4 shrink-0 items-center justify-center text-center text-[15px] font-black tabular-nums text-rose-500/90 dark:text-rose-300/90 sm:w-5 sm:text-lg"
                      aria-hidden
                    >
                      {adopting ? (
                        <RefreshCw size={13} className="animate-spin" />
                      ) : (
                        b.rank
                      )}
                    </span>
                    <span className="relative hidden h-14 w-10 shrink-0 overflow-hidden rounded-md bg-pill ring-1 ring-border/60 layout-wide:block">
                      {b.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={b.thumbnail}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span
                          className="flex h-full w-full items-center justify-center p-1 text-center text-[8px] font-bold text-white"
                          style={{ background: "var(--gradient-warm)" }}
                        >
                          {b.title.slice(0, 12)}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-[12px] font-semibold leading-snug group-hover:underline underline-offset-2 sm:text-[13px]">
                        {b.title}
                      </span>
                      {author ? (
                        <span className="mt-0.5 line-clamp-1 text-[10.5px] text-muted sm:text-[11.5px]">
                          {author}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}

function TopPicksSkeleton() {
  return (
    <div className="absolute inset-0 divide-y divide-border/60 overflow-hidden">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-center gap-2 py-2 sm:gap-3">
          <div className="h-4 w-4 rounded skeleton-shimmer sm:w-5" />
          <div className="hidden h-14 w-10 shrink-0 rounded-md skeleton-shimmer layout-wide:block" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-3/4 rounded skeleton-shimmer" />
            <div className="h-3 w-1/2 rounded skeleton-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}
