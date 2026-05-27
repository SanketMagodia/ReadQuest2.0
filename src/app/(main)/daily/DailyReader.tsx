"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  CheckCircle2,
  Flame,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { Flipbook } from "./Flipbook";

// ─── types mirroring /api/feed/daily ────────────────────────────────────────

type DailyPick = {
  id: string;
  day: string;
  completed: boolean;
  farthestPage: number;
  book: {
    id: string;
    slug: string;
    title: string;
    authors: string;
    thumbnail: string;
    description: string;
    categories: string;
  };
};

type Streak = {
  current: number;
  longest: number;
  lastDay: string;
  totalCompleted: number;
  today: string;
  completedToday: boolean;
};

type DailyResp = {
  pick: DailyPick | null;
  streak: Streak;
  summaryReady: boolean;
};

type SummaryResp = {
  book: { id: string; slug: string; title: string; authors: string };
  personal: { content: string } | null;
  shared: { content: string } | null;
  hasShared: boolean;
  hasPersonal: boolean;
};

// ─── component ──────────────────────────────────────────────────────────────

export function DailyReader() {
  const { status } = useSession();
  const [data, setData] = useState<DailyResp | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [completed, setCompleted] = useState(false);
  const completingRef = useRef(false);
  const lastReportedPage = useRef(0);

  // Initial fetch — daily pick + streak.
  useEffect(() => {
    if (status !== "authenticated") {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/feed/daily", { cache: "no-store" });
        if (!res.ok) {
          setError("Couldn't load today's pick.");
          return;
        }
        const j = (await res.json()) as DailyResp;
        if (cancelled) return;
        setData(j);
        setStreak(j.streak);
        setCompleted(j.streak.completedToday || !!j.pick?.completed);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  // Fetch (or generate) the book's summary.
  useEffect(() => {
    if (!data?.pick) return;
    const bookId = data.pick.book.id;
    let cancelled = false;

    const load = async () => {
      const res = await fetch(`/api/books/${bookId}/summary`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setError("Couldn't load summary.");
        return;
      }
      const j = (await res.json()) as SummaryResp;
      const content = j.personal?.content ?? j.shared?.content ?? null;
      if (content) {
        if (!cancelled) setSummary(content);
        return;
      }
      // Need to generate.
      setGenerating(true);
      const genRes = await fetch(`/api/books/${bookId}/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "shared" }),
      });
      setGenerating(false);
      if (!genRes.ok) {
        setError("Couldn't generate today's summary.");
        return;
      }
      const j2 = (await genRes.json()) as { summary: { content: string } };
      if (!cancelled) setSummary(j2.summary.content);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [data?.pick]);

  // ─── pagination ────────────────────────────────────────────────────────────
  //
  // We don't trust a word-count heuristic — the actual page height depends on
  // viewport width, typography, and which blocks live where. Instead we render
  // every block once into an off-screen mirror page that's CSS-identical to a
  // real page, then bin-pack by actual `offsetTop`/`offsetHeight`. The mirror
  // re-measures on resize so the same content reflows for tiny phones, wide
  // tablets, and everything in between.
  const rawBlocks = useMemo<MdBlock[] | null>(() => {
    if (!summary) return null;
    return prepareBlocksForPagination(parseMarkdown(summary));
  }, [summary]);

  const [measuredPages, setMeasuredPages] = useState<MdBlock[][] | null>(null);
  const measurerContentRef = useRef<HTMLDivElement | null>(null);

  const recomputePages = useCallback(() => {
    const blocks = rawBlocks;
    if (!blocks?.length) {
      setMeasuredPages(null);
      return;
    }
    const content = measurerContentRef.current;
    if (!content) return;
    const pageHeight = content.clientHeight;
    if (pageHeight <= 0) return;

    const children = Array.from(content.children) as HTMLElement[];
    if (children.length !== blocks.length) return;

    const contentOffsetTop = content.offsetTop;
    const out: MdBlock[][] = [[]];
    let pageStart = 0;

    for (let i = 0; i < children.length; i++) {
      const el = children[i];
      const top = el.offsetTop - contentOffsetTop;
      const bottom = top + el.offsetHeight;
      const fitsCurrent = bottom <= pageStart + pageHeight;
      if (!fitsCurrent && out[out.length - 1].length > 0) {
        out.push([]);
        pageStart = top;
      }
      out[out.length - 1].push(blocks[i]);
    }

    setMeasuredPages((prev) => {
      if (
        prev &&
        prev.length === out.length &&
        prev.every((p, i) => p.length === out[i].length)
      ) {
        return prev;
      }
      return out;
    });
  }, [rawBlocks]);

  // Measure after layout (and again on resize). Two RAFs let fonts settle.
  useLayoutEffect(() => {
    if (!rawBlocks?.length) {
      setMeasuredPages(null);
      return;
    }
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(recomputePages);
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [rawBlocks, recomputePages]);

  useEffect(() => {
    if (!rawBlocks?.length) return;
    const handler = () => recomputePages();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [rawBlocks, recomputePages]);

  const pages = useMemo<ReactNode[] | null>(() => {
    if (!data?.pick || !measuredPages) return null;
    const { book } = data.pick;
    const total = measuredPages.length;
    const list: ReactNode[] = [];

    list.push(
      <CoverPage key="cover" book={book} pages={total + 2} streak={streak} />
    );

    measuredPages.forEach((blocks, i) => {
      list.push(
        <ContentPage
          key={`p-${i}`}
          blocks={blocks}
          book={book}
          pageNumber={i + 1}
          totalPages={total}
        />
      );
    });

    list.push(
      <FinishPage
        key="finish"
        book={book}
        completed={completed}
        streak={streak}
      />
    );

    return list;
  }, [data?.pick, measuredPages, completed, streak]);

  // ─── completion ───────────────────────────────────────────────────────────
  const completeToday = useCallback(async () => {
    if (completed || completingRef.current) return;
    completingRef.current = true;
    try {
      const res = await fetch("/api/feed/daily", { method: "POST" });
      if (!res.ok) return;
      const j = (await res.json()) as { streak: Streak };
      setStreak(j.streak);
      setCompleted(true);
    } finally {
      completingRef.current = false;
    }
  }, [completed]);

  // Debounced progress reporter.
  const reportProgress = useCallback(async (idx: number) => {
    if (idx <= lastReportedPage.current) return;
    lastReportedPage.current = idx;
    await fetch("/api/feed/daily", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ farthestPage: idx }),
    }).catch(() => {});
  }, []);

  // ─── render ───────────────────────────────────────────────────────────────

  if (status !== "authenticated") {
    return (
      <Centered>
        <CallToSignIn />
      </Centered>
    );
  }

  if (loading) {
    return (
      <Centered>
        <LoadingIndicator label="Loading your daily pick…" />
      </Centered>
    );
  }

  if (error) {
    return (
      <Centered>
        <ErrorPanel message={error} />
      </Centered>
    );
  }

  if (!data?.pick) {
    return (
      <Centered>
        <ErrorPanel message="We couldn't find a book for you today. Try following a few books in Explore." />
      </Centered>
    );
  }

  const initialPage = pages
    ? Math.min(data.pick.farthestPage || 0, pages.length - 1)
    : 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-3 py-6 sm:px-6 sm:py-10">
      <header className="flex items-center justify-between gap-3">
        <Link
          href="/"
          aria-label="Back to feed"
          className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-3 text-xs font-semibold transition hover:bg-hover"
        >
          <ArrowLeft size={14} aria-hidden /> Feed
        </Link>
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
            Daily quest
          </p>
          <p className="text-sm font-semibold">{data.pick.book.title}</p>
        </div>
        <StreakChip streak={streak} completed={completed} />
      </header>

      {/* The book + its invisible measurement twin share this relative host so
          they always have identical width/height. */}
      <div className="relative">
        {pages ? (
          <Flipbook
            pages={pages}
            initialPage={initialPage}
            onPageChange={(i) => {
              void reportProgress(i);
            }}
            onLastPageReached={() => {
              void completeToday();
            }}
          />
        ) : (
          <FlipbookSkeleton
            message={
              generating
                ? "Writing today's read…"
                : "Measuring the page…"
            }
          />
        )}

        {rawBlocks && data.pick ? (
          <div
            aria-hidden
            className="rq-flipbook"
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              visibility: "hidden",
            }}
          >
            <div className="rq-book">
              <div className="rq-page rq-page--static">
                <div className="rq-page-face rq-page-face--front">
                  <div className="rq-page-body">
                    <p className="rq-page-eyebrow">{data.pick.book.title}</p>
                    <div
                      ref={measurerContentRef}
                      className="flex-1 overflow-hidden"
                    >
                      {rawBlocks.map((b, i) => renderBlock(b, `m-${i}`))}
                    </div>
                    <div className="rq-page-footer">
                      <span>·</span>
                      <span>99 / 99</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {completed ? (
        <p className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-pill px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 size={12} aria-hidden />
          Streak counted for {streak?.lastDay}
        </p>
      ) : (
        <p className="mx-auto text-center text-[11px] text-muted">
          Swipe, click the page edges, or use the arrow keys. Reach the last
          page to add a day to your streak.
        </p>
      )}
    </div>
  );
}

function FlipbookSkeleton({ message }: { message: string }) {
  return (
    <div className="rq-flipbook">
      <div className="rq-book">
        <div className="rq-page rq-page--static">
          <div className="rq-page-face rq-page-face--front">
            <div className="rq-page-body">
              <p className="rq-page-eyebrow" style={{ opacity: 0.3 }}>
                ·
              </p>
              <div className="flex flex-1 items-center justify-center text-center">
                <div>
                  <RefreshCw
                    size={20}
                    className="mx-auto animate-spin opacity-60"
                    aria-hidden
                  />
                  <p className="mt-3 text-sm opacity-75">{message}</p>
                </div>
              </div>
              <div className="rq-page-footer" style={{ opacity: 0.3 }}>
                <span>·</span>
                <span>·</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Reserve the same vertical footprint as Flipbook's bottom controls. */}
      <div aria-hidden style={{ height: 36 }} />
    </div>
  );
}

// ─── visual sub-components ───────────────────────────────────────────────────

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[70dvh] w-full max-w-2xl items-center justify-center px-4 py-12">
      {children}
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
      <p className="text-sm font-semibold">{message}</p>
      <Link
        href="/"
        className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background"
      >
        <ArrowLeft size={12} aria-hidden /> Back to feed
      </Link>
    </div>
  );
}

function CallToSignIn() {
  return (
    <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-soft)]">
      <Sparkles
        size={28}
        aria-hidden
        className="mx-auto text-amber-500 dark:text-amber-300"
      />
      <h2 className="mt-3 text-xl font-bold">Sign in to start your streak</h2>
      <p className="mt-2 text-sm text-muted">
        The daily quest picks a book just for you and rewards you for showing
        up.
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <Link
          href="/login"
          className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background"
        >
          Sign in
        </Link>
        <Link
          href="/register"
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
        >
          Create account
        </Link>
      </div>
    </div>
  );
}

function StreakChip({
  streak,
  completed,
}: {
  streak: Streak | null;
  completed: boolean;
}) {
  if (!streak) return <span />;
  const alive = streak.current > 0;
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold text-white"
      style={{
        background: alive
          ? completed
            ? "var(--gradient-warm)"
            : "var(--gradient-brand)"
          : "var(--gradient-cool)",
      }}
    >
      <Flame size={12} aria-hidden />
      {streak.current}d
    </div>
  );
}

// ─── flipbook page renderers ─────────────────────────────────────────────────

function CoverPage({
  book,
  pages,
  streak,
}: {
  book: DailyPick["book"];
  pages: number;
  streak: Streak | null;
}) {
  return (
    <div className="rq-page-body">
      <p className="rq-page-eyebrow">Daily quest · {new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="relative mb-5 h-[150px] w-[100px] overflow-hidden rounded-md shadow-[0_18px_40px_-14px_rgba(0,0,0,0.45)] ring-1 ring-black/10">
          {book.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={book.thumbnail.replace(/^http:/, "https:")}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-lg font-bold text-white"
              style={{ background: "var(--gradient-brand)" }}
            >
              {book.title.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
        <h1 className="text-[22px] font-black leading-tight tracking-tight sm:text-[26px]">
          {book.title}
        </h1>
        {book.authors ? (
          <p className="mt-1 text-sm italic opacity-75">
            {book.authors.split(/[,;]/)[0].trim()}
          </p>
        ) : null}
        <p className="mt-6 max-w-[80%] text-[13px] leading-relaxed opacity-75">
          A short, hand-shaped summary picked for you today. Reach the last
          page to keep your streak alive.
        </p>
      </div>
      <div className="rq-page-footer">
        <span>Streak · {streak?.current ?? 0}d</span>
        <span>{pages} pages</span>
      </div>
    </div>
  );
}

function ContentPage({
  blocks,
  book,
  pageNumber,
  totalPages,
}: {
  blocks: MdBlock[];
  book: DailyPick["book"];
  pageNumber: number;
  totalPages: number;
}) {
  return (
    <div className="rq-page-body">
      <p className="rq-page-eyebrow">{book.title}</p>
      <div className="flex-1 overflow-hidden">
        {blocks.map((b, i) => renderBlock(b, `${pageNumber}-${i}`))}
      </div>
      <div className="rq-page-footer">
        <span>·</span>
        <span>
          {pageNumber} / {totalPages}
        </span>
      </div>
    </div>
  );
}

function FinishPage({
  book,
  completed,
  streak,
}: {
  book: DailyPick["book"];
  completed: boolean;
  streak: Streak | null;
}) {
  return (
    <div className="rq-page-body">
      <p className="rq-page-eyebrow">End of today&apos;s quest</p>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div
          className="mb-4 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg"
          style={{ background: "var(--gradient-warm)" }}
        >
          <Flame size={22} aria-hidden />
        </div>
        <h2 className="text-xl font-black leading-tight tracking-tight sm:text-2xl">
          {completed
            ? `${streak?.current ?? 1}-day streak`
            : "You're at the end"}
        </h2>
        <p className="mt-3 max-w-[80%] text-[14px] leading-relaxed opacity-80">
          {completed
            ? "Nice work. Come back tomorrow for a new book — miss a day and the streak resets."
            : "Recording your read…"}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            href={`/book/${book.slug}`}
            className="inline-flex items-center rounded-full px-4 py-2 text-xs font-semibold text-white shadow-[0_8px_20px_-6px_rgba(56,189,248,0.5)] transition hover:brightness-110"
            style={{ background: "var(--gradient-brand)" }}
          >
            Open book room
          </Link>
          <Link
            href={`/book/${book.slug}/summary`}
            className="inline-flex items-center rounded-full border px-4 py-2 text-xs font-semibold transition hover:bg-black/5 dark:hover:bg-white/5"
            style={{ borderColor: "currentColor", opacity: 0.85 }}
          >
            Full summary
          </Link>
        </div>
      </div>
      <div className="rq-page-footer">
        <span>{book.title}</span>
        <span>Done.</span>
      </div>
    </div>
  );
}

// ─── markdown → paginated blocks ─────────────────────────────────────────────

type MdBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "blockquote"; text: string }
  | { type: "rule" };

function parseMarkdown(input: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  const lines = input.split(/\r?\n/);
  let buf: string[] = [];
  let bq: string[] = [];

  const flushParagraph = () => {
    const t = buf.join(" ").trim();
    buf = [];
    if (t) blocks.push({ type: "paragraph", text: t });
  };
  const flushBlockquote = () => {
    const t = bq.join(" ").trim();
    bq = [];
    if (t) blocks.push({ type: "blockquote", text: t });
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      flushBlockquote();
      continue;
    }
    if (/^([-*_])\1{2,}$/.test(line)) {
      flushParagraph();
      flushBlockquote();
      blocks.push({ type: "rule" });
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      flushParagraph();
      flushBlockquote();
      blocks.push({
        type: "heading",
        level: h[1].length as 1 | 2 | 3,
        text: h[2],
      });
      continue;
    }
    const q = line.match(/^>\s?(.*)$/);
    if (q) {
      flushParagraph();
      bq.push(q[1]);
      continue;
    }
    flushBlockquote();
    buf.push(line);
  }
  flushParagraph();
  flushBlockquote();
  return blocks;
}

function wordCount(s: string) {
  return (s.match(/\S+/g) || []).length;
}

/**
 * Splits long paragraphs/blockquotes into ~28-word sentence-aligned chunks so
 * the measurement-based bin packer always has fine-grained atoms to pack.
 * Short blocks are untouched — typical reads will look unchanged.
 */
function prepareBlocksForPagination(blocks: MdBlock[]): MdBlock[] {
  const MAX_BLOCK_WORDS = 45;
  const TARGET_CHUNK_WORDS = 28;
  const out: MdBlock[] = [];

  for (const b of blocks) {
    const canSplit = b.type === "paragraph" || b.type === "blockquote";
    if (!canSplit) {
      out.push(b);
      continue;
    }
    if (wordCount(b.text) <= MAX_BLOCK_WORDS) {
      out.push(b);
      continue;
    }
    const sentences = splitSentences(b.text);
    let buf: string[] = [];
    let bufW = 0;
    const flush = () => {
      if (!buf.length) return;
      out.push({ type: b.type, text: buf.join(" ") });
      buf = [];
      bufW = 0;
    };
    for (const s of sentences) {
      const sw = wordCount(s);
      if (bufW > 0 && bufW + sw > TARGET_CHUNK_WORDS) flush();
      buf.push(s);
      bufW += sw;
    }
    flush();
  }
  return out;
}

function splitSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by whitespace + capital letter.
  const parts = text
    .split(/(?<=[.!?])\s+(?=[A-Z“"])/g)
    .map((s) => s.trim())
    .filter(Boolean);
  // If splitting produced nothing useful, just chunk by ~60 words.
  if (parts.length <= 1) {
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += 60) {
      chunks.push(words.slice(i, i + 60).join(" "));
    }
    return chunks;
  }
  return parts;
}

function renderBlock(b: MdBlock, key: string): ReactNode {
  if (b.type === "rule") {
    return (
      <div
        key={key}
        className="ornament my-3"
        aria-hidden
        style={{ color: "currentColor", opacity: 0.55 }}
      >
        <span>·</span>
        <span>·</span>
        <span>·</span>
      </div>
    );
  }
  if (b.type === "heading") {
    if (b.level === 1 || b.level === 2) {
      return <h2 key={key}>{renderInline(b.text, key)}</h2>;
    }
    return (
      <h3
        key={key}
        className="mb-1 mt-2 text-[0.78rem] font-semibold uppercase tracking-[0.18em] opacity-60"
      >
        {renderInline(b.text, key)}
      </h3>
    );
  }
  if (b.type === "blockquote") {
    return (
      <blockquote
        key={key}
        className="my-2 italic"
        style={{
          borderLeft: "3px solid",
          paddingLeft: 12,
          opacity: 0.85,
        }}
      >
        {renderInline(b.text, key)}
      </blockquote>
    );
  }
  return <p key={key}>{renderInline(b.text, key)}</p>;
}

function renderInline(text: string, scope: string): ReactNode[] {
  const out: ReactNode[] = [];
  let remaining = text;
  let i = 0;
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_/;
  while (remaining.length) {
    const m = remaining.match(re);
    if (!m || m.index === undefined) {
      out.push(<Fragment key={`${scope}-t-${i++}`}>{remaining}</Fragment>);
      break;
    }
    if (m.index > 0)
      out.push(
        <Fragment key={`${scope}-t-${i++}`}>
          {remaining.slice(0, m.index)}
        </Fragment>
      );
    if (m[1]) out.push(<strong key={`${scope}-b-${i++}`}>{m[1]}</strong>);
    else out.push(<em key={`${scope}-i-${i++}`}>{m[2] || m[3]}</em>);
    remaining = remaining.slice(m.index + m[0].length);
  }
  return out;
}
