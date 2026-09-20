"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Loader2, Quote, Search, X } from "lucide-react";
import { trackMemorySaved } from "@/lib/analytics-events";
import type { MemoryDTO } from "@/lib/memories";

type BookHit = {
  id: string;
  title: string;
  authors?: string;
  thumbnail?: string;
};

/**
 * The capture form on your own profile. The trigger lives in the section
 * header as a pill — this only renders the open panel.
 */
export function MemoryComposeButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-[var(--shadow-soft)] transition hover:bg-hover"
    >
      <Quote size={13} aria-hidden />
      Keep a line
    </button>
  );
}

export function MemoryComposer({
  onSaved,
  open = false,
  onClose,
}: {
  onSaved: (memory: MemoryDTO) => void;
  open?: boolean;
  onClose?: () => void;
}) {
  const [quote, setQuote] = useState("");
  const [note, setNote] = useState("");
  const [page, setPage] = useState("");
  const [book, setBook] = useState<BookHit | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<BookHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const quoteRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) quoteRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `/api/books?q=${encodeURIComponent(term)}&limit=6`,
            { cache: "no-store" }
          );
          if (!res.ok) return;
          const j = (await res.json()) as { books?: BookHit[] };
          if (!cancelled) setHits(j.books ?? []);
        } finally {
          if (!cancelled) setSearching(false);
        }
      })();
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const reset = useCallback(() => {
    setQuote("");
    setNote("");
    setPage("");
    setBook(null);
    setQuery("");
    setHits([]);
    setError(null);
    onClose?.();
  }, [onClose]);

  async function save() {
    if (saving) return;
    if (!quote.trim() && !note.trim()) {
      setError("Write a line or a note first.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: book?.id ?? null,
          quote: quote.trim(),
          note: note.trim(),
          page: page.trim() ? Number(page) : null,
        }),
      });
      const j = (await res.json().catch(() => null)) as {
        memory?: MemoryDTO;
        error?: string;
      } | null;
      if (!res.ok || !j?.memory) {
        setError(j?.error ?? "Couldn't save that. Try again.");
        return;
      }
      trackMemorySaved(book?.id ?? null, "profile");
      onSaved(j.memory);
      reset();
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-muted">
          New memory
        </p>
        <button
          type="button"
          onClick={reset}
          aria-label="Cancel"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border transition hover:bg-hover"
        >
          <X size={14} aria-hidden />
        </button>
      </div>

      <textarea
        ref={quoteRef}
        value={quote}
        onChange={(e) => setQuote(e.target.value)}
        rows={2}
        maxLength={2000}
        placeholder="“The line you want to remember…”"
        className="mt-3 w-full resize-y rounded-xl border border-border bg-background px-3 py-2 font-display text-[14px] italic leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
      />

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        maxLength={2000}
        placeholder="Why it stuck with you (optional)"
        className="mt-2 w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-[14px] leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
      />

      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem]">
        <div className="relative">
          {book ? (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-pill px-3 py-2 text-[13px]">
              <BookOpen size={13} aria-hidden className="shrink-0 text-muted" />
              <span className="min-w-0 flex-1 truncate font-semibold">
                {book.title}
              </span>
              <button
                type="button"
                onClick={() => setBook(null)}
                aria-label="Remove book"
                className="shrink-0 text-muted hover:text-foreground"
              >
                <X size={13} aria-hidden />
              </button>
            </div>
          ) : (
            <>
              <Search
                size={14}
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Attach a book (optional)"
                className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
              />
              {searching || hits.length ? (
                <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-lg">
                  {searching && !hits.length ? (
                    <li className="px-3 py-2 text-[12px] text-muted">Searching…</li>
                  ) : null}
                  {hits.map((h) => (
                    <li key={h.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setBook(h);
                          setQuery("");
                          setHits([]);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] hover:bg-hover"
                      >
                        <span className="min-w-0 flex-1 truncate font-semibold">
                          {h.title}
                        </span>
                        {h.authors ? (
                          <span className="shrink-0 truncate text-[11px] text-muted">
                            {h.authors.split(/[,;]/)[0]}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </div>

        <input
          value={page}
          onChange={(e) => setPage(e.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          placeholder="Page"
          className="rounded-xl border border-border bg-background px-3 py-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
        />
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-[12px] font-medium text-rose-600 dark:text-rose-300">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={reset}
          className="cursor-pointer rounded-full border border-border px-3.5 py-1.5 text-[12px] font-semibold hover:bg-hover"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 text-[12px] font-semibold text-white shadow-[var(--shadow-pop)] transition hover:brightness-110 disabled:opacity-60"
          style={{ background: "var(--gradient-warm)" }}
        >
          {saving ? <Loader2 size={13} aria-hidden className="animate-spin" /> : null}
          Keep it
        </button>
      </div>
    </div>
  );
}
