"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Flag, ShieldX, ShieldCheck } from "lucide-react";

type ReportItem = {
  postId: string;
  reportCount: number;
  lastReportedAt: string;
  post: {
    id: string;
    content: string;
    image?: string;
    createdAt: string;
    author: { username: string; name: string };
    book: { title: string; slug: string };
  };
};

function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AdminReports() {
  const [items, setItems] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyPost, setBusyPost] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/reports/posts", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items: ReportItem[] };
      setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function moderate(postId: string, action: "ignore" | "delete") {
    if (busyPost) return;
    if (action === "delete") {
      const ok = window.confirm("Delete this post and clear all reports?");
      if (!ok) return;
    }
    setBusyPost(postId);
    try {
      await fetch(`/api/admin/reports/posts/${postId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      await load();
    } finally {
      setBusyPost(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          Reports queue
        </p>
        <p className="mt-1 text-sm text-muted">
          Ranked by number of reports. Ignore clears reports; Delete removes the post.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-14">
          <Loader2 className="h-6 w-6 animate-spin text-muted" aria-hidden />
        </div>
      ) : !items.length ? (
        <p className="text-center text-sm text-muted">No reported posts right now.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.postId} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-300">
                    <Flag size={13} aria-hidden />
                    {item.reportCount} report{item.reportCount === 1 ? "" : "s"}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Last reported {when(item.lastReportedAt)} · @{item.post.author.username} · {item.post.book.title}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                    {item.post.content || "(image-only post)"}
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    <Link href={`/post/${item.post.id}`} className="font-semibold hover:underline">
                      Open post
                    </Link>
                  </p>
                </div>

                <div className="flex shrink-0 flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => void moderate(item.postId, "ignore")}
                    disabled={busyPost === item.postId}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold hover:bg-hover disabled:opacity-60"
                  >
                    <ShieldCheck size={12} aria-hidden />
                    Ignore
                  </button>
                  <button
                    type="button"
                    onClick={() => void moderate(item.postId, "delete")}
                    disabled={busyPost === item.postId}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-rose-600 hover:bg-hover disabled:opacity-60 dark:text-rose-300"
                  >
                    <ShieldX size={12} aria-hidden />
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
