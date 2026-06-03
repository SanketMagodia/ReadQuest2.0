"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function PostImage({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);

  return (
    <div
      className={cn(
        "mt-3 overflow-hidden rounded-lg border border-border/60 bg-pill",
        className
      )}
    >
      <div className="relative w-full bg-pill/80" style={{ aspectRatio: "16 / 10" }}>
        {errored ? (
          <div className="flex h-full w-full items-center justify-center text-xs font-medium text-muted">
            Image unavailable
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            className="h-full w-full object-contain"
            loading="lazy"
            decoding="async"
            onError={() => setErrored(true)}
          />
        )}
      </div>
    </div>
  );
}
