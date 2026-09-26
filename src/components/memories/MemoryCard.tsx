"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import type { MemoryDTO } from "@/lib/memories";

function fmtDate(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

const ICON_BUTTON =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#6b5344] transition hover:bg-black/5 hover:text-[#3d2b1f] disabled:opacity-50";

const PAPERS = [
  { bg: "#f7f0e4", ink: "#3d2b1f" },
  { bg: "#f3e4cf", ink: "#3a271c" },
  { bg: "#efe7d8", ink: "#2f261c" },
  { bg: "#f8f1e6", ink: "#3f2e22" },
];

const TILTS = [-1.4, 1.15, -0.55, 1.5];

/** Uneven edges so each scrap looks torn, not die-cut. */
const EDGES = [
  "polygon(2% 1%, 12% 0, 28% 1.6%, 46% 0, 63% 1.4%, 81% 0, 98% 1.8%, 100% 14%, 99% 38%, 100% 61%, 98.5% 84%, 100% 98%, 84% 100%, 61% 98.4%, 40% 100%, 18% 98.6%, 0 100%, 1.2% 78%, 0 52%, 1.4% 24%)",
  "polygon(0 2%, 14% 0, 33% 1.5%, 52% 0, 74% 1.8%, 91% 0, 100% 2%, 99% 22%, 100% 47%, 98.6% 71%, 100% 96%, 82% 100%, 58% 98.5%, 34% 100%, 12% 98.2%, 0 100%, 1% 74%, 0 46%, 1.5% 18%)",
  "polygon(1% 0, 18% 1.6%, 39% 0, 57% 1.4%, 78% 0, 96% 1.8%, 100% 8%, 98.8% 31%, 100% 55%, 99% 79%, 100% 98%, 79% 100%, 55% 98.4%, 31% 100%, 9% 98.6%, 0 97%, 1.4% 70%, 0 42%, 1% 16%)",
  "polygon(0 1.4%, 16% 0, 35% 1.8%, 54% 0, 72% 1.2%, 90% 0, 100% 2.2%, 99.2% 26%, 100% 50%, 98.4% 76%, 100% 99%, 76% 98.2%, 52% 100%, 28% 98.5%, 8% 100%, 0 97%, 1.6% 68%, 0 40%, 1.2% 15%)",
];

function scrapIndex(id: string) {
  let n = 0;
  for (const ch of id) n = (n + ch.charCodeAt(0)) % PAPERS.length;
  return n;
}

const SCRIPT = { fontFamily: "var(--font-script), 'Segoe Script', cursive" };

export function MemoryCard({
  memory,
  onDeleted,
  onUpdated,
}: {
  memory: MemoryDTO;
  onDeleted?: (id: string) => void;
  onUpdated?: (memory: MemoryDTO) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [quote, setQuote] = useState(memory.quote);
  const [note, setNote] = useState(memory.note);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!confirming) return;
    const id = window.setTimeout(() => setConfirming(false), 2500);
    return () => window.clearTimeout(id);
  }, [confirming]);

  async function remove() {
    if (deleting) return;
    setDeleting(true);
    const res = await fetch(`/api/memories/${memory.id}`, { method: "DELETE" });
    if (res.ok) onDeleted?.(memory.id);
    else setDeleting(false);
  }

  async function save() {
    const nextQuote = quote.trim();
    const nextNote = note.trim();
    if (!nextQuote && !nextNote) {
      setError("Keep a line or a note.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/memories/${memory.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quote: nextQuote, note: nextNote }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Couldn't save that.");
      return;
    }
    const data = (await res.json()) as { memory?: MemoryDTO };
    if (data.memory) onUpdated?.(data.memory);
    setEditing(false);
  }

  const when = [memory.page ? `p. ${memory.page}` : "", fmtDate(memory.createdAt)]
    .filter(Boolean)
    .join(" · ");

  const paper = PAPERS[scrapIndex(memory.id)];
  const tilt = TILTS[scrapIndex(memory.id)];

  return (
    <article
      className="relative"
      style={{ transform: editing ? undefined : `rotate(${tilt}deg)` }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute left-8 top-0 z-10 h-3.5 w-12 -translate-y-1/2 rotate-[-8deg] rounded-[1px] bg-[#f3e7a8]/80 shadow-[0_1px_2px_rgba(80,50,10,0.25)]"
      />
      <div
        className="relative px-4 pb-3.5 pt-4 shadow-[0_14px_22px_-16px_rgba(40,22,8,0.7)]"
        style={{
          background: paper.bg,
          color: paper.ink,
          clipPath: EDGES[scrapIndex(memory.id)],
        }}
      >
        {editing ? (
          <div className="flex flex-col gap-1.5 pr-1">
            <textarea
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              rows={2}
              maxLength={2000}
              aria-label="Line"
              placeholder="The line"
              className="w-full resize-none rounded-md border border-[#c9b79a] bg-white/50 px-2.5 py-1.5 text-[1.35rem] leading-tight outline-none focus-visible:ring-2 focus-visible:ring-[#c4a574]"
              style={SCRIPT}
            />
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={2000}
              aria-label="Note"
              placeholder="A note, if you want one"
              className="w-full resize-none rounded-md border border-[#c9b79a] bg-white/50 px-2.5 py-1.5 text-[1.15rem] leading-tight outline-none focus-visible:ring-2 focus-visible:ring-[#c4a574]"
              style={SCRIPT}
            />
            {error ? (
              <p className="text-[12px] font-medium text-rose-700">{error}</p>
            ) : null}
            <div className="flex justify-end gap-1">
              <button
                type="button"
                onClick={() => {
                  setQuote(memory.quote);
                  setNote(memory.note);
                  setError(null);
                  setEditing(false);
                }}
                className={ICON_BUTTON}
                aria-label="Cancel edit"
              >
                <X size={14} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className={ICON_BUTTON}
                aria-label="Save memory"
              >
                {saving ? (
                  <Loader2 size={14} aria-hidden className="animate-spin" />
                ) : (
                  <Check size={14} aria-hidden />
                )}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="absolute right-2 top-2 flex">
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  setEditing(true);
                }}
                className={ICON_BUTTON}
                aria-label="Edit this memory"
              >
                <Pencil size={14} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!confirming) {
                    setConfirming(true);
                    return;
                  }
                  void remove();
                }}
                disabled={deleting}
                className={`${ICON_BUTTON} ${
                  confirming ? "bg-rose-700/15 text-rose-800" : ""
                }`}
                aria-label={confirming ? "Confirm delete" : "Delete this memory"}
              >
                {deleting ? (
                  <Loader2 size={14} aria-hidden className="animate-spin" />
                ) : (
                  <Trash2 size={14} aria-hidden />
                )}
              </button>
            </div>
            <div className="pr-14">
              {memory.quote ? (
                <p className="text-[1.55rem] font-semibold leading-[1.15]" style={SCRIPT}>
                  “{memory.quote}”
                </p>
              ) : null}
              {memory.note ? (
                <p
                  className={`text-[1.2rem] leading-tight opacity-80 ${memory.quote ? "mt-1" : ""}`}
                  style={SCRIPT}
                >
                  {memory.note}
                </p>
              ) : null}
              {memory.book || when ? (
                <p className="mt-2 truncate font-sans text-[11px] tracking-wide opacity-70">
                  {memory.book ? (
                    <Link href={`/book/${memory.book.slug}`} className="hover:underline">
                      {memory.book.title}
                    </Link>
                  ) : null}
                  {memory.book && when ? ` · ${when}` : when}
                </p>
              ) : null}
            </div>
          </>
        )}
      </div>
    </article>
  );
}
