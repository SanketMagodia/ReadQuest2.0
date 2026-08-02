"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Loader2, Lock, PartyPopper, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type ClubChatMessage = {
  id: string;
  content: string;
  createdAt: string;
  kind: "text" | "progress";
  progress: number | null;
  fromMe: boolean;
  author: { username: string; name: string; image: string } | null;
};

/** Poll cadence copied from the DM thread so the two chats feel the same. */
const POLL_MS = 8_000;

/** Messages this close together from one person read as a single turn. */
const GROUP_WINDOW_MS = 4 * 60_000;

function timeAgo(iso: string) {
  const diff = Date.now() - Date.parse(iso);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** A stable colour per person, so names are easy to tell apart at a glance. */
const NAME_COLOURS = [
  "text-rose-500 dark:text-rose-300",
  "text-amber-600 dark:text-amber-300",
  "text-emerald-600 dark:text-emerald-300",
  "text-sky-600 dark:text-sky-300",
  "text-violet-500 dark:text-violet-300",
  "text-teal-600 dark:text-teal-300",
  "text-fuchsia-500 dark:text-fuchsia-300",
];

function nameColour(username: string) {
  let hash = 0;
  for (let i = 0; i < username.length; i += 1) {
    hash = (hash * 31 + username.charCodeAt(i)) >>> 0;
  }
  return NAME_COLOURS[hash % NAME_COLOURS.length];
}

/**
 * A club's chat room.
 *
 * Deliberately not the DM bubble layout: tight left-aligned rows with coloured
 * names read as a room full of people, where alternating bubbles read as a
 * conversation between two. Progress updates land inline as little events so
 * the read visibly moves.
 */
export function ClubChat({
  slug,
  canPost,
  signedIn,
  heightClass = "h-[32rem] max-h-[32rem]",
  className,
  refreshKey = 0,
}: {
  slug: string;
  canPost: boolean;
  signedIn: boolean;
  /**
   * Fixed height of the whole chat shell. Keep it on the shell (not the
   * message list) so the room never grows with content — messages scroll.
   */
  heightClass?: string;
  className?: string;
  /** Bump to pull the room again, e.g. after posting a progress update. */
  refreshKey?: number;
}) {
  const [messages, setMessages] = useState<ClubChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!signedIn) {
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      try {
        const res = await fetch(`/api/clubs/${slug}/messages`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { messages: ClubChatMessage[] };
        setMessages(data.messages ?? []);
      } catch {
        /* transient — the next poll will catch up */
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [slug, signedIn]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (refreshKey > 0) void load(true);
  }, [refreshKey, load]);

  useEffect(() => {
    if (!signedIn) return;
    const t = window.setInterval(() => void load(true), POLL_MS);
    return () => window.clearInterval(t);
  }, [load, signedIn]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/clubs/${slug}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: ClubChatMessage;
        error?: string;
      };
      if (!res.ok || !data.message) {
        setError(data.error ?? "Could not send that.");
        return;
      }
      setMessages((prev) => [...prev, data.message!]);
      setDraft("");
    } catch {
      setError("Network hiccup — try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card",
        heightClass,
        className
      )}
    >
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 py-2"
      >
        {!signedIn ? (
          <p className="m-auto max-w-xs text-center text-[13px] text-muted">
            Sign in to read what this club is talking about.
          </p>
        ) : loading ? (
          <div className="m-auto">
            <Loader2
              size={18}
              className="animate-spin text-muted"
              aria-hidden
            />
          </div>
        ) : messages.length === 0 ? (
          <div className="m-auto max-w-[15rem] text-center">
            <Sparkles
              size={20}
              aria-hidden
              className="mx-auto text-[var(--brand-1)]"
            />
            <p className="mt-1.5 text-[13px] font-semibold">Quiet in here</p>
            <p className="mt-0.5 text-[12px] text-muted">
              {canPost
                ? "Say the first thing — what page are you on?"
                : "Join the club to start the conversation."}
            </p>
          </div>
        ) : (
          messages.map((m, i) => {
            if (m.kind === "progress") {
              return <ProgressEvent key={m.id} message={m} />;
            }
            const prev = messages[i - 1];
            const grouped =
              prev &&
              prev.kind === "text" &&
              prev.author?.username === m.author?.username &&
              Date.parse(m.createdAt) - Date.parse(prev.createdAt) <
                GROUP_WINDOW_MS;
            return (
              <ChatRow key={m.id} message={m} grouped={Boolean(grouped)} />
            );
          })
        )}
      </div>

      {error ? (
        <p className="border-t border-border/70 px-3 py-1.5 text-[11px] text-red-500 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {canPost ? (
        <form
          onSubmit={(e) => void send(e)}
          className="flex items-end gap-2 border-t border-border/70 px-2.5 py-2"
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={1}
            placeholder="Say something to the club…"
            maxLength={1500}
            className="max-h-24 min-h-[2rem] flex-1 resize-none rounded-2xl border border-border bg-background px-3 py-1.5 text-[13px] outline-none focus:ring-2 focus:ring-[var(--ring)]/70"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(e as unknown as FormEvent);
              }
            }}
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            aria-label="Send message"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white shadow-[var(--shadow-pop)] transition disabled:opacity-50"
            style={{ background: "var(--gradient-brand)" }}
          >
            {sending ? (
              <Loader2 size={14} className="animate-spin" aria-hidden />
            ) : (
              <Send size={14} aria-hidden />
            )}
          </button>
        </form>
      ) : signedIn ? (
        <p className="flex items-center justify-center gap-1.5 border-t border-border/70 px-3 py-2 text-[12px] text-muted">
          <Lock size={12} aria-hidden />
          Join the club to write here.
        </p>
      ) : null}
    </div>
  );
}

function ChatRow({
  message: m,
  grouped,
}: {
  message: ClubChatMessage;
  grouped: boolean;
}) {
  const username = m.author?.username ?? "";
  return (
    <div
      className={cn(
        "group flex gap-2 rounded-lg px-1.5 transition-colors hover:bg-hover/60",
        grouped ? "py-px" : "mt-1.5 py-0.5 first:mt-0",
        m.fromMe && "bg-[color-mix(in_srgb,var(--brand-1)_5%,transparent)]"
      )}
    >
      <div className="w-6 shrink-0 pt-0.5">
        {grouped ? (
          <span className="hidden pt-1 text-[9px] leading-none text-muted group-hover:block">
            {new Date(m.createdAt).toLocaleTimeString(undefined, {
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        ) : m.author?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={m.author.image}
            alt=""
            loading="lazy"
            className="h-6 w-6 rounded-full object-cover ring-1 ring-border/70"
          />
        ) : (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-pill text-[10px] font-bold text-muted">
            {(m.author?.name ?? "?").slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {!grouped ? (
          <p className="flex items-baseline gap-1.5 leading-tight">
            <Link
              href={`/profile/${username}`}
              className={cn(
                "text-[12px] font-bold hover:underline",
                nameColour(username)
              )}
            >
              {m.author?.name || "Reader"}
            </Link>
            <span className="text-[9.5px] text-muted">
              {timeAgo(m.createdAt)}
            </span>
          </p>
        ) : null}
        <p className="whitespace-pre-wrap break-words text-[13px] leading-[1.45] text-foreground/90">
          {m.content}
        </p>
      </div>
    </div>
  );
}

/** A member moving their marker, rendered inline as a small club event. */
function ProgressEvent({ message: m }: { message: ClubChatMessage }) {
  const done = m.progress === 100;
  const name = m.author?.name || "A reader";
  return (
    <div className="my-1.5 flex justify-center px-2">
      <span
        className={cn(
          "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
          done
            ? "border-transparent text-white"
            : "border-border bg-pill/60 text-muted"
        )}
        style={done ? { background: "var(--gradient-warm)" } : undefined}
      >
        {done ? (
          <PartyPopper size={11} className="shrink-0" aria-hidden />
        ) : (
          <span
            aria-hidden
            className="h-1.5 w-8 shrink-0 overflow-hidden rounded-full bg-border"
          >
            <span
              className="block h-full rounded-full"
              style={{
                width: `${m.progress ?? 0}%`,
                background: "var(--gradient-brand)",
              }}
            />
          </span>
        )}
        <span className="min-w-0 truncate">
          <Link
            href={`/profile/${m.author?.username ?? ""}`}
            className="hover:underline"
          >
            {name}
          </Link>{" "}
          {m.content}
        </span>
      </span>
    </div>
  );
}
