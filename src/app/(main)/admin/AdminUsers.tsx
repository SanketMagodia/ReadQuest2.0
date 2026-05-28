"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Loader2, Search } from "lucide-react";

type AdminUser = {
  id: string;
  username: string;
  name: string;
  email: string;
  role: string;
  posts: number;
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
                  <th className="px-4 py-3">Posts</th>
                  <th className="px-4 py-3">Joined</th>
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
                    <td className="px-4 py-3 tabular-nums">{u.posts}</td>
                    <td className="px-4 py-3 text-muted">{fmtJoined(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      }

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
