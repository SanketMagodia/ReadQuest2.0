"use client";

import Link from "next/link";
import { Flame } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Daily-quest streak indicator. Shown in place of the theme toggle for
 * signed-in readers (their theme is driven by their reading mood). Links to
 * the daily quest so a tap resumes the streak.
 */
export function StreakBadge({ className }: { className?: string }) {
  const [current, setCurrent] = useState<number | null>(null);
  const [completedToday, setCompletedToday] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/streak", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { current?: number; completedToday?: boolean } | null) => {
        if (!alive || !d) return;
        setCurrent(typeof d.current === "number" ? d.current : 0);
        setCompletedToday(Boolean(d.completedToday));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const n = current ?? 0;
  const label =
    n > 0
      ? `${n}-day daily quest streak${completedToday ? " · done today" : ""}`
      : "Start your daily quest streak";

  return (
    <Link
      href="/daily"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-10 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm font-bold text-foreground/80 shadow-[var(--shadow-soft)] transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70",
        className
      )}
    >
      <Flame
        size={16}
        aria-hidden
        className={n > 0 ? "text-orange-500" : "text-muted"}
        fill={n > 0 && completedToday ? "currentColor" : "none"}
      />
      <span className="tabular-nums">{current === null ? "–" : n}</span>
    </Link>
  );
}
