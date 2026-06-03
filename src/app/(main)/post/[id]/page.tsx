"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { ArrowLeft, BookOpen, CornerDownRight, MessageSquare } from "lucide-react";
import type { PostDTO } from "@/lib/serialize";
import Image from "next/image";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { PostReactions } from "@/components/posts/PostReactions";
import { PostImage } from "@/components/posts/PostImage";
import { DeleteContentButton } from "@/components/posts/DeleteContentButton";
import { PostActionsMenu } from "@/components/posts/PostActionsMenu";
import { canDeleteContent } from "@/lib/content-permissions";

type CommentDTO = {
  id: string;
  content: string;
  createdAt: string;
  parentId: string | null;
  author: { id: string; username: string; name: string; image?: string };
  likes: number;
  dislikes: number;
  myReaction: "like" | "dislike" | null;
};

type Node = CommentDTO & { children: Node[] };

function buildTree(rows: CommentDTO[]): Node[] {
  const map = new Map<string, Node>();
  rows.forEach((r) => map.set(r.id, { ...r, children: [] }));
  const roots: Node[] = [];
  rows.forEach((r) => {
    const node = map.get(r.id)!;
    const pid = r.parentId && map.has(r.parentId) ? r.parentId : null;
    if (!pid) {
      roots.push(node);
    } else {
      map.get(pid)!.children.push(node);
    }
  });
  return roots;
}

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

export default function ThreadPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const pid = typeof params?.id === "string" ? params.id : "";
  const { data: session, status } = useSession();
  const [post, setPost] = useState<PostDTO | null>(null);
  const [comments, setComments] = useState<CommentDTO[]>([]);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(
    null
  );
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  async function reload() {
    const [rp, rc] = await Promise.all([
      fetch(`/api/posts/${pid}`, { cache: "no-store" }),
      fetch(`/api/posts/${pid}/comments`, { cache: "no-store" }),
    ]);
    if (!rp.ok) {
      setPost(null);
      return;
    }
    const pj = (await rp.json()) as { post: PostDTO };
    setPost(pj.post);
    if (rc.ok) {
      const cj = (await rc.json()) as { comments: CommentDTO[] };
      setComments(cj.comments ?? []);
    }
  }

  useEffect(() => {
    if (pid) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pid]);

  const tree = useMemo(() => buildTree(comments), [comments]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status !== "authenticated") return;
    const text = body.trim();
    if (!text) return;
    await fetch(`/api/posts/${pid}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text, parentId: replyTo?.id ?? null }),
    });
    setBody("");
    setReplyTo(null);
    void reload();
  }

  if (!post) {
    return <LoadingIndicator fullPage label="Loading thread…" />;
  }

  const canDeletePost = canDeleteContent(session?.user, post.author.id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-3 py-8 sm:gap-8">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (window.history.length > 1) router.back();
            else router.push("/");
          }}
          aria-label="Go back"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground/80 transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
        >
          <ArrowLeft size={16} aria-hidden />
        </button>
        <Link
          href={`/book/${post.book.slug || post.book.id}`}
          className="inline-flex max-w-[70%] items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
        >
          <BookOpen size={14} aria-hidden className="text-muted" />
          <span className="truncate">{post.book.title}</span>
        </Link>
      </div>

      {/* Root post */}
      <article className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] sm:p-7">
        <div className="flex gap-4">
          <Avatar author={post.author} size={48} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex flex-wrap items-baseline gap-2">
                <Link
                  href={`/profile/${post.author.username}`}
                  className="font-semibold hover:underline hover:underline-offset-4"
                >
                  {post.author.name || post.author.username}
                </Link>
                <span className="truncate text-[13px] text-muted">
                  @{post.author.username}
                </span>
                <span aria-hidden className="text-muted">
                  ·
                </span>
                <span className="text-[13px] text-muted" title={post.createdAt}>
                  {fmtRelative(post.createdAt)}
                </span>
              </div>
              <PostActionsMenu postId={post.id} />
            </div>
            {post.content ? (
              <p className="post-content mt-4 whitespace-pre-wrap text-[17px] leading-relaxed sm:text-[18px]">
                {post.content}
              </p>
            ) : null}
            {post.image ? <PostImage src={post.image} className="mt-4" /> : null}

            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border/60 pt-4">
              <PostReactions
                postId={post.id}
                initialLikes={post.likes}
                initialDislikes={post.dislikes}
                initialMyReaction={post.myReaction}
              />
              <span aria-hidden className="h-4 w-px bg-border/80" />
              <button
                type="button"
                onClick={() => {
                  setReplyTo(null);
                  composerRef.current?.focus();
                }}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium text-muted transition hover:bg-sky-500/10 hover:text-sky-600 dark:hover:text-sky-300"
              >
                <MessageSquare size={15} aria-hidden />
                <span className="tabular-nums">{post.commentCount}</span>
                <span className="hidden sm:inline">replies</span>
              </button>
              {canDeletePost ? (
                <>
                  <span aria-hidden className="h-4 w-px bg-border/80" />
                  <DeleteContentButton
                    kind="post"
                    id={post.id}
                    onDeleted={() => router.push("/")}
                  />
                </>
              ) : null}
            </div>
          </div>
        </div>
      </article>

      {/* Composer */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">Thread</h2>
          {tree.length ? (
            <span className="text-xs text-muted">
              {comments.length} repl{comments.length === 1 ? "y" : "ies"}
            </span>
          ) : null}
        </div>

        {status === "authenticated" ? (
          <form
            onSubmit={(e) => void submit(e)}
            className="space-y-3 rounded-3xl border border-border bg-card p-4 sm:p-5"
          >
            {replyTo ? (
              <p className="flex items-center gap-2 text-xs text-muted">
                <CornerDownRight size={14} aria-hidden />
                Replying to{" "}
                <span className="font-semibold text-foreground/85">
                  @{replyTo.username}
                </span>
                <button
                  type="button"
                  className="underline-offset-4 hover:underline"
                  onClick={() => setReplyTo(null)}
                >
                  cancel
                </button>
              </p>
            ) : null}
            <textarea
              ref={composerRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              maxLength={1500}
              className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
              placeholder={
                replyTo ? `Reply to @${replyTo.username}…` : "Share your take"
              }
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted">
                {body.length}/1500
              </span>
              <button
                type="submit"
                disabled={!body.trim()}
                className="rounded-full px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
                style={{ background: "var(--gradient-brand)" }}
              >
                Reply
              </button>
            </div>
          </form>
        ) : (
          <p className="rounded-3xl border border-dashed border-border bg-card/60 p-5 text-sm text-muted">
            <Link
              href="/login"
              className="font-semibold text-sky-600 hover:underline dark:text-sky-300"
            >
              Sign in
            </Link>{" "}
            to join the thread.
          </p>
        )}

        {/* Thread tree */}
        <div className="space-y-1">
          {tree.map((n) => (
            <CommentBranch
              key={n.id}
              node={n}
              depth={0}
              viewer={session?.user}
              onReply={(id, username) => {
                setReplyTo({ id, username });
                composerRef.current?.focus();
              }}
              onDeleted={() => void reload()}
            />
          ))}
          {!tree.length ? (
            <p className="rounded-3xl border border-dashed border-border bg-card/60 p-5 text-center text-sm text-muted">
              No replies yet — start the discussion.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Avatar({
  author,
  size = 40,
}: {
  author: { username: string; name?: string; image?: string };
  size?: number;
}) {
  const text = (author.name || author.username || "?").slice(0, 2).toUpperCase();
  return (
    <Link
      href={`/profile/${author.username}`}
      aria-label={`Open ${author.username}'s profile`}
      className="relative shrink-0 overflow-hidden rounded-2xl bg-pill ring-1 ring-border/80"
      style={{ width: size, height: size }}
    >
      {author.image ? (
        <Image
          src={author.image}
          alt=""
          width={size}
          height={size}
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-white"
          style={{ background: "var(--gradient-brand)" }}
        >
          {text}
        </span>
      )}
    </Link>
  );
}

function CommentBranch({
  node,
  depth,
  viewer,
  onReply,
  onDeleted,
}: {
  node: Node;
  depth: number;
  viewer?: { id: string; role?: string };
  onReply: (id: string, username: string) => void;
  onDeleted: () => void;
}) {
  const hasChildren = node.children.length > 0;
  const showDelete = canDeleteContent(viewer, node.author.id);

  return (
    <div className="relative">
      {/* The connector line that drops from the avatar into the children. */}
      {hasChildren ? (
        <span
          aria-hidden
          className="pointer-events-none absolute left-[19px] top-12 bottom-2 w-px bg-gradient-to-b from-border via-border/70 to-transparent dark:from-border/80"
        />
      ) : null}

      <div className="flex gap-3">
        <Avatar author={node.author} size={40} />
        <div className="min-w-0 flex-1">
          <div className="rounded-2xl border border-border/80 bg-card px-4 py-3 transition hover:border-border">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <Link
                href={`/profile/${node.author.username}`}
                className="text-sm font-semibold hover:underline hover:underline-offset-4"
              >
                {node.author.name || node.author.username}
              </Link>
              <span className="truncate text-[12px] text-muted">
                @{node.author.username}
              </span>
              <span aria-hidden className="text-muted">
                ·
              </span>
              <span
                className="text-[12px] text-muted"
                title={node.createdAt}
              >
                {fmtRelative(node.createdAt)}
              </span>
            </div>
            <p className="comment-content mt-1.5 whitespace-pre-wrap text-[14.5px] leading-relaxed text-foreground/95">
              {node.content}
            </p>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1 pl-2 text-[12px]">
            <PostReactions
              postId={node.id}
              endpoint={`/api/comments/${node.id}/react`}
              initialLikes={node.likes}
              initialDislikes={node.dislikes}
              initialMyReaction={node.myReaction}
              size="sm"
            />
            <button
              type="button"
              onClick={() => onReply(node.id, node.author.username)}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold text-sky-600 transition hover:bg-sky-500/10 dark:text-sky-300"
            >
              <CornerDownRight size={12} aria-hidden />
              Reply
            </button>
            {showDelete ? (
              <DeleteContentButton
                kind="comment"
                id={node.id}
                onDeleted={onDeleted}
              />
            ) : null}
          </div>
        </div>
      </div>

      {hasChildren ? (
        <div className="mt-1.5 space-y-1.5 pl-[40px]">
          {node.children.map((c) => (
            <CommentBranch
              key={c.id}
              node={c}
              depth={depth + 1}
              viewer={viewer}
              onReply={onReply}
              onDeleted={onDeleted}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
