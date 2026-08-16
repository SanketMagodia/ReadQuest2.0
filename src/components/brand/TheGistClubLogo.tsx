"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * "The Gist Club" wordmark — a single editorial line: a small letterspaced
 * THE next to "Gist Club" set in the display face. No mark, no motion.
 *
 * `height` is the lockup height the caller wants to fill; the type is sized
 * from it so existing call sites keep their proportions.
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
  const nameSize = Math.round(height * 0.46);
  const theSize = Math.max(8, Math.round(nameSize * 0.58));

  const mark = (
    <span
      className={cn(
        "gc-logo inline-flex items-baseline whitespace-nowrap",
        className
      )}
      style={{ gap: Math.max(4, Math.round(nameSize * 0.28)) }}
    >
      <span className="gc-the" style={{ fontSize: theSize }}>
        The
      </span>
      <span className="gc-name" style={{ fontSize: nameSize }}>
        Gist Club
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
