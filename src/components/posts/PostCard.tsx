"use client";

import Image from "next/image";
import Link from "next/link";
import { MessageSquare, BookOpen } from "lucide-react";
import type { PostDTO } from "@/lib/serialize";
import { PostReactions } from "@/components/posts/PostReactions";

function fmtRelative(iso: string) {
  try {
    const ts = new Date(iso).getTime();
    const diff = Date.now() - ts;
    const m = Math.round(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.round(h / 24);
    if (d < 30) return `${d}d`;
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function PostCard({ post }: { post: PostDTO }) {
  const author = post.author.name || post.author.username;
  const initials = author.slice(0, 2).toUpperCase();

  return (
    <article className="group rounded-[22px] border border-border/80 bg-card p-5 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:border-border hover:shadow-lg">
      <div className="flex gap-4">
        <Link
          href={`/profile/${post.author.username}`}
          aria-label={`Open ${author}'s profile`}
          className="relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl bg-pill ring-2 ring-transparent transition group-hover:ring-sky-400/35 sm:h-12 sm:w-12"
        >
          {post.author.image ? (
            <Image
              src={post.author.image}
              alt=""
              width={48}
              height={48}
              className="h-full w-full object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="flex h-full w-full items-center justify-center text-sm font-semibold text-foreground/80"
              style={{ background: "var(--gradient-brand)", color: "white" }}
            >
              {initials}
            </span>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <Link
              href={`/profile/${post.author.username}`}
              className="font-semibold hover:underline hover:underline-offset-4"
            >
              {author}
            </Link>
            <span className="truncate text-[13px] text-muted">
              @{post.author.username}
            </span>
            <span aria-hidden className="text-muted">·</span>
            <span className="text-[13px] text-muted" title={post.createdAt}>
              {fmtRelative(post.createdAt)}
            </span>
          </div>

          <Link href={`/book/${post.book.slug || post.book.id}`} className="mt-2 inline-flex">
            <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-border/80 bg-pill px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted transition hover:border-sky-400/50 hover:text-foreground">
              <BookOpen size={12} aria-hidden />
              <span className="truncate text-foreground">{post.book.title}</span>
              {post.book.authors ? (
                <span className="text-muted">
                  · {post.book.authors.split(";")[0].slice(0, 40)}
                </span>
              ) : null}
            </span>
          </Link>

          <Link
            href={`/post/${post.id}`}
            prefetch={false}
            className="mt-3 block"
          >
            <p className="whitespace-pre-wrap text-[16px] leading-relaxed text-foreground/95 sm:text-[17px]">
              {post.content}
            </p>
          </Link>

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-muted">
            <PostReactions
              postId={post.id}
              initialLikes={post.likes}
              initialDislikes={post.dislikes}
              initialMyReaction={post.myReaction}
            />
            <span aria-hidden className="h-4 w-px bg-border/80" />
            <Link
              href={`/post/${post.id}`}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium transition hover:bg-sky-500/10 hover:text-sky-600 dark:hover:text-sky-300"
              prefetch={false}
            >
              <MessageSquare size={15} aria-hidden />
              <span className="tabular-nums">{post.commentCount}</span>
              <span className="hidden sm:inline">replies</span>
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
