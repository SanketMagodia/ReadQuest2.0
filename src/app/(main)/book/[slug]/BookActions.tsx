"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BookmarkPlus,
  BookmarkCheck,
  Heart,
  HeartOff,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { trackFollowBook, trackReadlistUpdate } from "@/lib/analytics-events";

type ReadStatus = "want" | "read" | null;

type Props = {
  bookId: string;
  initialFollowing: boolean;
  initialReadStatus: ReadStatus;
  authenticated: boolean;
};

export function BookActions({
  bookId,
  initialFollowing,
  initialReadStatus,
  authenticated,
}: Props) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [readStatus, setReadStatus] = useState<ReadStatus>(initialReadStatus);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  async function toggleFollow() {
    if (!authenticated) {
      setMsg("Sign in to follow this book.");
      return;
    }
    const next = !following;
    setFollowing(next);
    try {
      if (next) {
        await fetch("/api/follows/book", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookId }),
        });
        trackFollowBook(bookId, true);
      } else {
        await fetch(`/api/follows/book?bookId=${encodeURIComponent(bookId)}`, {
          method: "DELETE",
        });
        trackFollowBook(bookId, false);
      }
      startTransition(() => router.refresh());
    } catch {
      setFollowing(!next);
      setMsg("Something went wrong, try again.");
    }
  }

  async function setShelfStatus(nextStatus: Exclude<ReadStatus, null>) {
    if (!authenticated) {
      setMsg("Sign in to organize your shelves.");
      return;
    }
    const prev = readStatus;
    const removing = prev === nextStatus;
    const next = removing ? null : nextStatus;
    setReadStatus(next);
    try {
      if (next) {
        await fetch("/api/readlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookId, status: next }),
        });
        trackReadlistUpdate(bookId, next);
      } else {
        await fetch(`/api/readlist?bookId=${encodeURIComponent(bookId)}`, {
          method: "DELETE",
        });
        trackReadlistUpdate(bookId, "remove");
      }
      startTransition(() => router.refresh());
    } catch {
      setReadStatus(prev);
      setMsg("Something went wrong, try again.");
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void toggleFollow()}
          aria-pressed={following}
          disabled={pending}
          className={
            following
              ? "inline-flex items-center gap-2 rounded-full border border-border bg-pill px-5 py-2 text-sm font-semibold ring-2 ring-sky-400/60"
              : "inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-white shadow-[var(--shadow-pop)]"
          }
          style={
            following
              ? undefined
              : { background: "var(--gradient-brand)" }
          }
        >
          {following ? (
            <>
              <HeartOff size={14} aria-hidden /> Following
            </>
          ) : (
            <>
              <Heart size={14} aria-hidden /> Follow book
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => void setShelfStatus("want")}
          aria-pressed={readStatus === "want"}
          disabled={pending}
          className={
            readStatus === "want"
              ? "inline-flex items-center gap-2 rounded-full border border-border bg-pill px-5 py-2 text-sm font-semibold ring-2 ring-violet-400/60"
              : "inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2 text-sm font-semibold transition hover:bg-hover"
          }
        >
          {readStatus === "want" ? (
            <>
              <BookmarkCheck size={14} aria-hidden /> Want to read
            </>
          ) : (
            <>
              <BookmarkPlus size={14} aria-hidden /> Add to list
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => void setShelfStatus("read")}
          aria-pressed={readStatus === "read"}
          disabled={pending}
          className={
            readStatus === "read"
              ? "inline-flex items-center gap-2 rounded-full border border-border bg-pill px-5 py-2 text-sm font-semibold ring-2 ring-emerald-400/60"
              : "inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2 text-sm font-semibold transition hover:bg-hover"
          }
        >
          {readStatus === "read" ? (
            <>
              <CheckCircle2 size={14} aria-hidden /> Marked read
            </>
          ) : (
            <>
              <Circle size={14} aria-hidden /> Mark read
            </>
          )}
        </button>
      </div>
      {authenticated ? (
        <p className="text-[11px] text-muted">
          Tap an active pill again to remove this book from that shelf.
        </p>
      ) : null}
      {msg ? (
        <p className="text-xs font-medium text-sky-600 dark:text-sky-300">{msg}</p>
      ) : null}
    </div>
  );
}
