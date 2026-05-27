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
};

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
  const firstCategory = pick.book.categories.split(/[,;]/)[0]?.trim() || "";

  return (
    <article
      className="relative overflow-hidden rounded-3xl border border-border bg-card p-px shadow-[var(--shadow-soft)]"
      aria-label="Today's read"
    >
      {/* Decorative gradient corner */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full opacity-40 blur-3xl"
        style={{ background: "var(--gradient-brand)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-16 h-44 w-44 rounded-full opacity-30 blur-3xl"
        style={{ background: "var(--gradient-warm)" }}
      />

      <div className="relative rounded-[22px] bg-card/95 p-5 sm:p-6">
        {/* Header strip */}
        <div className="flex items-center justify-between gap-3">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
            <Sparkles
              size={11}
              aria-hidden
              className="text-amber-500 dark:text-amber-300"
            />
            Daily quest
          </p>
          <StreakBadge
            current={streak.current}
            longest={streak.longest}
            completedToday={streak.completedToday}
          />
        </div>

        <div className="mt-4 flex gap-4 sm:gap-5">
          {/* Book cover */}
          <div className="relative h-[130px] w-[90px] shrink-0 sm:h-[150px] sm:w-[104px]">
            <div
              aria-hidden
              className="absolute inset-0 -rotate-[4deg] rounded-xl bg-pill shadow-[var(--shadow-soft)]"
            />
            <div
              aria-hidden
              className="absolute inset-0 rotate-[3deg] rounded-xl bg-pill/80 shadow-[var(--shadow-soft)]"
            />
            <div className="relative h-full w-full overflow-hidden rounded-xl ring-1 ring-border/60 shadow-[var(--shadow-pop)]">
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              Today&apos;s read
            </p>
            <h2 className="mt-1 text-lg font-bold leading-snug sm:text-xl">
              <Link
                href={`/book/${pick.book.slug}`}
                className="hover:underline underline-offset-4"
              >
                {pick.book.title}
              </Link>
            </h2>
            {pick.book.authors ? (
              <p className="text-sm text-muted">
                {pick.book.authors.split(/[,;]/)[0].trim()}
              </p>
            ) : null}

            {firstCategory ? (
              <p className="mt-2 inline-block rounded-full bg-pill px-2.5 py-0.5 text-[11px] font-semibold text-foreground/80">
                #{firstCategory}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {pick.completed ? (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white"
                  style={{ background: "var(--gradient-cool)" }}
                >
                  <CheckCircle2 size={14} aria-hidden />
                  Done for today
                </span>
              ) : (
                <Link
                  href="/daily"
                  className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-pop)] transition hover:brightness-110"
                  style={{ background: "var(--gradient-brand)" }}
                >
                  <BookOpenCheck size={14} aria-hidden />
                  Open today&apos;s book
                </Link>
              )}
              <Link
                href={`/book/${pick.book.slug}`}
                className="inline-flex items-center rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-hover"
              >
                Visit book room
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom stats strip */}
        <div className="mt-5 grid grid-cols-3 gap-2 border-t border-border/70 pt-4 text-[11px] font-semibold uppercase tracking-wide text-muted">
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

function StreakBadge({
  current,
  longest,
  completedToday,
}: {
  current: number;
  longest: number;
  completedToday: boolean;
}) {
  const alive = current > 0;
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${
        alive ? "text-white" : "border border-border bg-card text-muted"
      }`}
      style={
        alive
          ? { background: completedToday ? "var(--gradient-warm)" : "var(--gradient-brand)" }
          : undefined
      }
      title={`Longest streak: ${longest} days`}
    >
      <Flame size={12} aria-hidden className={alive ? "" : "text-amber-500"} />
      {alive ? `${current}-day streak` : "Start your streak"}
    </div>
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
    <div className="animate-pulse rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] sm:p-6">
      <div className="flex gap-4 sm:gap-5">
        <div className="h-[130px] w-[90px] shrink-0 rounded-xl bg-pill sm:h-[150px] sm:w-[104px]" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-20 rounded bg-pill" />
          <div className="h-5 w-3/4 rounded bg-pill" />
          <div className="h-3 w-1/2 rounded bg-pill" />
          <div className="mt-4 h-9 w-44 rounded-full bg-pill" />
        </div>
      </div>
    </div>
  );
}
