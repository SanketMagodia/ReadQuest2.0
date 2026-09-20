"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Loader2, Search, Trash2 } from "lucide-react";

type AdminUser = {
  id: string;
  username: string;
  name: string;
  email: string;
  role: string;
  shelved: number;
  createdAt: string;
  image?: string | null;
};

function fmtJoined(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function AdminUsers() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pending, setPending] = useState<AdminUser | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqSeq = useRef(0);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 250);
    return () => window.clearTimeout(t);
  }, [query]);

  const load = useCallback(async (q: string, after?: string) => {
    const seq = ++reqSeq.current;
    if (after) setLoadingMore(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "40" });
      if (q) params.set("q", q);
      if (after) params.set("cursor", after);
      const res = await fetch(`/api/admin/users?${params}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        users: AdminUser[];
        nextCursor: string | null;
      };
      if (seq !== reqSeq.current) return;
      setUsers((prev) => (after ? [...prev, ...data.users] : data.users));
      setCursor(data.nextCursor);
    } finally {
      if (after) setLoadingMore(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(debounced);
  }, [debounced, load]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            Search users
          </span>
          <div className="mt-2 flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2">
            <Search size={16} aria-hidden className="text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="username, name, or email"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
        </label>
      </div>

      {loading ?
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted" aria-hidden />
        </div>
      : !users.length ?
        <p className="text-center text-sm text-muted">No users matched.</p>
      : <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border bg-pill/60 text-[11px] font-semibold uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Shelved</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3 text-right"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-hover/50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/profile/${u.username}`}
                        className="flex items-center gap-3"
                      >
                        <UserAvatar user={u} />
                        <span className="min-w-0">
                          <span className="block font-semibold">{u.name}</span>
                          <span className="block text-[12px] text-muted">
                            @{u.username}
                            {u.email ? ` · ${u.email}` : ""}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 capitalize">{u.role}</td>
                    <td className="px-4 py-3 tabular-nums">{u.shelved}</td>
                    <td className="px-4 py-3 text-muted">{fmtJoined(u.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {u.role === "admin" ? (
                        <span className="text-[11px] text-muted">protected</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setConfirmName("");
                            setPending(u);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:border-rose-400/50 hover:text-rose-600"
                        >
                          <Trash2 size={12} aria-hidden />
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      }

      {pending ? (
        <ConfirmRemove
          user={pending}
          confirmName={confirmName}
          onConfirmName={setConfirmName}
          removing={removing}
          error={error}
          onCancel={() => {
            if (removing) return;
            setPending(null);
            setConfirmName("");
            setError(null);
          }}
          onConfirm={async () => {
            if (confirmName.trim().toLowerCase() !== pending.username.toLowerCase()) {
              setError("Type the username exactly to confirm.");
              return;
            }
            setRemoving(true);
            setError(null);
            try {
              const res = await fetch(`/api/admin/users/${pending.id}`, {
                method: "DELETE",
              });
              const body = (await res.json().catch(() => ({}))) as {
                error?: string;
              };
              if (!res.ok) {
                setError(body.error ?? "Couldn't remove this user.");
                return;
              }
              setUsers((prev) => prev.filter((row) => row.id !== pending.id));
              setPending(null);
              setConfirmName("");
            } finally {
              setRemoving(false);
            }
          }}
        />
      ) : null}

      {cursor ?
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void load(debounced, cursor)}
            disabled={loadingMore}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-hover disabled:opacity-60"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      : null}
    </div>
  );
}

function ConfirmRemove({
  user,
  confirmName,
  onConfirmName,
  removing,
  error,
  onCancel,
  onConfirm,
}: {
  user: AdminUser;
  confirmName: string;
  onConfirmName: (v: string) => void;
  removing: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ready = confirmName.trim().toLowerCase() === user.username.toLowerCase();
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Remove @${user.username}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-pop)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-600">
          Remove permanently
        </p>
        <h2 className="mt-2 text-lg font-bold">Delete @{user.username}?</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          This erases the account and everything they did — shelves, memories,
          follows, friendships, DMs, quests, gist impressions, and any club
          they owned. Books they added stay in the catalog.
        </p>
        <label className="mt-4 block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Type {user.username} to confirm
          </span>
          <input
            value={confirmName}
            onChange={(e) => onConfirmName(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="mt-2 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
          />
        </label>
        {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={removing}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-hover disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!ready || removing}
            className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {removing ? "Removing…" : "Remove user"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UserAvatar({ user }: { user: AdminUser }) {
  const initials = user.username.slice(0, 2).toUpperCase();
  if (user.image) {
    return (
      <Image
        src={user.image}
        alt=""
        width={36}
        height={36}
        className="h-9 w-9 shrink-0 rounded-full border border-border object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
      style={{ background: "var(--gradient-brand)" }}
    >
      {initials}
    </span>
  );
}
