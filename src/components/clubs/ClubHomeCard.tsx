"use client";

import Link from "next/link";
import { ArrowUpRight, BookOpen, Users } from "lucide-react";
import { ClubChat } from "@/components/clubs/ClubChat";
import type { ClubSummary } from "@/lib/clubs";

/**
 * The club's room, condensed for the Home grid. When a reader belongs to a
 * club this takes the slot the daily quest normally occupies.
 */
export function ClubHomeCard({
  club,
  canPost = true,
}: {
  club: ClubSummary;
  canPost?: boolean;
}) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-soft)] sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
          <Users size={11} aria-hidden className="text-[var(--brand-1)]" />
          Your club
        </p>
        <Link
          href={`/clubs/${club.slug}`}
          className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-muted transition hover:text-foreground"
        >
          Open room
          <ArrowUpRight size={12} aria-hidden />
        </Link>
      </div>

      {/* Top rack — the one book the club is on right now. */}
      <div className="mt-2 flex items-center gap-2.5">
        <div className="h-[54px] w-[36px] shrink-0 overflow-hidden rounded bg-pill ring-1 ring-border/70">
          {club.currentBook?.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={club.currentBook.thumbnail.replace(/^http:/, "https:")}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-muted">
              <BookOpen size={14} aria-hidden />
            </span>
          )}
        </div>
        <div className="min-w-0">
          <Link
            href={`/clubs/${club.slug}`}
            className="block truncate text-[14px] font-bold hover:underline"
          >
            {club.name}
          </Link>
          <p className="truncate text-[11.5px] text-muted">
            {club.currentBook
              ? `Reading ${club.currentBook.title}`
              : "No book on the rack yet"}
          </p>
        </div>
      </div>

      <ClubChat
        slug={club.slug}
        canPost={canPost}
        signedIn
        heightClass="min-h-[12rem]"
        className="mt-3 min-h-0 flex-1"
      />
    </article>
  );
}
