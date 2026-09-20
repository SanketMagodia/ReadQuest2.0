"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Loader2, Trash2 } from "lucide-react";
import type { MemoryDTO } from "@/lib/memories";

function fmtDate(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function MemoryCard({
  memory,
  onDeleted,
}: {
  memory: MemoryDTO;
  onDeleted?: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    if (deleting) return;
    setDeleting(true);
    const res = await fetch(`/api/memories/${memory.id}`, { method: "DELETE" });
    if (res.ok) onDeleted?.(memory.id);
    else setDeleting(false);
  }

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-border bg-card px-3.5 py-2.5 pl-4">
      <span
        aria-hidden
        className="absolute inset-y-1.5 left-0 w-0.5 rounded-full"
        style={{ background: "var(--gradient-warm)" }}
      />

      {memory.quote ? (
        <p className="font-display text-[14px] italic leading-snug text-foreground/90">
          “{memory.quote}”
        </p>
      ) : null}

      {memory.note ? (
        <p
          className={`whitespace-pre-wrap text-[13px] leading-snug text-foreground/75 ${
            memory.quote ? "mt-1.5" : ""
          }`}
        >
          {memory.note}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted">
        {memory.book ? (
          <Link
            href={`/book/${memory.book.slug}`}
            className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-border/80 bg-pill px-2.5 py-1 font-semibold transition hover:text-foreground"
          >
            <BookOpen size={11} aria-hidden className="shrink-0" />
            <span className="min-w-0 truncate text-foreground/85">
              {memory.book.title}
            </span>
          </Link>
        ) : null}
        {memory.page ? <span>p. {memory.page}</span> : null}
        <time dateTime={memory.createdAt}>{fmtDate(memory.createdAt)}</time>

        <button
          type="button"
          onClick={() => void remove()}
          disabled={deleting}
          aria-label="Delete this memory"
          className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold opacity-0 transition hover:bg-rose-500/10 hover:text-rose-600 focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-60 dark:hover:text-rose-300"
        >
          {deleting ? (
            <Loader2 size={12} aria-hidden className="animate-spin" />
          ) : (
            <Trash2 size={12} aria-hidden />
          )}
          Delete
        </button>
      </div>
    </article>
  );
}
