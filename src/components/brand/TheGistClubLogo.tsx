"use client";

import Link from "next/link";
import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * "The Gist Club" brand lockup.
 *
 * Mark: a sky-gradient quill writing in the air — an amber flourish draws
 * itself under the nib in a loop, an ink drop lands where it finishes, and
 * a star twinkles at the feather's tip while the quill sways with a
 * writing rhythm. Wordmark: editorial two-liner — a tiny letterspaced THE
 * over a big Fraunces "Gist Club", with "Gist" carrying a slow sky→amber
 * shimmer.
 *
 * Works horizontally at any size (sidebar + mobile topbar). Animation lives
 * in globals.css (.gc-* classes) and stops under prefers-reduced-motion.
 * Standalone animated SVGs for use elsewhere:
 * public/brand/gist-club-lite.svg / gist-club-dark.svg.
 */

type TheGistClubLogoProps = {
  /** Overall lockup height in px. */
  height?: number;
  className?: string;
  /** Link target; pass `false` for a non-clickable mark */
  href?: string | false;
  priority?: boolean;
};

export function TheGistClubLogo({
  height = 40,
  className,
  href = "/",
}: TheGistClubLogoProps) {
  // The logo renders more than once per page (sidebar + mobile topbar), so
  // the SVG gradient needs a unique id per instance: with a shared id, the
  // browser resolves url(#…) to the FIRST match in the document — and when
  // that copy sits in a display:none subtree (the hidden sidebar on
  // phones), the gradient paints nothing and the quill disappears.
  const gradId = `gc-quill-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const markH = height;
  const markW = Math.round(markH * (52 / 46));
  const nameSize = Math.round(height * 0.5);
  const theSize = Math.max(7.5, height * 0.185);
  const gap = Math.max(6, Math.round(height * 0.22));

  const mark = (
    <span className={cn("gc-logo inline-flex items-center", className)} style={{ gap }}>
      <span className="gc-mark" style={{ width: markW, height: markH }}>
        <svg viewBox="0 0 52 46" aria-hidden>
          <defs>
            <linearGradient id={gradId} x1="1" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#38bdf8" />
              <stop offset="0.55" stopColor="#0ea5e9" />
              <stop offset="1" stopColor="#0284c7" />
            </linearGradient>
          </defs>
          <g className="gc-feather">
            {/* Quill vane — elegant curved teardrop */}
            <path
              d="M44.5 2.5 C 30 4.5 15.5 16.5 8.8 33.5 C 8.2 35.2 9.8 36.6 11.4 35.9 C 28.5 28 41.5 15.5 44.5 2.5 Z"
              fill={`url(#${gradId})`}
            />
            {/* Central shaft */}
            <path
              d="M43 4.5 C 32 12 20 24 11.5 34.2"
              fill="none"
              stroke="#e0f2fe"
              strokeWidth="1.4"
              strokeLinecap="round"
              opacity="0.85"
            />
            {/* Nib */}
            <path
              d="M11.5 34.2 L7.6 40.6"
              fill="none"
              stroke="#0284c7"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            {/* Star at the feather's tip */}
            <path
              className="gc-spark"
              d="M46.5 6 L47.7 9.1 L50.8 10.3 L47.7 11.5 L46.5 14.6 L45.3 11.5 L42.2 10.3 L45.3 9.1 Z"
              fill="#fbbf24"
            />
          </g>
          {/* The line being written in the air (self-drawing flourish) */}
          <path
            className="gc-script"
            d="M8 41.5 C 13.5 44.8 19 40.2 25 42 C 30.5 43.6 36 42.8 43.5 39.5"
            fill="none"
            stroke="#fbbf24"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeDasharray="60"
            strokeDashoffset="60"
          />
          {/* Ink drop where the stroke lands */}
          <circle className="gc-inkdot" cx="45.5" cy="38.8" r="2" fill="#fbbf24" />
        </svg>
      </span>

      <span className="flex min-w-0 flex-col justify-center" style={{ gap: Math.max(2, height * 0.07) }}>
        <span className="gc-the" style={{ fontSize: theSize, letterSpacing: "0.38em" }}>
          The
        </span>
        <span className="gc-name whitespace-nowrap" style={{ fontSize: nameSize }}>
          Gist Club
        </span>
      </span>
    </span>
  );

  if (href === false) return mark;

  return (
    <Link
      href={typeof href === "string" ? href : "/"}
      aria-label="The Gist Club — home"
      className="inline-flex rounded-xl outline-none ring-sky-400/70 focus-visible:ring-2"
    >
      {mark}
    </Link>
  );
}
