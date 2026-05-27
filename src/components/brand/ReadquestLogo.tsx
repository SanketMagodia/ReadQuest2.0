"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const ASPECT = 790 / 190;

type ReadquestLogoProps = {
  height?: number;
  className?: string;
  /** Link target; pass `false` for a non-clickable mark */
  href?: string | false;
  priority?: boolean;
};

export function ReadquestLogo({
  height = 36,
  className,
  href = "/",
  priority,
}: ReadquestLogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const width = Math.round(height * ASPECT);
  // Default to light during SSR/hydration to avoid flash; once mounted, follow theme.
  const src =
    mounted && resolvedTheme === "dark"
      ? "/brand/rq-dark.svg"
      : "/brand/rq-lite.svg";

  const mark = (
    <span
      className={cn("relative inline-block shrink-0", className)}
      style={{ height, width: Math.min(width, 240) }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={src}
        src={src}
        alt="Readquest"
        width={width}
        height={height}
        decoding="async"
        fetchPriority={priority ? "high" : undefined}
        className="h-full w-full object-contain object-left"
      />
    </span>
  );

  if (href === false) return mark;

  return (
    <Link
      href={typeof href === "string" ? href : "/"}
      className="inline-flex outline-none ring-sky-400/70 focus-visible:ring-2"
    >
      {mark}
    </Link>
  );
}
