"use client";

import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import { Megaphone, X } from "lucide-react";

export type AnnouncementItem = {
  id: string;
  title: string;
  body: string;
  link?: string;
  linkLabel?: string;
  createdAt: string;
};

export function AnnouncementCard({
  item,
  variant = "feed",
  onDismiss,
}: {
  item: AnnouncementItem;
  variant?: "feed" | "rail";
  onDismiss?: (id: string) => void;
}) {
  const isRail = variant === "rail";
  return (
    <article
      className={
        isRail ?
          "relative rounded-3xl border border-border bg-card p-5 pr-11 shadow-[var(--shadow-soft)]"
        : "relative rounded-[22px] border border-border/80 bg-card p-5 pr-11 shadow-[var(--shadow-soft)]"
      }
    >
      {onDismiss ?
        <button
          type="button"
          onClick={() => onDismiss(item.id)}
          aria-label="Dismiss announcement"
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-hover hover:text-foreground"
        >
          <X size={14} aria-hidden />
        </button>
      : null}
      <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-300">
        <Megaphone size={11} aria-hidden />
        From {BRAND_NAME}
      </p>
      <h3
        className={
          isRail ?
            "mt-2 text-[15px] font-bold leading-snug"
          : "mt-2 text-base font-bold leading-snug"
        }
      >
        {item.title}
      </h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/85">
        {item.body}
      </p>
      {item.link ?
        <Link
          href={item.link}
          className="mt-3 inline-flex rounded-full border border-border bg-pill px-3 py-1.5 text-[12px] font-semibold transition hover:bg-hover"
        >
          {item.linkLabel || "Learn more"}
        </Link>
      : null}
    </article>
  );
}
