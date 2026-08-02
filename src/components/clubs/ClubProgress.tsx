"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Flag, Loader2, PartyPopper, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClubMember } from "@/lib/clubs";

const STEPS: { value: number; label: string; title: string }[] = [
  { value: 0, label: "0%", title: "Not started" },
  { value: 25, label: "25%", title: "A quarter in" },
  { value: 50, label: "50%", title: "Halfway" },
  { value: 75, label: "75%", title: "Three quarters in" },
  { value: 100, label: "Done", title: "Finished the book" },
];

/**
 * The shared reading tracker: where everyone is in the club's current book,
 * and the control to move your own marker. Laid out for a narrow column.
 */
export function ClubProgress({
  slug,
  members,
  myUserId,
  myUsername,
  isMember,
  hasBook,
  onChanged,
}: {
  slug: string;
  members: ClubMember[];
  myUserId: string;
  myUsername: string;
  isMember: boolean;
  hasBook: boolean;
  onChanged: (members: ClubMember[], opts?: { changed: boolean }) => void;
}) {
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mine = members.find(
    (m) =>
      (myUserId && m.id === myUserId) ||
      (myUsername && m.username === myUsername)
  );
  const myProgress = mine?.progress ?? 0;
  const finished = members.filter((m) => m.progress === 100).length;
  const average = members.length
    ? Math.round(members.reduce((s, m) => s + m.progress, 0) / members.length)
    : 0;

  async function setProgress(value: number) {
    if (busy !== null) return;
    setBusy(value);
    setError(null);

    // Paint the new marker immediately so a slow round-trip never looks stuck.
    // Don't flag `changed` here — the chat event only exists after the server
    // confirms, and a premature refresh would race the write.
    const optimistic = members.map((m) => {
      const isMe =
        (myUserId && m.id === myUserId) ||
        (myUsername && m.username === myUsername);
      return isMe
        ? { ...m, progress: value, progressAt: new Date().toISOString() }
        : m;
    });
    onChanged(optimistic, { changed: false });

    try {
      const res = await fetch(`/api/clubs/${slug}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progress: value }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        members?: ClubMember[];
        changed?: boolean;
        error?: string;
      };
      if (!res.ok || !data.members) {
        // Roll back to whatever the parent still has by re-fetching via the
        // error path — restore the pre-click list.
        onChanged(members, { changed: false });
        setError(data.error ?? "Could not save that.");
        return;
      }
      onChanged(data.members, { changed: Boolean(data.changed) });
    } catch {
      onChanged(members, { changed: false });
      setError("Network hiccup — try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="px-3.5 pt-3.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="inline-flex items-baseline gap-1.5 font-display text-lg font-bold leading-none">
            {average}%
            <span className="text-[11px] font-semibold text-muted">
              club average
            </span>
          </span>
          {finished > 0 ? (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-300"
              title={`${finished} finished the book`}
            >
              <Trophy size={11} aria-hidden />
              {finished}
            </span>
          ) : null}
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-pill">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${average}%`, background: "var(--gradient-brand)" }}
          />
        </div>
      </div>

      {isMember ? (
        hasBook ? (
          <div className="px-3.5 pt-3.5">
            <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted">
              <Flag size={11} aria-hidden className="text-[var(--brand-1)]" />
              How far are you?
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {STEPS.map((s) => {
                const active = myProgress === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void setProgress(s.value)}
                    aria-pressed={active}
                    title={s.title}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-60",
                      active
                        ? "border-transparent text-white shadow-[var(--shadow-pop)]"
                        : "border-border bg-background hover:bg-hover"
                    )}
                    style={
                      active
                        ? {
                            background:
                              s.value === 100
                                ? "var(--gradient-warm)"
                                : "var(--gradient-brand)",
                          }
                        : undefined
                    }
                  >
                    {busy === s.value ? (
                      <Loader2 size={10} className="animate-spin" aria-hidden />
                    ) : s.value === 100 ? (
                      <PartyPopper size={10} aria-hidden />
                    ) : active ? (
                      <Check size={10} aria-hidden />
                    ) : null}
                    {s.label}
                  </button>
                );
              })}
            </div>
            {error ? (
              <p className="mt-1.5 text-[11px] text-red-500 dark:text-red-400">
                {error}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="px-3.5 pt-3 text-[12px] text-muted">
            Once there&apos;s a book on the rack you can track your progress here.
          </p>
        )
      ) : null}

      <ul className="mt-3.5 divide-y divide-border/60 border-t border-border/60">
        {members.map((m) => (
          <li key={m.id || m.username} className="px-3.5 py-2">
            <div className="flex items-center gap-2">
              {m.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.image}
                  alt=""
                  loading="lazy"
                  className="h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-border/70"
                />
              ) : (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pill text-[10px] font-bold text-muted">
                  {m.name.slice(0, 1).toUpperCase()}
                </span>
              )}

              <Link
                href={`/profile/${m.username}`}
                className="min-w-0 flex-1 truncate text-[12.5px] font-semibold hover:underline"
              >
                {m.name}
              </Link>

              <span
                className={cn(
                  "shrink-0 text-[11px] font-semibold tabular-nums",
                  m.progress === 100
                    ? "text-amber-600 dark:text-amber-300"
                    : "text-muted"
                )}
              >
                {m.progress === 100 ? "Done 🎉" : `${m.progress}%`}
              </span>
            </div>

            <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-pill">
              <span
                className="block h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${m.progress}%`,
                  background:
                    m.progress === 100
                      ? "var(--gradient-warm)"
                      : "var(--gradient-brand)",
                }}
              />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
