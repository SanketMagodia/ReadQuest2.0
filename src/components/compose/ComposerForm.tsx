"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { ChangeEvent, FormEvent } from "react";
import { RefreshCw, X, ImagePlus, Loader2 } from "lucide-react";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { fileToPostImageDataUrl } from "@/lib/post-image";
import { trackPostCreated, trackSelectBook } from "@/lib/analytics-events";
import type { PostDTO } from "@/lib/serialize";

type BookRow = {
  id: string;
  title: string;
  authors?: string;
  thumbnail?: string;
};

/**
 * The post composer, shared by the `/compose` page and the modal that opens
 * from the feed. The caller owns the chrome and decides what happens after a
 * successful publish.
 */
export function ComposerForm({
  initialBookId,
  onPublished,
  autoFocus = false,
  compact = false,
}: {
  /** Pre-attach a book, e.g. from `/compose?bookId=…`. */
  initialBookId?: string;
  onPublished: (post: PostDTO) => void;
  autoFocus?: boolean;
  compact?: boolean;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<BookRow[]>([]);
  const [book, setBook] = useState<BookRow | null>(null);
  const [content, setContent] = useState("");
  const [postImage, setPostImage] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [loadingBook, setLoadingBook] = useState(Boolean(initialBookId));
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  const [aiOpen, setAiOpen] = useState(false);
  const [aiHint, setAiHint] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Resolve a pre-attached book so deep links land with the book already on.
  useEffect(() => {
    if (!initialBookId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/books/${encodeURIComponent(initialBookId)}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { book?: BookRow };
        if (!cancelled && data.book) setBook(data.book);
      } finally {
        if (!cancelled) setLoadingBook(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialBookId]);

  useEffect(() => {
    if (autoFocus) textRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!q.trim()) {
        setResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      void (async () => {
        try {
          const res = await fetch(`/api/books?q=${encodeURIComponent(q)}&limit=8`, {
            cache: "no-store",
          });
          const data = await res.json().catch(() => ({}));
          setResults((data as { books?: BookRow[] }).books ?? []);
        } finally {
          setSearching(false);
        }
      })();
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const ready = useMemo(
    () => Boolean(book && (content.trim().length > 0 || postImage)),
    [book, content, postImage]
  );

  async function generateWithAI() {
    if (!book) {
      setAiError("Pick a book first.");
      return;
    }
    setAiBusy(true);
    setAiError(null);
    try {
      const res = await fetch("/api/ai/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: book.id,
          hint: aiHint.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setAiError(data.error ?? "Generation failed. Try again.");
        return;
      }
      const data = (await res.json()) as { content: string };
      setContent(data.content);
    } catch {
      setAiError("Network error. Try again.");
    } finally {
      setAiBusy(false);
    }
  }

  async function onPickImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImageError(null);
    try {
      const dataUrl = await fileToPostImageDataUrl(file);
      setPostImage(dataUrl);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Could not add image.");
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!book) {
      setError("Pick a book first.");
      return;
    }
    setPublishing(true);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: book.id,
          content: content.trim(),
          ...(postImage ? { image: postImage } : {}),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string; content?: string[]; image?: string[] }
          | null;
        setError(
          data?.error || data?.content?.[0] || data?.image?.[0] || "Publish failed"
        );
        return;
      }
      const data = (await res.json()) as { post: PostDTO };
      trackPostCreated(book.id, Boolean(postImage));
      onPublished(data.post);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-5">
      {/* ── Book picker ─────────────────────────────────────────────────────── */}
      <div>
        <label
          htmlFor="composer-book"
          className="text-[12px] font-semibold uppercase tracking-wide text-muted"
        >
          Attach a book
        </label>

        {loadingBook ? (
          <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted">
            <Loader2 size={14} className="animate-spin" aria-hidden />
            Loading book…
          </p>
        ) : book ? (
          <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl border border-border bg-pill px-3 py-2.5 text-sm">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative h-12 w-[40px] shrink-0 overflow-hidden rounded-lg bg-card">
                {book.thumbnail ? (
                  <Image
                    src={book.thumbnail.replace(/^http:/, "https:")}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="40px"
                  />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold">{book.title}</p>
                <p className="truncate text-xs text-muted">{book.authors}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setBook(null)}
              className="shrink-0 text-xs font-semibold underline"
            >
              Change
            </button>
          </div>
        ) : (
          <>
            <input
              id="composer-book"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search for the book…"
              className="mt-2 w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]/70"
            />
            {searching ? (
              <LoadingIndicator className="mt-3" label="Finding books…" size="sm" />
            ) : results.length > 0 ? (
              <ul className="mt-2 max-h-56 overflow-y-auto rounded-2xl border border-border bg-background">
                {results.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setBook(b);
                        trackSelectBook(b.id, b.title, "compose_search");
                        setQ("");
                        setResults([]);
                      }}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-hover"
                    >
                      <div className="relative h-10 w-[32px] shrink-0 overflow-hidden rounded-lg bg-pill">
                        {b.thumbnail ? (
                          <Image
                            src={b.thumbnail.replace(/^http:/, "https:")}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="32px"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{b.title}</p>
                        <p className="truncate text-xs text-muted">{b.authors}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </div>

      {/* ── The post ────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="composer-text"
            className="text-[12px] font-semibold uppercase tracking-wide text-muted"
          >
            Post
          </label>
          <button
            type="button"
            onClick={() => {
              if (!book) {
                setAiError("Pick a book first.");
                setAiOpen(true);
                return;
              }
              setAiOpen((v) => !v);
              setAiError(null);
            }}
            aria-pressed={aiOpen}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold transition hover:bg-hover"
          >
            {aiOpen ? "Close AI helper" : "Generate with AI"}
          </button>
        </div>

        {aiOpen ? (
          <div className="mt-2.5 space-y-2.5 rounded-2xl border border-dashed border-border bg-pill/40 p-3.5">
            <input
              value={aiHint}
              onChange={(e) => setAiHint(e.target.value)}
              placeholder="Angle (optional) — wistful, a hot take, a question…"
              maxLength={280}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]/70"
            />
            {aiError ? (
              <p className="text-xs text-red-600 dark:text-red-400">{aiError}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void generateWithAI()}
                disabled={!book || aiBusy}
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                style={{ background: "var(--gradient-brand)" }}
              >
                {aiBusy ? (
                  <RefreshCw size={13} aria-hidden className="animate-spin" />
                ) : null}
                {content ? "Regenerate" : "Generate"}
              </button>
              {content ? (
                <button
                  type="button"
                  onClick={() => setContent("")}
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-hover"
                >
                  Clear
                </button>
              ) : null}
              <p className="text-[11px] text-muted">
                Replaces your current text — edit before posting.
              </p>
            </div>
          </div>
        ) : null}

        <textarea
          id="composer-text"
          ref={textRef}
          rows={compact ? 5 : 7}
          maxLength={2000}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="mt-2.5 w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-[16px] leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]/70"
          placeholder="“It is a truth universally acknowledged…”"
        />

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold transition hover:bg-hover">
            <ImagePlus size={14} aria-hidden />
            Add photo
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              onChange={(e) => void onPickImage(e)}
            />
          </label>
          {postImage ? (
            <button
              type="button"
              onClick={() => setPostImage(null)}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-500/10 dark:text-red-300"
            >
              <X size={12} aria-hidden />
              Remove photo
            </button>
          ) : null}
        </div>

        {imageError ? (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">{imageError}</p>
        ) : null}

        {postImage ? (
          <div className="relative mt-2.5 overflow-hidden rounded-xl border border-border bg-pill">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={postImage}
              alt="Preview"
              className="max-h-56 w-full object-contain"
            />
          </div>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-3.5">
        <span className="text-xs text-muted">
          {content.length}/2000
          {ready ? "" : " · needs a book and some words"}
        </span>
        <button
          type="submit"
          disabled={!ready || publishing}
          className="inline-flex items-center gap-1.5 rounded-full px-6 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-pop)] transition active:translate-y-px disabled:opacity-40"
          style={{ background: "var(--gradient-brand)" }}
        >
          {publishing ? (
            <Loader2 size={14} className="animate-spin" aria-hidden />
          ) : null}
          {publishing ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}
