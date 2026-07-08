"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { trackReaction } from "@/lib/analytics-events";

export type ReactionType = "like" | "dislike" | null;

type Props = {
  /** Target id (post or comment). Used to build the default endpoint. */
  postId: string;
  initialLikes: number;
  initialDislikes: number;
  initialMyReaction: ReactionType;
  /** Visual style. Inline = chips on a card, compact = pills with hover bg. */
  variant?: "compact" | "inline";
  /** Override the endpoint (e.g. for comment reactions). */
  endpoint?: string;
  /** Optional smaller density for tight UIs (comments). */
  size?: "md" | "sm";
};

export function PostReactions({
  postId,
  initialLikes,
  initialDislikes,
  initialMyReaction,
  variant = "inline",
  endpoint,
  size = "md",
}: Props) {
  const router = useRouter();
  const { status } = useSession();
  const authenticated = status === "authenticated";
  const [likes, setLikes] = useState(initialLikes);
  const [dislikes, setDislikes] = useState(initialDislikes);
  const [mine, setMine] = useState<ReactionType>(initialMyReaction);
  const [pending, startTransition] = useTransition();

  const toggle = useCallback(
    (next: "like" | "dislike") => {
      if (!authenticated) {
        router.push("/login");
        return;
      }
      const prev = { likes, dislikes, mine };
      const desired: ReactionType = mine === next ? null : next;

      // Optimistic update.
      let nextLikes = likes;
      let nextDislikes = dislikes;
      if (mine === "like") nextLikes -= 1;
      if (mine === "dislike") nextDislikes -= 1;
      if (desired === "like") nextLikes += 1;
      if (desired === "dislike") nextDislikes += 1;
      setLikes(nextLikes);
      setDislikes(nextDislikes);
      setMine(desired);

      const url = endpoint ?? `/api/posts/${postId}/react`;
      startTransition(async () => {
        try {
          const r = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: desired }),
          });
          if (!r.ok) throw new Error("Failed");
          const data = (await r.json()) as {
            likes: number;
            dislikes: number;
            myReaction: ReactionType;
          };
          setLikes(data.likes);
          setDislikes(data.dislikes);
          setMine(data.myReaction);
          trackReaction(
            endpoint ? "comment" : "post",
            data.myReaction ?? "remove"
          );
        } catch {
          setLikes(prev.likes);
          setDislikes(prev.dislikes);
          setMine(prev.mine);
        }
      });
    },
    [authenticated, dislikes, endpoint, likes, mine, postId, router]
  );

  const pad = size === "sm" ? "px-2 py-0.5 text-[12px]" : "px-2.5 py-1 text-[13px]";
  const iconSize = size === "sm" ? 13 : 15;
  const base =
    variant === "inline"
      ? `inline-flex items-center gap-1.5 rounded-full ${pad} font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 disabled:opacity-60`
      : `inline-flex items-center gap-1.5 rounded-full border border-border bg-card ${pad} font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 disabled:opacity-60`;

  const likeActive = mine === "like";
  const dislikeActive = mine === "dislike";

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle("like");
        }}
        disabled={pending}
        aria-pressed={likeActive}
        aria-label={likeActive ? "Remove like" : "Like this post"}
        className={`${base} ${
          likeActive
            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
            : "text-muted hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-300"
        }`}
      >
        <ThumbsUp
          size={iconSize}
          aria-hidden
          className={likeActive ? "fill-current" : ""}
        />
        <span className="tabular-nums">{likes}</span>
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle("dislike");
        }}
        disabled={pending}
        aria-pressed={dislikeActive}
        aria-label={dislikeActive ? "Remove dislike" : "Dislike this post"}
        className={`${base} ${
          dislikeActive
            ? "bg-rose-500/15 text-rose-600 dark:text-rose-300"
            : "text-muted hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-300"
        }`}
      >
        <ThumbsDown
          size={iconSize}
          aria-hidden
          className={dislikeActive ? "fill-current" : ""}
        />
        <span className="tabular-nums">{dislikes}</span>
      </button>
    </div>
  );
}
