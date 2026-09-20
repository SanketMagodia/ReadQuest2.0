"use client";

import { useEffect, useState } from "react";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { AdminUsers } from "./AdminUsers";
import { AdminBroadcasts } from "./AdminBroadcasts";

type Stats = {
  counts: {
    books: number;
    users: number;
    summaries: number;
    /** Books that have a blurb we can summarize. */
    eligibleBooks: number;
    /** Eligible books still missing a gist. */
    remainingSummaries: number;
    /** Percentage of the whole catalog with a cached AI summary. */
    summaryCoverage: number;
    /** Percentage of eligible books with a cached AI summary. */
    eligibleCoverage: number;
    memories: number;
    quests: number;
    friendships: number;
    readlists: number;
    bookFollows: number;
    notifications: number;
  };
  today: {
    users: number;
    quests: number;
    gistsRead: number;
  };
  week: {
    users: number;
    gistsRead: number;
    activeReaders: number;
  };
  recentReads: {
    id: string;
    action: string;
    user: { username: string; name: string };
    book: { title: string };
    at?: string;
  }[];
  recentUsers: {
    id: string;
    username: string;
    name: string;
    role: string;
    createdAt: string;
  }[];
};

type AdminTab = "overview" | "users" | "broadcasts";

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
  ];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-12">
      <header>
        <p className="text-xs uppercase tracking-[0.4em] text-muted">restricted</p>
        <h1 className="mt-4 text-[32px] font-bold">Manager dashboard</h1>
        <p className="text-sm text-muted">
          Growth metrics, user directory, and broadcasts.
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
    </div>
  );
}

function OverviewPanel({ stats }: { stats: Stats }) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          Gist coverage
        </h2>
        <CoverageCard counts={stats.counts} />
      </section>

      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          Totals
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Metric label="Readers" value={stats.counts.users} hint="excl. bots" />
          <Metric label="Books" value={stats.counts.books} />
          <Metric label="Saved memories" value={stats.counts.memories} hint="private" />
          <Metric label="Quests completed" value={stats.counts.quests} />
          <Metric label="Friendships" value={stats.counts.friendships} />
          <Metric label="Readlist saves" value={stats.counts.readlists} />
          <Metric label="Book follows" value={stats.counts.bookFollows} />
          <Metric label="In-app notifications" value={stats.counts.notifications} />
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
              <span className="text-muted">Gists read</span>
              <span className="font-bold tabular-nums">{stats.today.gistsRead}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted">Quests completed</span>
              <span className="font-bold tabular-nums">{stats.today.quests}</span>
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
              <span className="text-muted">Gists read</span>
              <span className="font-bold tabular-nums">{stats.week.gistsRead}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted">Active in Gists</span>
              <span className="font-bold tabular-nums">{stats.week.activeReaders}</span>
            </li>
          </ul>
        </article>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-[28px] border border-border bg-card p-6 shadow-inner sm:p-8">
          <h2 className="text-xl font-semibold">Latest gist activity</h2>
          <ul className="mt-6 space-y-3 text-sm">
            {stats.recentReads.map((r) => (
              <li key={r.id} className="rounded-2xl bg-pill px-4 py-3">
                <p className="text-xs uppercase text-muted">
                  @{r.user?.username ?? "unknown"} • {r.action}
                </p>
                <p className="mt-1 text-[15px] leading-relaxed">
                  {r.book?.title ?? "—"}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-[28px] border border-border bg-card p-6 shadow-inner sm:p-8">
          <h2 className="text-xl font-semibold">Newest readers</h2>
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

function CoverageCard({
  counts,
}: {
  counts: Stats["counts"];
}) {
  const done = counts.summaries;
  const total = counts.books;
  const eligible = counts.eligibleBooks;
  const remaining = counts.remainingSummaries;
  const pct = counts.summaryCoverage;

  return (
    <article className="mt-3 rounded-[26px] border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-black tabular-nums">
            {done.toLocaleString()}
            <span className="text-lg font-semibold text-muted">
              {" "}
              / {total.toLocaleString()}
            </span>
          </p>
          <p className="mt-1 text-sm text-muted">
            books have a generated gist · {pct}% of the catalog
          </p>
        </div>
        <p className="text-sm font-semibold tabular-nums text-muted">
          {remaining.toLocaleString()} remaining
        </p>
      </div>
      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-pill"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Share of the catalog with a generated gist"
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, Math.max(0, pct))}%`,
            background: "var(--gradient-brand)",
          }}
        />
      </div>
      <p className="mt-3 text-[12px] text-muted">
        {eligible.toLocaleString()} books have a blurb we can summarize
        {eligible ? ` · ${counts.eligibleCoverage}% of those are done` : ""}.
        Run <code className="font-mono text-[11px]">python scripts/generate_book_summaries.py</code>{" "}
        for an hour to keep filling the rest.
      </p>
    </article>
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
