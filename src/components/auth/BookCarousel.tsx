"use client";

import { useState } from "react";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

type Cover = {
  src: string;
  label?: string;
  /** Used as a colorful fallback if the real image fails to load. */
  gradient?: string;
};

const FALLBACK_GRADIENTS = [
  "linear-gradient(160deg, #fbbf24 0%, #f97373 100%)",
  "linear-gradient(160deg, #38bdf8 0%, #8b5cf6 100%)",
  "linear-gradient(160deg, #34d399 0%, #38bdf8 100%)",
  "linear-gradient(160deg, #ec4899 0%, #8b5cf6 100%)",
  "linear-gradient(160deg, #f97373 0%, #ec4899 100%)",
];

/** Default shelf — uses the images the team dropped into /public/showcase. */
const DEFAULT_COVERS: Cover[] = [
  { src: "/showcase/anxiousppl.jpg", label: "Anxious People" },
  { src: "/showcase/the-power-of-discipline-cover.png", label: "Power of Discipline" },
  { src: "/showcase/psymoney.jpg", label: "Psychology of Money" },
  { src: "/showcase/morisaki.jpg", label: "Days at the Morisaki Bookshop" },
  { src: "/showcase/NeverLetmeGo.jpg", label: "Never Let Me Go" },
  { src: "/showcase/gilead.jpg", label: "Gilead" },
  { src: "/showcase/malice.jpg", label: "Malice" },
  { src: "/showcase/alchemist.jpg", label: "The Alchemist" },
];

type Props = {
  covers?: Cover[];
  className?: string;
  /** Marquee duration in seconds (higher = slower). Default 75. */
  durationSec?: number;
  /** Visual size preset. */
  size?: "sm" | "md" | "lg";
};

const SIZE_CLASSES: Record<NonNullable<Props["size"]>, string> = {
  sm: "h-28 sm:h-32",
  md: "h-32 sm:h-44 md:h-52",
  lg: "h-36 sm:h-52 md:h-60 lg:h-64",
};

function BookSpine({
  cover,
  rotate,
  fallbackIndex,
  sizeClass,
}: {
  cover: Cover;
  rotate: number;
  fallbackIndex: number;
  sizeClass: string;
}) {
  const [errored, setErrored] = useState(false);
  const gradient =
    cover.gradient ?? FALLBACK_GRADIENTS[fallbackIndex % FALLBACK_GRADIENTS.length];

  return (
    <div
      className={cn(
        "relative aspect-[2/3] shrink-0 overflow-hidden rounded-[12px] border border-black/5 shadow-[0_18px_40px_-22px_rgba(15,23,42,0.45)] ring-1 ring-black/5 transition-transform dark:border-white/10 dark:shadow-[0_18px_40px_-18px_rgba(0,0,0,0.55)] dark:ring-white/5",
        sizeClass
      )}
      style={{
        transform: `rotate(${rotate}deg)`,
        background: gradient,
      }}
      aria-hidden
    >
      {!errored ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover.src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setErrored(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center text-white">
          <BookOpen size={22} aria-hidden />
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] leading-tight">
            {cover.label ?? "Readquest"}
          </p>
        </div>
      )}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-[6px] bg-black/25"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/10 via-transparent to-white/15"
      />
    </div>
  );
}

export function BookCarousel({
  covers = DEFAULT_COVERS,
  className,
  durationSec = 75,
  size = "md",
}: Props) {
  // Duplicate the list so the marquee loops seamlessly.
  const items = [...covers, ...covers];
  const sizeClass = SIZE_CLASSES[size];

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden",
        "[mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)] [-webkit-mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]",
        className
      )}
      aria-label="A shelf of books featured on Readquest"
      role="img"
    >
      <div
        className="flex w-max items-end gap-4 px-4 py-4 will-change-transform animate-marquee sm:gap-5 sm:px-6 sm:py-6"
        style={{ animationDuration: `${durationSec}s` }}
      >
        {items.map((c, i) => (
          <BookSpine
            key={`${c.src}-${i}`}
            cover={c}
            rotate={i % 3 === 0 ? -3 : i % 3 === 1 ? 2 : -1}
            fallbackIndex={i}
            sizeClass={sizeClass}
          />
        ))}
      </div>
    </div>
  );
}
