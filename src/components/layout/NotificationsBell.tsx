"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
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

/** Compact "3m ago" / "yesterday" style. */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const seconds = Math.max(1, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function Avatar({
  actor,
  size = 36,
}: {
  actor: Notification["actor"];
  size?: number;
}) {
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
        width={size}
        height={size}
        className="h-9 w-9 shrink-0 rounded-full border border-border object-cover"
      />
    );
  }
  return (
    <div
      aria-hidden
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
      style={{ background: "var(--gradient-brand)" }}
    >
      {initials}
    </div>
  );
}

export function NotificationsBell({
  variant = "sidebar",
}: {
  variant?: "sidebar" | "topbar";
}) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  // Sidebar flyout coordinates (viewport-fixed, computed from the button).
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const fetchAll = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/notifications?limit=20", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ListResponse = await res.json();
      setItems(data.items);
      setUnread(data.unread);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  const fetchCount = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const res = await fetch("/api/notifications?limit=1", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data: ListResponse = await res.json();
      setUnread(data.unread);
    } catch {
      /* ignore */
    }
  }, [session?.user?.id]);

  // Initial count load + 60s polling while signed in.
  useEffect(() => {
    if (!session?.user?.id) return;
    void fetchCount();
    const i = window.setInterval(fetchCount, 60_000);
    return () => window.clearInterval(i);
  }, [session?.user?.id, fetchCount]);

  // Reload when opening so the list is always fresh.
  useEffect(() => {
    if (open) void fetchAll();
  }, [open, fetchAll]);

  // Click-outside to close. The sidebar panel is portaled to <body>, so we
  // must check it separately from the trigger container.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // Layout shifts (resize / orientation change) invalidate the measured
    // flyout position — just close.
    const onResize = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const toggleOpen = useCallback(() => {
    setOpen((o) => {
      if (!o && variant === "sidebar") {
        const btn = containerRef.current?.getBoundingClientRect();
        if (btn) setPos({ top: Math.max(12, btn.top - 4), left: btn.right + 12 });
      }
      return !o;
    });
  }, [variant]);

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
      void fetchCount();
    }
  }, [unread, fetchCount]);

  const markOneRead = useCallback(async (id: string) => {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnread((u) => Math.max(0, u - 1));
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
    } catch {
      /* swallow */
    }
  }, []);

  if (!session?.user?.id) return null;

  // The sidebar flyout escapes the sidebar's overflow/stacking context via a
  // portal; the topbar variant stays inline (its fixed positioning works).
  const renderPanel = (node: React.ReactNode) =>
    variant === "sidebar" && typeof document !== "undefined"
      ? createPortal(node, document.body)
      : node;

  const Badge = () =>
    unread > 0 ? (
      <span
        aria-label={`${unread} unread`}
        className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white shadow-[var(--shadow-soft)]"
        style={{ background: "var(--gradient-brand)" }}
      >
        {unread > 99 ? "99+" : unread}
      </span>
    ) : null;

  return (
    <div ref={containerRef} className="relative">
      {variant === "sidebar" ? (
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Notifications"
          onClick={toggleOpen}
          className={cn(
            "group relative flex w-full items-center gap-4 rounded-full px-4 py-3 text-[16px] font-semibold transition",
            open
              ? "bg-pill text-foreground"
              : "text-muted hover:bg-hover hover:text-foreground"
          )}
        >
          <span className="relative">
            <Bell size={20} aria-hidden strokeWidth={open ? 2.4 : 1.9} />
            <Badge />
          </span>
          <span>Notifications</span>
        </button>
      ) : (
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Notifications"
          onClick={toggleOpen}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-foreground transition hover:bg-hover"
        >
          <Bell size={18} aria-hidden />
          <Badge />
        </button>
      )}

      {open ? (
        renderPanel(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Notifications"
            className={cn(
              "z-50 flex flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-[var(--shadow-pop)]",
              // Desktop / sidebar: portaled to <body> and positioned as a
              // flyout to the RIGHT of the sidebar. Rendering it inside the
              // narrow sidebar clipped it at the sidebar's edge (the aside
              // is overflow-hidden and only ~13rem wide).
              variant === "sidebar"
                ? "animate-slide fixed w-[23rem] max-w-[calc(100vw-2rem)]"
                // Mobile / topbar: the bell isn't at the screen edge (theme
                // toggle + account menu sit to its right), so anchoring with
                // `right-0` pushed the popup off the left of the viewport.
                // Pin to the viewport with fixed positioning + symmetric
                // gutters instead.
                : "fixed left-3 right-3 top-[3.25rem]"
            )}
            style={
              variant === "sidebar" && pos
                ? {
                    top: pos.top,
                    left: pos.left,
                    maxHeight: `calc(100vh - ${pos.top + 16}px)`,
                  }
                : undefined
            }
          >
          <header className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
            <div>
              <h3 className="text-sm font-bold tracking-tight">
                Notifications
              </h3>
              <p className="text-[11px] text-muted">
                {unread > 0
                  ? `${unread} unread`
                  : "You're all caught up"}
              </p>
            </div>
            <button
              type="button"
              onClick={markAllRead}
              disabled={!unread}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold transition",
                unread
                  ? "text-foreground hover:bg-hover"
                  : "cursor-not-allowed text-muted opacity-60"
              )}
            >
              <CheckCheck size={12} aria-hidden />
              Mark all read
            </button>
          </header>

          <div className="min-h-0 max-h-[70vh] flex-1 overflow-y-auto">
            {loading && !items.length ? (
              <div className="flex items-center justify-center px-4 py-10 text-muted">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              </div>
            ) : error ? (
              <div className="px-4 py-6 text-center text-[12px] text-rose-600 dark:text-rose-300">
                {error}
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <div
                  aria-hidden
                  className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full text-white"
                  style={{ background: "var(--gradient-brand)" }}
                >
                  <Bell size={18} aria-hidden />
                </div>
                <p className="text-sm font-semibold">Nothing here yet</p>
                <p className="mt-1 text-[12px] text-muted">
                  Likes, replies and book activity will land here.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border/70">
                {items.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={n.link}
                      onClick={() => {
                        if (!n.read) void markOneRead(n.id);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex gap-3 px-4 py-3 transition hover:bg-hover",
                        !n.read && "bg-[color-mix(in_srgb,var(--brand-1)_6%,transparent)]"
                      )}
                    >
                      <Avatar actor={n.actor} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] leading-snug">
                          <span className="font-semibold">{n.message}</span>
                        </p>
                        {n.preview ? (
                          <p className="mt-0.5 line-clamp-2 text-[12px] text-muted">
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
                          className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                          style={{ background: "var(--gradient-brand)" }}
                        />
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <footer className="border-t border-border/70 px-4 py-2.5 text-center">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-[12px] font-semibold text-sky-700 hover:underline dark:text-sky-300"
            >
              See all notifications
            </Link>
          </footer>
          </div>
        )
      ) : null}
    </div>
  );
}
