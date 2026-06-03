"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Award,
  BookOpenCheck,
  CheckCircle2,
  Flame,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";

type DailyResponse = {
  pick: {
    id: string;
    day: string;
    completed: boolean;
    farthestPage: number;
    book: {
      id: string;
      slug: string;
      title: string;
      authors: string;
      thumbnail: string;
      description: string;
      categories: string;
    };
  } | null;
  streak: {
    current: number;
    longest: number;
    lastDay: string;
    totalCompleted: number;
    today: string;
    completedToday: boolean;
  };
  summaryReady: boolean;
  stats?: {
    completedToday: number;
    bookReaders: number;
  };
};

/** "1.2k" style compact formatter. */
function compact(n: number): string {
  if (n < 1_000) return String(n);
  if (n < 10_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  if (n < 1_000_000) return `${Math.round(n / 1_000)}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

export function DailyBookCard() {
  const { status } = useSession();
  const [data, setData] = useState<DailyResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/feed/daily", { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as DailyResponse;
        if (!cancelled) setData(j);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  if (status !== "authenticated") return null;
  if (loading) return <DailyCardSkeleton />;
  if (!data?.pick) return null;

  const { pick, streak } = data;
  const stats = data.stats ?? { completedToday: 0, bookReaders: 0 };
  const firstCategory = pick.book.categories.split(/[,;]/)[0]?.trim() || "";

  return (
    <article
      className="relative overflow-hidden rounded-3xl border border-border bg-card p-px shadow-[var(--shadow-soft)] layout-compact:rounded-xl layout-compact:border-sky-300/40 layout-compact:bg-[color-mix(in_srgb,var(--brand-1)_6%,var(--card))] layout-compact:shadow-none dark:layout-compact:border-sky-700/50"
      aria-label="Today's read"
    >
      {/* Decorative gradient corner — desktop only */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 hidden h-56 w-56 rounded-full opacity-40 blur-3xl layout-wide:block"
        style={{ background: "var(--gradient-brand)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-16 hidden h-44 w-44 rounded-full opacity-30 blur-3xl layout-wide:block"
        style={{ background: "var(--gradient-warm)" }}
      />

      <div className="relative rounded-[22px] bg-card/95 p-5 layout-compact:rounded-[14px] layout-compact:p-3 sm:p-6">
        {/* Header strip */}
        <div className="flex items-center justify-between gap-2 layout-compact:gap-1.5">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted layout-compact:rounded-full layout-compact:bg-[color-mix(in_srgb,var(--brand-1)_14%,transparent)] layout-compact:px-2 layout-compact:py-0.5 layout-compact:text-[9px] layout-compact:tracking-[0.16em]">
            <Sparkles
              size={11}
              aria-hidden
              className="text-amber-500 dark:text-amber-300 layout-compact:h-[10px] layout-compact:w-[10px]"
            />
            Daily quest
          </p>
          <StreakBadge
            current={streak.current}
            longest={streak.longest}
            completedToday={streak.completedToday}
            compact
          />
        </div>

        <div className="mt-4 flex gap-4 layout-compact:mt-2.5 layout-compact:gap-3 sm:gap-5">
          {/* Book cover */}
          <div className="relative h-[130px] w-[90px] shrink-0 layout-compact:h-[88px] layout-compact:w-[62px] sm:h-[150px] sm:w-[104px]">
            <div
              aria-hidden
              className="absolute inset-0 -rotate-[4deg] rounded-xl bg-pill shadow-[var(--shadow-soft)] layout-compact:rounded-lg"
            />
            <div
              aria-hidden
              className="absolute inset-0 rotate-[3deg] rounded-xl bg-pill/80 shadow-[var(--shadow-soft)] layout-compact:rounded-lg layout-compact:hidden"
            />
            <div className="relative h-full w-full overflow-hidden rounded-xl ring-1 ring-border/60 shadow-[var(--shadow-pop)] layout-compact:rounded-lg layout-compact:shadow-sm">
              {pick.book.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={pick.book.thumbnail.replace(/^http:/, "https:")}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center text-base font-bold text-white"
                  style={{ background: "var(--gradient-brand)" }}
                >
                  {pick.book.title.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted layout-compact:hidden">
              Today&apos;s read
            </p>
            <h2 className="mt-1 text-lg font-bold leading-snug layout-compact:mt-0 layout-compact:text-[15px] sm:text-xl">
              <Link
                href={`/book/${pick.book.slug}`}
                className="hover:underline underline-offset-4"
              >
                {pick.book.title}
              </Link>
            </h2>
            {pick.book.authors ? (
              <p className="text-sm text-muted layout-compact:text-[12px] layout-compact:leading-snug">
                {pick.book.authors.split(/[,;]/)[0].trim()}
              </p>
            ) : null}

            {firstCategory ? (
              <p className="mt-2 inline-block rounded-full bg-pill px-2.5 py-0.5 text-[11px] font-semibold text-foreground/80 layout-compact:mt-1 layout-compact:hidden">
                #{firstCategory}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-2 layout-compact:mt-2 layout-compact:gap-1.5">
              {pick.completed ? (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white layout-compact:px-3 layout-compact:py-1.5 layout-compact:text-xs"
                  style={{ background: "var(--gradient-cool)" }}
                >
                  <CheckCircle2 size={14} aria-hidden className="layout-compact:h-3 layout-compact:w-3" />
                  Done for today
                </span>
              ) : (
                <Link
                  href="/daily"
                  className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-pop)] transition hover:brightness-110 layout-compact:px-3 layout-compact:py-1.5 layout-compact:text-xs layout-compact:shadow-sm"
                  style={{ background: "var(--gradient-brand)" }}
                >
                  <BookOpenCheck size={14} aria-hidden className="layout-compact:h-3 layout-compact:w-3" />
                  <span className="layout-compact:hidden">Open today&apos;s book</span>
                  <span className="hidden layout-compact:inline">Open</span>
                </Link>
              )}
              <Link
                href={`/book/${pick.book.slug}`}
                className="inline-flex items-center rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-hover layout-compact:hidden"
              >
                Visit book room
              </Link>
            </div>

            {/* Community stats — hidden on compact mobile */}
            {stats.completedToday > 0 || stats.bookReaders > 0 ? (
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-muted layout-compact:hidden">
                {stats.completedToday > 0 ? (
                  <CommunityStat
                    icon={Trophy}
                    accent="amber"
                    value={compact(stats.completedToday)}
                    label={
                      stats.completedToday === 1
                        ? "reader finished today"
                        : "readers finished today"
                    }
                  />
                ) : null}
                {stats.bookReaders > 0 ? (
                  <CommunityStat
                    icon={Users}
                    accent="sky"
                    value={compact(stats.bookReaders)}
                    label={
                      stats.bookReaders === 1
                        ? "has read this book"
                        : "have read this book"
                    }
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {/* Compact stats strip on mobile/portrait (same core numbers as desktop). */}
        <div className="mt-2 hidden grid-cols-3 gap-1.5 layout-compact:grid">
          <CompactStat label="Streak" value={`${streak.current}d`} icon={Flame} tone="warm" />
          <CompactStat label="Longest" value={`${streak.longest}d`} icon={Award} tone="brand" />
          <CompactStat label="Reads" value={`${streak.totalCompleted}`} icon={BookOpenCheck} tone="cool" />
        </div>

        {/* Bottom stats strip — desktop / landscape only */}
        <div className="mt-5 grid grid-cols-3 gap-2 border-t border-border/70 pt-4 text-[11px] font-semibold uppercase tracking-wide text-muted layout-compact:hidden">
          <Stat
            label="Streak"
            value={`${streak.current}d`}
            icon={Flame}
            tone="warm"
          />
          <Stat
            label="Longest"
            value={`${streak.longest}d`}
            icon={Award}
            tone="brand"
          />
          <Stat
            label="Reads"
            value={`${streak.totalCompleted}`}
            icon={BookOpenCheck}
            tone="cool"
          />
        </div>
      </div>
    </article>
  );
}

function CompactStat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone: "brand" | "warm" | "cool";
}) {
  const toneClass =
    tone === "warm"
      ? "text-amber-600 dark:text-amber-300"
      : tone === "cool"
        ? "text-emerald-600 dark:text-emerald-300"
        : "text-sky-600 dark:text-sky-300";
  return (
    <div className="rounded-lg border border-border/70 bg-pill/70 px-1.5 py-1.5 text-center">
      <span className={`inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.12em] ${toneClass}`}>
        <Icon size={9} />
        {label}
      </span>
      <p className="mt-0.5 text-[12px] font-bold leading-none text-foreground">{value}</p>
    </div>
  );
}

function StreakBadge({
  current,
  longest,
  completedToday,
  compact = false,
}: {
  current: number;
  longest: number;
  completedToday: boolean;
  compact?: boolean;
}) {
  const alive = current > 0;
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${
        compact ? "layout-compact:px-2 layout-compact:py-0.5 layout-compact:text-[10px]" : ""
      } ${alive ? "text-white" : "border border-border bg-card text-muted"}`}
      style={
        alive
          ? { background: completedToday ? "var(--gradient-warm)" : "var(--gradient-brand)" }
          : undefined
      }
      title={`Longest streak: ${longest} days`}
    >
      <Flame size={12} aria-hidden className={`${alive ? "" : "text-amber-500"} ${compact ? "layout-compact:h-[10px] layout-compact:w-[10px]" : ""}`} />
      {alive ? (
        <>
          <span className={compact ? "layout-compact:hidden" : ""}>{current}-day streak</span>
          <span className={compact ? "hidden layout-compact:inline" : "hidden"}>{current}d</span>
        </>
      ) : (
        <>
          <span className={compact ? "layout-compact:hidden" : ""}>Start your streak</span>
          <span className={compact ? "hidden layout-compact:inline" : "hidden"}>Streak</span>
        </>
      )}
    </div>
  );
}

function CommunityStat({
  icon: Icon,
  value,
  label,
  accent,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  value: string;
  label: string;
  accent: "amber" | "sky";
}) {
  const accentClass =
    accent === "amber"
      ? "text-amber-600 dark:text-amber-300"
      : "text-sky-600 dark:text-sky-300";
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon size={13} className={accentClass} />
      <span className="font-semibold text-foreground">{value}</span>
      <span>{label}</span>
    </span>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone: "brand" | "warm" | "cool";
}) {
  const toneClass =
    tone === "warm"
      ? "text-amber-600 dark:text-amber-300"
      : tone === "cool"
        ? "text-emerald-600 dark:text-emerald-300"
        : "text-sky-600 dark:text-sky-300";
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-pill/70 px-3 py-2">
      <span className={`inline-flex items-center gap-1 text-[10px] ${toneClass}`}>
        <Icon size={11} />
        {label}
      </span>
      <span className="mt-0.5 text-sm font-bold text-foreground">{value}</span>
    </div>
  );
}

function DailyCardSkeleton() {
  return (
    <div className="animate-pulse rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] layout-compact:rounded-xl layout-compact:p-3 layout-compact:shadow-none sm:p-6">
      <div className="flex gap-4 layout-compact:gap-3 sm:gap-5">
        <div className="h-[130px] w-[90px] shrink-0 rounded-xl bg-pill layout-compact:h-[88px] layout-compact:w-[62px] sm:h-[150px] sm:w-[104px]" />
        <div className="flex-1 space-y-2 layout-compact:space-y-1.5">
          <div className="h-3 w-20 rounded bg-pill layout-compact:h-2.5 layout-compact:w-16" />
          <div className="h-5 w-3/4 rounded bg-pill layout-compact:h-4" />
          <div className="h-3 w-1/2 rounded bg-pill layout-compact:hidden" />
          <div className="mt-4 h-9 w-44 rounded-full bg-pill layout-compact:mt-2 layout-compact:h-7 layout-compact:w-20" />
        </div>
      </div>
    </div>
  );
}
