"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  type: string;
  message: string;
  preview: string;
  link: string;
  read: boolean;
  createdAt: string;
  actor: {
    id: string;
    username: string;
    name: string;
    image?: string | null;
  } | null;
};

type ListResponse = {
  items: Notification[];
  nextCursor: string | null;
  unread: number;
};

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const seconds = Math.max(1, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function Avatar({ actor }: { actor: Notification["actor"] }) {
  const initials =
    (actor?.name || actor?.username || "·")
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  if (actor?.image) {
    return (
      <Image
        src={actor.image}
        alt=""
        width={44}
        height={44}
        className="h-11 w-11 shrink-0 rounded-full border border-border object-cover"
      />
    );
  }
  return (
    <div
      aria-hidden
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
      style={{ background: "var(--gradient-brand)" }}
    >
      {initials}
    </div>
  );
}

export function NotificationsList() {
  const [items, setItems] = useState<Notification[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(
    async (after?: string) => {
      if (after) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ limit: "30" });
        if (after) params.set("cursor", after);
        const res = await fetch(`/api/notifications?${params}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: ListResponse = await res.json();
        setUnread(data.unread);
        setItems((prev) => (after ? [...prev, ...data.items] : data.items));
        setCursor(data.nextCursor);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (after) setLoadingMore(false);
        else setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Auto-mark visible items as read when the page mounts (small UX win).
  useEffect(() => {
    if (!items.length) return;
    const stillUnread = items.filter((n) => !n.read).map((n) => n.id);
    if (!stillUnread.length) return;
    fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: stillUnread.slice(0, 200) }),
    })
      .then(() => {
        setItems((prev) =>
          prev.map((n) => (stillUnread.includes(n.id) ? { ...n, read: true } : n))
        );
        setUnread(0);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length > 0]);

  // Infinite scroll sentinel.
  useEffect(() => {
    if (!cursor) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !loadingMore) {
            void load(cursor);
          }
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, loadingMore, load]);

  const markAllRead = useCallback(async () => {
    if (!unread) return;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
    } catch {
      /* swallow */
    }
  }, [unread]);

  if (loading && !items.length) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted" aria-hidden />
      </div>
    );
  }

  if (error && !items.length) {
    return (
      <div className="rounded-2xl border border-rose-300/40 bg-rose-50/50 px-4 py-6 text-center text-sm text-rose-700 dark:border-rose-700/50 dark:bg-rose-950/30 dark:text-rose-200">
        {error}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
        <div
          aria-hidden
          className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full text-white"
          style={{ background: "var(--gradient-brand)" }}
        >
          <Bell size={20} aria-hidden />
        </div>
        <h2 className="text-base font-bold">Nothing here yet</h2>
        <p className="mt-1 text-sm text-muted">
          When someone reacts to your posts or new chatter lands in books you
          follow, you&apos;ll see it here.
        </p>
      </div>
    );
  }

  return (
    <div>
      {unread > 0 ? (
        <div className="mb-3 flex items-center justify-between rounded-2xl border border-border bg-card/60 px-4 py-2.5">
          <p className="text-xs font-semibold text-muted">
            {unread} unread
          </p>
          <button
            type="button"
            onClick={markAllRead}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[11px] font-semibold transition hover:bg-hover"
          >
            <CheckCheck size={12} aria-hidden />
            Mark all read
          </button>
        </div>
      ) : null}

      <ul className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border/70">
        {items.map((n) => (
          <li key={n.id}>
            <Link
              href={n.link}
              className={cn(
                "flex gap-3 px-4 py-3.5 transition hover:bg-hover",
                !n.read &&
                  "bg-[color-mix(in_srgb,var(--brand-1)_6%,transparent)]"
              )}
            >
              <Avatar actor={n.actor} />
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug">
                  <span className="font-semibold">{n.message}</span>
                </p>
                {n.preview ? (
                  <p className="mt-0.5 line-clamp-2 text-[13px] text-muted">
                    &ldquo;{n.preview}&rdquo;
                  </p>
                ) : null}
                <p className="mt-1 text-[11px] text-muted">
                  {timeAgo(n.createdAt)}
                </p>
              </div>
              {!n.read ? (
                <span
                  aria-hidden
                  className="mt-2 h-2 w-2 shrink-0 rounded-full"
                  style={{ background: "var(--gradient-brand)" }}
                />
              ) : null}
            </Link>
          </li>
        ))}
      </ul>

      {cursor ? (
        <div ref={sentinelRef} className="flex items-center justify-center py-6">
          {loadingMore ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted" aria-hidden />
          ) : (
            <span className="text-[11px] text-muted">Loading more…</span>
          )}
        </div>
      ) : null}
    </div>
  );
}
