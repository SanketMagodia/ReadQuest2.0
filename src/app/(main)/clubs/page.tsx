"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useSession } from "next-auth/react";
import {
  BookOpen,
  Crown,
  Loader2,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { BRAND_NAME } from "@/lib/brand";
import { MOOD_MAP, isMoodId } from "@/lib/moods";
import type { ClubSummary } from "@/lib/clubs";

export default function ClubsPage() {
  const router = useRouter();
  const { status } = useSession();
  const signedIn = status === "authenticated";

  const [q, setQ] = useState("");
  const [clubs, setClubs] = useState<ClubSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [myClub, setMyClub] = useState<ClubSummary | null>(null);
  const [myRole, setMyRole] = useState<"owner" | "member" | null>(null);
  const [creating, setCreating] = useState(false);

  const loadClubs = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      const res = await fetch(`/api/clubs?${params}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { clubs?: ClubSummary[] };
      setClubs(data.clubs ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMine = useCallback(async () => {
    if (!signedIn) {
      setMyClub(null);
      setMyRole(null);
      return;
    }
    const res = await fetch("/api/clubs/me", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as {
      club: ClubSummary | null;
      role: "owner" | "member" | null;
    };
    setMyClub(data.club);
    setMyRole(data.role);
  }, [signedIn]);

  useEffect(() => {
    void loadMine();
  }, [loadMine]);

  // Debounced search.
  useEffect(() => {
    const t = setTimeout(() => void loadClubs(q), 260);
    return () => clearTimeout(t);
  }, [q, loadClubs]);

  const others = clubs.filter((c) => c.id !== myClub?.id);

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-2 pb-12 sm:px-4">
      <Reveal>
        <header className="pt-6 sm:pt-8">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            <Users size={13} aria-hidden className="text-[var(--brand-1)]" />
            Reading clubs
          </p>
          <h1 className="mt-1.5 font-display text-2xl font-bold sm:text-[32px]">
            Read one book together
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted">
            A club reads a single book at a time and talks about it in one room.
            You can be in one club at a time — pick the room that sounds like
            your kind of conversation.
          </p>
        </header>
      </Reveal>

      {myClub ? (
        <Reveal>
          <MyClubCard club={myClub} role={myRole} />
        </Reveal>
      ) : null}

      <Reveal>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              size={16}
              aria-hidden
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search clubs…"
              aria-label="Search clubs"
              className="w-full rounded-full border border-border bg-card py-3 pl-11 pr-4 text-[14px] outline-none placeholder:text-muted/70 focus:ring-2 focus:ring-[var(--ring)]/60"
            />
          </div>
          {!myClub ? (
            <button
              type="button"
              onClick={() =>
                signedIn ? setCreating(true) : router.push("/login")
              }
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-3 text-xs font-semibold text-white shadow-[var(--shadow-pop)] transition active:translate-y-px"
              style={{ background: "var(--gradient-brand)" }}
            >
              <Plus size={14} aria-hidden />
              Start a club
            </button>
          ) : null}
        </div>
      </Reveal>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="h-[132px] rounded-2xl border border-border bg-card p-4"
            >
              <div className="h-3 w-1/2 rounded skeleton-shimmer" />
              <div className="mt-2 h-3 w-3/4 rounded skeleton-shimmer" />
              <div className="mt-6 h-3 w-1/3 rounded skeleton-shimmer" />
            </div>
          ))}
        </div>
      ) : others.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/60 px-4 py-10 text-center text-sm text-muted">
          {q.trim()
            ? `No active clubs match “${q.trim()}”.`
            : `No active clubs yet. Start the first one on ${BRAND_NAME}.`}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {others.map((c) => (
            <ClubCard key={c.id} club={c} />
          ))}
        </div>
      )}

      {creating ? (
        <CreateClubDialog
          onClose={() => setCreating(false)}
          onCreated={(slug) => router.push(`/clubs/${slug}`)}
        />
      ) : null}
    </section>
  );
}

function MyClubCard({
  club,
  role,
}: {
  club: ClubSummary;
  role: "owner" | "member" | null;
}) {
  return (
    <Link
      href={`/clubs/${club.slug}`}
      className="group block rounded-2xl border border-[var(--brand-1)]/40 bg-[color-mix(in_srgb,var(--brand-1)_7%,var(--card))] p-4 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
    >
      <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--brand-1)]">
        {role === "owner" ? (
          <>
            <Crown size={11} aria-hidden /> Your club
          </>
        ) : (
          <>
            You&apos;re in this club
          </>
        )}
      </p>
      <div className="mt-1.5 flex items-start gap-3">
        {club.currentBook?.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={club.currentBook.thumbnail.replace(/^http:/, "https:")}
            alt=""
            className="h-[68px] w-[46px] shrink-0 rounded-md object-cover ring-1 ring-border/70"
          />
        ) : null}
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-bold">{club.name}</h2>
          {club.currentBook ? (
            <p className="mt-0.5 truncate text-[12px] text-muted">
              Reading {club.currentBook.title}
            </p>
          ) : (
            <p className="mt-0.5 text-[12px] text-muted">
              No book on the rack yet
            </p>
          )}
          <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted">
            <Users size={11} aria-hidden />
            {club.memberCount} {club.memberCount === 1 ? "member" : "members"}
            {!club.active ? " · inactive" : ""}
          </p>
        </div>
      </div>
    </Link>
  );
}

function ClubCard({ club }: { club: ClubSummary }) {
  const mood = club.mood && isMoodId(club.mood) ? MOOD_MAP[club.mood] : null;
  return (
    <Link
      href={`/clubs/${club.slug}`}
      className="group relative flex gap-3 overflow-hidden rounded-2xl border border-border bg-card p-4 pl-5 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      {/* Each club wears its own mood colours down the spine. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1.5"
        style={{
          background: mood
            ? `linear-gradient(180deg, ${mood.swatch[0]}, ${mood.swatch[1]})`
            : "var(--gradient-brand)",
        }}
      />
      <div className="h-[84px] w-[56px] shrink-0 overflow-hidden rounded-md bg-pill ring-1 ring-border/70">
        {club.currentBook?.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={club.currentBook.thumbnail.replace(/^http:/, "https:")}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition group-hover:scale-[1.04]"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-muted">
            <BookOpen size={18} aria-hidden />
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <h2 className="flex items-center gap-1.5 truncate text-[15px] font-semibold">
          {mood ? <span aria-hidden>{mood.emoji}</span> : null}
          <span className="truncate">{club.name}</span>
        </h2>
        {club.tagline ? (
          <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-muted">
            {club.tagline}
          </p>
        ) : null}
        {club.currentBook ? (
          <p className="mt-1 line-clamp-1 text-[12px] text-foreground/75">
            Reading <span className="font-semibold">{club.currentBook.title}</span>
          </p>
        ) : null}
        <div className="mt-auto flex items-center gap-3 pt-2 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1">
            <Users size={11} aria-hidden />
            {club.memberCount}
          </span>
          {club.owner ? <span className="truncate">by {club.owner.name}</span> : null}
        </div>
      </div>
    </Link>
  );
}

function CreateClubDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (slug: string) => void;
}) {
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || name.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), tagline: tagline.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        club?: { slug: string };
        error?: string;
      };
      if (!res.ok || !data.club) {
        setError(data.error ?? "Could not start the club.");
        return;
      }
      onCreated(data.club.slug);
    } catch {
      setError("Network hiccup — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Start a club"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => void submit(e)}
        className="w-full max-w-md rounded-t-3xl border border-border bg-background p-5 shadow-[var(--shadow-pop)] sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">Start a club</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              You&apos;ll be its owner. You can set the book and mood next.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-muted transition hover:bg-hover hover:text-foreground"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        <label className="mt-4 block text-[12px] font-semibold" htmlFor="club-name">
          Club name
        </label>
        <input
          id="club-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          autoFocus
          placeholder="The Slow Burn Society"
          className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-[var(--ring)]/60"
        />

        <label
          className="mt-3 block text-[12px] font-semibold"
          htmlFor="club-tagline"
        >
          Tagline <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id="club-tagline"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          maxLength={160}
          placeholder="Long books, slow reading, strong opinions."
          className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-[var(--ring)]/60"
        />

        {error ? (
          <p className="mt-3 text-[12px] text-red-500 dark:text-red-400">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={busy || name.trim().length < 2}
          className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-pop)] transition disabled:opacity-50"
          style={{ background: "var(--gradient-brand)" }}
        >
          {busy ? (
            <Loader2 size={15} className="animate-spin" aria-hidden />
          ) : (
            <Plus size={15} aria-hidden />
          )}
          Create club
        </button>
      </form>
    </div>
  );
}
