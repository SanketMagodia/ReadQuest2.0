"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import type { ChangeEvent } from "react";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { RefreshCw, Sparkles, X, ImagePlus } from "lucide-react";
import { fileToPostImageDataUrl } from "@/lib/post-image";

type BookRow = {
  id: string;
  title: string;
  authors?: string;
  thumbnail?: string;
};

export default function ComposePage() {
  const router = useRouter();
  const { status } = useSession();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<BookRow[]>([]);
  const [book, setBook] = useState<BookRow | null>(null);
  const [content, setContent] = useState("");
  const [postImage, setPostImage] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // AI generation state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiHint, setAiHint] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

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

  const ready = useMemo(
    () => Boolean(book && (content.trim().length > 0 || postImage)),
    [book, content, postImage]
  );

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (status !== "authenticated") {
      setError("Sign in to post.");
      router.push("/login");
      return;
    }
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
        const friendly =
          data?.error ||
          data?.content?.[0] ||
          data?.image?.[0] ||
          "Publish failed";
        setError(friendly);
        return;
      }
      const data = (await res.json()) as { post: { id: string } };
      router.push(`/post/${data.post.id}`);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-12">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-muted">compose</p>
        <h1 className="text-[32px] font-bold">Craft a quote-sized post</h1>
        <p className="text-sm text-muted">
          Search the catalog, tag the book, publish the line that lives rent-free in your head.
        </p>
      </header>

      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-6">
        <div>
          <label className="text-sm font-semibold text-muted">Attach a book</label>
          <input
            value={q}
            disabled={Boolean(book)}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
            placeholder="Search Atlas…"
            className="mt-2 w-full rounded-[20px] border border-border bg-card px-4 py-3 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
          />
          {book ?
            <div className="mt-3 flex items-center justify-between rounded-2xl border border-border bg-pill px-4 py-3 text-sm">
              <div className="flex items-center gap-3">
                <div className="relative h-12 w-[40px] overflow-hidden rounded-xl bg-card">
                  {book.thumbnail ?
                    <Image src={book.thumbnail.replace(/^http:/, "https:")} alt="" fill className="object-cover" sizes="40px" />
                  : null}
                </div>
                <div>
                  <p className="font-semibold">{book.title}</p>
                  <p className="text-xs text-muted">{book.authors}</p>
                </div>
              </div>
              <button type="button" onClick={() => setBook(null)} className="text-xs font-semibold underline">
                Change
              </button>
            </div>
          : null}
          {!book && searching ?
            <LoadingIndicator className="mt-4" label="Finding books…" size="sm" />
          : null}
          {!book && !searching && results.length > 0 ?
            <ul className="mt-2 max-h-64 overflow-y-auto rounded-[20px] border border-border bg-background">
              {results.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setBook(b);
                      setQ("");
                      setResults([]);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-hover"
                  >
                    <div className="relative h-10 w-[32px] overflow-hidden rounded-lg bg-pill">
                      {b.thumbnail ?
                        <Image src={b.thumbnail.replace(/^http:/, "https:")} alt="" fill className="object-cover" sizes="32px" />
                      : null}
                    </div>
                    <div>
                      <p className="font-semibold">{b.title}</p>
                      <p className="text-xs text-muted">{b.authors}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          : null}
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-semibold text-muted">Post</label>
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
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold shadow-[var(--shadow-soft)] transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
            >
              <Sparkles
                size={13}
                aria-hidden
                className="text-amber-500 dark:text-amber-300"
              />
              {aiOpen ? "Close AI helper" : "Generate with AI"}
            </button>
          </div>

          {aiOpen ? (
            <div className="mt-3 space-y-3 rounded-2xl border border-dashed border-border bg-pill/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  AI helper
                </p>
                <button
                  type="button"
                  onClick={() => setAiOpen(false)}
                  aria-label="Close AI helper"
                  className="rounded-full p-1 text-muted transition hover:bg-hover hover:text-foreground"
                >
                  <X size={14} aria-hidden />
                </button>
              </div>
              <label className="block space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Angle (optional)
                </span>
                <input
                  value={aiHint}
                  onChange={(e) => setAiHint(e.target.value)}
                  placeholder="e.g. wistful, sharp critique, a hot take, a question for readers…"
                  maxLength={280}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
                />
              </label>
              {aiError ? (
                <p className="text-xs text-red-600 dark:text-red-400">{aiError}</p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void generateWithAI()}
                  disabled={!book || aiBusy}
                  className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
                  style={{ background: "var(--gradient-brand)" }}
                >
                  {aiBusy ? (
                    <RefreshCw
                      size={13}
                      aria-hidden
                      className="animate-spin"
                    />
                  ) : (
                    <Sparkles size={13} aria-hidden />
                  )}
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
                  Draft will replace your current text — you can edit before posting.
                </p>
              </div>
            </div>
          ) : null}

          <textarea
            rows={7}
            maxLength={2000}
            value={content}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
            className="mt-3 w-full rounded-[24px] border border-border bg-card px-5 py-5 text-[17px] leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
            placeholder="“It is a truth universally acknowledged…”"
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
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
            <span className="text-[11px] text-muted">
              PNG, JPG, WebP, GIF · auto-compressed · final under 1 MB
            </span>
          </div>

          {imageError ? (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">{imageError}</p>
          ) : null}

          {postImage ? (
            <div className="relative mt-3 overflow-hidden rounded-xl border border-border bg-pill">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={postImage}
                alt="Preview"
                className="max-h-64 w-full object-contain"
              />
            </div>
          ) : null}

          <div className="mt-2 flex justify-between text-xs text-muted">
            <span>{content.length}/2000</span>
            <span>{ready ? "Looks good" : "Needs book + text or photo"}</span>
          </div>
        </div>

        {error ?
          <p className="text-sm text-red-500">{error}</p>
        : null}

        {publishing ?
          <LoadingIndicator label="Publishing…" />
        : <button
            type="submit"
            disabled={!ready}
            className="rounded-full px-8 py-4 text-sm font-semibold text-white shadow-xl disabled:opacity-40"
            style={{ background: "var(--gradient-brand)" }}
          >
            Launch into the feed
          </button>
        }
      </form>
    </div>
  );
}
