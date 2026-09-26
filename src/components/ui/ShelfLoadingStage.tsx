"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Decorative jackets for loading shelves. Color and a blurred wash only —
 * no cover images, so the screen can paint before any book request returns.
 */
const JACKETS = [
  { base: "#38bdf8", art: "radial-gradient(circle at 34% 32%, #fde68a 0 18%, transparent 36%), radial-gradient(circle at 72% 62%, #1e3a8a 0 22%, transparent 40%)", spine: "#0c4a6e" },
  { base: "#fb7185", art: "radial-gradient(circle at 40% 28%, #fff7ed 0 16%, transparent 34%), radial-gradient(circle at 66% 70%, #9f1239 0 24%, transparent 42%)", spine: "#881337" },
  { base: "#34d399", art: "radial-gradient(circle at 30% 36%, #ecfccb 0 18%, transparent 36%), radial-gradient(circle at 74% 58%, #065f46 0 22%, transparent 40%)", spine: "#064e3b" },
  { base: "#a78bfa", art: "radial-gradient(circle at 36% 30%, #fae8ff 0 16%, transparent 34%), radial-gradient(circle at 64% 68%, #4c1d95 0 24%, transparent 42%)", spine: "#4c1d95" },
  { base: "#fb923c", art: "radial-gradient(circle at 32% 34%, #ffedd5 0 18%, transparent 36%), radial-gradient(circle at 70% 64%, #9a3412 0 22%, transparent 40%)", spine: "#9a3412" },
  { base: "#22d3ee", art: "radial-gradient(circle at 38% 28%, #ecfeff 0 16%, transparent 34%), radial-gradient(circle at 68% 70%, #155e75 0 24%, transparent 42%)", spine: "#155e75" },
  { base: "#f472b6", art: "radial-gradient(circle at 34% 32%, #fdf2f8 0 18%, transparent 36%), radial-gradient(circle at 70% 66%, #9d174d 0 22%, transparent 40%)", spine: "#831843" },
  { base: "#facc15", art: "radial-gradient(circle at 36% 30%, #fffbeb 0 16%, transparent 34%), radial-gradient(circle at 66% 68%, #a16207 0 24%, transparent 42%)", spine: "#854d0e" },
  { base: "#60a5fa", art: "radial-gradient(circle at 32% 34%, #eff6ff 0 18%, transparent 36%), radial-gradient(circle at 72% 62%, #1e3a8a 0 22%, transparent 40%)", spine: "#1e3a8a" },
  { base: "#2dd4bf", art: "radial-gradient(circle at 40% 28%, #f0fdfa 0 16%, transparent 34%), radial-gradient(circle at 64% 70%, #115e59 0 24%, transparent 42%)", spine: "#115e59" },
] as const;

const ROW = [...JACKETS.keys(), ...JACKETS.keys()];

function BookFace({ index, tall }: { index: number; tall?: boolean }) {
  const jacket = JACKETS[index % JACKETS.length];
  return (
    <div
      aria-hidden
      className={cn(
        "relative shrink-0 overflow-hidden rounded-[4px]",
        tall ? "h-40 w-[6.4rem]" : "h-[7.4rem] w-[4.7rem]"
      )}
      style={{ background: jacket.base }}
    >
      <span
        className="absolute -inset-4"
        style={{ background: jacket.art, filter: "blur(8px)" }}
      />
      <span className="absolute inset-y-0 left-0 w-[7px]" style={{ background: jacket.spine }} />
      <span className="absolute inset-x-2 bottom-3 flex flex-col gap-1">
        <span className="h-[3px] w-4/5 rounded-full bg-white/60" />
        <span className="h-[3px] w-3/5 rounded-full bg-white/40" />
      </span>
    </div>
  );
}

function ShelfRow({ reverse, duration, tall }: { reverse?: boolean; duration: string; tall?: boolean }) {
  return (
    <div className="overflow-hidden">
      <div
        className="animate-marquee flex w-max items-end gap-3 px-1.5"
        style={{
          animationDuration: duration,
          animationDirection: reverse ? "reverse" : "normal",
        }}
      >
        {ROW.map((n, i) => (
          <BookFace key={i} index={n} tall={tall} />
        ))}
      </div>
    </div>
  );
}

/**
 * The gist loading stage, reusable: a drifting shelf of blank jackets, the
 * owl, and a line that changes while the real page is still on its way.
 */
export function ShelfLoadingStage({
  lines,
  hint,
  className,
  tall = false,
}: {
  lines: readonly string[];
  hint: string;
  className?: string;
  tall?: boolean;
}) {
  const [line, setLine] = useState(0);

  useEffect(() => {
    if (lines.length < 2) return;
    const id = window.setInterval(() => {
      setLine((n) => (n + 1) % lines.length);
    }, 2200);
    return () => window.clearInterval(id);
  }, [lines]);

  return (
    <div className={cn("relative flex items-center justify-center overflow-hidden", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex flex-col justify-center gap-4 opacity-[0.28]"
        style={{
          maskImage:
            "radial-gradient(ellipse 72% 68% at 50% 50%, #000 0%, rgba(0,0,0,0.45) 38%, transparent 72%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 72% 68% at 50% 50%, #000 0%, rgba(0,0,0,0.45) 38%, transparent 72%)",
        }}
      >
        <ShelfRow duration="46s" tall={tall} />
        <ShelfRow reverse duration="54s" tall={tall} />
      </div>
      <div className="relative z-10 flex flex-col items-center px-6 text-center" role="status" aria-live="polite" aria-busy="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/loading.gif"
          alt=""
          width={96}
          height={96}
          className="select-none object-contain drop-shadow-[0_10px_24px_rgba(56,189,248,0.22)]"
        />
        <p
          key={line}
          className="animate-fade mt-3 max-w-[26ch] text-lg font-semibold tracking-tight"
          style={{ fontFamily: "var(--font-reading-serif), Georgia, serif" }}
        >
          {lines[line] ?? lines[0]}
        </p>
        <p className="mt-1 text-xs text-muted">{hint}</p>
      </div>
    </div>
  );
}
