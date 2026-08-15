"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  MessageCircle,
  Users,
  X,
} from "lucide-react";
import { ClubChat } from "@/components/clubs/ClubChat";
import type { ClubSummary } from "@/lib/clubs";

/** Mirrors `@custom-variant layout-compact` in globals.css. */
const COMPACT_MQ = "(max-aspect-ratio: 1/1)";

let compactQuery: MediaQueryList | null = null;

function getCompactQuery() {
  compactQuery ??= window.matchMedia(COMPACT_MQ);
  return compactQuery;
}

function subscribeToLayout(onChange: () => void) {
  const mq = getCompactQuery();
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * True on phone-shaped screens. `useSyncExternalStore` keeps the server render
 * (always wide) and the client in step without a state-in-effect flash.
 */
function useCompactLayout() {
  return useSyncExternalStore(
    subscribeToLayout,
    () => getCompactQuery().matches,
    () => false
  );
}

/**
 * The club's room, condensed for the Home grid. When a reader belongs to a
 * club this takes the slot the daily quest normally occupies.
 *
 * On a phone the chat would eat the whole fold, so the card shrinks to a
 * cover-sized tile that opens the room in a sheet — which lets Top 5 Today
 * keep most of the row.
 */
export function ClubHomeCard({
  club,
  canPost = true,
}: {
  club: ClubSummary;
  canPost?: boolean;
}) {
  const compact = useCompactLayout();
  const [chatOpen, setChatOpen] = useState(false);

  if (compact) {
    return (
      <>
        <ClubTile club={club} onOpenChat={() => setChatOpen(true)} />
        {chatOpen ? (
          <ChatSheet
            club={club}
            canPost={canPost}
            onClose={() => setChatOpen(false)}
          />
        ) : null}
      </>
    );
  }

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
        heightClass="h-[16rem] max-h-[16rem]"
        className="mt-3"
      />
    </article>
  );
}

/**
 * The phone version: barely wider than the cover it shows. Tapping anywhere
 * opens the room in a sheet, which is where the chat and "Open room" live.
 */
function ClubTile({
  club,
  onOpenChat,
}: {
  club: ClubSummary;
  onOpenChat: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpenChat}
      aria-label={`Open ${club.name} chat`}
      className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-2 text-left shadow-[var(--shadow-soft)] transition active:translate-y-px"
    >
      <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">
        <Users size={9} aria-hidden className="text-[var(--brand-1)]" />
        Your club
      </span>

      <span className="relative mt-1.5 block w-full overflow-hidden rounded-md bg-pill ring-1 ring-border/70">
        {/* Hold a cover's shape whether or not there's art to put in it. */}
        <span className="block pt-[145%]" aria-hidden />
        {club.currentBook?.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={club.currentBook.thumbnail.replace(/^http:/, "https:")}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-muted">
            <BookOpen size={18} aria-hidden />
          </span>
        )}
        <span
          className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-full text-white shadow-[var(--shadow-pop)]"
          style={{ background: "var(--gradient-brand)" }}
          aria-hidden
        >
          <MessageCircle size={12} />
        </span>
      </span>

      <span className="mt-1.5 line-clamp-2 text-[11.5px] font-bold leading-tight">
        {club.name}
      </span>
      <span className="mt-auto flex items-center gap-0.5 pt-1 text-[10px] font-semibold text-muted">
        Chat
        <ChevronRight size={11} aria-hidden />
      </span>
    </button>
  );
}

/**
 * The full room as a bottom sheet. Portalled to `body` because the Home grid
 * sits inside a `Reveal`, whose transform would otherwise trap `fixed`.
 */
function ChatSheet({
  club,
  canPost,
  onClose,
}: {
  club: ClubSummary;
  canPost: boolean;
  onClose: () => void;
}) {
  // Only ever mounted from a click, so `document` is safe to reach for here.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`${club.name} chat`}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full flex-col overflow-hidden rounded-t-3xl border border-border bg-background shadow-[var(--shadow-pop)]"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border/70 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-[15px] font-bold">
              {club.name}
            </h2>
            <p className="truncate text-[11px] text-muted">
              {club.currentBook
                ? `Reading ${club.currentBook.title}`
                : "No book on the rack yet"}
            </p>
          </div>
          <Link
            href={`/clubs/${club.slug}`}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-semibold transition hover:bg-hover"
          >
            Open room
            <ArrowUpRight size={12} aria-hidden />
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full p-1.5 text-muted transition hover:bg-hover hover:text-foreground"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        <ClubChat
          slug={club.slug}
          canPost={canPost}
          signedIn
          heightClass="h-[62dvh] max-h-[62dvh]"
          className="m-2.5"
        />
      </div>
    </div>,
    document.body
  );
}
