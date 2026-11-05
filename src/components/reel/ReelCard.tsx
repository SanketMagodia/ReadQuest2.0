"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
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
import { readCache, writeCache } from "@/lib/client-cache";
import type { ReelCard as ReelCardData } from "@/lib/reel";
import {
  canOpenShareSheet,
  invokeGistShare,
  prepareGistShare,
  type GistShareResult,
  type PreparedGistShare,
} from "@/lib/share-gist";

/** Horizontal swipe past this many pixels turns the page (reduced motion). */
const PAGE_SWIPE_PX = 48;
/** Let go past this share of the page width and the leaf finishes turning. */
const TURN_COMMIT = 0.35;
/** A flick faster than this (px/ms) turns the page however far it got. */
const TURN_FLICK = 0.45;
const TURN_MS = 620;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Same query as the `layout-compact` variant — the phone-shaped shell. */
const COMPACT_QUERY = "(max-aspect-ratio: 1/1)";

function subscribeCompact(onChange: () => void) {
  const mq = window.matchMedia(COMPACT_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** Swipe-to-turn and the page curl only exist on the phone layout. */
function useCompactLayout() {
  return useSyncExternalStore(
    subscribeCompact,
    () => window.matchMedia(COMPACT_QUERY).matches,
    () => false
  );
}

type Turn = { dir: 1 | -1; from: number; to: number };

/** Where the "Keep this line" bubble sits, relative to the reader box. */
type BubbleAt = { x: number; y: number; below: boolean };
const BUBBLE_HALF_WIDTH = 80;
const BUBBLE_ROOM = 52;

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
  // Where this gist was left, so coming back to the reel finds it there.
  const pageKey = `reel-page:${card.id}`;
  const savedKey = `reel-saved:${card.id}`;
  const [saved, setSaved] = useState(() => readCache<boolean>(savedKey) ?? false);
  const [page, setPage] = useState(() => readCache<number>(pageKey) ?? 0);
  useEffect(() => {
    writeCache(pageKey, page);
  }, [pageKey, page]);
  useEffect(() => {
    if (saved) writeCache(savedKey, true);
  }, [savedKey, saved]);
  const [slices, setSlices] = useState<MdBlock[][] | null>(null);
  const [columnWidth, setColumnWidth] = useState(0);
  const [selection, setSelection] = useState("");
  const [selectionAt, setSelectionAt] = useState<BubbleAt | null>(null);
  /** Where the "kept" confirmation shows — the spot the line was kept from. */
  const [kept, setKept] = useState<BubbleAt | null>(null);
  const compact = useCompactLayout();
  const [shareState, setShareState] = useState<
    "idle" | "busy" | "shared" | "saved" | "unsupported" | "failed"
  >("idle");
  const [sheetless, setSheetless] = useState(false);
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
    lastX: number;
    lastT: number;
    vx: number;
    /** `skip`: the drag is a text highlight or there's no page that way. */
    axis: "h" | "v" | "skip" | null;
  } | null>(null);
  // The turning leaf only exists while a page is actually being turned; its
  // angle is written straight to the DOM so a drag doesn't re-render per frame.
  const [turn, setTurn] = useState<Turn | null>(null);
  const turnRef = useRef<(Turn & { progress: number; raf: number }) | null>(null);
  const turnLayerRef = useRef<HTMLDivElement | null>(null);

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

  /** A highlight belongs to the page it was made on. */
  const clearSelection = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setSelection("");
    setSelectionAt(null);
  }, []);

  /**
   * Turning forward lifts the current page off the spine (0° → -180°);
   * turning back lays the previous page down again (-180° → 0°).
   */
  const applyTurn = useCallback(() => {
    const t = turnRef.current;
    const el = turnLayerRef.current;
    if (!t || !el) return;
    const angle = (t.dir === 1 ? t.progress : 1 - t.progress) * -180;
    const tilt = Math.abs(angle);
    el.style.setProperty("--leaf-angle", `${angle}deg`);
    el.style.setProperty("--leaf-lift", Math.sin((tilt * Math.PI) / 180).toFixed(3));
    // Past ~130° the leaf is lying over the far margin; let it go quietly.
    el.style.setProperty("--leaf-fade", Math.min(1, Math.max(0, (180 - tilt) / 50)).toFixed(3));
  }, []);

  useLayoutEffect(() => {
    if (turn) applyTurn();
  }, [turn, applyTurn]);

  useEffect(() => () => cancelAnimationFrame(turnRef.current?.raf ?? 0), []);

  const beginTurn = useCallback(
    (dir: 1 | -1) => {
      if (turnRef.current) return false;
      const to = current + dir;
      if (to < 0 || to >= totalPages || !slices) return false;
      const next: Turn = { dir, from: current, to };
      turnRef.current = { ...next, progress: 0, raf: 0 };
      clearSelection();
      setTurn(next);
      return true;
    },
    [clearSelection, current, totalPages, slices]
  );

  /** Animate the leaf to flat-down (0) or fully turned (1), then settle. */
  const settleTurn = useCallback(
    (target: 0 | 1, ease: (x: number) => number) => {
      const t = turnRef.current;
      if (!t) return;
      cancelAnimationFrame(t.raf);
      const startP = t.progress;
      const duration = Math.max(120, TURN_MS * Math.abs(target - startP));
      const t0 = performance.now();
      const step = (now: number) => {
        const live = turnRef.current;
        if (!live) return;
        const k = Math.min(1, (now - t0) / duration);
        live.progress = startP + (target - startP) * ease(k);
        applyTurn();
        if (k < 1) {
          live.raf = requestAnimationFrame(step);
          return;
        }
        if (target === 1) setPage(live.to);
        turnRef.current = null;
        setTurn(null);
      };
      t.raf = requestAnimationFrame(step);
    },
    [applyTurn]
  );

  const goToPage = useCallback(
    (next: number) => {
      const to = Math.max(0, Math.min(next, totalPages - 1));
      if (to === current || turnRef.current) return;
      if (!compact || prefersReducedMotion() || Math.abs(to - current) > 1) {
        clearSelection();
        setPage(to);
        return;
      }
      if (beginTurn(to > current ? 1 : -1)) {
        settleTurn(1, (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2));
      }
    },
    [beginTurn, clearSelection, compact, current, settleTurn, totalPages]
  );

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goToPage(current + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPage(current - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, current, goToPage]);

  const onSwipePointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (!compact) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (turnRef.current) return;
    const now = performance.now();
    swipeRef.current = {
      x: e.clientX,
      y: e.clientY,
      lastX: e.clientX,
      lastT: now,
      vx: 0,
      axis: null,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [compact]);

  const onSwipePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const start = swipeRef.current;
      if (!start || start.axis === "v" || start.axis === "skip") return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const now = performance.now();
      const dt = now - start.lastT;
      if (dt > 0) start.vx = (e.clientX - start.lastX) / dt;
      start.lastX = e.clientX;
      start.lastT = now;

      if (!start.axis) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        if (Math.abs(dx) <= Math.abs(dy) * 1.15) {
          start.axis = "v";
          return;
        }
        // A mouse drag across words is a highlight, not a page turn.
        const selecting =
          e.pointerType === "mouse" &&
          (window.getSelection()?.toString().trim().length ?? 0) > 0;
        if (selecting || prefersReducedMotion()) {
          start.axis = selecting ? "skip" : "h";
          return;
        }
        start.axis = beginTurn(dx < 0 ? 1 : -1) ? "h" : "skip";
        if (start.axis !== "h") return;
      }

      const t = turnRef.current;
      const width = readerRef.current?.clientWidth ?? 0;
      if (!t || width <= 0) return;
      t.progress = Math.min(1, Math.max(0, (-t.dir * dx) / width));
      applyTurn();
    },
    [applyTurn, beginTurn]
  );

  const onSwipePointerEnd = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const start = swipeRef.current;
      swipeRef.current = null;
      if (!start || start.axis !== "h") return;
      const t = turnRef.current;
      if (!t) {
        // Reduced motion: no leaf, just a swipe.
        if ((window.getSelection()?.toString().trim().length ?? 0) > 3) return;
        const dx = e.clientX - start.x;
        if (Math.abs(dx) < PAGE_SWIPE_PX) return;
        goToPage(dx < 0 ? current + 1 : current - 1);
        return;
      }
      const flick = -t.dir * start.vx;
      const commit =
        t.progress > TURN_COMMIT || (flick > TURN_FLICK && t.progress > 0.04);
      settleTurn(commit ? 1 : 0, (x) => 1 - (1 - x) ** 3);
    },
    [current, goToPage, settleTurn]
  );

  const onSwipePointerCancel = useCallback(() => {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (start?.axis === "h" && turnRef.current) {
      settleTurn(0, (x) => 1 - (1 - x) ** 3);
    }
  }, [settleTurn]);

  /**
   * Follow the selection wherever it's made — mouse drag, long-press, or the
   * phone's selection handles, which never fire a touchend on the reader.
   * Phones open their own copy/share menu above a selection, so the bubble
   * goes below there and above with a mouse, flipping when there's no room.
   */
  useEffect(() => {
    if (!active) return;
    let timer = 0;
    const read = () => {
      const host = readerRef.current;
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? "";
      if (!host || !sel || !sel.rangeCount || text.length <= 3 || !host.contains(sel.anchorNode)) {
        setSelection("");
        setSelectionAt(null);
        return;
      }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      const box = host.getBoundingClientRect();
      const roomAbove = rect.top - box.top > BUBBLE_ROOM;
      const roomBelow = box.bottom - rect.bottom > BUBBLE_ROOM;
      const touch = window.matchMedia("(pointer: coarse)").matches;
      const below = touch ? roomBelow || !roomAbove : !roomAbove && roomBelow;
      const center = rect.left + rect.width / 2 - box.left;
      setSelection(text.slice(0, 2000));
      setSelectionAt({
        x: Math.min(box.width - BUBBLE_HALF_WIDTH, Math.max(BUBBLE_HALF_WIDTH, center)),
        y: below ? rect.bottom - box.top + 10 : rect.top - box.top - 10,
        below,
      });
      setKept(null);
    };
    // Settle first: a drag fires this on every character, and a tap on the
    // bubble can briefly clear the selection before its click lands.
    const onChange = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(read, 200);
    };
    document.addEventListener("selectionchange", onChange);
    window.addEventListener("resize", onChange);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("selectionchange", onChange);
      window.removeEventListener("resize", onChange);
    };
  }, [active]);

  useEffect(() => {
    if (!kept) return;
    const t = window.setTimeout(() => setKept(null), 2200);
    return () => window.clearTimeout(t);
  }, [kept]);

  const keepSelection = useCallback(async () => {
    if (!selection) return;
    const at = selectionAt;
    const res = await fetch("/api/memories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId: card.id, quote: selection }),
    });
    if (res.ok) {
      trackMemorySaved(card.id, "gist");
      setSelection("");
      setSelectionAt(null);
      window.getSelection()?.removeAllRanges();
      setKept(at);
    }
  }, [card.id, selection, selectionAt]);

  const bubble = kept ?? (selection ? selectionAt : null);

  const buildShare = useCallback(() => {
    if (preparedShare.current) return Promise.resolve(preparedShare.current);
    if (preparingShare.current) return preparingShare.current;
    const section = sectionRef.current;
    if (!section) return Promise.reject(new Error("gist is not on screen"));
    const job = prepareGistShare({
      section,
      firstPageHtml: firstPageRef.current?.innerHTML ?? "",
      title: card.title,
      author,
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
  }, [author, card.id, card.slug, card.title, totalPages]);

  // Paint the share image while this gist is the one on screen, so the tap
  // can open the phone sheet immediately instead of after a long wait.
  useEffect(() => {
    if (!active || !slices) return;
    void buildShare().catch(() => {});
  }, [active, slices, buildShare]);

  useEffect(() => setSheetless(!canOpenShareSheet()), []);

  function finishShare(result: Promise<GistShareResult>) {
    void result.then((outcome) => {
      if (outcome === "cancelled") {
        setShareState("idle");
        return;
      }
      setShareState(outcome);
      window.setTimeout(() => setShareState("idle"), outcome === "unsupported" ? 4500 : 2000);
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

  const shareNote =
    shareState === "busy"
      ? "Preparing…"
      : shareState === "shared"
        ? "Shared · caption copied, paste it if the app dropped it"
        : shareState === "saved"
          ? "Image saved · caption copied"
          : shareState === "unsupported"
            ? "This browser has no share sheet (needs HTTPS) — image saved, link copied"
            : shareState === "failed"
              ? "Couldn't build that image"
              : "";
  const shareLabel =
    shareNote || (sheetless ? "Save this gist as an image" : "Share this gist");

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
              {shareNote && shareState !== "busy" ? (
                <p
                  data-no-shot
                  role="status"
                  className="pointer-events-none absolute right-3 top-12 z-30 max-w-[15rem] rounded-lg bg-foreground/90 px-2.5 py-1.5 text-[11px] font-semibold leading-snug text-background shadow-lg"
                >
                  {shareNote}
                </p>
              ) : null}
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
          className={
            turn
              ? "relative min-h-0 flex-1 touch-pan-y select-none"
              : "relative min-h-0 flex-1 touch-pan-y"
          }
          onPointerDown={onSwipePointerDown}
          onPointerMove={onSwipePointerMove}
          onPointerUp={onSwipePointerEnd}
          onPointerCancel={onSwipePointerCancel}
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
                className={
                  compact
                    ? "rq-reel-prose overflow-hidden"
                    : "rq-reel-prose rq-page-turn overflow-hidden"
                }
                style={turn ? { visibility: "hidden" } : undefined}
              >
                {slice.map((b, j) => renderBlock(b, `p-${current}-${i}-${j}`))}
              </div>
            ))}

            {turn && slices ? (
              <div ref={turnLayerRef} data-no-shot aria-hidden className="rq-leaf-turn">
                <div className="rq-leaf-under rq-reel-prose overflow-hidden">
                  {(slices[turn.dir === 1 ? turn.to : turn.from] ?? []).map((b, j) =>
                    renderBlock(b, `u-${j}`)
                  )}
                </div>
                <div className="rq-leaf">
                  <div className="rq-leaf-face">
                    <div className="rq-reel-prose h-full overflow-hidden">
                      {(slices[turn.dir === 1 ? turn.from : turn.to] ?? []).map((b, j) =>
                        renderBlock(b, `l-${j}`)
                      )}
                    </div>
                  </div>
                  <div className="rq-leaf-back" />
                </div>
              </div>
            ) : null}
          </div>

          {/* Edge tabs live entirely in the side gutters (the card's px-*),
              so neither the tab nor its tap target ever covers the text. */}
          <button
            type="button"
            onClick={() => goToPage(current - 1)}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={current === 0}
            data-no-shot
            aria-label="Previous page"
            className="group absolute -left-4 top-1/2 z-10 flex h-28 w-4 -translate-y-1/2 items-center justify-start transition disabled:pointer-events-none disabled:opacity-0 sm:-left-8 sm:w-8 lg:-left-12 lg:w-12 layout-wide:hidden"
          >
            <span className="rq-edge-tab rq-edge-tab--left">
              <ChevronLeft size={14} strokeWidth={2.5} aria-hidden />
            </span>
          </button>
          <button
            type="button"
            onClick={() => goToPage(current + 1)}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={onLastPage}
            data-no-shot
            aria-label="Next page"
            className="group absolute -right-4 top-1/2 z-10 flex h-28 w-4 -translate-y-1/2 items-center justify-end transition disabled:pointer-events-none disabled:opacity-0 sm:-right-8 sm:w-8 lg:-right-12 lg:w-12 layout-wide:hidden"
          >
            <span
              className={
                current === 0
                  ? "rq-edge-tab rq-edge-tab--right rq-edge-tab--nudge"
                  : "rq-edge-tab rq-edge-tab--right"
              }
            >
              <ChevronRight size={14} strokeWidth={2.5} aria-hidden />
            </span>
          </button>

          {bubble ? (
            <div
              data-no-shot
              className="pointer-events-none absolute z-30"
              style={{
                left: bubble.x,
                top: bubble.y,
                transform: `translate(-50%, ${bubble.below ? "0" : "-100%"})`,
              }}
            >
              {kept ? (
                <p className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-500/20 bg-card/95 px-4 py-2 text-[13px] font-semibold text-emerald-700 shadow-[var(--shadow-soft)] backdrop-blur-sm dark:text-emerald-300">
                  <Check size={15} aria-hidden /> Kept in your memories
                </p>
              ) : (
                <button
                  type="button"
                  // Keep the highlight alive and the reader's swipe out of it.
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.stopPropagation();
                    void keepSelection();
                  }}
                  className="pointer-events-auto inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border border-border/70 bg-card/95 px-4 py-2 text-[13px] font-semibold text-foreground shadow-[var(--shadow-soft)] backdrop-blur-sm transition hover:bg-hover"
                >
                  <BookmarkPlus size={15} aria-hidden />
                  Keep this line
                </button>
              )}
            </div>
          ) : null}
        </div>

        <footer
          className="shrink-0 cursor-pointer pt-2"
          onClick={onNext}
        >
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
