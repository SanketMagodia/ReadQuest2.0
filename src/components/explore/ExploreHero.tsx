"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { RefreshCw, Search, Sparkles, X } from "lucide-react";
import { VibePromptBox } from "@/components/explore/VibeRecommender";
import { useMood } from "@/components/mood/MoodProvider";
import { MoodAtmosphere } from "@/components/mood/MoodAtmosphere";

/**
 * Explore hero — replaces the old flat "welcome / Explore stories" rectangle.
 *
 * Borderless and full-bleed so it melts into the page background (which we
 * must not change): a blurred aurora drifts behind the type, the headline
 * cycles through gradient words with a self-drawing squiggle, and a pure-CSS
 * 3D book floats beside it turning its own pages.
 *
 * Search lives in `ExploreSearchDock` (a sibling under the Explore section) so
 * `position: sticky` can pin it for the whole page scroll, not only while the
 * short hero is on screen. Decorative motion is disabled under
 * prefers-reduced-motion.
 */

const ROTATING_WORDS = ["stories", "worlds", "ideas", "voices", "legends"];

export function ExploreHero({ firstName }: { firstName: string }) {
  const { activeMood } = useMood();

  return (
    <header className="rq-hero -mx-2 px-4 pt-6 pb-1 sm:-mx-4 sm:px-6 sm:pt-10 layout-wide:-mx-4">
      {/* With a mood set, the header becomes that weather instead of showing
          the book — see MoodAtmosphere. */}
      {activeMood ? <MoodAtmosphere mood={activeMood} /> : null}
      <div
        className={`rq-hero-aurora ${activeMood ? "rq-hero-aurora--muted" : ""}`}
        aria-hidden
      >
        <span />
        <span />
        <span />
      </div>
      {/* Sits after the scene so it washes over it, but still behind the copy.
          Full-bleed and feathered on every edge — a panel behind the text alone
          reads as a card pasted onto the banner. */}
      {activeMood ? <div className="rq-hero-scrim" aria-hidden /> : null}

      <div className="relative flex items-center justify-between gap-4">
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
        </div>

        {activeMood ? null : (
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
                <div className="rq-book3d-leaf" style={{ "--d": "0s" } as React.CSSProperties} />
                <div className="rq-book3d-leaf" style={{ "--d": "1.1s" } as React.CSSProperties} />
                <div className="rq-book3d-leaf" style={{ "--d": "2.2s" } as React.CSSProperties} />
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

/**
 * Sticky search for Explore. Render as a direct child of the tall page
 * `<section>` so sticky stays pinned while browsing results. Compacts into a
 * frosted strip once it docks under the top bar.
 */
export function ExploreSearchDock({
  q,
  onQChange,
  onSubmit,
  searching,
  category,
  onClearFilters,
  aiMode,
  onToggleAi,
  aiPrompt,
  onAiPromptChange,
  onAiSubmit,
  aiLoading,
  aiError,
}: {
  q: string;
  onQChange: (value: string) => void;
  onSubmit: (e?: FormEvent) => void;
  searching: boolean;
  category: string;
  onClearFilters: () => void;
  aiMode: boolean;
  onToggleAi: () => void;
  aiPrompt: string;
  onAiPromptChange: (value: string) => void;
  onAiSubmit: () => void;
  aiLoading: boolean;
  aiError: string | null;
}) {
  const dockRef = useRef<HTMLDivElement | null>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = dockRef.current;
    if (!el) return;

    // Matches `@custom-variant layout-wide` in globals.css (aspect-ratio).
    const mq = window.matchMedia("(min-aspect-ratio: 10001/10000)");

    const check = () => {
      const dockTop = mq.matches ? 0 : 48; // top-12 on compact
      setStuck(el.getBoundingClientRect().top <= dockTop + 0.5);
    };

    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    mq.addEventListener?.("change", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
      mq.removeEventListener?.("change", check);
    };
  }, []);

  return (
    <div
      ref={dockRef}
      className={`rq-search-dock rq-enter sticky top-12 z-20 -mx-2 -mt-2 px-4 sm:-mx-4 sm:-mt-3 sm:px-6 layout-wide:top-0 layout-wide:px-4 ${
        stuck ? "rq-search-dock--stuck" : ""
      }`}
      style={{ animationDelay: "400ms" }}
    >
      <div
        className={`mx-auto transition-[max-width] duration-300 ease-out ${
          stuck ? "max-w-3xl" : "max-w-2xl sm:mx-0"
        }`}
      >
        {/**
         * Two modes, not a field plus a submit button: a segmented switcher
         * makes it obvious that "Describe a vibe" swaps the input for a prompt
         * box rather than acting on whatever was typed into search.
         */}
        <div
          role="tablist"
          aria-label="How to find books"
          className="mb-2 inline-flex items-center gap-0.5 rounded-full border border-border bg-card p-1 shadow-[var(--shadow-soft)]"
        >
          <button
            type="button"
            role="tab"
            aria-selected={!aiMode}
            onClick={() => {
              if (aiMode) onToggleAi();
            }}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition ${
              aiMode
                ? "text-muted hover:text-foreground"
                : "bg-pill text-foreground"
            }`}
          >
            <Search size={12} aria-hidden />
            Search
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={aiMode}
            onClick={() => {
              if (!aiMode) onToggleAi();
            }}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition ${
              aiMode
                ? "text-white shadow-[var(--shadow-pop)]"
                : "text-muted hover:text-foreground"
            }`}
            style={aiMode ? { background: "var(--gradient-brand)" } : undefined}
          >
            <Sparkles
              size={12}
              aria-hidden
              className={aiMode ? "" : "rq-vibe-sparkle text-[var(--brand-1)]"}
            />
            Recommend me
          </button>
        </div>

        {aiMode ? (
          <VibePromptBox
            value={aiPrompt}
            onChange={onAiPromptChange}
            onSubmit={onAiSubmit}
            onClose={onToggleAi}
            loading={aiLoading}
            error={aiError}
          />
        ) : (
          <form onSubmit={onSubmit}>
            <div className={`rq-search group ${stuck ? "rq-search--stuck" : ""}`}>
              <div className="relative flex items-center gap-2.5 rounded-full bg-card pl-4 pr-2 sm:pl-5">
                <Search
                  size={stuck ? 15 : 17}
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
                  className={`w-full bg-transparent text-[14px] outline-none placeholder:text-muted/70 transition-[padding] duration-300 sm:text-[15px] ${
                    stuck ? "py-2.5" : "py-3 sm:py-3.5"
                  }`}
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
        )}
      </div>

      {category ? (
        <div
          className={`mx-auto mt-2 flex flex-wrap items-center gap-2 text-xs transition-[max-width] duration-300 ${
            stuck ? "max-w-3xl" : "max-w-2xl sm:mx-0"
          }`}
        >
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

      {!stuck ? (
        <hr className="rq-hero-rule mt-5 sm:mt-6" aria-hidden />
      ) : null}
    </div>
  );
}
