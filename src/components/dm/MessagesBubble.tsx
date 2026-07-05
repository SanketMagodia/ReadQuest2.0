"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  Loader2,
  MessageCircle,
  Send,
  Shield,
  UserPlus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDm } from "@/components/dm/DmProvider";
import { ADMIN_DISPLAY_NAME } from "@/lib/admin";

type UserLite = {
  id: string;
  username: string;
  name: string;
  image?: string | null;
};

type ConversationRow = {
  id: string;
  otherUser: UserLite;
  lastPreview: string;
  lastMessageAt: string | null;
  unread: number;
  fromMe: boolean;
};

type ChatMessage = {
  id: string;
  content: string;
  createdAt: string;
  fromMe: boolean;
};

type FriendRow = {
  friendshipId: string;
  user: UserLite;
};

type AdminContact = UserLite & {
  displayName: string;
  isAdmin?: boolean;
};

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const seconds = Math.max(1, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function Avatar({ user, size = 36 }: { user: UserLite; size?: number }) {
  const initials = (user.name || user.username)
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const cls =
    size <= 24
      ? "h-6 w-6 text-[9px]"
      : size >= 40
        ? "h-10 w-10 text-[12px]"
        : "h-9 w-9 text-[11px]";
  if (user.image) {
    return (
      <Image
        src={user.image}
        alt=""
        width={size}
        height={size}
        className={cn("shrink-0 rounded-full border border-border object-cover", cls)}
      />
    );
  }
  return (
    <div
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold text-white",
        cls
      )}
      style={{ background: "var(--gradient-brand)" }}
    >
      {initials}
    </div>
  );
}

export function MessagesBubble() {
  const { data: session } = useSession();
  const { open, setOpen, target, clearTarget } = useDm();

  const [unread, setUnread] = useState(0);
  const [view, setView] = useState<"list" | "thread">("list");

  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [adminContact, setAdminContact] = useState<AdminContact | null>(null);

  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeUser, setActiveUser] = useState<UserLite | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pollRef = useRef<number | null>(null);

  const fetchUnread = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const res = await fetch("/api/conversations/unread", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { unread: number };
      setUnread(data.unread);
    } catch {
      /* ignore */
    }
  }, [session?.user?.id]);

  const fetchAdmin = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const res = await fetch("/api/conversations/admin", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { admin: AdminContact };
      setAdminContact(data.admin);
    } catch {
      setAdminContact(null);
    }
  }, [session?.user?.id]);

  const fetchFriends = useCallback(async () => {
    if (!session?.user?.id) return;
    setFriendsLoading(true);
    try {
      const res = await fetch("/api/friends", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { friends: FriendRow[] };
      setFriends(data.friends);
    } catch {
      setFriends([]);
    } finally {
      setFriendsLoading(false);
    }
  }, [session?.user?.id]);

  const fetchInbox = useCallback(async () => {
    if (!session?.user?.id) return;
    setListLoading(true);
    setListError(null);
    try {
      const res = await fetch("/api/conversations", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        conversations: ConversationRow[];
        unread: number;
      };
      setConversations(data.conversations);
      setUnread(data.unread);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setListLoading(false);
    }
  }, [session?.user?.id]);

  const markRead = useCallback(async (conversationId: string) => {
    try {
      await fetch(`/api/conversations/${conversationId}/read`, {
        method: "POST",
      });
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, unread: 0 } : c))
      );
      void fetchUnread();
    } catch {
      /* ignore */
    }
  }, [fetchUnread]);

  const loadThread = useCallback(
    async (conversationId: string, silent = false) => {
      if (!silent) setThreadLoading(true);
      setThreadError(null);
      try {
        const res = await fetch(
          `/api/conversations/${conversationId}/messages`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          otherUser: UserLite | null;
          messages: ChatMessage[];
        };
        setActiveId(conversationId);
        setActiveUser(data.otherUser);
        setMessages(data.messages);
        setView("thread");
        void markRead(conversationId);
      } catch (e) {
        setThreadError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!silent) setThreadLoading(false);
      }
    },
    [markRead]
  );

  const openThreadWithUsername = useCallback(
    async (username: string) => {
      setThreadLoading(true);
      setThreadError(null);
      try {
        const res = await fetch(
          `/api/conversations/with/${encodeURIComponent(username)}`,
          { method: "POST" }
        );
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        const data = (await res.json()) as {
          conversationId: string;
          otherUser: UserLite;
        };
        setActiveUser(data.otherUser);
        await loadThread(data.conversationId);
      } catch (e) {
        setThreadError(e instanceof Error ? e.message : "Could not open chat");
        setThreadLoading(false);
      }
    },
    [loadThread]
  );

  const sendMessage = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!activeId || sending) return;
      const text = draft.trim();
      if (!text) return;
      setSending(true);
      try {
        const res = await fetch(`/api/conversations/${activeId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { message: ChatMessage };
        setMessages((prev) => [...prev, data.message]);
        setDraft("");
        void fetchInbox();
      } catch (err) {
        setThreadError(err instanceof Error ? err.message : "Send failed");
      } finally {
        setSending(false);
      }
    },
    [activeId, draft, sending, fetchInbox]
  );

  // Unread badge polling while signed in.
  useEffect(() => {
    if (!session?.user?.id) return;
    void fetchUnread();
    const i = window.setInterval(fetchUnread, 30_000);
    return () => window.clearInterval(i);
  }, [session?.user?.id, fetchUnread]);

  // Load inbox + friends when panel opens.
  useEffect(() => {
    if (!open || !session?.user?.id) return;
    void fetchInbox();
    void fetchFriends();
    void fetchAdmin();
  }, [open, session?.user?.id, fetchInbox, fetchFriends, fetchAdmin]);

  // Deep-link target from DmProvider (friends tab Message button, etc.).
  useEffect(() => {
    if (!open || !session?.user?.id || !target) return;
    if (target.conversationId) {
      void loadThread(target.conversationId);
      clearTarget();
      return;
    }
    if (target.username) {
      void openThreadWithUsername(target.username);
      clearTarget();
    }
  }, [
    open,
    session?.user?.id,
    target,
    loadThread,
    openThreadWithUsername,
    clearTarget,
  ]);

  // Poll active thread while open.
  useEffect(() => {
    if (!open || view !== "thread" || !activeId) return;
    const tick = () => void loadThread(activeId, true);
    pollRef.current = window.setInterval(tick, 8_000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [open, view, activeId, loadThread]);

  // Scroll to bottom when messages change.
  useEffect(() => {
    if (view !== "thread" || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, view, threadLoading]);

  const closePanel = useCallback(() => {
    setOpen(false);
    setView("list");
    setActiveId(null);
    setActiveUser(null);
    setMessages([]);
    setDraft("");
    setThreadError(null);
  }, [setOpen]);

  const backToList = useCallback(() => {
    setView("list");
    setActiveId(null);
    setActiveUser(null);
    setMessages([]);
    setDraft("");
    setThreadError(null);
    void fetchInbox();
  }, [fetchInbox]);

  if (!session?.user?.id) return null;

  const hasFriends = friends.length > 0;
  const showNoFriends = !friendsLoading && !hasFriends;

  return (
    <>
      {/* Floating trigger — sits above mobile bottom nav */}
      <button
        type="button"
        onClick={() => {
          if (open) closePanel();
          else setOpen(true);
        }}
        aria-label={open ? "Close messages" : "Open messages"}
        aria-expanded={open}
        className={cn(
          "fixed z-50 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[var(--shadow-pop)] transition hover:scale-[1.03] active:scale-[0.98] layout-wide:bottom-6 layout-wide:right-6",
          "bottom-[5.5rem] right-4"
        )}
        style={{ background: "var(--gradient-brand)" }}
      >
        {open ? (
          <X size={22} aria-hidden />
        ) : (
          <MessageCircle size={24} aria-hidden />
        )}
        {!open && unread > 0 ? (
          <span
            aria-label={`${unread} unread messages`}
            className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Messages"
          className={cn(
            "fixed z-50 flex h-[min(32rem,calc(100dvh-11rem))] w-[calc(100vw-2rem)] max-w-[24rem] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-[var(--shadow-pop)]",
            "bottom-[9.5rem] right-4 layout-wide:bottom-24 layout-wide:right-6 layout-wide:h-[32rem] layout-wide:w-[24rem]"
          )}
        >
          {view === "list" ? (
            <>
              <header className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
                <div>
                  <h3 className="text-sm font-bold tracking-tight">Messages</h3>
                  <p className="text-[11px] text-muted">
                    {unread > 0 ? `${unread} unread` : "Chat with friends"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closePanel}
                  aria-label="Close"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-hover hover:text-foreground"
                >
                  <X size={16} aria-hidden />
                </button>
              </header>

              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-pill/25">
                {adminContact ? (
                  <section className="border-b border-border/70 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                      Site team
                    </p>
                    <button
                      type="button"
                      onClick={() => void openThreadWithUsername(adminContact.username)}
                      className="mt-2 flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2.5 text-left shadow-[var(--shadow-soft)] transition hover:border-sky-400/40 hover:bg-hover"
                    >
                      <span
                        aria-hidden
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
                        style={{ background: "var(--gradient-brand)" }}
                      >
                        <Shield size={18} aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold">
                          {adminContact.displayName || ADMIN_DISPLAY_NAME}
                        </p>
                        <p className="truncate text-[11px] text-muted">
                          @{adminContact.username} · Questions & feedback
                        </p>
                      </div>
                      <MessageCircle size={16} className="shrink-0 text-sky-600 dark:text-sky-300" aria-hidden />
                    </button>
                  </section>
                ) : null}

                {showNoFriends ? (
                  <div className="flex flex-1 flex-col items-center justify-center px-5 py-8 text-center">
                    <div
                      aria-hidden
                      className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full text-white"
                      style={{ background: "var(--gradient-brand)" }}
                    >
                      <UserPlus size={18} aria-hidden />
                    </div>
                    <p className="text-sm font-semibold">Add friends to start chatting</p>
                    <p className="mt-1 text-[12px] text-muted">
                      Find readers you know, or message the team above for help.
                    </p>
                    <Link
                      href="/friends?tab=find"
                      onClick={closePanel}
                      className="mt-4 inline-flex rounded-full px-4 py-2 text-xs font-semibold text-white shadow-[var(--shadow-pop)]"
                      style={{ background: "var(--gradient-brand)" }}
                    >
                      Find friends
                    </Link>
                  </div>
                ) : listLoading && !conversations.length ? (
                  <div className="flex flex-1 items-center justify-center text-muted">
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  </div>
                ) : listError ? (
                  <p className="flex flex-1 items-center justify-center px-4 text-center text-[12px] text-rose-600 dark:text-rose-300">
                    {listError}
                  </p>
                ) : (
                  <div className="divide-y divide-border/70">
                    {hasFriends ? (
                      <section className="px-4 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                          Start a chat
                        </p>
                        <ul className="mt-2 flex flex-wrap gap-2">
                          {friends.map((f) => (
                            <li key={f.friendshipId}>
                              <button
                                type="button"
                                onClick={() => void openThreadWithUsername(f.user.username)}
                                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold transition hover:bg-hover"
                              >
                                <Avatar user={f.user} size={22} />
                                {f.user.name.split(" ")[0]}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ) : null}

                    {conversations.length ? (
                      <ul>
                        {conversations.map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() => void loadThread(c.id)}
                              className="flex w-full gap-3 px-4 py-3 text-left transition hover:bg-hover"
                            >
                              <Avatar user={c.otherUser} />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline justify-between gap-2">
                                  <p className="truncate text-[13px] font-semibold">
                                    {c.otherUser.name}
                                  </p>
                                  {c.lastMessageAt ? (
                                    <span className="shrink-0 text-[10px] text-muted">
                                      {timeAgo(c.lastMessageAt)}
                                    </span>
                                  ) : null}
                                </div>
                                <p className="truncate text-[12px] text-muted">
                                  {c.fromMe && c.lastPreview ? "You: " : ""}
                                  {c.lastPreview || "No messages yet"}
                                </p>
                              </div>
                              {c.unread > 0 ? (
                                <span
                                  aria-hidden
                                  className="mt-2 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                                  style={{ background: "var(--gradient-brand)" }}
                                >
                                  {c.unread > 9 ? "9+" : c.unread}
                                </span>
                              ) : null}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : hasFriends && !listLoading ? (
                      <p className="flex flex-1 items-center justify-center px-4 py-6 text-center text-[12px] text-muted">
                        Pick a friend above to say hello.
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <header className="flex items-center gap-2 border-b border-border/70 px-3 py-2.5">
                <button
                  type="button"
                  onClick={backToList}
                  aria-label="Back to inbox"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-hover hover:text-foreground"
                >
                  <ArrowLeft size={16} aria-hidden />
                </button>
                {activeUser ? (
                  <Link
                    href={`/profile/${activeUser.username}`}
                    onClick={closePanel}
                    className="flex min-w-0 flex-1 items-center gap-2"
                  >
                    <Avatar user={activeUser} size={32} />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold leading-tight">
                        {activeUser.name}
                      </p>
                      <p className="truncate text-[11px] text-muted">
                        @{activeUser.username}
                      </p>
                    </div>
                  </Link>
                ) : (
                  <p className="text-sm font-semibold">Chat</p>
                )}
                <button
                  type="button"
                  onClick={closePanel}
                  aria-label="Close"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-hover hover:text-foreground"
                >
                  <X size={16} aria-hidden />
                </button>
              </header>

              <div
                ref={scrollRef}
                className="flex min-h-0 flex-1 flex-col space-y-2 overflow-y-auto bg-pill/25 px-3 py-3"
              >
                {threadLoading && !messages.length ? (
                  <div className="flex flex-1 items-center justify-center text-muted">
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  </div>
                ) : threadError && !messages.length ? (
                  <p className="flex flex-1 items-center justify-center text-center text-[12px] text-rose-600 dark:text-rose-300">
                    {threadError}
                  </p>
                ) : messages.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
                    <div
                      aria-hidden
                      className="flex h-10 w-10 items-center justify-center rounded-full text-white"
                      style={{ background: "var(--gradient-brand)" }}
                    >
                      <MessageCircle size={18} aria-hidden />
                    </div>
                    <p className="text-[13px] font-semibold">Start the conversation</p>
                    <p className="text-[12px] text-muted">
                      Say hello to {activeUser?.name.split(" ")[0] ?? "your friend"}.
                    </p>
                  </div>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "flex",
                        m.fromMe ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-snug",
                          m.fromMe
                            ? "rounded-br-md text-white"
                            : "rounded-bl-md border border-border bg-card text-foreground"
                        )}
                        style={
                          m.fromMe
                            ? { background: "var(--gradient-brand)" }
                            : undefined
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
                  ))
                )}
              </div>

              <form
                onSubmit={(e) => void sendMessage(e)}
                className="flex items-end gap-2 border-t border-border/70 px-3 py-2.5"
              >
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={1}
                  placeholder="Write a message…"
                  maxLength={1500}
                  className="max-h-24 min-h-[2.25rem] flex-1 resize-none rounded-2xl border border-border bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-sky-400/70"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage(e);
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
            </>
          )}
        </div>
      ) : null}
    </>
  );
}
