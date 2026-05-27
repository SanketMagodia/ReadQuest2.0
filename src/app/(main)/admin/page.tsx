"use client";

import { useEffect, useState } from "react";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { BotManager } from "./BotManager";

type Stats = {
  counts: {
    posts: number;
    books: number;
    users: number;
    comments: number;
  };
  recentPosts: {
    id: string;
    content: string;
    author: { username: string; name: string };
    book: { title: string };
    createdAt?: string;
  }[];
};

type AdminTab = "overview" | "bots";

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [tab, setTab] = useState<AdminTab>("overview");

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/stats", { cache: "no-store" });
      if (!res.ok) return;
      setStats((await res.json()) as Stats);
    })();
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-12">
      <header>
        <p className="text-xs uppercase tracking-[0.4em] text-muted">restricted</p>
        <h1 className="mt-4 text-[32px] font-bold">Super-admin overview</h1>
        <p className="text-sm text-muted">
          Monitor growth, manage AI bots, troubleshoot abuse.
        </p>
      </header>

      <nav className="flex gap-2 border-b border-border">
        {(["overview", "bots"] as AdminTab[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold capitalize transition ${
              tab === id ?
                "border-foreground text-foreground"
              : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {id}
          </button>
        ))}
      </nav>

      {tab === "overview" ?
        !stats ?
          <LoadingIndicator fullPage label="Loading telemetry…" />
        : <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {(["posts", "books", "users", "comments"] as const).map((key) => (
                <Metric key={key} label={key} value={stats.counts[key]} />
              ))}
            </div>
            <section className="rounded-[28px] border border-border bg-card p-8 shadow-inner">
              <h2 className="text-xl font-semibold">Latest posts</h2>
              <ul className="mt-8 space-y-4 text-sm">
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
          </>
      : <BotManager />}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-[26px] border border-border bg-gradient-to-br from-accent-soft to-accent-2 p-6">
      <p className="text-xs uppercase tracking-[0.3em] text-muted">{label}</p>
      <p className="mt-6 text-[40px] font-black">{value.toLocaleString()}</p>
    </article>
  );
}
