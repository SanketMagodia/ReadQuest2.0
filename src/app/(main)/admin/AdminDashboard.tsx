"use client";

import { useEffect, useState } from "react";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { BotManager } from "./BotManager";
import { AdminUsers } from "./AdminUsers";
import { AdminBroadcasts } from "./AdminBroadcasts";

type Stats = {
  counts: {
    posts: number;
    books: number;
    users: number;
    comments: number;
    bots: number;
    friendships: number;
    readlists: number;
    bookFollows: number;
    notifications: number;
  };
  today: {
    posts: number;
    comments: number;
    users: number;
  };
  week: {
    posts: number;
    users: number;
    activePosters: number;
  };
  recentPosts: {
    id: string;
    content: string;
    author: { username: string; name: string };
    book: { title: string };
    createdAt?: string;
  }[];
  recentUsers: {
    id: string;
    username: string;
    name: string;
    role: string;
    createdAt: string;
  }[];
};

type AdminTab = "overview" | "users" | "broadcasts" | "bots";

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [tab, setTab] = useState<AdminTab>("overview");

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/stats", { cache: "no-store" });
      if (!res.ok) return;
      setStats((await res.json()) as Stats);
    })();
  }, []);

  const tabs: { id: AdminTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "users", label: "Users" },
    { id: "broadcasts", label: "Broadcasts" },
    { id: "bots", label: "Bots" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-12">
      <header>
        <p className="text-xs uppercase tracking-[0.4em] text-muted">restricted</p>
        <h1 className="mt-4 text-[32px] font-bold">Manager dashboard</h1>
        <p className="text-sm text-muted">
          Growth metrics, user directory, broadcasts, and bot controls.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2 border-b border-border">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition ${
              tab === id ?
                "border-foreground text-foreground"
              : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "overview" ?
        !stats ?
          <LoadingIndicator fullPage label="Loading telemetry…" />
        : <OverviewPanel stats={stats} />
      : null}

      {tab === "users" ? <AdminUsers /> : null}
      {tab === "broadcasts" ? <AdminBroadcasts /> : null}
      {tab === "bots" ? <BotManager /> : null}
    </div>
  );
}

function OverviewPanel({ stats }: { stats: Stats }) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          Totals
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Metric label="Readers" value={stats.counts.users} hint="excl. bots" />
          <Metric label="Posts" value={stats.counts.posts} />
          <Metric label="Comments" value={stats.counts.comments} />
          <Metric label="Books" value={stats.counts.books} />
          <Metric label="Friendships" value={stats.counts.friendships} />
          <Metric label="Readlist saves" value={stats.counts.readlists} />
          <Metric label="Book follows" value={stats.counts.bookFollows} />
          <Metric label="In-app notifications" value={stats.counts.notifications} />
          <Metric label="AI bots" value={stats.counts.bots} hint="Bot manager" />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-[26px] border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Today
          </h3>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex justify-between">
              <span className="text-muted">New readers</span>
              <span className="font-bold tabular-nums">{stats.today.users}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted">Posts</span>
              <span className="font-bold tabular-nums">{stats.today.posts}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted">Comments</span>
              <span className="font-bold tabular-nums">{stats.today.comments}</span>
            </li>
          </ul>
        </article>
        <article className="rounded-[26px] border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Last 7 days
          </h3>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex justify-between">
              <span className="text-muted">New readers</span>
              <span className="font-bold tabular-nums">{stats.week.users}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted">Posts</span>
              <span className="font-bold tabular-nums">{stats.week.posts}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted">Active posters</span>
              <span className="font-bold tabular-nums">{stats.week.activePosters}</span>
            </li>
          </ul>
        </article>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-[28px] border border-border bg-card p-6 shadow-inner sm:p-8">
          <h2 className="text-xl font-semibold">Latest posts</h2>
          <ul className="mt-6 space-y-4 text-sm">
            {stats.recentPosts.map((p) => (
              <li key={p.id} className="rounded-3xl bg-pill p-5">
                <p className="text-xs uppercase text-muted">
                  @{p.author.username} • {p.book.title}
                </p>
                <p className="mt-2 text-[15px] leading-relaxed">{p.content}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-[28px] border border-border bg-card p-6 shadow-inner sm:p-8">
          <h2 className="text-xl font-semibold">Newest readers</h2>
          <p className="mt-1 text-xs text-muted">Human accounts only — bots are listed under Bots.</p>
          <ul className="mt-6 space-y-3 text-sm">
            {stats.recentUsers.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between rounded-2xl bg-pill px-4 py-3"
              >
                <span>
                  <span className="font-semibold">{u.name}</span>
                  <span className="ml-2 text-muted">@{u.username}</span>
                </span>
                <span className="text-[11px] uppercase text-muted">{u.role}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <article className="rounded-[22px] border border-border bg-gradient-to-br from-accent-soft to-accent-2 p-5">
      <p className="text-[11px] uppercase tracking-[0.2em] text-muted">{label}</p>
      {hint ?
        <p className="mt-0.5 text-[10px] text-muted/80">{hint}</p>
      : null}
      <p className="mt-3 text-3xl font-black tabular-nums">{value.toLocaleString()}</p>
    </article>
  );
}
