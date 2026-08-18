"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import {
  ArrowRight,
  BookOpen,
  Globe,
  RefreshCw,
  X,
} from "lucide-react";

export type VibePick = {
  source: "local" | "openlibrary";
  id?: string;
  slug?: string;
  olKey?: string;
  title: string;
  authors: string;
  thumbnail: string;
  categories?: string;
  publishedYear?: number;
  averageRating?: number;
  ratingsCount?: number;
  isbn?: string;
  numPages?: number;
  why: string;
  tag: string;
  match: number;
};

export type VibeResult = { echo: string; picks: VibePick[]; vibe: string };

/**
 * The prompt box the search field swaps to. Kept plain and compact: a label,
 * a two-line box, and one button. The quality of the picks comes from what the
 * reader writes, so nothing here competes with the writing.
 */
export function VibePromptBox({
  value,
  onChange,
  onSubmit,
  onClose,
  loading,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  loading: boolean;
  error: string | null;
}) {
  const areaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    areaRef.current?.focus();
  }, []);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter keeps a newline for longer descriptions.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
    if (e.key === "Escape") onClose();
  }

  const canSubmit = value.trim().length >= 3 && !loading;

  return (
    <div className="rq-vibe-box">
      <div className="relative rounded-[22px] bg-card px-3.5 py-3">
        <label
          htmlFor="rq-vibe-input"
          className="text-[12.5px] font-semibold text-foreground/90"
        >
          What do you feel like reading?
        </label>

        <textarea
          id="rq-vibe-input"
          ref={areaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          maxLength={600}
          disabled={loading}
          placeholder="Say it however you like — “something slow and rainy about starting over”"
          className="mt-1 w-full resize-none bg-transparent text-[14.5px] leading-relaxed outline-none placeholder:text-muted/60 disabled:opacity-60"
        />

        <div className="flex items-end justify-between gap-3">
          <p
            aria-live="polite"
            className={`text-[11px] leading-snug ${
              error ? "text-red-500 dark:text-red-400" : "text-muted"
            }`}
          >
            {error
              ? error
              : loading
                ? "Picking your books…"
                : "A sentence or two gets the best picks."}
          </p>

          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold text-white shadow-[var(--shadow-pop)] transition active:translate-y-px disabled:opacity-45"
            style={{ background: "var(--gradient-brand)" }}
          >
            {loading ? (
              <RefreshCw size={13} aria-hidden className="animate-spin" />
            ) : null}
            {loading ? "Finding…" : "Recommend"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Skeleton shown while the librarian is thinking. */
export function VibeResultsSkeleton() {
  return (
    <section aria-label="Finding recommendations" className="rq-vibe-results">
      <div className="h-4 w-64 max-w-full rounded skeleton-shimmer" />
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="flex gap-3 rounded-2xl border border-border bg-card p-3"
          >
            <div className="h-[104px] w-[70px] shrink-0 rounded-lg skeleton-shimmer" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-3 w-3/4 rounded skeleton-shimmer" />
              <div className="h-3 w-1/2 rounded skeleton-shimmer" />
              <div className="h-3 w-full rounded skeleton-shimmer" />
              <div className="h-3 w-5/6 rounded skeleton-shimmer" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function VibeResults({
  result,
  adoptingKey,
  onOpen,
  onRefine,
  onDismiss,
}: {
  result: VibeResult;
  adoptingKey: string | null;
  onOpen: (pick: VibePick) => void;
  onRefine: () => void;
  onDismiss: () => void;
}) {
  return (
    <section aria-label="Your recommendations" className="rq-vibe-results">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Recommended for you
          </p>
          {result.echo ? (
            <p className="mt-1.5 font-display text-lg leading-snug sm:text-xl">
              “{result.echo}”
            </p>
          ) : null}
          <p className="mt-1 line-clamp-1 text-xs text-muted">
            from “{result.vibe}”
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onRefine}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-semibold text-muted transition hover:bg-hover hover:text-foreground"
          >
            Refine
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss recommendations"
            className="rounded-full border border-border bg-card p-1.5 text-muted transition hover:bg-hover hover:text-foreground"
          >
            <X size={13} aria-hidden />
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {result.picks.map((p, i) => (
          <VibeCard
            key={`${p.title}-${i}`}
            pick={p}
            rank={i + 1}
            adopting={Boolean(p.olKey) && adoptingKey === p.olKey}
            disabled={Boolean(adoptingKey) && adoptingKey !== p.olKey}
            onOpen={() => onOpen(p)}
          />
        ))}
      </div>
    </section>
  );
}

function VibeCard({
  pick,
  rank,
  adopting,
  disabled,
  onOpen,
}: {
  pick: VibePick;
  rank: number;
  adopting: boolean;
  disabled: boolean;
  onOpen: () => void;
}) {
  const author = pick.authors.split(/[,;]/)[0]?.trim() ?? "";

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled || adopting}
      style={{ animationDelay: `${Math.min(rank * 60, 360)}ms` }}
      className="rq-vibe-card group flex gap-3 rounded-2xl border border-border bg-card p-3 text-left shadow-[var(--shadow-soft)] outline-none transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-[var(--ring)]/70 disabled:opacity-60"
    >
      <div className="relative h-[104px] w-[70px] shrink-0 overflow-hidden rounded-lg bg-pill ring-1 ring-border/70">
        {pick.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pick.thumbnail.replace(/^http:/, "https:")}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center p-2 text-center text-[10px] font-bold leading-tight text-white"
            style={{ background: "var(--gradient-cool)" }}
          >
            {pick.title}
          </span>
        )}
        <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/90 text-[10px] font-black tabular-nums shadow">
          {rank}
        </span>
        {adopting ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-white">
            <RefreshCw size={16} aria-hidden className="animate-spin" />
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start gap-2">
          <p className="line-clamp-2 flex-1 text-[14px] font-semibold leading-snug">
            {pick.title}
          </p>
          <span
            title={`${pick.match}% match to your description`}
            className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--brand-1)_14%,transparent)] px-2 py-0.5 text-[10px] font-bold tabular-nums text-[var(--brand-1)]"
          >
            {pick.match}%
          </span>
        </div>
        {author ? (
          <p className="mt-0.5 line-clamp-1 text-[12px] text-muted">{author}</p>
        ) : null}

        <p className="mt-1.5 line-clamp-3 text-[12.5px] leading-relaxed text-foreground/85">
          {pick.why}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2 text-[10px]">
          {pick.tag ? (
            <span className="rounded-full bg-pill px-2 py-0.5 font-semibold uppercase tracking-wide text-muted">
              {pick.tag}
            </span>
          ) : null}
          {pick.source === "openlibrary" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 font-semibold text-emerald-600 dark:text-emerald-300">
              <Globe size={9} aria-hidden /> Add to library
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-pill px-2 py-0.5 font-semibold text-muted">
              <BookOpen size={9} aria-hidden /> In library
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-0.5 font-semibold text-[var(--brand-1)] opacity-0 transition group-hover:opacity-100">
            {adopting ? "Adding…" : "Open"}
            <ArrowRight size={10} aria-hidden />
          </span>
        </div>
      </div>
    </button>
  );
}
