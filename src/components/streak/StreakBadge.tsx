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
  const alive = current !== null && n > 0;
  const label =
    n > 0
      ? `${n}-day daily quest streak${completedToday ? " · done today" : ""}`
      : "Start your daily quest streak";

  /**
   * A fixed circle, matching the ThemeToggle that occupies this same slot for
   * signed-out readers. The flame and the count side by side used to widen the
   * badge with every extra digit, which pushed it out of the sidebar header —
   * so a live streak shows the number alone and the flame stands in for zero.
   */
  return (
    <Link
      href="/daily"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border shadow-[var(--shadow-soft)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70",
        alive && completedToday
          ? "border-transparent bg-orange-500 text-white hover:brightness-110"
          : alive
            ? "border-orange-400/60 bg-orange-500/10 text-orange-600 hover:bg-orange-500/15 dark:text-orange-300"
            : "border-border bg-card text-muted hover:bg-hover",
        className
      )}
    >
      {alive ? (
        <span
          className={cn(
            "font-bold leading-none tabular-nums",
            n > 99 ? "text-[10px]" : "text-sm"
          )}
        >
          {n}
        </span>
      ) : (
        <Flame size={18} aria-hidden />
      )}
    </Link>
  );
}
