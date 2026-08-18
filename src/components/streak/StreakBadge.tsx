"use client";

import Link from "next/link";
import { Flame } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";

/** Lucide's flame outline, reused as a fill so it reads as a solid flame. */
const FLAME_PATH =
  "M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4";

/**
 * A burning flame: the silhouette in a deep-orange-to-amber wash with a
 * scaled-down copy of itself as the pale hot core. Unlit, it collapses to a
 * flat `currentColor` glyph.
 */
function FlameArt({ size, lit }: { size: number; lit: boolean }) {
  // Gradient ids are document-global, so two badges on one page would other-
  // wise share (and fight over) the same defs.
  const uid = useId().replace(/:/g, "");

  if (!lit) {
    return (
      <Flame
        size={size}
        aria-hidden
        strokeWidth={1.9}
        className="shrink-0"
      />
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      className="shrink-0"
    >
      <defs>
        <linearGradient
          id={`${uid}-outer`}
          x1="12"
          y1="22"
          x2="12"
          y2="2"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#ea580c" />
          <stop offset="42%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
        <linearGradient
          id={`${uid}-core`}
          x1="12"
          y1="21"
          x2="12"
          y2="11"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#fb923c" />
          <stop offset="55%" stopColor="#fcd34d" />
          <stop offset="100%" stopColor="#fffbeb" />
        </linearGradient>
      </defs>
      <path d={FLAME_PATH} fill={`url(#${uid}-outer)`} />
      <g transform="translate(12 16.4) scale(0.52) translate(-12 -16.4)">
        <path d={FLAME_PATH} fill={`url(#${uid}-core)`} />
      </g>
    </svg>
  );
}

/**
 * Daily-quest streak indicator. Shown in place of the theme toggle for
 * signed-in readers (their theme is driven by their reading mood). Links to
 * the daily quest so a tap resumes the streak.
 *
 * No chrome anywhere — just the flame and the count. A bordered chip competed
 * with the wordmark it sits beside in both bars.
 *
 * `size` is a prop rather than something callers patch in through `className`,
 * because `cn` is plain clsx — a `h-8` passed alongside the built-in `h-10`
 * would be decided by stylesheet order, not by the caller.
 */
export function StreakBadge({
  className,
  size = "md",
}: {
  className?: string;
  /** `sm` for the compact top bar, `md` for the sidebar header. */
  size?: "sm" | "md";
}) {
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
  const loaded = current !== null;
  const alive = loaded && n > 0;
  const label =
    n > 0
      ? `${n}-day daily quest streak${completedToday ? " · done today" : ""}`
      : "Start your daily quest streak";

  const focus =
    "transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70";

  // Only a streak kept up *today* gets the glow.
  const glow =
    completedToday && alive
      ? "drop-shadow-[0_0_5px_rgba(249,115,22,0.6)]"
      : undefined;

  const small = size === "sm";

  return (
    <Link
      href="/daily"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 hover:bg-hover",
        small ? "h-8" : "h-10",
        alive ? null : "text-muted",
        focus,
        className
      )}
    >
      <span className={glow}>
        <FlameArt size={small ? 18 : 20} lit={alive} />
      </span>
      {alive ? (
        <span
          className={cn(
            "font-extrabold leading-none tabular-nums text-orange-600 dark:text-orange-300",
            small ? "text-[12.5px]" : "text-[13px]"
          )}
        >
          {n > 99 ? "99+" : n}
        </span>
      ) : null}
    </Link>
  );
}
