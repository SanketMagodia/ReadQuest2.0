"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Sparkles, X } from "lucide-react";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { CategoryMultiSelect } from "@/components/ui/CategoryMultiSelect";

type BotDTO = {
  id: string;
  enabled: boolean;
  persona: string;
  categories: string[];
  intervalMinMinutes: number;
  intervalMaxMinutes: number;
  model: string;
  postsCount: number;
  lastPostAt: string | null;
  nextPostAt: string | null;
  lastError: string;
  createdAt: string | null;

  replyEnabled: boolean;
  replyCategories: string[];
  replyChancePerTick: number;
  repliesPerTick: number;
  replyDailyLimit: number;
  autoRespondToComments: boolean;
  autoRespondPerTick: number;
  repliesCount: number;
  lastReplyAt: string | null;
  lastReplyError: string;

  user: {
    id: string;
    username: string;
    name: string;
    bio: string;
    image: string;
  };
};

type BotsResponse = { bots: BotDTO[]; groqConfigured: boolean };

type FormState = {
  username: string;
  name: string;
  bio: string;
  image: string;
  persona: string;
  categories: string[];
  intervalMinDays: number;
  intervalMaxDays: number;
  enabled: boolean;
  model: string;

  replyEnabled: boolean;
  replyCategories: string[];
  replyChancePerTick: number;
  repliesPerTick: number;
  replyDailyLimit: number;
  autoRespondToComments: boolean;
  autoRespondPerTick: number;
};

const emptyForm: FormState = {
  username: "",
  name: "",
  bio: "",
  image: "",
  persona: "",
  categories: [],
  intervalMinDays: 1,
  intervalMaxDays: 3,
  enabled: false,
  model: "",

  replyEnabled: false,
  replyCategories: [],
  replyChancePerTick: 20,
  repliesPerTick: 1,
  replyDailyLimit: 12,
  autoRespondToComments: true,
  autoRespondPerTick: 3,
};

/** Cadence is stored in minutes on the server; the admin UI works in days. */
const minutesToDays = (m: number) => Math.round((m / 1440) * 100) / 100;
const daysToMinutes = (d: number) => Math.max(10, Math.round(d * 1440));

function splitCats(raw: string): string[] {
  return raw
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

const PERSONA_PRESETS = [
  {
    label: "Cozy literary reader",
    persona:
      "You are a calm, thoughtful reader in your late 20s. You read with a cup of tea, gravitate toward character-driven literary fiction, and notice small details about prose and atmosphere. You sound warm and reflective, never preachy.",
    categories: splitCats("Fiction, Literary"),
  },
  {
    label: "Sci-fi & space nerd",
    persona:
      "You are an enthusiastic science fiction reader who loves big ideas about consciousness, time, and space. You speak casually, sometimes geek out about a concept, and occasionally compare books to other genre staples.",
    categories: splitCats("Science Fiction, Fantasy"),
  },
  {
    label: "True-crime & thriller fan",
    persona:
      "You are a thriller and true-crime reader. You read fast, judge pacing, and care about twists landing without feeling cheap. You sound a little wry and intense, never edgy.",
    categories: splitCats("Mystery, Thrillers, True Crime"),
  },
  {
    label: "Romance & rom-com lover",
    persona:
      "You are a hopeful romance reader. You crave banter, slow burn, and emotional payoff. You sound chatty, a bit dramatic, and protective of your favorite tropes.",
    categories: splitCats("Romance, Fiction"),
  },
  {
    label: "History & non-fiction explorer",
    persona:
      "You are a curious non-fiction reader who loves history, biography, and big-idea books. You frame your reactions like little discoveries — “Did not realize X about Y” energy — and you stay precise.",
    categories: splitCats("History, Biography, Nonfiction"),
  },
];

function formatCadence(minMinutes: number, maxMinutes: number) {
  const fmt = (m: number) => {
    const d = m / 1440;
    if (d >= 1) return `${Math.round(d * 10) / 10}d`;
    const h = m / 60;
    if (h >= 1) return `${Math.round(h * 10) / 10}h`;
    return `${m}m`;
  };
  return minMinutes === maxMinutes
    ? `every ~${fmt(minMinutes)}`
    : `every ${fmt(minMinutes)}–${fmt(maxMinutes)}`;
}

function formatRelative(iso: string | null) {
  if (!iso) return "never";
  const d = new Date(iso).getTime();
  const diff = d - Date.now();
  const abs = Math.abs(diff);
  const m = Math.round(abs / 60000);
  if (m < 1) return diff >= 0 ? "in <1m" : "just now";
  if (m < 60) return diff >= 0 ? `in ${m}m` : `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return diff >= 0 ? `in ${h}h` : `${h}h ago`;
  const days = Math.round(h / 24);
  return diff >= 0 ? `in ${days}d` : `${days}d ago`;
}

export function BotManager() {
  const [data, setData] = useState<BotsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyBot, setBusyBot] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [personaAiOpen, setPersonaAiOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/bots", { cache: "no-store" });
    if (res.ok) setData((await res.json()) as BotsResponse);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const groqOk = data?.groqConfigured ?? false;

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (form.categories.length === 0) {
      setFormError("Pick at least one category for this bot to post about.");
      return;
    }
    if (form.intervalMaxDays < form.intervalMinDays) {
      setFormError("Max days must be greater than or equal to min days.");
      return;
    }
    setCreating(true);
    const { intervalMinDays, intervalMaxDays, ...rest } = form;
    const res = await fetch("/api/admin/bots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...rest,
        intervalMinMinutes: daysToMinutes(intervalMinDays),
        intervalMaxMinutes: daysToMinutes(intervalMaxDays),
      }),
    });
    setCreating(false);
    if (res.ok) {
      setForm(emptyForm);
      setShowForm(false);
      setToast({ kind: "ok", text: "Bot created." });
      void refresh();
    } else {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setFormError(j.error ?? "Failed to create bot");
    }
  };

  const patchBot = async (
    id: string,
    patch: Partial<BotDTO> & {
      name?: string;
      bio?: string;
      image?: string;
    }
  ) => {
    setBusyBot(id);
    const res = await fetch(`/api/admin/bots/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setBusyBot(null);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setToast({ kind: "err", text: j.error ?? "Update failed" });
      return false;
    }
    void refresh();
    return true;
  };

  const postNow = async (id: string) => {
    setBusyBot(id);
    const res = await fetch(`/api/admin/bots/${id}/post-now`, { method: "POST" });
    setBusyBot(null);
    if (res.ok) {
      const j = (await res.json()) as { bookTitle?: string };
      setToast({
        kind: "ok",
        text: `Posted${j.bookTitle ? ` about "${j.bookTitle}"` : ""}.`,
      });
      void refresh();
    } else {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setToast({ kind: "err", text: j.error ?? "Post failed" });
    }
  };

  const replyNow = async (id: string) => {
    setBusyBot(id);
    const res = await fetch(`/api/admin/bots/${id}/reply-now`, {
      method: "POST",
    });
    setBusyBot(null);
    if (res.ok) {
      const j = (await res.json()) as { bookTitle?: string };
      setToast({
        kind: "ok",
        text: `Replied${j.bookTitle ? ` on a post about "${j.bookTitle}"` : ""}.`,
      });
      void refresh();
    } else {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setToast({ kind: "err", text: j.error ?? "Reply failed" });
    }
  };

  const removeBot = async (id: string, wipe: boolean) => {
    if (
      !window.confirm(
        wipe
          ? "Delete bot AND its user + all its posts? This cannot be undone."
          : "Delete this bot config? The user account remains."
      )
    ) {
      return;
    }
    setBusyBot(id);
    const res = await fetch(`/api/admin/bots/${id}${wipe ? "?wipe=1" : ""}`, {
      method: "DELETE",
    });
    setBusyBot(null);
    if (res.ok) {
      setToast({ kind: "ok", text: wipe ? "Bot wiped." : "Bot config removed." });
      void refresh();
    } else {
      setToast({ kind: "err", text: "Delete failed" });
    }
  };

  const triggerTick = async () => {
    setBusyBot("tick");
    const res = await fetch("/api/admin/bots/tick", { method: "POST" });
    setBusyBot(null);
    if (res.ok) {
      const j = (await res.json()) as {
        processed: number;
        errors: { message: string }[];
        replies: number;
        replyErrors: { message: string }[];
        responses: number;
        responseErrors: { message: string }[];
        stillDue?: number;
        skippedDueToLock?: boolean;
      };
      if (j.skippedDueToLock) {
        setToast({
          kind: "err",
          text: "A tick is already running (or its lock hasn't expired yet). Try again in a few minutes.",
        });
        return;
      }
      const errCount =
        (j.errors?.length ?? 0) +
        (j.replyErrors?.length ?? 0) +
        (j.responseErrors?.length ?? 0);
      setToast({
        kind: errCount ? "err" : "ok",
        text: `Tick ran: ${j.processed} posted, ${j.replies} replied, ${j.responses} responded${
          errCount ? `, ${errCount} errors` : ""
        }.${
          j.stillDue
            ? ` ${j.stillDue} bot${j.stillDue === 1 ? " is" : "s are"} still catching up — run tick again to continue.`
            : ""
        }`,
      });
      void refresh();
    } else {
      setToast({ kind: "err", text: "Tick failed" });
    }
  };

  const presetOptions = useMemo(() => PERSONA_PRESETS, []);

  if (loading && !data) return <LoadingIndicator fullPage label="Loading bots…" />;

  return (
    <section className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">AI Bots</h2>
          <p className="text-sm text-muted">
            Schedule personas to post about books and reply to other readers. Powered by Groq.
          </p>
          {!groqOk ? (
            <p className="mt-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300">
              GROQ_API_KEY is not set. Bots will fail until you add it to <code>.env.local</code>.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void triggerTick()}
            disabled={busyBot === "tick"}
            className="rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-hover disabled:opacity-50"
          >
            {busyBot === "tick" ? "Running…" : "Run tick now"}
          </button>
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className="rounded-full px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:brightness-110"
            style={{ background: "var(--gradient-brand)" }}
          >
            {showForm ? "Cancel" : "Add bot"}
          </button>
        </div>
      </header>

      {toast ? (
        <div
          role="status"
          className={`rounded-2xl border px-4 py-3 text-sm ${
            toast.kind === "ok"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300"
          }`}
        >
          {toast.text}
        </div>
      ) : null}

      {showForm ? (
        <form
          onSubmit={(e) => void submitCreate(e)}
          className="space-y-5 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]"
        >
          <div className="flex flex-wrap gap-2">
            {presetOptions.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    persona: p.persona,
                    categories: p.categories,
                    name: f.name || p.label,
                  }))
                }
                className="rounded-full border border-border bg-pill px-3 py-1 text-xs font-semibold hover:bg-hover"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Username (handle)">
              <input
                required
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="e.g. sameer_singh"
                className={inputCls}
              />
              <p className="mt-1 text-[11px] text-muted">
                Lowercase @handle for URLs — put the real name in Display name below.
              </p>
            </Field>
            <Field label="Display name">
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Maya R."
                className={inputCls}
              />
            </Field>
            <Field label="Bio">
              <input
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                placeholder="Books, tea, and slow Sundays."
                className={inputCls}
              />
            </Field>
            <Field label="Avatar URL (optional)">
              <input
                value={form.image}
                onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))}
                placeholder="https://…"
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Categories to post about (1–5)">
            <CategoryMultiSelect
              value={form.categories}
              onChange={(next) => setForm((f) => ({ ...f, categories: next }))}
              placeholder="Pick categories…"
              max={5}
              hint="The bot will post about books that match any of these."
            />
          </Field>

          <Field
            label="Persona prompt"
            action={
              <button
                type="button"
                onClick={() => setPersonaAiOpen((v) => !v)}
                aria-pressed={personaAiOpen}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal hover:bg-hover"
              >
                <Sparkles
                  size={11}
                  aria-hidden
                  className="text-amber-500 dark:text-amber-300"
                />
                {personaAiOpen ? "Close AI" : "Generate with AI"}
              </button>
            }
          >
            <PersonaGenerator
              open={personaAiOpen}
              onOpenChange={setPersonaAiOpen}
              contextName={form.name}
              contextCategories={form.categories}
              onApply={(persona) => setForm((f) => ({ ...f, persona }))}
            />
            <textarea
              required
              rows={4}
              value={form.persona}
              onChange={(e) => setForm((f) => ({ ...f, persona: e.target.value }))}
              placeholder="Describe how this bot talks, what they care about, their reading taste…"
              className={`${inputCls} font-mono text-[12px] leading-relaxed`}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Posts every… min (days)">
              <input
                type="number"
                min={0.1}
                max={30}
                step={0.5}
                value={form.intervalMinDays}
                onChange={(e) =>
                  setForm((f) => ({ ...f, intervalMinDays: Number(e.target.value) || 0 }))
                }
                className={inputCls}
              />
            </Field>
            <Field label="Posts every… max (days)">
              <input
                type="number"
                min={0.1}
                max={30}
                step={0.5}
                value={form.intervalMaxDays}
                onChange={(e) =>
                  setForm((f) => ({ ...f, intervalMaxDays: Number(e.target.value) || 0 }))
                }
                className={inputCls}
              />
              <p className="mt-1 text-[11px] text-muted">
                e.g. 1–3 → a new post every 1 to 3 days, at a random moment.
              </p>
            </Field>
            <Field label="Model (optional)">
              <input
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                placeholder="llama-3.3-70b-versatile"
                className={inputCls}
              />
            </Field>
          </div>

          {/* Reply configuration */}
          <fieldset className="space-y-4 rounded-2xl border border-dashed border-border bg-background/40 p-4">
            <legend className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Proactive replies (on other readers&apos; posts)
            </legend>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={form.replyEnabled}
                onChange={(e) =>
                  setForm((f) => ({ ...f, replyEnabled: e.target.checked }))
                }
              />
              Let this bot reach out and reply to other readers&apos; posts
            </label>

            <Field label="Reply categories (optional)">
              <CategoryMultiSelect
                value={form.replyCategories}
                onChange={(next) =>
                  setForm((f) => ({ ...f, replyCategories: next }))
                }
                placeholder="Defaults to posting categories"
                max={5}
                hint="Leave empty to reply on the same categories the bot posts about."
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={`Chance per tick (${form.replyChancePerTick}%)`}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={form.replyChancePerTick}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      replyChancePerTick: Number(e.target.value) || 0,
                    }))
                  }
                  className="w-full accent-sky-500"
                />
              </Field>
              <Field label="Replies per tick">
                <input
                  type="number"
                  min={1}
                  max={3}
                  value={form.repliesPerTick}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      repliesPerTick: Math.min(
                        3,
                        Math.max(1, Number(e.target.value) || 1)
                      ),
                    }))
                  }
                  className={inputCls}
                />
              </Field>
              <Field label="Daily limit (0 = off)">
                <input
                  type="number"
                  min={0}
                  max={200}
                  value={form.replyDailyLimit}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      replyDailyLimit: Math.max(
                        0,
                        Math.min(200, Number(e.target.value) || 0)
                      ),
                    }))
                  }
                  className={inputCls}
                />
              </Field>
            </div>
          </fieldset>

          {/* Auto-respond configuration */}
          <fieldset className="space-y-4 rounded-2xl border border-dashed border-border bg-background/40 p-4">
            <legend className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Conversations (respond to comments on bot&apos;s posts)
            </legend>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={form.autoRespondToComments}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    autoRespondToComments: e.target.checked,
                  }))
                }
              />
              Reply when humans comment on this bot&apos;s posts (or threads it&apos;s already in)
            </label>
            <Field label="Max responses per tick">
              <input
                type="number"
                min={0}
                max={10}
                value={form.autoRespondPerTick}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    autoRespondPerTick: Math.max(
                      0,
                      Math.min(10, Number(e.target.value) || 0)
                    ),
                  }))
                }
                className={inputCls}
              />
              <p className="text-[11px] text-muted">
                Responses also fire automatically ~30–90s after a human
                comments, so the back-and-forth feels natural.
              </p>
            </Field>
          </fieldset>

          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
            />
            Enable immediately (first post on the next tick)
          </label>

          {formError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
          ) : null}

          <button
            type="submit"
            disabled={creating}
            className="rounded-full px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
            style={{ background: "var(--gradient-brand)" }}
          >
            {creating ? "Creating…" : "Create bot"}
          </button>
        </form>
      ) : null}

      {data?.bots.length ? (
        <ul className="space-y-4">
          {data.bots.map((b) => (
            <BotRow
              key={b.id}
              bot={b}
              busy={busyBot === b.id}
              onToggle={(enabled) => patchBot(b.id, { enabled })}
              onToggleReply={(replyEnabled) =>
                patchBot(b.id, { replyEnabled })
              }
              onSave={(patch) => patchBot(b.id, patch)}
              onPostNow={() => postNow(b.id)}
              onReplyNow={() => replyNow(b.id)}
              onDelete={(wipe) => removeBot(b.id, wipe)}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted">
          No bots yet. Click <b>Add bot</b> to spin one up.
        </p>
      )}
    </section>
  );
}

const inputCls =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70";

function Field({
  label,
  children,
  action,
}: {
  label: string;
  children: React.ReactNode;
  /** Optional action displayed at the right of the label (e.g. an AI button). */
  action?: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
        <span>{label}</span>
        {action}
      </span>
      {children}
    </label>
  );
}

/** Inline AI persona generator. Calls /api/admin/ai/persona and pipes the
 *  generated text into the parent textarea via `onApply`. */
function PersonaGenerator({
  open,
  onOpenChange,
  contextName,
  contextCategories,
  onApply,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  contextName?: string;
  contextCategories?: string[];
  onApply: (persona: string) => void;
}) {
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ai/persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: brief.trim() || undefined,
          name: contextName?.trim() || undefined,
          categories:
            contextCategories && contextCategories.length
              ? contextCategories
              : undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Generation failed. Try again.");
        return;
      }
      const data = (await res.json()) as { persona: string };
      onApply(data.persona);
      setHasGenerated(true);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="space-y-3 rounded-2xl border border-dashed border-border bg-pill/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
          <Sparkles
            size={12}
            aria-hidden
            className="text-amber-500 dark:text-amber-300"
          />
          AI persona helper
        </p>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Close AI helper"
          className="rounded-full p-1 text-muted hover:bg-hover hover:text-foreground"
        >
          <X size={12} aria-hidden />
        </button>
      </div>
      <label className="block space-y-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          Brief (optional)
        </span>
        <textarea
          rows={2}
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          maxLength={500}
          placeholder="e.g. mid-30s, snarky, loves slipstream sci-fi and detests anything cozy"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
        />
      </label>
      <p className="text-[11px] text-muted">
        Uses the display name and chosen categories above for context.
      </p>
      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void generate()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
          style={{ background: "var(--gradient-brand)" }}
        >
          {busy ? (
            <RefreshCw size={12} aria-hidden className="animate-spin" />
          ) : (
            <Sparkles size={12} aria-hidden />
          )}
          {hasGenerated ? "Regenerate" : "Generate persona"}
        </button>
      </div>
    </div>
  );
}

type RowSaveInput = {
  name?: string;
  bio?: string;
  image?: string;
  persona?: string;
  categories?: string[];
  intervalMinMinutes?: number;
  intervalMaxMinutes?: number;
  model?: string;
  replyEnabled?: boolean;
  replyCategories?: string[];
  replyChancePerTick?: number;
  repliesPerTick?: number;
  replyDailyLimit?: number;
  autoRespondToComments?: boolean;
  autoRespondPerTick?: number;
};

function BotRow({
  bot,
  busy,
  onToggle,
  onToggleReply,
  onSave,
  onPostNow,
  onReplyNow,
  onDelete,
}: {
  bot: BotDTO;
  busy: boolean;
  onToggle: (enabled: boolean) => Promise<boolean>;
  onToggleReply: (replyEnabled: boolean) => Promise<boolean>;
  onSave: (patch: RowSaveInput) => Promise<boolean>;
  onPostNow: () => void;
  onReplyNow: () => void;
  onDelete: (wipe: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [draft, setDraft] = useState({
    name: bot.user.name,
    bio: bot.user.bio,
    image: bot.user.image,
    persona: bot.persona,
    categories: bot.categories,
    intervalMinDays: minutesToDays(bot.intervalMinMinutes),
    intervalMaxDays: minutesToDays(bot.intervalMaxMinutes),
    model: bot.model,
    replyEnabled: bot.replyEnabled,
    replyCategories: bot.replyCategories,
    replyChancePerTick: bot.replyChancePerTick,
    repliesPerTick: bot.repliesPerTick,
    replyDailyLimit: bot.replyDailyLimit,
    autoRespondToComments: bot.autoRespondToComments,
    autoRespondPerTick: bot.autoRespondPerTick,
  });

  useEffect(() => {
    setDraft({
      name: bot.user.name,
      bio: bot.user.bio,
      image: bot.user.image,
      persona: bot.persona,
      categories: bot.categories,
      intervalMinDays: minutesToDays(bot.intervalMinMinutes),
      intervalMaxDays: minutesToDays(bot.intervalMaxMinutes),
      model: bot.model,
      replyEnabled: bot.replyEnabled,
      replyCategories: bot.replyCategories,
      replyChancePerTick: bot.replyChancePerTick,
      repliesPerTick: bot.repliesPerTick,
      replyDailyLimit: bot.replyDailyLimit,
      autoRespondToComments: bot.autoRespondToComments,
      autoRespondPerTick: bot.autoRespondPerTick,
    });
  }, [bot]);

  const save = async () => {
    const ok = await onSave({
      name: draft.name,
      bio: draft.bio,
      image: draft.image,
      persona: draft.persona,
      categories: draft.categories,
      intervalMinMinutes: daysToMinutes(draft.intervalMinDays),
      intervalMaxMinutes: daysToMinutes(draft.intervalMaxDays),
      model: draft.model,
      replyEnabled: draft.replyEnabled,
      replyCategories: draft.replyCategories,
      replyChancePerTick: draft.replyChancePerTick,
      repliesPerTick: draft.repliesPerTick,
      replyDailyLimit: draft.replyDailyLimit,
      autoRespondToComments: draft.autoRespondToComments,
      autoRespondPerTick: draft.autoRespondPerTick,
    });
    if (ok) setEditing(false);
  };

  return (
    <li className="rounded-[26px] border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full text-base font-black text-white"
            style={{ background: "var(--gradient-brand)" }}
          >
            {bot.user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={bot.user.image} alt="" className="h-full w-full object-cover" />
            ) : (
              bot.user.username.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold">
              {bot.user.name || bot.user.username}{" "}
              <span className="text-xs font-normal text-muted">@{bot.user.username}</span>
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {bot.categories.length ? (
                bot.categories.map((c) => (
                  <span
                    key={c}
                    className="rounded-full bg-pill px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/80"
                  >
                    {c}
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-muted">no categories</span>
              )}
            </div>
            <p className="mt-1.5 text-[11px] text-muted">
              {bot.postsCount} posts ·{" "}
              {formatCadence(bot.intervalMinMinutes, bot.intervalMaxMinutes)} · last{" "}
              {formatRelative(bot.lastPostAt)} · next{" "}
              {bot.enabled ? formatRelative(bot.nextPostAt) : "paused"}
            </p>
            <p className="text-[11px] text-muted">
              {bot.repliesCount} replies · last {formatRelative(bot.lastReplyAt)} ·{" "}
              {bot.replyEnabled
                ? `${bot.replyChancePerTick}% / tick`
                : "outreach off"}
              {" · "}
              {bot.autoRespondToComments ? "auto-responds" : "no auto-respond"}
            </p>
            {bot.lastError ? (
              <p className="mt-1 line-clamp-2 text-[11px] text-red-600 dark:text-red-400">
                post error: {bot.lastError}
              </p>
            ) : null}
            {bot.lastReplyError ? (
              <p className="line-clamp-2 text-[11px] text-amber-600 dark:text-amber-400">
                reply: {bot.lastReplyError}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-semibold">
            <input
              type="checkbox"
              checked={bot.enabled}
              disabled={busy}
              onChange={(e) => void onToggle(e.target.checked)}
            />
            {bot.enabled ? "On" : "Off"}
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold">
            <input
              type="checkbox"
              checked={bot.replyEnabled}
              disabled={busy}
              onChange={(e) => void onToggleReply(e.target.checked)}
            />
            Replies
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={onPostNow}
            className="rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-hover disabled:opacity-50"
          >
            {busy ? "…" : "Post now"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onReplyNow}
            className="rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-hover disabled:opacity-50"
          >
            {busy ? "…" : "Reply now"}
          </button>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-hover"
          >
            {editing ? "Close" : "Edit"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onDelete(true)}
            className="rounded-full border border-red-500/40 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-500/10 dark:text-red-300"
          >
            Delete
          </button>
        </div>
      </div>

      {editing ? (
        <div className="mt-5 space-y-5 border-t border-border pt-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Display name">
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Avatar URL">
              <input
                value={draft.image}
                onChange={(e) => setDraft({ ...draft, image: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Bio">
              <input
                value={draft.bio}
                onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Posting categories (1–5)">
              <CategoryMultiSelect
                value={draft.categories}
                onChange={(next) => setDraft({ ...draft, categories: next })}
                placeholder="Pick categories…"
                max={5}
              />
            </Field>
          </div>

          <Field
            label="Persona prompt"
            action={
              <button
                type="button"
                onClick={() => setAiOpen((v) => !v)}
                aria-pressed={aiOpen}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal hover:bg-hover"
              >
                <Sparkles
                  size={11}
                  aria-hidden
                  className="text-amber-500 dark:text-amber-300"
                />
                {aiOpen ? "Close AI" : "Generate with AI"}
              </button>
            }
          >
            <PersonaGenerator
              open={aiOpen}
              onOpenChange={setAiOpen}
              contextName={draft.name}
              contextCategories={draft.categories}
              onApply={(persona) => setDraft({ ...draft, persona })}
            />
            <textarea
              rows={4}
              value={draft.persona}
              onChange={(e) => setDraft({ ...draft, persona: e.target.value })}
              className={`${inputCls} font-mono text-[12px] leading-relaxed`}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Posts every… min (days)">
              <input
                type="number"
                min={0.1}
                max={30}
                step={0.5}
                value={draft.intervalMinDays}
                onChange={(e) =>
                  setDraft({ ...draft, intervalMinDays: Number(e.target.value) || 0 })
                }
                className={inputCls}
              />
            </Field>
            <Field label="Posts every… max (days)">
              <input
                type="number"
                min={0.1}
                max={30}
                step={0.5}
                value={draft.intervalMaxDays}
                onChange={(e) =>
                  setDraft({ ...draft, intervalMaxDays: Number(e.target.value) || 0 })
                }
                className={inputCls}
              />
            </Field>
            <Field label="Model">
              <input
                value={draft.model}
                onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                placeholder="llama-3.3-70b-versatile"
                className={inputCls}
              />
            </Field>
          </div>

          <fieldset className="space-y-4 rounded-2xl border border-dashed border-border bg-background/40 p-4">
            <legend className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Proactive replies (on other readers&apos; posts)
            </legend>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={draft.replyEnabled}
                onChange={(e) =>
                  setDraft({ ...draft, replyEnabled: e.target.checked })
                }
              />
              Reply to other readers&apos; posts
            </label>

            <Field label="Reply categories (optional)">
              <CategoryMultiSelect
                value={draft.replyCategories}
                onChange={(next) =>
                  setDraft({ ...draft, replyCategories: next })
                }
                placeholder="Defaults to posting categories"
                max={5}
                hint="Leave empty to reply on the same categories the bot posts about."
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={`Chance per tick (${draft.replyChancePerTick}%)`}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={draft.replyChancePerTick}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      replyChancePerTick: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full accent-sky-500"
                />
              </Field>
              <Field label="Replies per tick">
                <input
                  type="number"
                  min={1}
                  max={3}
                  value={draft.repliesPerTick}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      repliesPerTick: Math.min(
                        3,
                        Math.max(1, Number(e.target.value) || 1)
                      ),
                    })
                  }
                  className={inputCls}
                />
              </Field>
              <Field label="Daily limit (0 = off)">
                <input
                  type="number"
                  min={0}
                  max={200}
                  value={draft.replyDailyLimit}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      replyDailyLimit: Math.max(
                        0,
                        Math.min(200, Number(e.target.value) || 0)
                      ),
                    })
                  }
                  className={inputCls}
                />
              </Field>
            </div>
          </fieldset>

          <fieldset className="space-y-4 rounded-2xl border border-dashed border-border bg-background/40 p-4">
            <legend className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Conversations (respond to comments on bot&apos;s posts)
            </legend>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={draft.autoRespondToComments}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    autoRespondToComments: e.target.checked,
                  })
                }
              />
              Reply when humans comment on this bot&apos;s threads
            </label>
            <Field label="Max responses per tick">
              <input
                type="number"
                min={0}
                max={10}
                value={draft.autoRespondPerTick}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    autoRespondPerTick: Math.max(
                      0,
                      Math.min(10, Number(e.target.value) || 0)
                    ),
                  })
                }
                className={inputCls}
              />
              <p className="text-[11px] text-muted">
                A human comment also triggers a one-off response ~30–90s after
                it lands. The scheduler is the safety net.
              </p>
            </Field>
          </fieldset>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="rounded-full px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
              style={{ background: "var(--gradient-brand)" }}
            >
              Save changes
            </button>
            <button
              type="button"
              onClick={() => onDelete(false)}
              className="rounded-full border border-border px-5 py-2 text-xs font-semibold hover:bg-hover"
            >
              Remove bot only (keep user)
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
