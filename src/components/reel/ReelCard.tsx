"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import Link from "next/link";
import {
  Bookmark,
  BookmarkPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUp,
  Loader2,
  Share2,
  Star,
} from "lucide-react";
import {
  packBlocksIntoPages,
  parseMarkdown,
  prepareBlocksForPagination,
  renderBlock,
  samePagination,
  type MdBlock,
} from "@/components/reader/markdown";
import { trackMemorySaved } from "@/lib/analytics-events";
import type { ReelCard as ReelCardData } from "@/lib/reel";
import {
  invokeGistShare,
  littleSynopsis,
  prepareGistShare,
  type PreparedGistShare,
} from "@/lib/share-gist";

/** Horizontal swipe past this many pixels turns the page. */
const PAGE_SWIPE_PX = 48;

const GHOST_BUTTON =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-hover hover:text-foreground disabled:pointer-events-none disabled:opacity-25";

/** First author only — the full string is often a semicolon-joined list. */
function primaryAuthor(authors: string) {
  return authors.split(/[,;]/)[0]?.trim() ?? "";
}

function firstCategory(categories: string) {
  return categories.split(/[,;]/)[0]?.trim() ?? "";
}

export function ReelCard({
  card,
  active,
  peeking = false,
  mounted,
  onSave,
  onRead,
  onNext,
  onPeek,
}: {
  card: ReelCardData;
  /** Whether this card is the one snapped into view. */
  active: boolean;
  /** Next book sitting in the desktop peek strip — header stays sharp. */
  peeking?: boolean;
  /**
   * Whether to build the reader for this card. Measuring every card in the
   * reel at once would force a reflow per book, so the parent only turns this
   * on for the cards next to the one in view.
   */
  mounted: boolean;
  onSave: () => Promise<boolean>;
  /** Fired once the reader reaches the last page. */
  onRead: () => void;
  onNext: () => void;
  /** Tap the peek strip to snap this book into view. */
  onPeek?: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [page, setPage] = useState(0);
  const [slices, setSlices] = useState<MdBlock[][] | null>(null);
  const [columnWidth, setColumnWidth] = useState(0);
  const [selection, setSelection] = useState("");
  const [kept, setKept] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "busy" | "shared" | "saved" | "failed">(
    "idle"
  );
  const preparedShare = useRef<PreparedGistShare | null>(null);
  const preparingShare = useRef<Promise<PreparedGistShare> | null>(null);

  const sectionRef = useRef<HTMLElement | null>(null);
  const firstPageRef = useRef<HTMLDivElement | null>(null);
  const readerRef = useRef<HTMLDivElement | null>(null);
  const columnRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const readReported = useRef(false);
  const swipeRef = useRef<{
    x: number;
    y: number;
    axis: "h" | "v" | null;
  } | null>(null);

  const author = primaryAuthor(card.authors);
  const category = firstCategory(card.categories);
  const cover = card.thumbnail ? card.thumbnail.replace(/^http:/, "https:") : "";

  // The personalized hook opens the read as an epigraph, so the reason this
  // book is in front of them is the first thing on page one.
  const blocks = useMemo<MdBlock[]>(() => {
    const source =
      card.summary.trim() ||
      card.description.trim() ||
      "We don't have a write-up for this one yet. Open the book room to see what's there.";
    const lead: MdBlock[] = card.hook
      ? [{ type: "blockquote", text: card.hook }]
      : [];
    return prepareBlocksForPagination([...lead, ...parseMarkdown(source)]);
  }, [card.summary, card.description, card.hook]);

  // One page of text, even on a wide desktop — the right rail is the
  // second column of the screen now, not a second page of the gist.
  const columns = 1;

  // Measured off a real column rather than computed, so whatever the grid and
  // the `max-w` cap settle on is exactly what the measurer is handed.
  useEffect(() => {
    const el = columnRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setColumnWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const remeasure = useCallback(() => {
    const el = measureRef.current;
    if (!el || !blocks.length) return;
    const out = packBlocksIntoPages(el, blocks);
    if (!out) return;
    setSlices((prev) => (samePagination(prev, out) ? prev : out));
  }, [blocks]);

  // Two frames so webfonts and the new column width settle before we trust
  // any heights.
  useLayoutEffect(() => {
    if (!mounted || !blocks.length || columnWidth <= 0) return;
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(remeasure);
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [mounted, blocks, columnWidth, remeasure]);

  // A page is one column on a phone and two on a wide window, so the same
  // packed slices serve both without re-measuring.
  const totalPages = slices ? Math.max(1, Math.ceil(slices.length / columns)) : 1;
  // Derived rather than clamped in an effect, so a reflow that shortens the
  // book can never strand the reader on a page that no longer exists.
  const current = Math.min(page, totalPages - 1);
  const onLastPage = current >= totalPages - 1;
  const visible = slices
    ? slices.slice(current * columns, current * columns + columns)
    : null;

  useEffect(() => {
    if (!active || readReported.current || !slices) return;
    if (onLastPage) {
      readReported.current = true;
      onRead();
    }
  }, [active, slices, onLastPage, onRead]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setPage((p) => Math.min(p + 1, totalPages - 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setPage((p) => Math.max(p - 1, 0));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, totalPages]);

  const goToPage = useCallback((next: number) => {
    setPage((p) => Math.max(0, Math.min(next, totalPages - 1)));
  }, [totalPages]);

  const onSwipePointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    swipeRef.current = { x: e.clientX, y: e.clientY, axis: null };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onSwipePointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const start = swipeRef.current;
    if (!start || start.axis) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
    start.axis = Math.abs(dx) > Math.abs(dy) * 1.15 ? "h" : "v";
  }, []);

  const onSwipePointerEnd = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start || start.axis !== "h") return;
    // A highlight is a drag, not a page turn.
    if ((window.getSelection()?.toString().trim().length ?? 0) > 3) return;
    const dx = e.clientX - start.x;
    if (Math.abs(dx) < PAGE_SWIPE_PX) return;
    goToPage(dx < 0 ? current + 1 : current - 1);
  }, [current, goToPage]);

  const captureSelection = useCallback(() => {
    const text = window.getSelection()?.toString().trim() ?? "";
    setSelection(text.length > 3 ? text.slice(0, 2000) : "");
    setKept(false);
  }, []);

  const keepSelection = useCallback(async () => {
    if (!selection) return;
    const res = await fetch("/api/memories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId: card.id, quote: selection }),
    });
    if (res.ok) {
      trackMemorySaved(card.id, "gist");
      setKept(true);
      setSelection("");
      window.getSelection()?.removeAllRanges();
    }
  }, [card.id, selection]);

  const buildShare = useCallback(() => {
    if (preparedShare.current) return Promise.resolve(preparedShare.current);
    if (preparingShare.current) return preparingShare.current;
    const section = sectionRef.current;
    if (!section) return Promise.reject(new Error("gist is not on screen"));
    const job = prepareGistShare({
      section,
      firstPageHtml: firstPageRef.current?.innerHTML ?? "",
      title: card.title,
      synopsis: littleSynopsis(card.description, card.summary, card.hook),
      bookUrl: `${window.location.origin}/book/${card.slug}`,
      bookId: card.id,
      totalPages,
    })
      .then((prepared) => {
        preparedShare.current = prepared;
        preparingShare.current = null;
        return prepared;
      })
      .catch((err: unknown) => {
        preparingShare.current = null;
        throw err;
      });
    preparingShare.current = job;
    return job;
  }, [
    card.description,
    card.hook,
    card.id,
    card.slug,
    card.summary,
    card.title,
    totalPages,
  ]);

  // Paint the share image while this gist is the one on screen, so the tap
  // can open the phone sheet immediately instead of after a long wait.
  useEffect(() => {
    if (!active || !slices) return;
    void buildShare().catch(() => {});
  }, [active, slices, buildShare]);

  function finishShare(result: Promise<"shared" | "saved" | "cancelled">) {
    void result.then((outcome) => {
      if (outcome === "cancelled") {
        setShareState("idle");
        return;
      }
      setShareState(outcome === "saved" ? "saved" : "shared");
      window.setTimeout(() => setShareState("idle"), 2000);
    });
  }

  function share() {
    if (shareState === "busy") return;
    const ready = preparedShare.current;
    if (ready) {
      finishShare(invokeGistShare(ready));
      return;
    }
    setShareState("busy");
    void buildShare().then(
      (prepared) => finishShare(invokeGistShare(prepared)),
      () => {
        setShareState("failed");
        window.setTimeout(() => setShareState("idle"), 2000);
      }
    );
  }

  async function save() {
    if (saving || saved) return;
    setSaving(true);
    const ok = await onSave();
    setSaving(false);
    if (ok) setSaved(true);
  }

  const meta = [author, category, card.publishedYear ? String(card.publishedYear) : ""]
    .filter(Boolean)
    .join(" · ");

  const shareLabel =
    shareState === "busy"
      ? "Preparing snapshot"
      : shareState === "shared"
        ? "Shared"
        : shareState === "saved"
          ? "Snapshot saved and link copied"
          : shareState === "failed"
            ? "Couldn't share this gist"
            : "Share this gist";

  return (
    <>
    <section
      ref={sectionRef}
      className={
        peeking
          ? "rq-reel-item rq-reel-item--peeking relative overflow-hidden"
          : "rq-reel-item relative overflow-hidden"
      }
      aria-label={card.title}
    >
      {cover ? (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover} alt="" className="rq-reel-wash h-full w-full object-cover" />
        </div>
      ) : null}
      <div aria-hidden className="rq-reel-scrim" />

      <div
        className={
          peeking
            ? "relative flex h-full flex-col px-4 pb-1 pt-2 sm:px-8 lg:px-12"
            : "relative flex h-full flex-col px-4 pb-1 pt-3 sm:px-8 sm:pt-5 lg:px-12"
        }
      >
        <header
          className={
            peeking
              ? "flex shrink-0 items-center gap-2 pb-1"
              : "flex shrink-0 items-center gap-2.5 pb-3.5"
          }
        >
          <div
            className={
              peeking
                ? "h-7 w-5 shrink-0 overflow-hidden rounded-[3px] ring-1 ring-border/60"
                : "h-[38px] w-[26px] shrink-0 overflow-hidden rounded-[3px] ring-1 ring-border/60"
            }
          >
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cover}
                alt=""
                className="h-full w-full object-cover"
                loading={mounted ? "eager" : "lazy"}
              />
            ) : (
              <div
                className="h-full w-full"
                style={{ background: "var(--gradient-brand)" }}
              />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="flex min-w-0 items-center gap-1.5 text-[14px] font-semibold leading-tight tracking-tight">
              <Link
                href={`/book/${card.slug}`}
                className="min-w-0 truncate hover:underline underline-offset-4"
              >
                {card.title}
              </Link>
              {!peeking && card.averageRating ? (
                <span className="inline-flex shrink-0 items-center gap-0.5 text-[11.5px] font-semibold text-muted">
                  <Star size={11} aria-hidden className="text-amber-500" />
                  {card.averageRating.toFixed(1)}
                </span>
              ) : null}
            </h2>
            {peeking ? null : (
              <p className="truncate text-[11.5px] leading-tight text-muted">{meta}</p>
            )}
          </div>

          {!peeking ? (
            <div className="flex shrink-0 self-start">
              <button
                type="button"
                data-no-shot
                onClick={(e) => {
                  e.stopPropagation();
                  void share();
                }}
                aria-label={shareLabel}
                disabled={shareState === "busy"}
                className={GHOST_BUTTON}
              >
                {shareState === "busy" ? (
                  <Loader2 size={16} aria-hidden className="animate-spin" />
                ) : shareState === "shared" || shareState === "saved" ? (
                  <Check size={16} aria-hidden className="text-emerald-600 dark:text-emerald-300" />
                ) : (
                  <Share2 size={16} aria-hidden />
                )}
              </button>
              <button
                type="button"
                data-no-shot
                onClick={(e) => {
                  e.stopPropagation();
                  void save();
                }}
                aria-label={saved ? "Saved to your shelf" : "Save for later"}
                aria-pressed={saved}
                disabled={saving}
                className={
                  saved
                    ? `${GHOST_BUTTON} text-emerald-600 hover:text-emerald-600 dark:text-emerald-300`
                    : GHOST_BUTTON
                }
              >
                {saved ? <Check size={16} aria-hidden /> : <Bookmark size={16} aria-hidden />}
              </button>
            </div>
          ) : null}
        </header>

        {peeking ? (
          <button
            type="button"
            onClick={onPeek}
            aria-label="Swipe to this gist"
            className="absolute inset-x-0 top-0 z-20 h-[var(--rq-reel-peek)] cursor-pointer"
          >
            <ChevronsUp
              size={16}
              aria-hidden
              className="rq-reel-hint pointer-events-none absolute right-4 top-1.5 text-muted sm:right-8 lg:right-12"
            />
          </button>
        ) : null}

        {/* The columns and their invisible twin share this box, so the twin
            always measures against the exact height a real column gets. */}
        <div
          ref={readerRef}
          className="relative min-h-0 flex-1 touch-pan-y"
          onPointerDown={onSwipePointerDown}
          onPointerMove={onSwipePointerMove}
          onPointerUp={onSwipePointerEnd}
          onPointerCancel={() => {
            swipeRef.current = null;
          }}
          onMouseUp={captureSelection}
          onTouchEnd={captureSelection}
        >
          <div
            ref={measureRef}
            data-no-shot
            aria-hidden
            style={columnWidth > 0 ? { width: columnWidth } : undefined}
            className="rq-reel-prose pointer-events-none invisible absolute inset-y-0 left-0 overflow-hidden"
          >
            {blocks.map((b, i) => renderBlock(b, `m-${i}`))}
          </div>

          <div
            className="absolute inset-0 mx-auto grid w-full"
            style={{
              gridTemplateColumns: "minmax(0, 1fr)",
              maxWidth: "72ch",
            }}
          >
            {(visible ?? [blocks.slice(0, 6)]).map((slice, i) => (
              <div
                key={`${current}-${i}`}
                ref={i === 0 ? columnRef : undefined}
                data-gist-body={i === 0 ? "" : undefined}
                className="rq-reel-prose rq-page-turn overflow-hidden"
              >
                {slice.map((b, j) => renderBlock(b, `p-${current}-${i}-${j}`))}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => goToPage(current - 1)}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={current === 0}
            data-no-shot
            aria-label="Previous page"
            className="absolute left-0 top-1/2 z-10 flex h-24 w-10 -translate-y-1/2 items-center justify-center text-foreground/25 transition hover:text-foreground/55 disabled:pointer-events-none disabled:opacity-0 layout-wide:hidden"
          >
            <ChevronLeft size={28} strokeWidth={1.5} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => goToPage(current + 1)}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={onLastPage}
            data-no-shot
            aria-label="Next page"
            className="absolute right-0 top-1/2 z-10 flex h-24 w-10 -translate-y-1/2 items-center justify-center text-foreground/25 transition hover:text-foreground/55 disabled:pointer-events-none disabled:opacity-0 layout-wide:hidden"
          >
            <ChevronRight size={28} strokeWidth={1.5} aria-hidden />
          </button>
        </div>

        <footer
          className="shrink-0 cursor-pointer pt-2"
          onClick={onNext}
        >
          {selection || kept ? (
            <div data-no-shot className="mb-2 flex justify-center">
              {kept ? (
                <p className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-[13px] font-semibold text-emerald-700 dark:text-emerald-300">
                  <Check size={15} aria-hidden /> Kept in your memories
                </p>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void keepSelection();
                  }}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border/70 bg-card/80 px-4 py-2 text-[13px] font-semibold text-foreground shadow-[var(--shadow-soft)] backdrop-blur-sm transition hover:bg-hover"
                >
                  <BookmarkPlus size={15} aria-hidden />
                  Keep this line
                </button>
              )}
            </div>
          ) : null}

          <div className="flex items-center justify-center layout-wide:hidden">
            <span data-page-label="compact" className="text-[11px] font-semibold tabular-nums text-muted">
              {current + 1}/{totalPages}
            </span>
          </div>

          <div className="hidden items-center justify-center gap-0.5 layout-wide:flex">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToPage(current - 1);
              }}
              disabled={current === 0}
              data-no-shot
              aria-label="Previous page"
              className={GHOST_BUTTON}
            >
              <ChevronLeft size={17} aria-hidden />
            </button>
            <span
              data-page-label="wide"
              className="min-w-[3.25rem] text-center text-[11px] font-semibold tabular-nums text-muted"
            >
              {current + 1} / {totalPages}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToPage(current + 1);
              }}
              disabled={onLastPage}
              data-no-shot
              aria-label="Next page"
              className={GHOST_BUTTON}
            >
              <ChevronRight size={17} aria-hidden />
            </button>
          </div>

          <div className="mt-1.5 h-[2px] w-full overflow-hidden rounded-full bg-border/60 layout-wide:mt-2">
            <div
              data-gist-progress
              className="h-full rounded-full transition-[width] duration-300"
              style={{
                width: `${((current + 1) / totalPages) * 100}%`,
                background: "var(--gradient-brand)",
              }}
            />
          </div>
        </footer>
      </div>
    </section>
    <div ref={firstPageRef} hidden aria-hidden>
      {(slices?.[0] ?? []).map((b, j) => renderBlock(b, `shot-${j}`))}
    </div>
    </>
  );
}
