"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Loader2, Lock, Send } from "lucide-react";
import { cn } from "@/lib/utils";

export type ClubChatMessage = {
  id: string;
  content: string;
  createdAt: string;
  fromMe: boolean;
  author: { username: string; name: string; image: string } | null;
};

/** Poll cadence copied from the DM thread so the two chats feel the same. */
const POLL_MS = 8_000;

function timeAgo(iso: string) {
  const diff = Date.now() - Date.parse(iso);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/**
 * A club's chat room.
 *
 * Anyone signed in can read — that's how a visitor decides whether they like
 * the room enough to join — but only members get a composer.
 */
export function ClubChat({
  slug,
  canPost,
  signedIn,
  heightClass = "h-[26rem]",
  className,
}: {
  slug: string;
  canPost: boolean;
  signedIn: boolean;
  heightClass?: string;
  className?: string;
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
    if (!signedIn) return;
    const t = window.setInterval(() => void load(true), POLL_MS);
    return () => window.clearInterval(t);
  }, [load, signedIn]);

  // Keep the newest line in view as the room fills up.
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
        "flex flex-col overflow-hidden rounded-2xl border border-border bg-card",
        className
      )}
    >
      <div
        ref={scrollRef}
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto bg-pill/25 px-3 py-3",
          heightClass
        )}
      >
        {!signedIn ? (
          <p className="m-auto max-w-xs text-center text-[13px] text-muted">
            Sign in to read what this club is talking about.
          </p>
        ) : loading ? (
          <div className="m-auto">
            <Loader2 size={18} className="animate-spin text-muted" aria-hidden />
          </div>
        ) : messages.length === 0 ? (
          <p className="m-auto max-w-xs text-center text-[13px] text-muted">
            No messages yet. {canPost ? "Say the first thing." : ""}
          </p>
        ) : (
          messages.map((m, i) => {
            // Only label a message when the speaker changes, so a burst from
            // one person reads as a single turn.
            const prev = messages[i - 1];
            const newSpeaker =
              !prev || prev.author?.username !== m.author?.username;
            return (
              <div
                key={m.id}
                className={cn("flex", m.fromMe ? "justify-end" : "justify-start")}
              >
                <div className="max-w-[85%]">
                  {!m.fromMe && newSpeaker && m.author ? (
                    <Link
                      href={`/profile/${m.author.username}`}
                      className="mb-0.5 ml-1 block text-[10px] font-semibold text-muted hover:text-foreground"
                    >
                      {m.author.name}
                    </Link>
                  ) : null}
                  <div
                    className={cn(
                      "rounded-2xl px-3 py-2 text-[13px] leading-snug",
                      m.fromMe
                        ? "rounded-br-md text-white"
                        : "rounded-bl-md border border-border bg-card text-foreground"
                    )}
                    style={
                      m.fromMe ? { background: "var(--gradient-brand)" } : undefined
                    }
                  >
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    <p
                      className={cn(
                        "mt-1 text-[10px]",
                        m.fromMe ? "text-white/75" : "text-muted"
                      )}
                    >
                      {timeAgo(m.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
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
          className="flex items-end gap-2 border-t border-border/70 px-3 py-2.5"
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={1}
            placeholder="Write to the club…"
            maxLength={1500}
            className="max-h-24 min-h-[2.25rem] flex-1 resize-none rounded-2xl border border-border bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[var(--ring)]/70"
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
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-[var(--shadow-pop)] transition disabled:opacity-50"
            style={{ background: "var(--gradient-brand)" }}
          >
            {sending ? (
              <Loader2 size={16} className="animate-spin" aria-hidden />
            ) : (
              <Send size={16} aria-hidden />
            )}
          </button>
        </form>
      ) : signedIn ? (
        <p className="flex items-center justify-center gap-1.5 border-t border-border/70 px-3 py-2.5 text-[12px] text-muted">
          <Lock size={12} aria-hidden />
          Join the club to write here.
        </p>
      ) : null}
    </div>
  );
}
