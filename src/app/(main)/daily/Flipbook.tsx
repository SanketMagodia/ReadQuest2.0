"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Flip = { from: number; to: number; dir: "next" | "prev" };

type Props = {
  pages: ReactNode[];
  /** Fired the FIRST time the user reaches the last page. */
  onLastPageReached?: () => void;
  /** Fired whenever the displayed page changes (for resume + progress). */
  onPageChange?: (idx: number) => void;
  initialPage?: number;
};

/**
 * A real 3D paged-book reader.
 *
 *   - Single visible "static" page at all times.
 *   - During a turn we overlay a temporary "flipping leaf" with the LEAVING
 *     page on its front and the ARRIVING page on its back. That leaf rotates
 *     around the left edge — front side visible 0°→90°, back side 90°→180°.
 *   - We swap the static page to the new index immediately on turn-start so
 *     the underlying state is already correct when the animation ends.
 */
export function Flipbook({
  pages,
  onLastPageReached,
  onPageChange,
  initialPage = 0,
}: Props) {
  const [current, setCurrent] = useState(
    Math.min(initialPage, pages.length - 1)
  );
  const [flip, setFlip] = useState<Flip | null>(null);
  const reachedRef = useRef(new Set<number>());

  // Notify last page reached + page change.
  useEffect(() => {
    onPageChange?.(current);
    if (
      current === pages.length - 1 &&
      !reachedRef.current.has(current)
    ) {
      reachedRef.current.add(current);
      onLastPageReached?.();
    }
  }, [current, pages.length, onPageChange, onLastPageReached]);

  const animateTo = useCallback(
    (target: number, dir: "next" | "prev") => {
      if (flip) return;
      if (target < 0 || target > pages.length - 1) return;
      setFlip({ from: current, to: target, dir });
      setCurrent(target);
    },
    [current, flip, pages.length]
  );

  const goNext = useCallback(() => {
    if (current >= pages.length - 1) return;
    animateTo(current + 1, "next");
  }, [current, pages.length, animateTo]);

  const goPrev = useCallback(() => {
    if (current <= 0) return;
    animateTo(current - 1, "prev");
  }, [current, animateTo]);

  // Keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev]);

  // Touch swipe nav
  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 40) return;
    if (dx < 0) goNext();
    else goPrev();
  };

  const onLeafAnimEnd = () => setFlip(null);

  return (
    <div className="rq-flipbook">
      <div
        className="rq-book"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Decorative left binding gutter */}
        <div className="rq-book-gutter" aria-hidden />

        {/* Static visible page */}
        <div className="rq-page rq-page--static" aria-live="polite">
          <div className="rq-page-face rq-page-face--front">
            {pages[current]}
          </div>
        </div>

        {/* Flipping leaf */}
        {flip ? (
          <div
            key={`flip-${flip.from}-${flip.to}-${flip.dir}`}
            className={`rq-page rq-page--flip rq-page--${flip.dir}`}
            onAnimationEnd={onLeafAnimEnd}
            aria-hidden
          >
            <div className="rq-page-face rq-page-face--front">
              {pages[flip.dir === "next" ? flip.from : flip.to]}
            </div>
            <div className="rq-page-face rq-page-face--back">
              {pages[flip.dir === "next" ? flip.to : flip.from]}
            </div>
          </div>
        ) : null}

        {/* Click zones — left third = prev, right third = next */}
        <button
          type="button"
          onClick={goPrev}
          disabled={current === 0 || !!flip}
          aria-label="Previous page"
          className="rq-tap-zone rq-tap-zone--left"
        >
          <span className="rq-tap-hint">
            <ChevronLeft size={18} aria-hidden />
          </span>
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={current === pages.length - 1 || !!flip}
          aria-label="Next page"
          className="rq-tap-zone rq-tap-zone--right"
        >
          <span className="rq-tap-hint">
            <ChevronRight size={18} aria-hidden />
          </span>
        </button>
      </div>

      {/* Bottom controls */}
      <div className="rq-book-controls">
        <button
          type="button"
          onClick={goPrev}
          disabled={current === 0 || !!flip}
          className="rq-ctrl"
          aria-label="Previous page"
        >
          <ChevronLeft size={16} aria-hidden />
          <span className="hidden sm:inline">Prev</span>
        </button>
        <div className="rq-progress">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Page {current + 1} / {pages.length}
          </span>
          <div className="rq-progress-bar">
            <div
              className="rq-progress-fill"
              style={{
                width: `${((current + 1) / pages.length) * 100}%`,
                background: "var(--gradient-brand)",
              }}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={goNext}
          disabled={current === pages.length - 1 || !!flip}
          className="rq-ctrl"
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}
