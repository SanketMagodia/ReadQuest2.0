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
      className="relative flex h-full min-h-[13rem] flex-col overflow-hidden rounded-3xl border border-border bg-card p-px shadow-[var(--shadow-soft)] layout-compact:rounded-xl layout-compact:border-sky-300/40 layout-compact:bg-[color-mix(in_srgb,var(--brand-1)_6%,var(--card))] layout-compact:shadow-none layout-wide:min-h-[18rem] dark:layout-compact:border-sky-700/50"
      aria-label="Today's read"
    >
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

      <div className="relative flex min-h-0 flex-1 flex-col rounded-[22px] bg-card/95 p-4 layout-compact:rounded-[14px] layout-compact:p-3 sm:p-5">
        <div className="flex items-center justify-between gap-2 layout-compact:gap-1.5">
          <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted layout-compact:rounded-full layout-compact:bg-[color-mix(in_srgb,var(--brand-1)_14%,transparent)] layout-compact:px-2 layout-compact:py-0.5 layout-compact:text-[9px] layout-compact:tracking-[0.14em]">
            <Sparkles
              size={10}
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

        <div className="mt-3 flex gap-3 layout-compact:mt-2 layout-compact:gap-2.5 sm:mt-4 sm:gap-4">
          <div className="relative h-[120px] w-[84px] shrink-0 layout-compact:h-[88px] layout-compact:w-[62px] sm:h-[140px] sm:w-[98px]">
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
                  className="flex h-full w-full items-center justify-center text-sm font-bold text-white"
                  style={{ background: "var(--gradient-brand)" }}
                >
                  {pick.book.title.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted layout-compact:hidden">
              Today&apos;s read
            </p>
            <h2 className="mt-0.5 line-clamp-2 text-[15px] font-bold leading-snug layout-compact:mt-0 layout-compact:text-[14px] sm:text-[17px]">
              <Link
                href={`/book/${pick.book.slug}`}
                className="hover:underline underline-offset-4"
              >
                {pick.book.title}
              </Link>
            </h2>
            {pick.book.authors ? (
              <p className="mt-0.5 truncate text-[12px] text-muted layout-compact:text-[11px] sm:text-[13px]">
                {pick.book.authors.split(/[,;]/)[0].trim()}
              </p>
            ) : null}

            {firstCategory ? (
              <p className="mt-1.5 inline-block rounded-full bg-pill px-2 py-0.5 text-[10px] font-semibold text-foreground/80 layout-compact:hidden">
                #{firstCategory}
              </p>
            ) : null}

            <div className="mt-2 flex flex-wrap items-center gap-1.5 layout-compact:mt-1.5 sm:mt-3 sm:gap-2">
              {pick.completed ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold text-white sm:text-xs"
                  style={{ background: "var(--gradient-cool)" }}
                >
                  <CheckCircle2 size={13} aria-hidden />
                  Done for today
                </span>
              ) : (
                <Link
                  href="/daily"
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold text-white shadow-[var(--shadow-pop)] transition hover:brightness-110 sm:text-xs"
                  style={{ background: "var(--gradient-brand)" }}
                >
                  <BookOpenCheck size={13} aria-hidden />
                  <span className="layout-compact:hidden">Open today&apos;s book</span>
                  <span className="hidden layout-compact:inline">Open</span>
                </Link>
              )}
              <Link
                href={`/book/${pick.book.slug}`}
                className="inline-flex items-center rounded-full border border-border bg-card px-2.5 py-1.5 text-[11px] font-semibold hover:bg-hover layout-compact:hidden sm:text-xs"
              >
                Visit book room
              </Link>
            </div>

            {stats.completedToday > 0 || stats.bookReaders > 0 ? (
              <div className="mt-2 hidden flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted layout-wide:flex">
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

        <div className="mt-2 hidden shrink-0 grid-cols-3 gap-1 layout-compact:grid">
          <CompactStat label="Streak" value={`${streak.current}d`} icon={Flame} tone="warm" />
          <CompactStat label="Longest" value={`${streak.longest}d`} icon={Award} tone="brand" />
          <CompactStat label="Reads" value={`${streak.totalCompleted}`} icon={BookOpenCheck} tone="cool" />
        </div>

        <div className="mt-4 grid shrink-0 grid-cols-3 gap-2 border-t border-border/70 pt-3 text-[10px] font-semibold uppercase tracking-wide text-muted layout-compact:hidden sm:mt-5 sm:pt-4">
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
    <div
      className="min-w-0 rounded-lg bg-pill/70 px-1 py-1.5 text-center"
      title={`${label}: ${value}`}
    >
      <span className={`inline-flex items-center justify-center ${toneClass}`}>
        <Icon size={11} aria-hidden />
      </span>
      <p className="mt-0.5 truncate text-[11px] font-bold leading-none text-foreground">{value}</p>
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
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold sm:px-3 sm:py-1 sm:text-[11px] ${
        compact ? "layout-compact:px-2 layout-compact:py-0.5 layout-compact:text-[9px]" : ""
      } ${alive ? "text-white" : "border border-border bg-card text-muted"}`}
      style={
        alive
          ? { background: completedToday ? "var(--gradient-warm)" : "var(--gradient-brand)" }
          : undefined
      }
      title={`Longest streak: ${longest} days`}
    >
      <Flame size={10} aria-hidden className={`${alive ? "" : "text-amber-500"} sm:h-3 sm:w-3`} />
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
    <span className="inline-flex items-center gap-1">
      <Icon size={12} className={accentClass} />
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
    <div className="flex flex-col items-center justify-center rounded-2xl bg-pill/70 px-2.5 py-1.5 sm:px-3 sm:py-2">
      <span className={`inline-flex items-center gap-1 text-[9px] sm:text-[10px] ${toneClass}`}>
        <Icon size={10} />
        {label}
      </span>
      <span className="mt-0.5 text-[13px] font-bold text-foreground sm:text-sm">{value}</span>
    </div>
  );
}

function DailyCardSkeleton() {
  return (
    <div className="flex min-h-[13rem] animate-pulse flex-col rounded-3xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] layout-compact:rounded-xl layout-compact:p-3 layout-compact:shadow-none layout-wide:min-h-[18rem] sm:p-5">
      <div className="flex flex-1 gap-3 layout-compact:gap-2.5 sm:gap-4">
        <div className="h-[120px] w-[84px] shrink-0 rounded-xl bg-pill layout-compact:h-[88px] layout-compact:w-[62px] sm:h-[140px] sm:w-[98px]" />
        <div className="flex flex-1 flex-col gap-1.5 pt-0.5">
          <div className="h-2.5 w-16 rounded bg-pill layout-compact:w-14" />
          <div className="h-4 w-full rounded bg-pill layout-compact:h-3.5" />
          <div className="h-3 w-1/2 rounded bg-pill layout-compact:hidden" />
          <div className="mt-auto h-7 w-20 rounded-full bg-pill sm:h-8 sm:w-36" />
        </div>
      </div>
      <div className="mt-2 hidden grid-cols-3 gap-1 layout-compact:grid">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-10 rounded-lg bg-pill/80" />
        ))}
      </div>
    </div>
  );
}
