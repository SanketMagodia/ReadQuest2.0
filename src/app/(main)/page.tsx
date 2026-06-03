"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Sparkles, Clock3 } from "lucide-react";
import type { PostDTO } from "@/lib/serialize";
import { PostCard } from "@/components/posts/PostCard";
import { PostSkeletonList } from "@/components/feed/PostSkeleton";
import { DailyBookCard } from "@/components/feed/DailyBookCard";
import { AnnouncementFeedStrip } from "@/components/announcements/AnnouncementStrips";
import { JoinReadquestFeedCard } from "@/components/auth/UnlockFeatures";
import { useInfiniteScroll } from "@/lib/hooks/useInfiniteScroll";

type FeedMode = "for-you" | "latest";

type FeedResponse = {
  posts: PostDTO[];
  nextCursor: string | null;
  mode: FeedMode;
  signals?: { following: number; readlist: number; categories: number };
};

const PAGE_SIZE = 10;

export default function HomePage() {
  const { status } = useSession();
  const isGuest = status === "unauthenticated";
  const [mode, setMode] = useState<FeedMode>("for-you");
  const [posts, setPosts] = useState<PostDTO[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [signals, setSignals] = useState<FeedResponse["signals"]>();
  const seenIdsRef = useRef<Set<string>>(new Set());
  const requestSeqRef = useRef(0);

  const fetchFeed = useCallback(
    async (m: FeedMode, cursor: string | null) => {
      const seq = ++requestSeqRef.current;
      const params = new URLSearchParams();
      params.set("mode", m);
      params.set("limit", String(PAGE_SIZE));
      if (cursor) params.set("cursor", cursor);
      const res = await fetch(`/api/feed?${params}`, { cache: "no-store" });
      if (!res.ok) return null;
      const data = (await res.json()) as FeedResponse;
      if (seq !== requestSeqRef.current) return null;
      return data;
    },
    []
  );

  const reset = useCallback(
    async (m: FeedMode) => {
      seenIdsRef.current = new Set();
      setInitialLoading(true);
      setPosts([]);
      setNextCursor(null);
      const data = await fetchFeed(m, null);
      if (!data) {
        setInitialLoading(false);
        return;
      }
      data.posts.forEach((p) => seenIdsRef.current.add(p.id));
      setPosts(data.posts);
      setNextCursor(data.nextCursor);
      setSignals(data.signals);
      setInitialLoading(false);
    },
    [fetchFeed]
  );

  useEffect(() => {
    void reset(mode);
  }, [mode, reset]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !nextCursor) return;
    setLoadingMore(true);
    const data = await fetchFeed(mode, nextCursor);
    if (!data) {
      setLoadingMore(false);
      return;
    }
    const fresh = data.posts.filter((p) => !seenIdsRef.current.has(p.id));
    fresh.forEach((p) => seenIdsRef.current.add(p.id));
    setPosts((prev) => [...prev, ...fresh]);
    setNextCursor(data.nextCursor);
    setLoadingMore(false);
  }, [fetchFeed, mode, nextCursor, loadingMore]);

  const sentinelRef = useInfiniteScroll({
    onLoadMore: loadMore,
    hasMore: Boolean(nextCursor),
    loading: loadingMore || initialLoading,
  });

  const triggerIndex = useMemo(() => Math.max(0, posts.length - 5), [posts.length]);

  const isPersonalized = mode === "for-you" && (signals?.following ?? 0) + (signals?.readlist ?? 0) > 0;

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-1 sm:px-3 layout-wide:max-w-none layout-wide:px-0">
      <header className="sticky top-12 z-20 -mx-1 border-b border-border/70 bg-background/85 px-5 py-3 backdrop-blur layout-wide:top-0 layout-wide:-mx-0 layout-wide:px-3 layout-wide:py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
            Timeline
          </p>
          <div
            className="inline-flex rounded-full border border-border bg-card p-1 shadow-[var(--shadow-soft)]"
            role="tablist"
            aria-label="Feed mode"
          >
            <TabButton
              active={mode === "for-you"}
              onClick={() => setMode("for-you")}
              icon={<Sparkles size={14} aria-hidden />}
              label="For you"
            />
            <TabButton
              active={mode === "latest"}
              onClick={() => setMode("latest")}
              icon={<Clock3 size={14} aria-hidden />}
              label="Latest"
            />
          </div>
        </div>

        {mode === "for-you" && !isPersonalized && !initialLoading ? (
          <p className="mt-2 text-xs text-muted">
            Follow books from{" "}
            <Link href="/explore" className="font-semibold text-foreground underline">
              Explore
            </Link>{" "}
            to personalize this feed.
          </p>
        ) : null}
      </header>

      <div className="flex flex-col gap-3 px-2 layout-wide:px-3">
        {isGuest ? <JoinReadquestFeedCard /> : null}
        <div className="layout-compact:block hidden">
          <AnnouncementFeedStrip />
        </div>
        <DailyBookCard />

        {initialLoading ? (
          <PostSkeletonList count={6} />
        ) : posts.length === 0 ? (
          <EmptyFeed mode={mode} />
        ) : (
          <>
            {posts.map((p, i) => (
              <div
                key={p.id}
                ref={i === triggerIndex ? sentinelRef : undefined}
                className="animate-fade"
                style={{ animationDelay: `${Math.min(i * 35, 240)}ms` }}
              >
                <PostCard
                  post={p}
                  onDeleted={(postId) =>
                    setPosts((prev) => prev.filter((row) => row.id !== postId))
                  }
                />
              </div>
            ))}

            {nextCursor ? (
              <PostSkeletonList count={2} />
            ) : (
              <p className="py-8 text-center text-xs text-muted">
                You&apos;ve reached the end. New posts will appear here soon.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-semibold transition ${
        active
          ? "text-white shadow-[var(--shadow-pop)]"
          : "text-muted hover:text-foreground"
      }`}
      style={active ? { background: "var(--gradient-brand)" } : undefined}
    >
      {icon}
      {label}
    </button>
  );
}

function EmptyFeed({ mode }: { mode: FeedMode }) {
  return (
    <div className="rounded-3xl border border-dashed border-border p-10 text-center">
      <p className="text-base font-semibold">Nothing here yet</p>
      <p className="mt-2 text-sm text-muted">
        {mode === "for-you"
          ? "Follow books or share your first quote to start your feed."
          : "No posts yet — be the first to share a line."}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link
          href="/explore"
          className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background"
        >
          Explore books
        </Link>
        <Link
          href="/compose"
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-hover"
        >
          Compose a post
        </Link>
      </div>
    </div>
  );
}
