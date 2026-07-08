"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  BookOpen,
  RefreshCw,
  Sparkles,
  User as UserIcon,
  Users,
  Wand2,
  X,
} from "lucide-react";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import {
  trackGenerateSummary,
  trackViewSummary,
} from "@/lib/analytics-events";

type Summary = {
  id: string;
  content: string;
  prompt: string;
  scope: "shared" | "personal";
  wordCount: number;
  updatedAt: string;
};

type SummaryResponse = {
  book: { id: string; slug: string; title: string; authors: string };
  personal: Summary | null;
  shared: Summary | null;
  hasShared: boolean;
  hasPersonal: boolean;
  canCustomize: boolean;
};

type Props = {
  bookId: string;
  slug: string;
  title: string;
  authors: string;
  thumbnail: string;
};

const CUSTOM_PRESETS = [
  "Tell me as if the main character is me — first-person POV.",
  "Tell me as a bedtime story with a warm, gentle voice.",
  "Lens the summary through the antagonist's perspective.",
  "Focus on the central themes and what the book is really arguing.",
  "Give it as a cinematic 3-act breakdown of beats.",
];

export function SummaryReader({
  bookId,
  slug,
  title,
  authors,
  thumbnail,
}: Props) {
  const { status } = useSession();
  const authenticated = status === "authenticated";

  const [data, setData] = useState<SummaryResponse | null>(null);
  const [activeScope, setActiveScope] = useState<"shared" | "personal">(
    "shared"
  );
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Custom prompt panel state
  const [panelOpen, setPanelOpen] = useState(false);
  const [prompt, setPrompt] = useState("");

  // Reading progress
  const articleRef = useRef<HTMLDivElement | null>(null);
  const scopeCardRef = useRef<HTMLElement | null>(null);
  const [progress, setProgress] = useState(0);

  const refresh = useCallback(async () => {
    setError(null);
    const res = await fetch(`/api/books/${bookId}/summary`, {
      cache: "no-store",
    });
    if (!res.ok) {
      setError("Couldn't load summary.");
      return;
    }
    const j = (await res.json()) as SummaryResponse;
    setData(j);
    // Prefer personal if it exists, otherwise shared.
    if (j.personal) setActiveScope("personal");
    else setActiveScope("shared");
  }, [bookId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    trackViewSummary(bookId, slug);
  }, [bookId, slug]);

  // Track reading progress across the article.
  useEffect(() => {
    const onScroll = () => {
      const el = articleRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const totalScrollable = Math.max(1, rect.height - window.innerHeight + 240);
      const scrolledPast = Math.max(0, 240 - rect.top);
      const pct = Math.min(100, Math.max(0, (scrolledPast / totalScrollable) * 100));
      setProgress(pct);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [data]);

  const active: Summary | null =
    activeScope === "personal" ? data?.personal ?? null : data?.shared ?? null;

  const minutes = active ? Math.max(1, Math.round(active.wordCount / 220)) : 0;

  const generate = useCallback(
    async (scope: "shared" | "personal", userPrompt: string) => {
      if (scope === "personal" && !authenticated) {
        setError("Sign in to create a personal summary.");
        return;
      }
      if (!authenticated) {
        setError("Sign in to generate a summary.");
        return;
      }
      setGenerating(true);
      setError(null);
      try {
        const res = await fetch(`/api/books/${bookId}/summary`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope, prompt: userPrompt }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          setError(j.error ?? "Generation failed. Try again.");
          return;
        }
        const j = (await res.json()) as { summary: Summary };
        trackGenerateSummary(bookId, j.summary.scope);
        await refresh();
        setActiveScope(j.summary.scope);
        setPanelOpen(false);
        setPrompt("");
        // Scroll to top so the new read starts fresh.
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch {
        setError("Network error. Try again.");
      } finally {
        setGenerating(false);
      }
    },
    [authenticated, bookId, refresh]
  );

  const removePersonal = async () => {
    if (!data?.hasPersonal) return;
    if (!window.confirm("Delete your personal summary and revert to the community one?")) {
      return;
    }
    const res = await fetch(`/api/books/${bookId}/summary`, {
      method: "DELETE",
    });
    if (res.ok) {
      void refresh();
    }
  };

  const renderedBody = useMemo(
    () => (active?.content ? renderMarkdown(active.content) : null),
    [active?.content]
  );

  const headerSpacer = "h-[88px] sm:h-[96px]";

  return (
    <div className="relative">
      {/* Top progress strip (mobile-friendly + visible on desktop) */}
      <div
        aria-hidden
        className="fixed inset-x-0 top-0 z-30 h-[3px] bg-border/40"
      >
        <div
          className="h-full origin-left transition-[width] duration-150"
          style={{
            width: `${progress}%`,
            background: "var(--gradient-brand)",
          }}
        />
      </div>

      {/* Sticky compact header */}
      <header className="sticky top-12 z-20 border-b border-border/70 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:top-0">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-3 py-3 sm:px-6">
          <Link
            href={`/book/${slug}`}
            aria-label="Back to book"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground/80 transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
          >
            <ArrowLeft size={16} aria-hidden />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              Summary
            </p>
            <p className="truncate text-sm font-semibold sm:text-base">
              {title}
              {authors ? (
                <span className="ml-1 text-muted">— {authors.split(/[,;]/)[0]}</span>
              ) : null}
            </p>
          </div>
          {minutes ? (
            <span className="hidden shrink-0 rounded-full bg-pill px-3 py-1 text-[11px] font-semibold text-muted sm:inline-flex">
              {minutes} min read
            </span>
          ) : null}
        </div>
      </header>

      {/* Side rail with progress + percent (desktop) */}
      <div
        aria-hidden
        className="pointer-events-none fixed right-5 top-1/2 hidden -translate-y-1/2 flex-col items-center gap-3 lg:flex"
      >
        <span className="text-[11px] font-semibold text-muted tabular-nums">
          {Math.round(progress)}%
        </span>
        <div className="relative h-[60vh] w-[3px] overflow-hidden rounded-full bg-border/40">
          <div
            className="absolute inset-x-0 top-0 transition-[height] duration-150"
            style={{
              height: `${progress}%`,
              background: "var(--gradient-brand)",
            }}
          />
        </div>
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted">
          read
        </span>
      </div>

      <main className="mx-auto w-full max-w-3xl px-3 pb-24 sm:px-6">
        <div className={headerSpacer} aria-hidden />

        {/* Book chip + scope switcher */}
        <section ref={scopeCardRef} className="mt-4 mb-8 flex flex-col gap-5 rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] sm:p-6">
          <div className="flex items-start gap-4">
            <div className="relative h-[88px] w-[60px] shrink-0 overflow-hidden rounded-xl bg-pill ring-1 ring-border/60">
              {thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbnail.replace(/^http:/, "https:")}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center text-xs font-bold text-white"
                  style={{ background: "var(--gradient-brand)" }}
                >
                  {title.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-black leading-tight tracking-tight sm:text-3xl">
                {title}
              </h1>
              {authors ? (
                <p className="mt-1 text-sm text-muted">{authors}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                <Link
                  href={`/book/${slug}`}
                  className="inline-flex items-center gap-1 rounded-full bg-pill px-2.5 py-0.5 font-semibold text-foreground/80 hover:bg-hover"
                >
                  <BookOpen size={11} aria-hidden /> Open book page
                </Link>
                {minutes ? <span>· {minutes} min read</span> : null}
                {active?.wordCount ? (
                  <span>· {active.wordCount.toLocaleString()} words</span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Scope switcher */}
          {data?.hasShared || data?.hasPersonal ? (
            <div
              role="tablist"
              aria-label="Summary version"
              className="flex flex-wrap items-center gap-2"
            >
              {data?.hasShared ? (
                <button
                  role="tab"
                  aria-selected={activeScope === "shared"}
                  onClick={() => setActiveScope("shared")}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    activeScope === "shared"
                      ? "text-white shadow-sm"
                      : "border border-border bg-card text-foreground/80 hover:bg-hover"
                  }`}
                  style={
                    activeScope === "shared"
                      ? { background: "var(--gradient-brand)" }
                      : undefined
                  }
                >
                  <Users size={12} aria-hidden /> Community
                </button>
              ) : null}
              {data?.hasPersonal ? (
                <button
                  role="tab"
                  aria-selected={activeScope === "personal"}
                  onClick={() => setActiveScope("personal")}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    activeScope === "personal"
                      ? "text-white shadow-sm"
                      : "border border-border bg-card text-foreground/80 hover:bg-hover"
                  }`}
                  style={
                    activeScope === "personal"
                      ? { background: "var(--gradient-warm)" }
                      : undefined
                  }
                >
                  <UserIcon size={12} aria-hidden /> My version
                </button>
              ) : null}
              <span aria-hidden className="ml-auto" />
              <button
                type="button"
                onClick={() => {
                  setPanelOpen((v) => !v);
                  setError(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold shadow-[var(--shadow-soft)] hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
              >
                <Wand2
                  size={12}
                  aria-hidden
                  className="text-amber-500 dark:text-amber-300"
                />
                {data?.hasPersonal ? "Re-personalize" : "Make it personal"}
              </button>
              {data?.hasPersonal ? (
                <button
                  type="button"
                  onClick={() => void removePersonal()}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-hover"
                >
                  <X size={11} aria-hidden /> Remove
                </button>
              ) : null}
            </div>
          ) : null}

          {panelOpen ? (
            <CustomPromptPanel
              prompt={prompt}
              setPrompt={setPrompt}
              generating={generating}
              onClose={() => setPanelOpen(false)}
              onGenerate={() => generate("personal", prompt)}
              authenticated={authenticated}
            />
          ) : null}

          {error ? (
            <p className="rounded-2xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">
              {error}
            </p>
          ) : null}
        </section>

        {/* Body */}
        <article ref={articleRef} className="mb-16">
          {data === null ? (
            <LoadingIndicator label="Loading summary…" />
          ) : active ? (
            <SummaryBody>{renderedBody}</SummaryBody>
          ) : (
            <EmptyState
              authenticated={authenticated}
              busy={generating}
              onGenerateShared={() => generate("shared", "")}
              onCustomize={() => setPanelOpen(true)}
            />
          )}

          {active ? (
            <footer className="mt-12 flex flex-col gap-3 border-t border-border/70 pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
              <p>
                {active.scope === "personal"
                  ? `Personalized · ${new Date(active.updatedAt).toLocaleString()}`
                  : `Community summary · ${new Date(active.updatedAt).toLocaleString()}`}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPanelOpen(true);
                    setError(null);
                    scopeCardRef.current?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 font-semibold hover:bg-hover"
                >
                  <Wand2 size={12} aria-hidden />
                  {data?.hasPersonal ? "Re-personalize" : "Make it personal"}
                </button>
                <Link
                  href={`/book/${slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 font-semibold hover:bg-hover"
                >
                  <ArrowLeft size={12} aria-hidden /> Back to book
                </Link>
              </div>
            </footer>
          ) : null}
        </article>
      </main>
    </div>
  );
}

function CustomPromptPanel({
  prompt,
  setPrompt,
  generating,
  onClose,
  onGenerate,
  authenticated,
}: {
  prompt: string;
  setPrompt: (next: string) => void;
  generating: boolean;
  onClose: () => void;
  onGenerate: () => void;
  authenticated: boolean;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-dashed border-border bg-pill/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
          <Sparkles
            size={12}
            aria-hidden
            className="text-amber-500 dark:text-amber-300"
          />
          Personalize your summary
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-full p-1 text-muted hover:bg-hover hover:text-foreground"
        >
          <X size={12} aria-hidden />
        </button>
      </div>

      <textarea
        rows={2}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        maxLength={800}
        placeholder="e.g. Tell me as if the main character is me, in first-person POV."
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
      />

      <div className="flex flex-wrap gap-1.5">
        {CUSTOM_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPrompt(p)}
            className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground/80 hover:bg-hover"
          >
            {p.length > 48 ? p.slice(0, 45) + "…" : p}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating || !authenticated}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
          style={{ background: "var(--gradient-brand)" }}
        >
          {generating ? (
            <RefreshCw size={12} aria-hidden className="animate-spin" />
          ) : (
            <Sparkles size={12} aria-hidden />
          )}
          {generating ? "Writing…" : "Generate my version"}
        </button>
        {!authenticated ? (
          <Link
            href="/login"
            className="text-xs font-semibold text-sky-600 hover:underline dark:text-sky-300"
          >
            Sign in to save your personal version
          </Link>
        ) : (
          <p className="text-[11px] text-muted">
            Saved to your account — next visit you&apos;ll land on your version.
          </p>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  authenticated,
  busy,
  onGenerateShared,
  onCustomize,
}: {
  authenticated: boolean;
  busy: boolean;
  onGenerateShared: () => void;
  onCustomize: () => void;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card/60 p-8 text-center sm:p-12">
      <Sparkles
        size={28}
        aria-hidden
        className="mx-auto text-amber-500 dark:text-amber-300"
      />
      <h2 className="mt-3 text-xl font-bold">No summary yet</h2>
      <p className="mt-2 text-sm text-muted">
        Generate a long-form reader&apos;s summary in seconds. The first version
        is saved for everyone; you can also make a personal one with your own
        angle.
      </p>
      {authenticated ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onGenerateShared}
            className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
            style={{ background: "var(--gradient-brand)" }}
          >
            {busy ? (
              <RefreshCw size={14} aria-hidden className="animate-spin" />
            ) : (
              <Sparkles size={14} aria-hidden />
            )}
            {busy ? "Writing…" : "Generate summary"}
          </button>
          <button
            type="button"
            onClick={onCustomize}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold hover:bg-hover"
          >
            <Wand2 size={14} aria-hidden /> Personalize instead
          </button>
        </div>
      ) : (
        <Link
          href="/login"
          className="mt-5 inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
          style={{ background: "var(--gradient-brand)" }}
        >
          Sign in to generate
        </Link>
      )}
    </div>
  );
}

function SummaryBody({ children }: { children: ReactNode }) {
  return <div className="prose-reader">{children}</div>;
}

// ──────────────────────────────────────────────────────────────────────────────
//  Tiny markdown renderer — supports # / ## / ### headings, **bold**, *italic*,
//  blockquotes (> ...) and paragraph breaks. Intentionally minimal so we don't
//  pull in a dependency for one screen.
// ──────────────────────────────────────────────────────────────────────────────

function renderMarkdown(input: string): ReactNode[] {
  const lines = input.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let blockquote: string[] = [];

  const flushParagraph = (key: string) => {
    if (!paragraph.length) return;
    const text = paragraph.join(" ").trim();
    paragraph = [];
    if (!text) return;
    blocks.push(
      <p key={`p-${key}`}>{renderInline(text, `p-${key}`)}</p>
    );
  };

  const flushBlockquote = (key: string) => {
    if (!blockquote.length) return;
    const text = blockquote.join(" ").trim();
    blockquote = [];
    if (!text) return;
    blocks.push(
      <blockquote key={`bq-${key}`}>
        {renderInline(text, `bq-${key}`)}
      </blockquote>
    );
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();

    if (!line.trim()) {
      flushParagraph(String(i));
      flushBlockquote(String(i));
      continue;
    }

    // Ornamental break: a line of three or more `-`, `*`, or `_`.
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      flushParagraph(String(i));
      flushBlockquote(String(i));
      blocks.push(
        <div key={`hr-${i}`} className="ornament" aria-hidden>
          <span>·</span>
          <span>·</span>
          <span>·</span>
        </div>
      );
      continue;
    }

    const h3 = line.match(/^###\s+(.*)$/);
    const h2 = line.match(/^##\s+(.*)$/);
    const h1 = line.match(/^#\s+(.*)$/);
    const bq = line.match(/^>\s?(.*)$/);

    if (h1 || h2 || h3) {
      flushParagraph(String(i));
      flushBlockquote(String(i));
      if (h1) {
        blocks.push(
          <h2 key={`h-${i}`}>{renderInline(h1[1], `h-${i}`)}</h2>
        );
      } else if (h2) {
        blocks.push(
          <h2 key={`h-${i}`}>{renderInline(h2[1], `h-${i}`)}</h2>
        );
      } else if (h3) {
        blocks.push(
          <h3 key={`h-${i}`}>{renderInline(h3[1], `h-${i}`)}</h3>
        );
      }
      continue;
    }

    if (bq) {
      flushParagraph(String(i));
      blockquote.push(bq[1]);
      continue;
    }

    flushBlockquote(String(i));
    paragraph.push(line.trim());
  }

  flushParagraph("end");
  flushBlockquote("end");

  return blocks;
}

function renderInline(text: string, scopeKey: string): ReactNode[] {
  const out: ReactNode[] = [];
  let remaining = text;
  let i = 0;
  // Match **bold**, then *italic*, then _italic_, in order.
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_/;
  while (remaining.length) {
    const m = remaining.match(re);
    if (!m || m.index === undefined) {
      out.push(<Fragment key={`${scopeKey}-t-${i++}`}>{remaining}</Fragment>);
      break;
    }
    if (m.index > 0) {
      out.push(
        <Fragment key={`${scopeKey}-t-${i++}`}>
          {remaining.slice(0, m.index)}
        </Fragment>
      );
    }
    if (m[1]) {
      out.push(
        <strong key={`${scopeKey}-b-${i++}`}>{m[1]}</strong>
      );
    } else {
      out.push(<em key={`${scopeKey}-i-${i++}`}>{m[2] || m[3]}</em>);
    }
    remaining = remaining.slice(m.index + m[0].length);
  }
  return out;
}
