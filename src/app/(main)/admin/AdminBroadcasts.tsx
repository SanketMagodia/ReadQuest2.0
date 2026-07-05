"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Megaphone, Trash2 } from "lucide-react";

type Broadcast = {
  id: string;
  title: string;
  body: string;
  link: string;
  linkLabel: string;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
  author: { username: string; name: string } | null;
};

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Readers stop seeing a broadcast 24h after publish (or at expiresAt). */
function isExpired(item: Broadcast) {
  const dayEnd = new Date(item.createdAt).getTime() + 24 * 60 * 60 * 1000;
  const expiry = item.expiresAt
    ? Math.min(new Date(item.expiresAt).getTime(), dayEnd)
    : dayEnd;
  return expiry <= Date.now();
}

export function AdminBroadcasts() {
  const [items, setItems] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [linkLabel, setLinkLabel] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/announcements", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { items: Broadcast[] };
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          link: link || "",
          linkLabel: linkLabel || "",
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setTitle("");
      setBody("");
      setLink("");
      setLinkLabel("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/admin/announcements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this broadcast permanently?")) return;
    await fetch(`/api/admin/announcements/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[28px] border border-border bg-card p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white"
            style={{ background: "var(--gradient-brand)" }}
          >
            <Megaphone size={18} />
          </span>
          <div>
            <h2 className="text-xl font-semibold">Push a broadcast</h2>
            <p className="mt-1 text-sm text-muted">
              Pops up as a dismissible card in the right panel (wide screens)
              or at the top of the feed (compact). Readers close it with ×.
              Broadcasts last 24 hours, then disappear on their own.
            </p>
          </div>
        </div>

        <form onSubmit={(e) => void publish(e)} className="mt-6 space-y-4">
          <Field label="Headline">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              required
              className={inputCls}
              placeholder="New feature, maintenance window, reading challenge…"
            />
          </Field>
          <Field label="Message">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={600}
              required
              rows={4}
              className={`${inputCls} resize-none`}
              placeholder="What should readers know?"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Link URL (optional)">
              <input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                className={inputCls}
                placeholder="/explore or https://…"
              />
            </Field>
            <Field label="Link label (optional)">
              <input
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                maxLength={40}
                className={inputCls}
                placeholder="Learn more"
              />
            </Field>
          </div>
          {error ?
            <p className="rounded-xl border border-rose-300/40 bg-rose-50/50 px-3 py-2 text-sm text-rose-700 dark:border-rose-700/50 dark:bg-rose-950/30 dark:text-rose-200">
              {error}
            </p>
          : null}
          <button
            type="submit"
            disabled={saving}
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-pop)] disabled:opacity-60"
            style={{ background: "var(--gradient-brand)" }}
          >
            {saving ? "Publishing…" : "Publish to all readers"}
          </button>
        </form>
      </section>

      <section>
        <h3 className="text-lg font-semibold">Recent broadcasts</h3>
        {loading ?
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted" aria-hidden />
          </div>
        : !items.length ?
          <p className="mt-3 text-sm text-muted">No broadcasts yet.</p>
        : <ul className="mt-4 space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-1 text-sm text-muted">{item.body}</p>
                    {item.link ?
                      <p className="mt-2 text-xs text-muted">
                        Link:{" "}
                        <Link href={item.link} className="underline">
                          {item.linkLabel || item.link}
                        </Link>
                      </p>
                    : null}
                    <p className="mt-2 text-[11px] text-muted">
                      {fmtWhen(item.createdAt)}
                      {item.author ? ` · @${item.author.username}` : ""}
                      {isExpired(item) ?
                        " · expired"
                      : item.active ?
                        " · live"
                      : " · hidden"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => void toggleActive(item.id, item.active)}
                      className="rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold hover:bg-hover"
                    >
                      {item.active ? "Hide" : "Show"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(item.id)}
                      aria-label="Delete broadcast"
                      className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-rose-600 hover:bg-hover dark:text-rose-300"
                    >
                      <Trash2 size={12} aria-hidden />
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        }
      </section>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
