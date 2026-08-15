"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  Crown,
  Loader2,
  LogOut,
  Palette,
  Search,
  Sparkles,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useMood } from "@/components/mood/MoodProvider";
import { MOODS, MOOD_MAP, isMoodId, type MoodId } from "@/lib/moods";
import { ClubChat } from "@/components/clubs/ClubChat";
import { ClubProgress } from "@/components/clubs/ClubProgress";
import type { ClubBookLite, ClubMember, ClubSummary } from "@/lib/clubs";

type ClubDetail = {
  club: ClubSummary;
  shelf: ClubBookLite[];
  members: ClubMember[];
  viewer: {
    isMember: boolean;
    isOwner: boolean;
    inAnotherClub: boolean;
    signedIn: boolean;
  };
};

export default function ClubRoomPage() {
  const params = useParams<{ slug: string }>();
  const slug = String(params?.slug ?? "");
  const router = useRouter();
  const { data: session, status } = useSession();
  const { ownMood, previewMood, setOwnMood } = useMood();
  const myUsername = session?.user?.username ?? "";
  const myUserId = session?.user?.id ?? "";

  const [data, setData] = useState<ClubDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [askMood, setAskMood] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(true);
  /** Bumped after a progress update so the room pulls the new event in. */
  const [progressKey, setProgressKey] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch(`/api/clubs/${slug}`, { cache: "no-store" });
    if (!res.ok) {
      setData(null);
      setLoading(false);
      return;
    }
    setData((await res.json()) as ClubDetail);
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const clubMood: "" | MoodId = isMoodId(data?.club.mood) ? data.club.mood : "";

  /**
   * Wear the club's mood while the room is open, then hand the app back to the
   * reader's own mood — same contract the profile page uses.
   */
  useEffect(() => {
    previewMood(clubMood || null);
    return () => previewMood(null);
  }, [clubMood, previewMood]);

  async function join() {
    if (status !== "authenticated") {
      router.push("/login");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/clubs/${slug}/membership`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Could not join.");
        return;
      }
      await load();
      if (clubMood) setAskMood(true);
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/clubs/${slug}/membership`, {
        method: "DELETE",
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Could not leave.");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function adoptMood() {
    if (!clubMood) return;
    setOwnMood(clubMood);
    setAskMood(false);
    await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mood: clubMood }),
    }).catch(() => {});
  }

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-4xl px-2 py-10 sm:px-4">
        <div className="h-6 w-48 rounded skeleton-shimmer" />
        <div className="mt-4 h-40 rounded-2xl skeleton-shimmer" />
        <div className="mt-3 h-80 rounded-2xl skeleton-shimmer" />
      </section>
    );
  }

  if (!data) {
    return (
      <section className="mx-auto w-full max-w-4xl px-4 py-16 text-center">
        <h1 className="font-display text-xl font-bold">Club not found</h1>
        <p className="mt-1 text-sm text-muted">
          This club may have been removed.
        </p>
        <Link
          href="/clubs"
          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold hover:bg-hover"
        >
          <ArrowLeft size={13} aria-hidden /> Browse clubs
        </Link>
      </section>
    );
  }

  const { club, shelf, members, viewer } = data;
  const showMoodNotice = clubMood && !viewer.isOwner && noticeOpen;

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-2 pb-12 pt-4 sm:px-4">
      <Link
        href="/clubs"
        className="inline-flex w-fit items-center gap-1.5 text-[12px] font-semibold text-muted transition hover:text-foreground"
      >
        <ArrowLeft size={13} aria-hidden /> All clubs
      </Link>

      {showMoodNotice ? (
        <div className="flex items-start gap-2.5 rounded-2xl border border-border bg-card px-4 py-3">
          <Palette
            size={15}
            aria-hidden
            className="mt-0.5 shrink-0 text-[var(--brand-1)]"
          />
          <p className="flex-1 text-[12.5px] leading-snug text-muted">
            <span className="font-semibold text-foreground">{club.name}</span> is
            in a {MOOD_MAP[clubMood as MoodId].emoji}{" "}
            {MOOD_MAP[clubMood as MoodId].label} mood, so the colours around you
            have shifted to match. They&apos;ll go back when you leave the room.
          </p>
          <button
            type="button"
            onClick={() => setNoticeOpen(false)}
            aria-label="Dismiss"
            className="shrink-0 rounded-full p-1 text-muted transition hover:bg-hover hover:text-foreground"
          >
            <X size={14} aria-hidden />
          </button>
        </div>
      ) : null}

      {/* ── Header + top rack ─────────────────────────────────────────────── */}
      <header className="overflow-hidden rounded-3xl border border-border bg-card">
        {/* A splash of the club's colours, tinted by the book it's reading. */}
        <div
          className="relative h-24 sm:h-28"
          style={{ background: "var(--gradient-brand)" }}
        >
          {club.currentBook?.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={club.currentBook.thumbnail.replace(/^http:/, "https:")}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-xl"
            />
          ) : null}
          <span
            aria-hidden
            className="absolute -left-6 -top-8 h-28 w-28 rounded-full bg-white/20 blur-2xl"
          />
          <span
            aria-hidden
            className="absolute right-6 top-2 h-20 w-20 rounded-full bg-black/10 blur-2xl"
          />
          {clubMood ? (
            <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
              <span aria-hidden>{MOOD_MAP[clubMood as MoodId].emoji}</span>
              {MOOD_MAP[clubMood as MoodId].label}
            </span>
          ) : null}
        </div>

        {/* `relative` matters: the banner above is positioned, so without it
            the cover paints underneath the banner instead of over it. */}
        <div className="relative px-4 pb-4 sm:px-5 sm:pb-5">
          {/* Cover overlaps the band, the way a profile avatar does. */}
          <div className="-mt-12 flex items-end gap-3 sm:-mt-14">
            <div className="h-[96px] w-[66px] shrink-0 overflow-hidden rounded-lg bg-pill shadow-lg ring-4 ring-card sm:h-[116px] sm:w-[80px]">
              {club.currentBook?.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={club.currentBook.thumbnail.replace(/^http:/, "https:")}
                  alt={club.currentBook.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-muted">
                  <BookOpen size={22} aria-hidden />
                </span>
              )}
            </div>
            <MemberStack members={members} total={club.memberCount} />
          </div>

          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                <Users size={11} aria-hidden />
                {club.memberCount}{" "}
                {club.memberCount === 1 ? "member" : "members"}
                {!club.active ? " · inactive" : ""}
              </p>
              <h1 className="mt-1 break-words font-display text-xl font-bold sm:text-2xl">
                {club.name}
              </h1>
              {club.tagline ? (
                <p className="mt-1 max-w-prose text-[13px] text-muted">
                  {club.tagline}
                </p>
              ) : null}
              {club.owner ? (
                <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted">
                  <Crown size={11} aria-hidden className="text-amber-500" />
                  run by{" "}
                  <Link
                    href={`/profile/${club.owner.username}`}
                    className="font-semibold hover:underline"
                  >
                    {club.owner.name}
                  </Link>
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {viewer.isOwner ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-pill px-3 py-1.5 text-[11px] font-semibold text-muted">
                  <Crown size={12} aria-hidden /> You own this
                </span>
              ) : viewer.isMember ? (
                <button
                  type="button"
                  onClick={() => void leave()}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold transition hover:bg-hover disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 size={13} className="animate-spin" aria-hidden />
                  ) : (
                    <LogOut size={13} aria-hidden />
                  )}
                  Leave club
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void join()}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white shadow-[var(--shadow-pop)] transition active:translate-y-px disabled:opacity-50"
                  style={{ background: "var(--gradient-brand)" }}
                >
                  {busy ? (
                    <Loader2 size={13} className="animate-spin" aria-hidden />
                  ) : (
                    <UserPlus size={13} aria-hidden />
                  )}
                  Join club
                </button>
              )}
            </div>
          </div>

          {error ? (
            <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-[12px] text-red-600 dark:text-red-300">
              {error}
            </p>
          ) : null}

          {/* Top rack — exactly one book. The cover is up on the banner, so
            this is just the title line. */}
          <div className="mt-3.5 rounded-xl bg-pill/50 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
              📖 On the rack
            </p>
            {club.currentBook ? (
              <p className="mt-0.5 truncate text-[14.5px] font-bold">
                <Link
                  href={`/book/${club.currentBook.slug}`}
                  className="hover:underline"
                >
                  {club.currentBook.title}
                </Link>
                <span className="ml-1.5 text-[12px] font-normal text-muted">
                  {club.currentBook.authors.split(/[,;]/)[0]}
                </span>
              </p>
            ) : (
              <p className="mt-0.5 text-[13px] text-muted">
                {viewer.isOwner
                  ? "Pick the book your club is reading."
                  : "The owner hasn't set a book yet."}
              </p>
            )}
          </div>

          {/* Members can take the club's palette with them. Inside the room
            everyone already sees it; this makes it stick everywhere else. */}
          {viewer.isMember && clubMood ? (
            ownMood === clubMood ? (
              <p className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] text-muted">
                <Check size={12} aria-hidden className="text-[var(--brand-1)]" />
                You&apos;re wearing this club&apos;s mood everywhere.
              </p>
            ) : (
              <button
                type="button"
                onClick={() => void adoptMood()}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11.5px] font-semibold transition hover:bg-hover"
                title={`Set ${MOOD_MAP[clubMood as MoodId].label} as your own mood`}
              >
                <Palette size={12} aria-hidden className="text-[var(--brand-1)]" />
                Use this mood as mine
              </button>
            )
          ) : null}
        </div>
      </header>

      {/* ── The room: chat on the left, everyone's progress on the right ──── */}
      <div className="grid items-start gap-4 lg:grid-cols-10">
        <div className="min-w-0 lg:col-span-7">
          <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            💬 Club room
          </h2>
          <ClubChat
            slug={slug}
            canPost={viewer.isMember}
            signedIn={status === "authenticated"}
            refreshKey={progressKey}
            heightClass="h-[32rem] max-h-[32rem]"
          />
          {!viewer.isMember && viewer.inAnotherClub ? (
            <p className="mt-2 px-1 text-[11px] text-muted">
              You&apos;re in another club. Leave it first if you want to join this
              conversation.
            </p>
          ) : null}
        </div>

        {members.length ? (
          <aside className="min-w-0 lg:col-span-3">
            <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              🏁 Reading together
            </h2>
            <ClubProgress
              slug={slug}
              members={members}
              myUserId={myUserId}
              myUsername={myUsername}
              isMember={viewer.isMember}
              hasBook={Boolean(club.currentBook)}
              onChanged={(next, opts) => {
                setData((d) => (d ? { ...d, members: next } : d));
                // Only re-pull the room when a new progress event was written.
                if (opts?.changed) setProgressKey((k) => k + 1);
              }}
            />
          </aside>
        ) : null}
      </div>

      {viewer.isOwner ? (
        <OwnerPanel club={club} onChanged={load} />
      ) : null}

      {shelf.length ? (
        <div>
          <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            Club shelf · already read
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {shelf.map((b) => (
              <Link
                key={b.id}
                href={`/book/${b.slug}`}
                title={b.title}
                className="w-[62px] shrink-0"
              >
                <div className="h-[92px] w-full overflow-hidden rounded-md bg-pill ring-1 ring-border/70">
                  {b.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={b.thumbnail.replace(/^http:/, "https:")}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <p className="mt-1 line-clamp-2 text-[10px] leading-tight text-muted">
                  {b.title}
                </p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {askMood && clubMood ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-3xl border border-border bg-background p-5 shadow-[var(--shadow-pop)]">
            <h2 className="font-display text-lg font-bold">
              Wear the club&apos;s mood?
            </h2>
            <p className="mt-1 text-[13px] text-muted">
              {club.name} reads in a {MOOD_MAP[clubMood as MoodId].emoji}{" "}
              {MOOD_MAP[clubMood as MoodId].label} mood. Set it as yours and the
              app keeps these colours everywhere, including your profile.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => void adoptMood()}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white shadow-[var(--shadow-pop)]"
                style={{ background: "var(--gradient-brand)" }}
              >
                <Check size={13} aria-hidden /> Yes, set it
              </button>
              <button
                type="button"
                onClick={() => setAskMood(false)}
                className="rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold hover:bg-hover"
              >
                No thanks
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** Overlapping member avatars — a quick read on how busy the club is. */
function MemberStack({
  members,
  total,
}: {
  members: ClubMember[];
  total: number;
}) {
  const shown = members.slice(0, 5);
  const extra = Math.max(0, total - shown.length);
  if (!shown.length) return null;

  return (
    <div className="flex items-center gap-2 pb-1">
      <div className="flex -space-x-2">
        {shown.map((m) => (
          <Link
            key={m.username}
            href={`/profile/${m.username}`}
            title={m.name}
            className="transition hover:-translate-y-0.5"
          >
            {m.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={m.image}
                alt={m.name}
                loading="lazy"
                className="h-7 w-7 rounded-full object-cover ring-2 ring-card"
              />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-pill text-[10px] font-bold text-muted ring-2 ring-card">
                {m.name.slice(0, 1).toUpperCase()}
              </span>
            )}
          </Link>
        ))}
      </div>
      {extra > 0 ? (
        <span className="text-[11px] font-semibold text-muted">+{extra}</span>
      ) : null}
    </div>
  );
}

/** Owner-only controls: the book on the rack, the club mood, active flag. */
function OwnerPanel({
  club,
  onChanged,
}: {
  club: ClubSummary;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/clubs/${club.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save.");
        return;
      }
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/60 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
        🎛️ Club control room
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPicking((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-semibold transition hover:bg-hover"
        >
          <BookOpen size={12} aria-hidden />
          {club.currentBook ? "Change book" : "Set the book"}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => void patch({ active: !club.active })}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-semibold transition hover:bg-hover disabled:opacity-50"
          title={
            club.active
              ? "Hide from the clubs list and free yourself to join another club"
              : "Show in the clubs list again"
          }
        >
          <Sparkles size={12} aria-hidden />
          {club.active ? "Mark inactive" : "Mark active"}
        </button>
      </div>

      <label className="mt-3 block text-[11px] font-semibold text-muted">
        Club mood — re-themes the room for everyone who visits
      </label>
      <select
        value={club.mood}
        disabled={busy}
        onChange={(e) => void patch({ mood: e.target.value })}
        className="mt-1 w-full max-w-xs rounded-xl border border-border bg-card px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[var(--ring)]/60"
      >
        <option value="">No mood</option>
        {MOODS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.emoji} {m.label}
          </option>
        ))}
      </select>

      {picking ? (
        <BookPicker
          onPick={async (bookId) => {
            setPicking(false);
            await patch({ currentBookId: bookId });
          }}
          onClose={() => setPicking(false)}
        />
      ) : null}

      {error ? (
        <p className="mt-2 text-[12px] text-red-500 dark:text-red-400">{error}</p>
      ) : null}
      <p className="mt-2 text-[11px] text-muted">
        Swapping the book files the current one on the club shelf and resets
        everyone&apos;s reading progress to 0%.
      </p>
    </div>
  );
}

type BookHit = { id: string; title: string; authors?: string; thumbnail?: string };

/** Minimal in-library search so the owner can put a book on the rack. */
function BookPicker({
  onPick,
  onClose,
}: {
  onPick: (bookId: string) => void | Promise<void>;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<BookHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q.trim()) {
      setHits([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/books?q=${encodeURIComponent(q.trim())}&limit=8`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = (await res.json()) as { books?: BookHit[] };
        if (!cancelled) setHits(data.books ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <div className="mt-3 rounded-xl border border-border bg-background p-3">
      <div className="flex items-center gap-2">
        <Search size={14} aria-hidden className="shrink-0 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
          placeholder="Search our library…"
          className="w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-muted/70"
        />
        {loading ? (
          <Loader2 size={13} className="animate-spin text-muted" aria-hidden />
        ) : null}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close book picker"
          className="rounded-full p-1 text-muted hover:bg-hover"
        >
          <X size={13} aria-hidden />
        </button>
      </div>

      {hits.length ? (
        <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
          {hits.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => void onPick(b.id)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-hover"
              >
                <span className="h-10 w-7 shrink-0 overflow-hidden rounded bg-pill">
                  {b.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={b.thumbnail.replace(/^http:/, "https:")}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-semibold">
                    {b.title}
                  </span>
                  <span className="block truncate text-[11px] text-muted">
                    {(b.authors ?? "").split(/[,;]/)[0]}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : q.trim() && !loading ? (
        <p className="mt-2 text-[12px] text-muted">
          Nothing found. Add the book from Explore first.
        </p>
      ) : null}
    </div>
  );
}
