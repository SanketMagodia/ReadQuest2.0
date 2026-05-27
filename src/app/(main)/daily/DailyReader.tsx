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
  const contentPages = useMemo(() => {
    if (!summary) return null;
    return paginateMarkdown(summary, 130);
  }, [summary]);

  const pages = useMemo<ReactNode[] | null>(() => {
    if (!data?.pick || !contentPages) return null;
    const { book } = data.pick;
    const total = contentPages.length;
    const list: ReactNode[] = [];

    // Cover (page 1)
    list.push(
      <CoverPage key="cover" book={book} pages={total + 2} streak={streak} />
    );

    // Content pages
    contentPages.forEach((blocks, i) => {
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

    // Finish page (last)
    list.push(
      <FinishPage
        key="finish"
        book={book}
        completed={completed}
        streak={streak}
      />
    );

    return list;
  }, [data?.pick, contentPages, completed, streak]);

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

  if (generating || !pages) {
    return (
      <Centered>
        <div className="flex flex-col items-center gap-3 text-center">
          <RefreshCw size={22} className="animate-spin text-sky-500" />
          <p className="text-sm font-semibold">
            Preparing today&apos;s read…
          </p>
          <p className="text-xs text-muted">
            Writing a fresh summary just for this quest. Takes a few seconds.
          </p>
        </div>
      </Centered>
    );
  }

  const initialPage = Math.min(
    data.pick.farthestPage || 0,
    pages.length - 1
  );

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

function paginateMarkdown(md: string, wordsPerPage: number): MdBlock[][] {
  const blocks = parseMarkdown(md);
  const pages: MdBlock[][] = [];
  let cur: MdBlock[] = [];
  let words = 0;

  for (const b of blocks) {
    const w =
      b.type === "rule" ? 0 : wordCount("text" in b ? b.text : "");

    // Headings prefer to start a new page when the current page is not nearly empty.
    if (b.type === "heading" && cur.length && words > 40) {
      pages.push(cur);
      cur = [];
      words = 0;
    }

    if (words + w > wordsPerPage && cur.length) {
      // If the block is a long paragraph, try to split it on sentences.
      if (b.type === "paragraph" && w > 60) {
        const sentences = splitSentences(b.text);
        for (const s of sentences) {
          const sw = wordCount(s);
          if (words + sw > wordsPerPage && cur.length) {
            pages.push(cur);
            cur = [];
            words = 0;
          }
          cur.push({ type: "paragraph", text: s });
          words += sw;
        }
        continue;
      }
      pages.push(cur);
      cur = [];
      words = 0;
    }
    cur.push(b);
    words += w;
  }
  if (cur.length) pages.push(cur);
  return pages.length ? pages : [[{ type: "paragraph", text: md }]];
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
