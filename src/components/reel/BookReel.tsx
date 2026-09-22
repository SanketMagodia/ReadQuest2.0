"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Compass, RefreshCw } from "lucide-react";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { JoinReadquestFeedCard } from "@/components/auth/UnlockFeatures";
import { trackReelAction } from "@/lib/analytics-events";
import type { ReelCard as ReelCardData } from "@/lib/reel";
import { ReelCard } from "./ReelCard";

type ReelAction = "served" | "skipped" | "read" | "saved";

/** Fetch one more batch when the reader is this close to the end. */
const PREFETCH_WITHIN = 2;

export function BookReel() {
  const { status } = useSession();
  const [cards, setCards] = useState<ReelCardData[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [randomMode, setRandomMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cardsRef = useRef<ReelCardData[]>([]);
  const peekedRef = useRef(false);
  const [peek, setPeek] = useState(false);

  // Actions already sent for a book, so a re-render or a scroll wobble can't
  // downgrade a "read" back to a "skipped".
  const reported = useRef<Map<string, ReelAction>>(new Map());
  const loadingMoreRef = useRef(false);
  const randomModeRef = useRef(false);

  // `loadBatch` needs the current cards to build its exclude list without
  // taking them as a dependency, which would restart in-flight fetches.
  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  const report = useCallback((bookId: string, action: ReelAction) => {
    const WEIGHT: Record<ReelAction, number> = {
      served: 0,
      skipped: 1,
      read: 2,
      saved: 3,
    };
    const prev = reported.current.get(bookId);
    if (prev && WEIGHT[prev] >= WEIGHT[action]) return;
    reported.current.set(bookId, action);
    if (action !== "served") trackReelAction(bookId, action);
    void fetch("/api/reel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId, action }),
      keepalive: true,
    }).catch(() => {});
  }, []);

  const appendCards = useCallback((fresh: ReelCardData[]) => {
    setCards((prev) => {
      const seen = new Set(prev.map((c) => c.id));
      return [...prev, ...fresh.filter((c) => !seen.has(c.id))];
    });
  }, []);

  const fetchCards = useCallback(async (kind: "starter" | "ranked" | "random") => {
    const params = new URLSearchParams();
    const exclude = cardsRef.current.map((c) => c.id).slice(-60).join(",");
    if (exclude) params.set("exclude", exclude);
    if (kind === "starter") params.set("starter", "1");
    if (kind === "random") params.set("random", "1");
    const qs = params.toString();
    const res = await fetch(`/api/reel${qs ? `?${qs}` : ""}`, { cache: "no-store" });
    if (!res.ok) return null;
    const j = (await res.json()) as { cards: ReelCardData[] };
    return j.cards ?? [];
  }, []);

  const loadBatch = useCallback(
    async (mode: "initial" | "more" | "starter" | "background") => {
      if (mode === "more") {
        if (loadingMoreRef.current || exhausted) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
      }
      try {
        let fresh = await fetchCards(
          mode === "starter" ? "starter" : randomModeRef.current ? "random" : "ranked"
        );
        if (fresh === null) {
          if (mode === "initial" || mode === "starter") {
            setError("Couldn't load your gists.");
          }
          return;
        }
        if (!fresh.length && mode !== "starter" && !randomModeRef.current) {
          // Nothing new left to rank. Keep the reel full with a random mix.
          fresh = await fetchCards("random");
          if (fresh === null) {
            if (mode === "initial") setError("Couldn't load your gists.");
            return;
          }
          randomModeRef.current = true;
          setRandomMode(true);
        }
        if (!fresh.length) {
          // The starter rotation running dry just means this reader has been
          // through it; the ranked run behind it still has books to give.
          if (mode !== "starter") setExhausted(true);
          return;
        }
        appendCards(fresh);
        // A later run succeeding clears an earlier one's failure — there are
        // books on screen, so the error screen would be a lie.
        setError(null);
        if (mode === "starter") setLoading(false);
      } catch {
        if (mode === "initial" || mode === "starter") {
          setError("Couldn't load your gists.");
        }
      } finally {
        // A starter run that came back empty keeps the spinner up: the ranked
        // run behind it is the one that decides whether there's anything left.
        if (mode === "initial" || mode === "background") setLoading(false);
        else if (mode === "more") {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        }
      }
    },
    [appendCards, exhausted, fetchCards]
  );

  /**
   * Open on the shared hourly rotation, which needs no ranker, then queue the
   * personalized run behind it. Reading starts immediately and the LLM
   * round-trip happens while the reader is on the first gist.
   */
  useEffect(() => {
    if (status !== "authenticated") return;
    void (async () => {
      await loadBatch("starter");
      await loadBatch("background");
    })();
    // Only ever run the first fetch once per session resolution.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Track which card is snapped into view. An observer beats a scroll handler
  // here because snap scrolling settles asynchronously.
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || !cards.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.6) continue;
          const index = Number((entry.target as HTMLElement).dataset.index);
          if (Number.isInteger(index)) setActiveIndex(index);
        }
      },
      { root, threshold: [0.6] }
    );

    for (const el of itemRefs.current) {
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [cards.length]);

  // A card reaching the top counts as served; leaving it behind untouched is
  // the skip signal the ranker learns from.
  useEffect(() => {
    const current = cards[activeIndex];
    if (current) report(current.id, "served");
    const previous = cards[activeIndex - 1];
    if (previous) report(previous.id, "skipped");
  }, [activeIndex, cards, report]);

  useEffect(() => {
    if (!cards.length) return;
    if (activeIndex >= cards.length - PREFETCH_WITHIN) {
      void loadBatch("more");
    }
  }, [activeIndex, cards.length, loadBatch]);

  const scrollToIndex = useCallback((index: number) => {
    itemRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // After the first batch paints, nudge the stack once so it reads as a
  // swipeable reel. Transform only — never scrollTop — or snap would skip.
  useEffect(() => {
    if (peekedRef.current || !cards.length) return;
    peekedRef.current = true;
    setPeek(true);
  }, [cards.length]);

  // Up/down move between books; left/right turn pages and belong to the card.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        scrollToIndex(Math.min(activeIndex + 1, cards.length - 1));
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        scrollToIndex(Math.max(activeIndex - 1, 0));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, cards.length, scrollToIndex]);

  const saveCard = useCallback(
    async (bookId: string) => {
      const res = await fetch("/api/readlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId, status: "want" }),
      });
      if (res.ok) report(bookId, "saved");
      return res.ok;
    },
    [report]
  );

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <div className="rq-reel flex items-center justify-center">
        <LoadingIndicator label="Lining up books for you…" />
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="rq-reel flex items-center justify-center px-3">
        <div className="w-full max-w-md">
          <JoinReadquestFeedCard />
          <Link
            href="/explore"
            className="mt-4 flex items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-3 text-sm font-semibold hover:bg-hover"
          >
            <Compass size={15} aria-hidden />
            Browse the library instead
          </Link>
        </div>
      </div>
    );
  }

  if (error || (!cards.length && !loading)) {
    return (
      <div className="rq-reel flex items-center justify-center px-3">
        <div className="max-w-sm rounded-3xl border border-dashed border-border p-8 text-center">
          <p className="text-base font-semibold">
            {error ?? "You've seen everything we have."}
          </p>
          <p className="mt-2 text-sm text-muted">
            {error
              ? "Give it a moment and try again."
              : "Follow a few books and we'll find fresher matches for you."}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setExhausted(false);
                randomModeRef.current = false;
                setRandomMode(false);
                setLoading(true);
                void loadBatch("initial");
              }}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white"
              style={{ background: "var(--gradient-brand)" }}
            >
              <RefreshCw size={13} aria-hidden /> Try again
            </button>
            <Link
              href="/explore"
              className="rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-hover"
            >
              Explore
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rq-reel-frame">
      {randomMode ? (
        <div className="shrink-0 border-b border-border/70 px-4 py-2.5 text-center">
          <p className="text-sm font-semibold">You&apos;ve seen everything we have.</p>
          <p className="mt-0.5 text-xs text-muted">
            A random mix, so there&apos;s always another gist.
          </p>
        </div>
      ) : null}
      <div
        ref={scrollerRef}
        className={peek ? "rq-reel rq-reel--peek" : "rq-reel"}
        aria-label="Gists"
      >
        {cards.map((card, i) => {
          const hasNext = i < cards.length - 1 || loadingMore;
          return (
          <div
            key={card.id}
            data-index={i}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            className={hasNext ? "rq-reel-slide" : "rq-reel-slide rq-reel-slide--last"}
            onAnimationEnd={
              i === 0
                ? (e) => {
                    if (e.target === e.currentTarget) setPeek(false);
                  }
                : undefined
            }
          >
            <ReelCard
              card={card}
              active={i === activeIndex}
              peeking={i === activeIndex + 1}
              mounted={Math.abs(i - activeIndex) <= 1}
              onSave={() => saveCard(card.id)}
              onRead={() => report(card.id, "read")}
              onNext={() => {
                report(card.id, "skipped");
                scrollToIndex(i + 1);
              }}
              onPeek={() => scrollToIndex(i)}
            />
          </div>
          );
        })}

        {loadingMore ? (
          <div className="rq-reel-item flex items-center justify-center">
            <LoadingIndicator size="sm" label="Finding your next book…" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
