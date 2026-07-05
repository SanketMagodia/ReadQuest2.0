"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  BookOpen,
  Check,
  Clock,
  Loader2,
  MessageCircle,
  Search,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDm } from "@/components/dm/DmProvider";

type UserLite = {
  id: string;
  username: string;
  name: string;
  image?: string | null;
  bio?: string;
};

type Friend = {
  friendshipId: string;
  user: UserLite;
  since: string;
  reading: {
    postId: string;
    preview: string;
    createdAt: string;
    book: {
      id: string;
      slug: string;
      title: string;
      authors: string;
      thumbnail?: string;
    };
  } | null;
};

type FriendRequest = {
  id: string;
  createdAt: string;
  user: UserLite;
};

type RelationshipStatus =
  | "self"
  | "none"
  | "incoming_request"
  | "outgoing_request"
  | "friends";

type SearchResult = UserLite & { relationship: RelationshipStatus };

type Tab = "friends" | "requests" | "find";

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const seconds = Math.max(1, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function Avatar({
  user,
  size = 44,
}: {
  user: UserLite | null | undefined;
  size?: number;
}) {
  const initials =
    (user?.name || user?.username || "·")
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  const sideClass =
    size >= 56 ? "h-14 w-14" : size >= 44 ? "h-11 w-11" : "h-9 w-9";
  if (user?.image) {
    return (
      <Image
        src={user.image}
        alt=""
        width={size}
        height={size}
        className={cn(
          "shrink-0 rounded-full border border-border object-cover",
          sideClass
        )}
      />
    );
  }
  return (
    <div
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-sm font-bold text-white",
        sideClass
      )}
      style={{ background: "var(--gradient-brand)" }}
    >
      {initials}
    </div>
  );
}

export function FriendsClient() {
  const searchParams = useSearchParams();
  const { openWithUser } = useDm();
  const initialTab = ((): Tab => {
    const t = searchParams?.get("tab");
    if (t === "requests" || t === "find") return t;
    return "friends";
  })();
  const [tab, setTab] = useState<Tab>(initialTab);

  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [friendsError, setFriendsError] = useState<string | null>(null);

  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);

  const loadFriends = useCallback(async () => {
    setFriendsLoading(true);
    setFriendsError(null);
    try {
      const res = await fetch("/api/friends", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { friends: Friend[] };
      setFriends(data.friends);
    } catch (e) {
      setFriendsError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setFriendsLoading(false);
    }
  }, []);

  const loadRequests = useCallback(async () => {
    setRequestsLoading(true);
    setRequestsError(null);
    try {
      const res = await fetch("/api/friends/requests", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        incoming: FriendRequest[];
        outgoing: FriendRequest[];
      };
      setIncoming(data.incoming);
      setOutgoing(data.outgoing);
    } catch (e) {
      setRequestsError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFriends();
    void loadRequests();
  }, [loadFriends, loadRequests]);

  useEffect(() => {
    const dm = searchParams?.get("dm")?.trim().toLowerCase();
    if (dm) openWithUser(dm);
  }, [searchParams, openWithUser]);

  const tabs: { id: Tab; label: string; icon: typeof Users; count?: number }[] =
    [
      { id: "friends", label: "Friends", icon: Users, count: friends.length },
      {
        id: "requests",
        label: "Requests",
        icon: Clock,
        count: incoming.length,
      },
      { id: "find", label: "Find people", icon: Search },
    ];

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="Friends sections"
        className="inline-flex w-full overflow-hidden rounded-2xl border border-border bg-card p-1 shadow-[var(--shadow-soft)]"
      >
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={cn(
                "relative inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold uppercase tracking-wide transition sm:text-[13px]",
                active
                  ? "text-white shadow-[var(--shadow-pop)]"
                  : "text-muted hover:text-foreground"
              )}
              style={active ? { background: "var(--gradient-brand)" } : undefined}
            >
              <Icon size={14} aria-hidden />
              <span>{t.label}</span>
              {typeof t.count === "number" && t.count > 0 ? (
                <span
                  className={cn(
                    "ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums",
                    active
                      ? "bg-white/20 text-white"
                      : "bg-pill text-foreground/80"
                  )}
                >
                  {t.count > 99 ? "99+" : t.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === "friends" ? (
        <FriendsList
          friends={friends}
          loading={friendsLoading}
          error={friendsError}
          onChange={() => {
            void loadFriends();
            void loadRequests();
          }}
          onSwitchTab={setTab}
        />
      ) : null}

      {tab === "requests" ? (
        <RequestsPanel
          incoming={incoming}
          outgoing={outgoing}
          loading={requestsLoading}
          error={requestsError}
          onChange={() => {
            void loadRequests();
            void loadFriends();
          }}
        />
      ) : null}

      {tab === "find" ? (
        <FindPeople
          onSent={() => {
            void loadRequests();
          }}
        />
      ) : null}
    </div>
  );
}

// ───────────────────────── Friends list ─────────────────────────

function FriendsList({
  friends,
  loading,
  error,
  onChange,
  onSwitchTab,
}: {
  friends: Friend[];
  loading: boolean;
  error: string | null;
  onChange: () => void;
  onSwitchTab: (t: Tab) => void;
}) {
  const { openWithUser } = useDm();
  const [removing, setRemoving] = useState<string | null>(null);

  async function unfriend(username: string) {
    if (!confirm(`Remove @${username} from your friends?`)) return;
    setRemoving(username);
    try {
      const res = await fetch(`/api/friends/${encodeURIComponent(username)}`, {
        method: "DELETE",
      });
      if (res.ok) onChange();
    } finally {
      setRemoving(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted" aria-hidden />
      </div>
    );
  }
  if (error) {
    return <ErrorBox message={error} />;
  }
  if (!friends.length) {
    return (
      <EmptyState
        icon={<Users size={20} aria-hidden />}
        title="No friends yet"
        hint="Add friends to start chatting — search for a reader by username."
        cta={{
          label: "Find people",
          onClick: () => onSwitchTab("find"),
        }}
      />
    );
  }

  return (
    <ul className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border/70">
      {friends.map((f) => (
        <li key={f.friendshipId} className="px-4 py-4">
          <div className="flex items-start gap-3">
            <Link
              href={`/profile/${f.user.username}`}
              aria-label={`Open ${f.user.username}'s profile`}
            >
              <Avatar user={f.user} size={48} />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <Link
                  href={`/profile/${f.user.username}`}
                  className="font-semibold leading-tight hover:underline"
                >
                  {f.user.name}
                </Link>
                <span className="truncate text-[12px] text-muted">
                  @{f.user.username}
                </span>
              </div>

              {f.reading ? (
                <Link
                  href={`/post/${f.reading.postId}`}
                  className="mt-2 block rounded-2xl border border-border/70 bg-pill px-3 py-2.5 transition hover:border-sky-400/50"
                >
                  <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                    <BookOpen size={11} aria-hidden />
                    Reading now
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-foreground">
                    {f.reading.book.title}
                  </p>
                  {f.reading.book.authors ? (
                    <p className="truncate text-[11px] text-muted">
                      {f.reading.book.authors.split(";")[0]}
                    </p>
                  ) : null}
                  {f.reading.preview ? (
                    <p className="mt-1 line-clamp-2 text-[12px] text-muted">
                      &ldquo;{f.reading.preview}&rdquo;
                    </p>
                  ) : null}
                  <p className="mt-1 text-[10px] text-muted">
                    {timeAgo(f.reading.createdAt)}
                  </p>
                </Link>
              ) : (
                <p className="mt-2 text-[12px] text-muted">
                  Hasn&apos;t posted yet.
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
              <button
                type="button"
                onClick={() => openWithUser(f.user.username)}
                className="inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white shadow-[var(--shadow-pop)]"
                style={{ background: "var(--gradient-brand)" }}
              >
                <MessageCircle size={12} aria-hidden />
                <span className="hidden sm:inline">Message</span>
              </button>
              <button
                type="button"
                onClick={() => void unfriend(f.user.username)}
                disabled={removing === f.user.username}
                aria-label={`Remove ${f.user.username}`}
                className="inline-flex items-center justify-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:bg-hover hover:text-foreground disabled:opacity-60"
              >
                {removing === f.user.username ? (
                  <Loader2 size={12} className="animate-spin" aria-hidden />
                ) : (
                  <UserMinus size={12} aria-hidden />
                )}
                <span className="hidden sm:inline">Remove</span>
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ───────────────────────── Requests panel ─────────────────────────

function RequestsPanel({
  incoming,
  outgoing,
  loading,
  error,
  onChange,
}: {
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
  loading: boolean;
  error: string | null;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, action: "accept" | "decline" | "cancel") {
    setBusy(id + ":" + action);
    try {
      const res = await fetch(`/api/friends/requests/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) onChange();
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted" aria-hidden />
      </div>
    );
  }
  if (error) {
    return <ErrorBox message={error} />;
  }
  if (!incoming.length && !outgoing.length) {
    return (
      <EmptyState
        icon={<Clock size={20} aria-hidden />}
        title="No pending requests"
        hint="When someone sends you a friend request, it'll appear here."
      />
    );
  }

  return (
    <div className="space-y-5">
      {incoming.length ? (
        <section>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Incoming ({incoming.length})
          </h2>
          <ul className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border/70">
            {incoming.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 px-4 py-3.5"
              >
                <Link
                  href={`/profile/${r.user.username}`}
                  aria-label={`Open ${r.user.username}'s profile`}
                >
                  <Avatar user={r.user} />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/profile/${r.user.username}`}
                    className="block truncate font-semibold leading-tight hover:underline"
                  >
                    {r.user.name}
                  </Link>
                  <p className="truncate text-[12px] text-muted">
                    @{r.user.username} · {timeAgo(r.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => void act(r.id, "accept")}
                    disabled={busy === `${r.id}:accept`}
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold text-white shadow-[var(--shadow-pop)] transition active:translate-y-px disabled:opacity-60"
                    style={{ background: "var(--gradient-brand)" }}
                  >
                    {busy === `${r.id}:accept` ? (
                      <Loader2 size={12} className="animate-spin" aria-hidden />
                    ) : (
                      <Check size={12} aria-hidden />
                    )}
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => void act(r.id, "decline")}
                    disabled={busy === `${r.id}:decline`}
                    aria-label="Decline"
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-[12px] font-semibold text-muted transition hover:bg-hover hover:text-foreground disabled:opacity-60"
                  >
                    {busy === `${r.id}:decline` ? (
                      <Loader2 size={12} className="animate-spin" aria-hidden />
                    ) : (
                      <X size={12} aria-hidden />
                    )}
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {outgoing.length ? (
        <section>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Sent ({outgoing.length})
          </h2>
          <ul className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border/70">
            {outgoing.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 px-4 py-3.5"
              >
                <Link href={`/profile/${r.user.username}`}>
                  <Avatar user={r.user} />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/profile/${r.user.username}`}
                    className="block truncate font-semibold leading-tight hover:underline"
                  >
                    {r.user.name}
                  </Link>
                  <p className="truncate text-[12px] text-muted">
                    @{r.user.username} · Sent {timeAgo(r.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void act(r.id, "cancel")}
                  disabled={busy === `${r.id}:cancel`}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-[12px] font-semibold text-muted transition hover:bg-hover hover:text-foreground disabled:opacity-60"
                >
                  {busy === `${r.id}:cancel` ? (
                    <Loader2 size={12} className="animate-spin" aria-hidden />
                  ) : (
                    <X size={12} aria-hidden />
                  )}
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

// ───────────────────────── Find people ─────────────────────────

function FindPeople({ onSent }: { onSent: () => void }) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const reqSeq = useRef(0);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(query.trim()), 220);
    return () => window.clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    if (debounced.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }
    const seq = ++reqSeq.current;
    setLoading(true);
    setError(null);
    fetch(`/api/users/search?q=${encodeURIComponent(debounced)}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as { users: SearchResult[] };
      })
      .then((data) => {
        if (seq !== reqSeq.current) return;
        setResults(data.users);
      })
      .catch((e) => {
        if (seq !== reqSeq.current) return;
        setError(e instanceof Error ? e.message : "Search failed");
      })
      .finally(() => {
        if (seq !== reqSeq.current) return;
        setLoading(false);
      });
  }, [debounced]);

  async function sendRequest(username: string) {
    setBusy(username);
    try {
      const res = await fetch("/api/friends/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      const data = (await res.json()) as {
        status: RelationshipStatus;
      };
      setResults((prev) =>
        prev.map((u) =>
          u.username.toLowerCase() === username.toLowerCase()
            ? { ...u, relationship: data.status }
            : u
        )
      );
      onSent();
    } finally {
      setBusy(null);
    }
  }

  const hint = useMemo(() => {
    if (query.length === 0) return "Type a username to find readers.";
    if (debounced.length < 2) return "Keep typing — at least 2 characters.";
    if (!loading && results.length === 0) return "No readers matched that yet.";
    return null;
  }, [query, debounced, loading, results.length]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            Find a reader
          </span>
          <div className="mt-2 flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-sky-400/70">
            <Search size={16} aria-hidden className="text-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="username or display name"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted/70"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear"
                className="text-muted hover:text-foreground"
              >
                <X size={14} aria-hidden />
              </button>
            ) : null}
          </div>
        </label>
        {error ? (
          <p className="mt-2 rounded-xl border border-rose-300/40 bg-rose-50/50 px-3 py-1.5 text-[12px] font-medium text-rose-700 dark:border-rose-700/50 dark:bg-rose-950/30 dark:text-rose-200">
            {error}
          </p>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted" aria-hidden />
        </div>
      ) : results.length ? (
        <ul className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border/70">
          {results.map((u) => (
            <li
              key={u.id}
              className="flex items-center gap-3 px-4 py-3.5"
            >
              <Link href={`/profile/${u.username}`}>
                <Avatar user={u} />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/profile/${u.username}`}
                  className="block truncate font-semibold leading-tight hover:underline"
                >
                  {u.name}
                </Link>
                <p className="truncate text-[12px] text-muted">
                  @{u.username}
                  {u.bio ? ` · ${u.bio}` : ""}
                </p>
              </div>
              <RelationshipButton
                relationship={u.relationship}
                username={u.username}
                busy={busy === u.username}
                onSend={() => void sendRequest(u.username)}
              />
            </li>
          ))}
        </ul>
      ) : hint ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 px-5 py-8 text-center text-sm text-muted">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function RelationshipButton({
  relationship,
  username,
  busy,
  onSend,
}: {
  relationship: RelationshipStatus;
  username: string;
  busy: boolean;
  onSend: () => void;
}) {
  const { openWithUser } = useDm();

  if (relationship === "friends") {
    return (
      <button
        type="button"
        onClick={() => openWithUser(username)}
        className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold text-white shadow-[var(--shadow-pop)]"
        style={{ background: "var(--gradient-brand)" }}
      >
        <MessageCircle size={12} aria-hidden />
        Message
      </button>
    );
  }
  if (relationship === "outgoing_request") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-semibold text-muted">
        <Clock size={12} aria-hidden />
        Pending
      </span>
    );
  }
  if (relationship === "incoming_request") {
    return (
      <Link
        href="/friends?tab=requests"
        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-semibold text-foreground hover:bg-hover"
      >
        <Clock size={12} aria-hidden />
        Respond
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onSend}
      disabled={busy}
      aria-label={`Send friend request to ${username}`}
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold text-white shadow-[var(--shadow-pop)] transition active:translate-y-px disabled:opacity-60"
      style={{ background: "var(--gradient-brand)" }}
    >
      {busy ? (
        <Loader2 size={12} className="animate-spin" aria-hidden />
      ) : (
        <UserPlus size={12} aria-hidden />
      )}
      Add
    </button>
  );
}

// ───────────────────────── Misc helpers ─────────────────────────

function EmptyState({
  icon,
  title,
  hint,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  cta?: { label: string; onClick: () => void };
}) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
      <div
        aria-hidden
        className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full text-white"
        style={{ background: "var(--gradient-brand)" }}
      >
        {icon}
      </div>
      <p className="text-base font-bold">{title}</p>
      <p className="mt-1 text-sm text-muted">{hint}</p>
      {cta ? (
        <button
          type="button"
          onClick={cta.onClick}
          className="mt-5 inline-flex rounded-full px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-pop)]"
          style={{ background: "var(--gradient-brand)" }}
        >
          {cta.label}
        </button>
      ) : null}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-rose-300/40 bg-rose-50/50 px-4 py-6 text-center text-sm text-rose-700 dark:border-rose-700/50 dark:bg-rose-950/30 dark:text-rose-200">
      {message}
    </div>
  );
}
