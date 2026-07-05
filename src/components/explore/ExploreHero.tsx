"use client";

import {
  type ChangeEvent,
  type FormEvent,
} from "react";
import { BookOpen, Feather, RefreshCw, Search, Sparkles, Star, X } from "lucide-react";

/**
 * Explore hero — replaces the old flat "welcome / Explore stories" rectangle.
 *
 * Borderless and full-bleed so it melts into the page background (which we
 * must not change): a blurred aurora drifts behind the type, the headline
 * cycles through gradient words with a self-drawing squiggle, a pure-CSS 3D
 * book floats beside it turning its own pages, sparks drift upward, and the
 * search pill wears an animated conic halo that wakes on focus.
 * All motion is decorative-only and disabled under prefers-reduced-motion.
 */

const ROTATING_WORDS = ["stories", "worlds", "ideas", "voices", "legends"];

/** Scatter of drifting glyphs; positions/delays are hand-tuned constants. */
const SPARKS: Array<{
  top: string;
  left: string;
  delay: string;
  size: number;
  icon: "star" | "sparkle" | "feather" | "book";
  hideOnMobile?: boolean;
}> = [
  { top: "12%", left: "4%", delay: "0s", size: 11, icon: "sparkle" },
  { top: "62%", left: "9%", delay: "2.6s", size: 9, icon: "star" },
  { top: "20%", left: "44%", delay: "4.1s", size: 10, icon: "feather", hideOnMobile: true },
  { top: "70%", left: "38%", delay: "6.2s", size: 9, icon: "book", hideOnMobile: true },
  { top: "8%", left: "72%", delay: "1.4s", size: 10, icon: "star", hideOnMobile: true },
  { top: "58%", left: "88%", delay: "5.1s", size: 11, icon: "sparkle" },
  { top: "30%", left: "94%", delay: "7.6s", size: 9, icon: "feather" },
];

const SPARK_ICONS = {
  star: Star,
  sparkle: Sparkles,
  feather: Feather,
  book: BookOpen,
} as const;

export function ExploreHero({
  firstName,
  q,
  onQChange,
  onSubmit,
  searching,
  category,
  onClearFilters,
}: {
  firstName: string;
  q: string;
  onQChange: (value: string) => void;
  onSubmit: (e?: FormEvent) => void;
  searching: boolean;
  category: string;
  onClearFilters: () => void;
}) {
  return (
    <header className="rq-hero -mx-2 px-4 pt-6 pb-1 sm:-mx-4 sm:px-6 sm:pt-10 layout-wide:-mx-4">
      {/* Drifting aurora + glyphs, all behind and non-interactive */}
      <div className="rq-hero-aurora" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {SPARKS.map((s, i) => {
          const Icon = SPARK_ICONS[s.icon];
          return (
            <span
              key={i}
              className={`rq-hero-spark ${s.hideOnMobile ? "hidden sm:inline-flex" : ""}`}
              style={{ top: s.top, left: s.left, "--d": s.delay } as React.CSSProperties}
            >
              <Icon size={s.size} strokeWidth={2.2} />
            </span>
          );
        })}
      </div>

      <div className="relative flex items-center justify-between gap-4">
        {/* ── Copy + search ── */}
        <div className="min-w-0 flex-1">
          <p
            className="rq-enter inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-muted sm:text-[11px]"
            style={{ animationDelay: "60ms" }}
          >
            <Sparkles
              size={12}
              aria-hidden
              className="text-amber-500 dark:text-amber-300"
            />
            {firstName ? `welcome back, ${firstName}` : "your next read awaits"}
          </p>

          <h1
            className="rq-enter mt-2.5 text-[34px] leading-[1.04] sm:text-[46px] lg:text-[54px]"
            style={{ animationDelay: "160ms" }}
          >
            Explore{" "}
            <span className="rq-hero-words" aria-label="stories">
              {ROTATING_WORDS.map((w, i) => (
                <span
                  key={w}
                  aria-hidden={i > 0}
                  style={{ "--d": `${i * 2.5}s` } as React.CSSProperties}
                >
                  {w}
                </span>
              ))}
              <svg
                className="rq-hero-squiggle"
                viewBox="0 0 220 14"
                preserveAspectRatio="none"
                aria-hidden
              >
                <path
                  d="M3 10 Q 30 3, 58 8 T 112 8 T 166 8 T 217 7"
                  fill="none"
                  stroke="var(--brand-amber)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>

          <p
            className="rq-enter mt-3 hidden max-w-xl text-sm leading-relaxed text-muted sm:block sm:text-[15px]"
            style={{ animationDelay: "280ms" }}
          >
            Search by title, author, or vibe — knock out today&apos;s quest,
            and follow books to make this feel like home.
          </p>

          <form
            onSubmit={onSubmit}
            className="rq-enter mt-4 max-w-xl sm:mt-6"
            style={{ animationDelay: "400ms" }}
          >
            {/* Icon, input, and spinner/clear all live in one flex row inside
                the solid pill; the animated gradient ring is painted by the
                .rq-search wrapper around it. */}
            <div className="rq-search group">
              <div className="relative flex items-center gap-2.5 rounded-full bg-card pl-4 pr-2 sm:pl-5">
                <Search
                  size={17}
                  aria-hidden
                  className="shrink-0 text-muted transition-colors duration-300 group-focus-within:text-[var(--brand-1)]"
                />
                <input
                  value={q}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    onQChange(e.target.value)
                  }
                  placeholder="Search titles, authors, themes…"
                  aria-label="Search"
                  className="w-full bg-transparent py-3 text-[14px] outline-none placeholder:text-muted/70 sm:py-3.5 sm:text-[15px]"
                />
                {searching && q.trim() ? (
                  <span aria-hidden className="mr-1.5 flex shrink-0">
                    <RefreshCw size={15} className="animate-spin text-muted" />
                  </span>
                ) : q ? (
                  <button
                    type="button"
                    onClick={() => onQChange("")}
                    aria-label="Clear search"
                    className="mr-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-hover hover:text-foreground"
                  >
                    <X size={14} aria-hidden />
                  </button>
                ) : null}
              </div>
            </div>
          </form>

          {category ? (
            <div className="rq-enter mt-4 flex flex-wrap items-center gap-2 text-xs" style={{ animationDelay: "80ms" }}>
              <span className="text-muted">Filtering:</span>
              <span className="inline-flex items-center gap-2 rounded-full bg-pill px-3 py-1 font-semibold">
                {category}
                <button
                  type="button"
                  onClick={onClearFilters}
                  aria-label="Clear filter"
                  className="rounded-full p-0.5 hover:bg-hover"
                >
                  <X size={12} />
                </button>
              </span>
            </div>
          ) : null}
        </div>

        {/* ── Floating 3D book (tablet/desktop) ── */}
        <div
          className="rq-enter hidden shrink-0 pr-2 sm:block lg:pr-8"
          style={{ animationDelay: "300ms" }}
          aria-hidden
        >
          <div className="rq-book3d">
            <div className="rq-book3d-shadow" />
            <div className="rq-book3d-tilt">
              <div className="rq-book3d-page rq-book3d-page--left" />
              <div className="rq-book3d-page rq-book3d-page--right" />
              {/* Three leaves flipping on staggered delays reads as a
                  continuous riffle of pages. */}
              <div className="rq-book3d-leaf" style={{ "--d": "0s" } as React.CSSProperties} />
              <div className="rq-book3d-leaf" style={{ "--d": "1.1s" } as React.CSSProperties} />
              <div className="rq-book3d-leaf" style={{ "--d": "2.2s" } as React.CSSProperties} />
            </div>
          </div>
        </div>
      </div>

      <hr className="rq-hero-rule mt-6 sm:mt-8" aria-hidden />
    </header>
  );
}
