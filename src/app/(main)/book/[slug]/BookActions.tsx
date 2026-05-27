"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookmarkPlus, BookmarkCheck, Heart, HeartOff } from "lucide-react";

type Props = {
  bookId: string;
  initialFollowing: boolean;
  initialOnReadlist: boolean;
  authenticated: boolean;
};

export function BookActions({
  bookId,
  initialFollowing,
  initialOnReadlist,
  authenticated,
}: Props) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [onReadlist, setOnReadlist] = useState(initialOnReadlist);
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
      } else {
        await fetch(`/api/follows/book?bookId=${encodeURIComponent(bookId)}`, {
          method: "DELETE",
        });
      }
      startTransition(() => router.refresh());
    } catch {
      setFollowing(!next);
      setMsg("Something went wrong, try again.");
    }
  }

  async function toggleReadlist() {
    if (!authenticated) {
      setMsg("Sign in to organize your shelves.");
      return;
    }
    const next = !onReadlist;
    setOnReadlist(next);
    try {
      if (next) {
        await fetch("/api/readlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookId }),
        });
      } else {
        await fetch(`/api/readlist?bookId=${encodeURIComponent(bookId)}`, {
          method: "DELETE",
        });
      }
      startTransition(() => router.refresh());
    } catch {
      setOnReadlist(!next);
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
          onClick={() => void toggleReadlist()}
          aria-pressed={onReadlist}
          disabled={pending}
          className={
            onReadlist
              ? "inline-flex items-center gap-2 rounded-full border border-border bg-pill px-5 py-2 text-sm font-semibold ring-2 ring-violet-400/60"
              : "inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2 text-sm font-semibold transition hover:bg-hover"
          }
        >
          {onReadlist ? (
            <>
              <BookmarkCheck size={14} aria-hidden /> On readlist
            </>
          ) : (
            <>
              <BookmarkPlus size={14} aria-hidden /> Add to readlist
            </>
          )}
        </button>
      </div>
      {msg ? (
        <p className="text-xs font-medium text-sky-600 dark:text-sky-300">{msg}</p>
      ) : null}
    </div>
  );
}
