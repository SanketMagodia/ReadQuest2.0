"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Bookmark,
  BookmarkCheck,
  BookmarkPlus,
  CheckCircle2,
  Grid3X3,
  Library,
  Pencil,
  CalendarDays,
  Camera,
  Trash2,
  X,
  ArrowLeft,
  ArrowRight,
  Plus,
  Share2,
  Check,
  ChevronRight,
  UserPlus,
  UserCheck,
  Clock,
  MessageCircle,
  Loader2,
  RotateCcw,
  Crown,
  BookOpen,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { MemoryDTO } from "@/lib/memories";
import { MemoryCard } from "@/components/memories/MemoryCard";
import {
  MemoryComposeButton,
  MemoryComposer,
} from "@/components/memories/MemoryComposer";
import {
  ProfileBookGrid,
  type ShelfBook,
} from "@/components/profile/ProfileBookGrid";
import { ShelfLoadingStage } from "@/components/ui/ShelfLoadingStage";
import { Reveal } from "@/components/ui/Reveal";
import { resizeAvatar } from "@/lib/image";
import { useMood } from "@/components/mood/MoodProvider";
import { MoodSwitcher } from "@/components/mood/MoodSwitcher";
import { Moon, Sun, VeiledSun } from "@/components/mood/scenery";
import { useDm } from "@/components/dm/DmProvider";
import { MobileAccountMenu } from "@/components/layout/MobileAccountMenu";
import { trackFriendAction } from "@/lib/analytics-events";
import { MOODS, MOOD_MAP, isMoodId, type MoodId } from "@/lib/moods";
import type { ClubSummary } from "@/lib/clubs";

type PublicUser = {
  id: string;
  username: string;
  name: string;
  image?: string;
  bio: string;
  mood?: string;
  followerCount?: number;
  followingCount?: number;
  createdAt?: string;
};

type ShelfCounts = {
  wantToRead: number;
  read: number;
  following: number;
  recommendations: number;
};

type ReadStatus = "want" | "read";

type RecommendedBook = ShelfBook & { rank: number };

type ShelfModalTab = "want-to-read" | "read" | "following";

function formatJoined(iso?: string) {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

type RelationshipStatus =
  | "self"
  | "none"
  | "incoming_request"
  | "outgoing_request"
  | "friends";

/**
 * Friend + message controls for another reader's profile. Surfaces the same
 * relationship actions as the Friends page, inline in the header:
 *   none → Add friend · outgoing → Requested (cancel) ·
 *   incoming → Accept / Decline · friends → Message + Friends (unfriend).
 * No user-follow model exists in this app — connections are mutual friendships,
 * and messaging unlocks once a request is accepted.
 */
function ProfileConnect({ username }: { username: string }) {
  const { openWithUser } = useDm();
  const [rel, setRel] = useState<RelationshipStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setRel(null);
    fetch(`/api/friends/${encodeURIComponent(username)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { relationship?: RelationshipStatus } | null) => {
        if (alive) setRel(d?.relationship ?? "none");
      })
      .catch(() => {
        if (alive) setRel("none");
      });
    return () => {
      alive = false;
    };
  }, [username]);

  async function addFriend() {
    setBusy(true);
    try {
      const res = await fetch("/api/friends/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      if (res.ok) {
        const d = (await res.json()) as { status?: RelationshipStatus };
        const next = d?.status ?? "outgoing_request";
        // A mutual click auto-accepts on the server (incoming → friends).
        trackFriendAction(next === "friends" ? "accept" : "request");
        setRel(next);
      }
    } finally {
      setBusy(false);
    }
  }

  // DELETE clears any friendship row in either direction, so it serves cancel
  // (outgoing), decline (incoming) and unfriend (friends) with one endpoint.
  async function removeLink(action: "cancel" | "decline" | "remove") {
    if (
      action === "remove" &&
      !confirm(`Remove @${username} from your friends?`)
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/friends/${encodeURIComponent(username)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        trackFriendAction(action);
        setRel("none");
      }
    } finally {
      setBusy(false);
    }
  }

  const pillPrimary =
    "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white shadow-[var(--shadow-pop)] transition active:translate-y-px disabled:opacity-60";
  const pillSecondary =
    "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-muted transition hover:bg-hover hover:text-foreground disabled:opacity-60";

  if (rel === null) {
    return (
      <span className={pillSecondary} aria-hidden>
        <Loader2 size={13} className="animate-spin" />
      </span>
    );
  }

  if (rel === "friends") {
    return (
      <>
        <button
          type="button"
          onClick={() => openWithUser(username)}
          className={pillPrimary}
          style={{ background: "var(--gradient-brand)" }}
        >
          <MessageCircle size={13} aria-hidden /> Message
        </button>
        <button
          type="button"
          onClick={() => void removeLink("remove")}
          disabled={busy}
          className={pillSecondary}
          title="Remove friend"
        >
          {busy ? (
            <Loader2 size={13} className="animate-spin" aria-hidden />
          ) : (
            <UserCheck size={13} aria-hidden />
          )}
          Friends
        </button>
      </>
    );
  }

  if (rel === "outgoing_request") {
    return (
      <button
        type="button"
        onClick={() => void removeLink("cancel")}
        disabled={busy}
        className={pillSecondary}
        title="Cancel friend request"
      >
        {busy ? (
          <Loader2 size={13} className="animate-spin" aria-hidden />
        ) : (
          <Clock size={13} aria-hidden />
        )}
        Requested
      </button>
    );
  }

  if (rel === "incoming_request") {
    return (
      <>
        <button
          type="button"
          onClick={() => void addFriend()}
          disabled={busy}
          className={pillPrimary}
          style={{ background: "var(--gradient-brand)" }}
        >
          {busy ? (
            <Loader2 size={13} className="animate-spin" aria-hidden />
          ) : (
            <Check size={13} aria-hidden />
          )}
          Accept
        </button>
        <button
          type="button"
          onClick={() => void removeLink("decline")}
          disabled={busy}
          className={pillSecondary}
        >
          <X size={13} aria-hidden /> Decline
        </button>
      </>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void addFriend()}
      disabled={busy}
      className={pillPrimary}
      style={{ background: "var(--gradient-brand)" }}
    >
      {busy ? (
        <Loader2 size={13} className="animate-spin" aria-hidden />
      ) : (
        <UserPlus size={13} aria-hidden />
      )}
      Add friend
    </button>
  );
}

const PILL_PRIMARY =
  "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white shadow-[var(--shadow-pop)] transition active:translate-y-px disabled:opacity-60";
const PILL_SECONDARY =
  "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-muted transition hover:bg-hover hover:text-foreground disabled:opacity-60";

type PersonRow = {
  id: string;
  username: string;
  name: string;
  image?: string | null;
  bio?: string;
  isFollowing: boolean;
  isSelf: boolean;
};

/**
 * Followers / Following list for a profile. Each reader links to their profile
 * and (for signed-in visitors) carries a follow / unfollow toggle so you can
 * grow your own following list without leaving the sheet.
 */
function PeopleModal({
  username,
  name,
  openTab,
  followers,
  following,
  canFollow,
  onClose,
}: {
  username: string;
  name: string;
  openTab: "followers" | "following";
  followers: number;
  following: number;
  canFollow: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"followers" | "following">(openTab);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setTab(openTab);
  }, [openTab]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setPeople([]);
    fetch(`/api/users/${encodeURIComponent(username)}/${tab}`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { users?: PersonRow[] } | null) => {
        if (alive) setPeople(d?.users ?? []);
      })
      .catch(() => {
        if (alive) setPeople([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [username, tab]);

  async function toggle(row: PersonRow) {
    setBusyId(row.id);
    const next = !row.isFollowing;
    setPeople((prev) =>
      prev.map((p) => (p.id === row.id ? { ...p, isFollowing: next } : p))
    );
    try {
      const res = await fetch(
        `/api/users/${encodeURIComponent(row.username)}/follow`,
        { method: next ? "POST" : "DELETE" }
      );
      if (!res.ok) {
        setPeople((prev) =>
          prev.map((p) =>
            p.id === row.id ? { ...p, isFollowing: !next } : p
          )
        );
      }
    } finally {
      setBusyId(null);
    }
  }

  const tabs: { id: "followers" | "following"; label: string; count: number }[] =
    [
      { id: "followers", label: "Followers", count: followers },
      { id: "following", label: "Following", count: following },
    ];

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/55 backdrop-blur-[1px] sm:items-center sm:justify-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative max-h-[85vh] w-full overflow-hidden rounded-t-3xl border border-border bg-background sm:mx-4 sm:max-w-md sm:rounded-3xl">
        <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="truncate text-sm font-semibold">@{username}</p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-border p-1.5 text-muted transition hover:bg-hover"
              aria-label="Close"
            >
              <X size={14} aria-hidden />
            </button>
          </div>
          <div className="flex border-t border-border/60">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`relative flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-semibold uppercase tracking-wide ${
                  tab === t.id
                    ? "text-foreground"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <span>{t.label}</span>
                <span className="rounded-full bg-pill px-1.5 text-[10px] font-bold leading-4">
                  {t.count}
                </span>
                {tab === t.id ? (
                  <span
                    aria-hidden
                    className="absolute inset-x-3 -bottom-px h-[2px] rounded-full"
                    style={{ background: "var(--gradient-brand)" }}
                  />
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[calc(85vh-92px)] overflow-y-auto p-2 sm:p-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted" aria-hidden />
            </div>
          ) : people.length ? (
            <ul className="divide-y divide-border/70">
              {people.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-2 py-2.5">
                  <Link
                    href={`/profile/${p.username}`}
                    onClick={onClose}
                    className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-pill ring-1 ring-border"
                  >
                    {p.image ? (
                      <Image
                        src={p.image}
                        alt=""
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-xs font-bold text-muted">
                        {(p.name || p.username).slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </Link>
                  <Link
                    href={`/profile/${p.username}`}
                    onClick={onClose}
                    className="min-w-0 flex-1"
                  >
                    <p className="truncate text-sm font-semibold leading-tight hover:underline">
                      {p.name}
                    </p>
                    <p className="truncate text-[12px] text-muted">
                      @{p.username}
                    </p>
                  </Link>
                  {canFollow && !p.isSelf ? (
                    <button
                      type="button"
                      onClick={() => void toggle(p)}
                      disabled={busyId === p.id}
                      className={p.isFollowing ? PILL_SECONDARY : PILL_PRIMARY}
                      style={
                        p.isFollowing
                          ? undefined
                          : { background: "var(--gradient-brand)" }
                      }
                    >
                      {busyId === p.id ? (
                        <Loader2 size={13} className="animate-spin" aria-hidden />
                      ) : p.isFollowing ? (
                        <UserCheck size={13} aria-hidden />
                      ) : (
                        <UserPlus size={13} aria-hidden />
                      )}
                      {p.isFollowing ? "Following" : "Follow"}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-12 text-center text-sm text-muted">
              {tab === "followers"
                ? `No one follows ${name} yet.`
                : `${name} isn't following anyone yet.`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const params = useParams<{ username: string }>();
  const username = typeof params?.username === "string" ? params.username : "";
  const { data: session, status } = useSession();

  const [user, setUser] = useState<PublicUser | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [memories, setMemories] = useState<MemoryDTO[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [wantToRead, setWantToRead] = useState<ShelfBook[]>([]);
  const [readBooks, setReadBooks] = useState<ShelfBook[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendedBook[]>([]);
  const [following, setFollowing] = useState<ShelfBook[]>([]);
  const [counts, setCounts] = useState<ShelfCounts>({
    wantToRead: 0,
    read: 0,
    following: 0,
    recommendations: 0,
  });
  const [shelfModalTab, setShelfModalTab] = useState<ShelfModalTab | null>(null);
  // People-follow state (separate from friend requests): follower/following
  // counts for credibility, whether the viewer follows this profile, and the
  // followers/following list sheet.
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  /** The club this reader belongs to, badged below the header. */
  const [profileClub, setProfileClub] = useState<ClubSummary | null>(null);
  const [profileClubRole, setProfileClubRole] = useState<
    "owner" | "member" | null
  >(null);
  const [iFollow, setIFollow] = useState<boolean | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [peopleTab, setPeopleTab] = useState<"followers" | "following" | null>(
    null
  );
  const [moodNoticeOpen, setMoodNoticeOpen] = useState(true);
  // Viewer's own library state — powers "add to my wishlist" / "follow" actions
  // when browsing someone else's portfolio.
  const [myWantIds, setMyWantIds] = useState<Set<string>>(new Set());
  const [myReadIds, setMyReadIds] = useState<Set<string>>(new Set());
  const [myFollowIds, setMyFollowIds] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [mood, setMood] = useState<"" | MoodId>("");
  const [saving, setSaving] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [gistReset, setGistReset] = useState<"idle" | "confirm" | "busy" | "done">(
    "idle"
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { ownMood, setOwnMood, previewMood } = useMood();

  const isSelf =
    session?.user?.username?.toLowerCase() === username.toLowerCase();
  const isVisitor = Boolean(session?.user?.id) && !isSelf;

  // The mood this profile radiates (falls back to none for unknown values).
  const profileMood: "" | MoodId = isMoodId(user?.mood) ? user.mood : "";

  // Someone else's profile borrows their mood for the visit. Your own profile
  // must not: the sidebar mood picker writes `ownMood`, and a preview of the
  // saved mood would sit on top of it and ignore the change.
  useEffect(() => {
    if (isSelf) {
      previewMood(null);
      return;
    }
    previewMood(profileMood || null);
    return () => previewMood(null);
  }, [isSelf, profileMood, previewMood]);

  // The sidebar picker updates ownMood directly. Follow it once a real mood
  // has arrived, so the empty value during load doesn't wipe the chip or the
  // Top Shelf scene (both read the profile mood).
  const moodSeen = useRef(false);
  useEffect(() => {
    if (!isSelf) return;
    if (isMoodId(ownMood)) moodSeen.current = true;
    else if (!moodSeen.current) return;
    const next: "" | MoodId = isMoodId(ownMood) ? ownMood : "";
    setMood(next);
    setUser((u) => (u && u.mood !== next ? { ...u, mood: next } : u));
  }, [isSelf, ownMood]);

  // Re-show the "why did the theme change" notice each time you open a new
  // reader's profile.
  useEffect(() => {
    setMoodNoticeOpen(true);
  }, [username]);

  // Load the visitor's own wishlist/read/follow state so shelf actions show
  // the right initial state ("already on your shelf", "following", …).
  useEffect(() => {
    if (!isVisitor) {
      setIFollow(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const [rl, fl, uf] = await Promise.all([
        fetch("/api/readlist", { cache: "no-store" }),
        fetch("/api/follows/book", { cache: "no-store" }),
        fetch(`/api/users/${encodeURIComponent(username)}/follow`, {
          cache: "no-store",
        }),
      ]);
      if (cancelled) return;
      if (rl.ok) {
        const j = (await rl.json()) as {
          books?: { id: string; status: "want" | "read" }[];
        };
        const rows = j.books ?? [];
        setMyWantIds(new Set(rows.filter((b) => b.status === "want").map((b) => b.id)));
        setMyReadIds(new Set(rows.filter((b) => b.status === "read").map((b) => b.id)));
      }
      if (fl.ok) {
        const j = (await fl.json()) as { bookIds?: string[] };
        setMyFollowIds(new Set(j.bookIds ?? []));
      }
      if (uf.ok) {
        const j = (await uf.json()) as {
          following?: boolean;
          followers?: number;
          followingCount?: number;
        };
        setIFollow(Boolean(j.following));
        if (typeof j.followers === "number") setFollowerCount(j.followers);
        if (typeof j.followingCount === "number")
          setFollowingCount(j.followingCount);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isVisitor, username]);

  // Memories are private, so they're only ever fetched for your own profile —
  // the API would refuse anyway, but not asking keeps visitor loads lighter.
  useEffect(() => {
    if (!isSelf) {
      setMemories([]);
      setMemoriesLoading(false);
      return;
    }
    let cancelled = false;
    setMemoriesLoading(true);
    void (async () => {
      try {
        const res = await fetch("/api/memories", { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as { memories?: MemoryDTO[] };
        if (!cancelled) setMemories(j.memories ?? []);
      } finally {
        if (!cancelled) setMemoriesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSelf, username]);

  useEffect(() => {
    async function load() {
      const [ru, rs] = await Promise.all([
        fetch(`/api/users/${encodeURIComponent(username)}`, { cache: "no-store" }),
        fetch(`/api/users/${encodeURIComponent(username)}/shelf`, {
          cache: "no-store",
        }),
      ]);
      const ujson = ru.ok ? await ru.json() : null;
      const shelf = rs.ok
        ? ((await rs.json()) as {
            counts?: ShelfCounts;
            wantToRead?: ShelfBook[];
            read?: ShelfBook[];
            recommendations?: RecommendedBook[];
            following?: ShelfBook[];
          })
        : null;

      const udoc =
        ujson && "user" in ujson ? (ujson as { user: PublicUser }).user : null;

      const cjson = ujson as {
        club?: ClubSummary | null;
        clubRole?: "owner" | "member" | null;
      } | null;
      setProfileClub(cjson?.club ?? null);
      setProfileClubRole(cjson?.clubRole ?? null);
      setUser(udoc);
      setBio(udoc?.bio ?? "");
      setName(udoc?.name ?? "");
      setImage(udoc?.image ?? "");
      setMood(isMoodId(udoc?.mood) ? udoc.mood : "");
      setFollowerCount(udoc?.followerCount ?? 0);
      setFollowingCount(udoc?.followingCount ?? 0);
      setWantToRead(shelf?.wantToRead ?? []);
      setReadBooks(shelf?.read ?? []);
      setRecommendations(
        (shelf?.recommendations ?? []).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
      );
      setFollowing(shelf?.following ?? []);
      setCounts(
        shelf?.counts ?? {
          wantToRead: shelf?.wantToRead?.length ?? 0,
          read: shelf?.read?.length ?? 0,
          following: shelf?.following?.length ?? 0,
          recommendations: shelf?.recommendations?.length ?? 0,
        }
      );
      setLoadedOnce(true);
    }
    void load();
  }, [username]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload: Record<string, unknown> = { bio, name };
    if (image === "") payload.image = ""; // explicit clear
    else if (image && image !== user?.image) payload.image = image;

    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const ru = await fetch(`/api/users/${encodeURIComponent(username)}`, {
        cache: "no-store",
      });
      if (ru.ok) {
        const ujson = (await ru.json()) as { user?: PublicUser };
        if (ujson.user) setUser(ujson.user);
      }
      setEditing(false);
    }
    setSaving(false);
  }

  // Mood lives outside the edit form (it's changed often) and saves instantly,
  // re-theming the whole app right away.
  async function saveMood(next: "" | MoodId) {
    const prev = mood;
    setMood(next);
    setOwnMood(next);
    previewMood(next || null);
    setUser((u) => (u ? { ...u, mood: next } : u));
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mood: next }),
    });
    if (!res.ok) {
      setMood(prev);
      setOwnMood(prev);
      previewMood(prev || null);
      setUser((u) => (u ? { ...u, mood: prev } : u));
    }
  }

  async function handlePickFile(file?: File | null) {
    setImageError(null);
    if (!file) return;
    setImageBusy(true);
    try {
      const result = await resizeAvatar(file);
      setImage(result.dataUrl);
    } catch (e) {
      setImageError(
        e instanceof Error ? e.message : "Could not load that image."
      );
    } finally {
      setImageBusy(false);
    }
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  async function resetGistHistory() {
    if (gistReset === "busy") return;
    setGistReset("busy");
    try {
      const res = await fetch("/api/reel", { method: "DELETE" });
      if (!res.ok) {
        setGistReset("idle");
        return;
      }
      setGistReset("done");
      window.setTimeout(() => setGistReset("idle"), 2500);
    } catch {
      setGistReset("idle");
    }
  }

  // Follow / unfollow this profile (one-directional; no acceptance needed).
  async function toggleFollowUser() {
    if (iFollow === null || followBusy) return;
    const next = !iFollow;
    setIFollow(next);
    setFollowerCount((c) => Math.max(0, c + (next ? 1 : -1)));
    setFollowBusy(true);
    try {
      const res = await fetch(
        `/api/users/${encodeURIComponent(username)}/follow`,
        { method: next ? "POST" : "DELETE" }
      );
      if (!res.ok) {
        setIFollow(!next);
        setFollowerCount((c) => Math.max(0, c + (next ? -1 : 1)));
        return;
      }
      const d = (await res.json().catch(() => null)) as {
        followers?: number;
      } | null;
      if (d && typeof d.followers === "number") setFollowerCount(d.followers);
    } finally {
      setFollowBusy(false);
    }
  }

  async function updateShelfStatus(bookId: string, status: ReadStatus) {
    const prevWant = wantToRead;
    const prevRead = readBooks;
    if (status === "read") {
      setWantToRead((prev) => prev.filter((b) => b.id !== bookId));
      const moved = prevWant.find((b) => b.id === bookId);
      if (moved) setReadBooks((prev) => [moved, ...prev.filter((b) => b.id !== bookId)]);
    } else {
      setReadBooks((prev) => prev.filter((b) => b.id !== bookId));
      const moved = prevRead.find((b) => b.id === bookId);
      if (moved) setWantToRead((prev) => [moved, ...prev.filter((b) => b.id !== bookId)]);
      if (recommendations.some((r) => r.id === bookId)) {
        void removeRecommendation(bookId);
      }
    }
    try {
      const res = await fetch("/api/readlist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId, status }),
      });
      if (!res.ok) throw new Error("Failed");
      setCounts((c) => ({
        ...c,
        wantToRead: status === "read" ? Math.max(0, c.wantToRead - 1) : c.wantToRead + 1,
        read: status === "read" ? c.read + 1 : Math.max(0, c.read - 1),
      }));
    } catch {
      setWantToRead(prevWant);
      setReadBooks(prevRead);
    }
  }

  // Move a book from Wishlist into "Currently reading": follow the book and
  // drop it from the wishlist so it flows Wishlist → Currently reading → Read.
  async function startReading(book: ShelfBook) {
    if (!isSelf) return;
    const prevWant = wantToRead;
    const prevFollowing = following;
    setWantToRead((prev) => prev.filter((b) => b.id !== book.id));
    setFollowing((prev) => [book, ...prev.filter((b) => b.id !== book.id)]);
    setCounts((c) => ({
      ...c,
      wantToRead: Math.max(0, c.wantToRead - 1),
      following: c.following + 1,
    }));
    try {
      const [r1, r2] = await Promise.all([
        fetch("/api/follows/book", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookId: book.id }),
        }),
        fetch(`/api/readlist?bookId=${encodeURIComponent(book.id)}`, {
          method: "DELETE",
        }),
      ]);
      if (!r1.ok || !r2.ok) throw new Error("Failed");
    } catch {
      setWantToRead(prevWant);
      setFollowing(prevFollowing);
      setCounts((c) => ({
        ...c,
        wantToRead: c.wantToRead + 1,
        following: Math.max(0, c.following - 1),
      }));
    }
  }

  // Move a book from "Currently reading" onto the Read shelf: mark it read and
  // drop the follow so it leaves the currently-reading row.
  async function finishReading(book: ShelfBook) {
    if (!isSelf) return;
    const prevFollowing = following;
    const prevRead = readBooks;
    setFollowing((prev) => prev.filter((b) => b.id !== book.id));
    setReadBooks((prev) => [book, ...prev.filter((b) => b.id !== book.id)]);
    setCounts((c) => ({
      ...c,
      following: Math.max(0, c.following - 1),
      read: c.read + 1,
    }));
    try {
      const [r1, r2] = await Promise.all([
        fetch("/api/readlist", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookId: book.id, status: "read" }),
        }),
        fetch(`/api/follows/book?bookId=${encodeURIComponent(book.id)}`, {
          method: "DELETE",
        }),
      ]);
      if (!r1.ok || !r2.ok) throw new Error("Failed");
    } catch {
      setFollowing(prevFollowing);
      setReadBooks(prevRead);
      setCounts((c) => ({
        ...c,
        following: c.following + 1,
        read: Math.max(0, c.read - 1),
      }));
    }
  }

  async function addRecommendation(bookId: string) {
    if (!isSelf) return;
    const res = await fetch("/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId }),
    });
    if (!res.ok) return;
    const source = readBooks.find((b) => b.id === bookId);
    if (!source) return;
    setRecommendations((prev) => [...prev, { ...source, rank: prev.length + 1 }]);
    setCounts((c) => ({ ...c, recommendations: c.recommendations + 1 }));
  }

  async function removeRecommendation(bookId: string) {
    if (!isSelf) return;
    const prev = recommendations;
    const next = prev
      .filter((b) => b.id !== bookId)
      .map((b, idx) => ({ ...b, rank: idx + 1 }));
    setRecommendations(next);
    setCounts((c) => ({ ...c, recommendations: Math.max(0, c.recommendations - 1) }));
    const res = await fetch(`/api/recommendations?bookId=${encodeURIComponent(bookId)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setRecommendations(prev);
      setCounts((c) => ({ ...c, recommendations: prev.length }));
    }
  }

  async function moveRecommendation(bookId: string, dir: -1 | 1) {
    const idx = recommendations.findIndex((b) => b.id === bookId);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= recommendations.length) return;
    const next = [...recommendations];
    [next[idx], next[target]] = [next[target], next[idx]];
    const ranked = next.map((b, i) => ({ ...b, rank: i + 1 }));
    setRecommendations(ranked);
    const res = await fetch("/api/recommendations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookIds: ranked.map((b) => b.id) }),
    });
    if (!res.ok) setRecommendations(recommendations);
  }

  async function addToMyWishlist(bookId: string) {
    if (myWantIds.has(bookId) || myReadIds.has(bookId)) return;
    setMyWantIds((prev) => new Set(prev).add(bookId));
    const res = await fetch("/api/readlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId, status: "want" }),
    });
    if (!res.ok) {
      setMyWantIds((prev) => {
        const next = new Set(prev);
        next.delete(bookId);
        return next;
      });
    }
  }

  async function toggleMyFollow(bookId: string) {
    const wasFollowing = myFollowIds.has(bookId);
    setMyFollowIds((prev) => {
      const next = new Set(prev);
      if (wasFollowing) next.delete(bookId);
      else next.add(bookId);
      return next;
    });
    const res = wasFollowing
      ? await fetch(`/api/follows/book?bookId=${encodeURIComponent(bookId)}`, {
          method: "DELETE",
        })
      : await fetch("/api/follows/book", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookId }),
        });
    if (!res.ok) {
      setMyFollowIds((prev) => {
        const next = new Set(prev);
        if (wasFollowing) next.add(bookId);
        else next.delete(bookId);
        return next;
      });
    }
  }

  // Per-book actions shown to logged-in visitors on every shelf: add the book
  // to MY wishlist, or follow it. "compact" = icon buttons under shelf covers,
  // "labeled" = full buttons for the Top Shelf detail card.
  const visitorActions = isVisitor
    ? (b: ShelfBook, variant: "compact" | "labeled" = "compact") => {
        const onMyShelf = myWantIds.has(b.id) || myReadIds.has(b.id);
        const following = myFollowIds.has(b.id);

        if (variant === "labeled") {
          return (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => void addToMyWishlist(b.id)}
                disabled={onMyShelf}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                  onMyShelf
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-border bg-background text-muted hover:bg-hover hover:text-foreground"
                }`}
              >
                {onMyShelf ? (
                  <>
                    <BookmarkCheck size={12} aria-hidden /> On your shelf
                  </>
                ) : (
                  <>
                    <BookmarkPlus size={12} aria-hidden /> Add to wishlist
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => void toggleMyFollow(b.id)}
                aria-pressed={following}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                  following
                    ? "border-sky-400/50 bg-sky-500/15 text-sky-600 dark:text-sky-300"
                    : "border-border bg-background text-muted hover:bg-hover hover:text-foreground"
                }`}
              >
                <Library size={12} aria-hidden />
                {following ? "Reading" : "Currently reading"}
              </button>
            </div>
          );
        }

        return (
          <div className="mt-1.5 flex flex-col gap-1">
            <button
              type="button"
              onClick={() => void addToMyWishlist(b.id)}
              disabled={onMyShelf}
              title={onMyShelf ? "Already on your shelf" : "Add to my wishlist"}
              className={`flex h-6 items-center justify-center gap-1 rounded-md border text-[10px] font-semibold transition ${
                onMyShelf
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-border bg-card text-muted hover:bg-hover hover:text-foreground"
              }`}
            >
              {onMyShelf ? (
                <>
                  <BookmarkCheck size={11} aria-hidden /> Saved
                </>
              ) : (
                <>
                  <BookmarkPlus size={11} aria-hidden /> Wishlist
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => void toggleMyFollow(b.id)}
              title={
                following
                  ? "Remove from currently reading"
                  : "Mark as currently reading"
              }
              aria-pressed={following}
              className={`flex h-6 items-center justify-center gap-1 rounded-md border text-[10px] font-semibold transition ${
                following
                  ? "border-sky-400/50 bg-sky-500/15 text-sky-600 dark:text-sky-300"
                  : "border-border bg-card text-muted hover:bg-hover hover:text-foreground"
              }`}
            >
              <Library size={11} aria-hidden /> Reading
            </button>
          </div>
        );
      }
    : undefined;

  const initials = useMemo(
    () => (user ? user.username.slice(0, 2).toUpperCase() : "RQ"),
    [user]
  );

  // Covers fanned into the banner — the reader's top picks make each profile
  // cover unique. Falls back to read books when there are no recommendations.
  const bannerBooks = useMemo(() => {
    const source = recommendations.length ? recommendations : readBooks;
    return source.filter((b) => b.thumbnail).slice(0, 4);
  }, [recommendations, readBooks]);

  if (!user && !loadedOnce) {
    return (
      <ShelfLoadingStage
        className="min-h-[min(70vh,720px)]"
        lines={[
          "Opening this shelf",
          "The books are finding their places",
          "A reader's room, just a moment",
        ]}
        hint="Loading profile…"
      />
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-lg font-semibold">Profile not found</p>
        <Link
          href="/"
          className="mt-3 inline-flex rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-hover"
        >
          Back to Explore
        </Link>
      </div>
    );
  }

  const joined = formatJoined(user.createdAt);

  // Top Shelf is intentionally omitted here — the shelf itself sits right
  // below, so its count would be redundant in the numbers row.
  const stats: {
    id: string;
    label: string;
    value: number;
  }[] = [
    { id: "read", label: "Read", value: counts.read },
    { id: "wishlist", label: "Wishlist", value: counts.wantToRead },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-2 pb-16 sm:px-4">
      {!isSelf && profileMood && moodNoticeOpen ? (
        <MoodThemeBanner
          mood={profileMood}
          name={(user.name || user.username).split(" ")[0]}
          onDismiss={() => setMoodNoticeOpen(false)}
        />
      ) : null}

      {/* ── Cover banner with the reader's own book covers fanned in ───────── */}
      <div className="relative">
        {/* Account actions live here on phones — the top bar gave up its avatar
            so the bell could sit at the right edge. Kept outside the cover
            below, whose `overflow-hidden` would clip the open menu. */}
        <div className="absolute left-3 top-3 z-30 layout-wide:hidden">
          <MobileAccountMenu trigger="hamburger" />
        </div>

        <div
          className="relative h-36 overflow-hidden rounded-b-[28px] sm:h-48"
          style={{ background: "var(--gradient-brand)" }}
        >
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.35),transparent_55%),radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.25),transparent_55%)]"
          />
          {bannerBooks.length ? (
            <div
              aria-hidden
              className="absolute inset-y-0 right-3 flex items-center sm:right-8"
            >
              {bannerBooks.map((b, i) => (
                <div
                  key={b.id}
                  className="relative h-[88px] w-[60px] shrink-0 overflow-hidden rounded-md shadow-[0_10px_24px_rgba(0,0,0,0.35)] ring-1 ring-white/30 sm:h-[122px] sm:w-[84px]"
                  style={{
                    transform: `rotate(${(i % 2 === 0 ? -1 : 1) * (7 - i * 1.5)}deg) translateY(${i % 2 === 0 ? -4 : 8}px)`,
                    marginLeft: i === 0 ? 0 : "-18px",
                    zIndex: bannerBooks.length - i,
                  }}
                >
                  <Image
                    src={(b.thumbnail || "").replace(/^http:/, "https:")}
                    alt=""
                    fill
                    sizes="84px"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          ) : null}
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/25 to-transparent"
          />
        </div>
      </div>

      {/* ── Identity header ─────────────────────────────────────────────────── */}
      <header className="px-4 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-7">
          <div className="group relative -mt-12 h-24 w-24 shrink-0 overflow-hidden rounded-[26px] border-4 border-background bg-pill shadow-[var(--shadow-soft)] sm:-mt-16 sm:h-32 sm:w-32">
            <AvatarImage src={user.image} initials={initials} />
            {isSelf ? (
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                  openFilePicker();
                }}
                aria-label="Change profile photo"
                className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/60 py-1 text-[10px] font-semibold uppercase tracking-wide text-white transition hover:bg-black/75"
              >
                <Camera size={11} aria-hidden /> Change
              </button>
            ) : null}
          </div>

          <div className="min-w-0 flex-1 pt-1 sm:pt-3">
            {/* Name on the left, actions pinned top-right (wrap below on
                narrow screens) — one glance tells you who + what you can do. */}
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2.5">
              <div className="min-w-0">
                <h1 className="font-display text-2xl font-bold leading-tight sm:text-[32px]">
                  {user.name || `@${user.username}`}
                </h1>
                <p className="mt-0.5 text-sm text-muted">@{user.username}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 pt-1">
                <ShareProfileButton username={user.username} name={user.name} />
                {isSelf ? (
                  <button
                    type="button"
                    onClick={() => setEditing((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white shadow-[var(--shadow-pop)] transition active:translate-y-px"
                    style={{ background: "var(--gradient-brand)" }}
                  >
                    {editing ? (
                      <>
                        <X size={13} aria-hidden /> Close
                      </>
                    ) : (
                      <>
                        <Pencil size={13} aria-hidden /> Edit profile
                      </>
                    )}
                  </button>
                ) : isVisitor ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void toggleFollowUser()}
                      disabled={iFollow === null || followBusy}
                      className={iFollow ? PILL_SECONDARY : PILL_PRIMARY}
                      style={
                        iFollow ? undefined : { background: "var(--gradient-brand)" }
                      }
                    >
                      {followBusy || iFollow === null ? (
                        <Loader2 size={13} className="animate-spin" aria-hidden />
                      ) : iFollow ? (
                        <UserCheck size={13} aria-hidden />
                      ) : (
                        <UserPlus size={13} aria-hidden />
                      )}
                      {iFollow ? "Following" : "Follow"}
                    </button>
                    <ProfileConnect username={user.username} />
                  </>
                ) : (
                  <Link
                    href="/login"
                    className={PILL_PRIMARY}
                    style={{ background: "var(--gradient-brand)" }}
                  >
                    <UserPlus size={13} aria-hidden /> Follow
                  </Link>
                )}
              </div>
            </div>

            {/* Inline numbers, Instagram-style. Followers/Following open the
                people sheet; library counts jump to their section. */}
            <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-2">
              <button
                type="button"
                onClick={() => setPeopleTab("followers")}
                className="group flex items-baseline gap-1.5"
              >
                <span className="font-display text-lg font-black leading-none tabular-nums sm:text-xl">
                  {followerCount}
                </span>
                <span className="text-[12px] font-semibold text-muted group-hover:text-foreground">
                  Followers
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPeopleTab("following")}
                className="group flex items-baseline gap-1.5"
              >
                <span className="font-display text-lg font-black leading-none tabular-nums sm:text-xl">
                  {followingCount}
                </span>
                <span className="text-[12px] font-semibold text-muted group-hover:text-foreground">
                  Following
                </span>
              </button>
              {stats.map(({ id, label, value }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => scrollToSection(id)}
                  className="group flex items-baseline gap-1.5"
                >
                  <span className="font-display text-lg font-black leading-none tabular-nums sm:text-xl">
                    {value}
                  </span>
                  <span className="text-[12px] font-semibold text-muted group-hover:text-foreground">
                    {label}
                  </span>
                </button>
              ))}
            </div>

            <p className="mt-3 max-w-prose whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/90">
              {user.bio || (isSelf ? "Add a bio so readers know your vibe." : "Quiet reader vibes.")}
            </p>

            {/* One quiet meta row: mood chip + member-since. The mood
                chip is the switcher for you, read-only for visitors. */}
            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              {isSelf ? (
                <MoodSwitcher value={mood} onChange={(m) => void saveMood(m)} />
              ) : profileMood ? (
                <MoodDisplayTab
                  mood={profileMood}
                  name={(user.name || user.username).split(" ")[0]}
                />
              ) : null}
              {joined ? (
                <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-pill px-3 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  <CalendarDays size={12} aria-hidden />
                  Reader since {joined}
                </span>
              ) : null}
            </div>
            {isSelf ? (
              <div className="mt-1.5">
                {gistReset === "confirm" || gistReset === "busy" ? (
                  <span className="inline-flex h-7 items-center gap-1.5 text-[11px] font-semibold text-muted">
                    Clear viewed gists?
                    <button
                      type="button"
                      onClick={() => void resetGistHistory()}
                      disabled={gistReset === "busy"}
                      className="text-foreground underline-offset-2 hover:underline disabled:opacity-60"
                    >
                      {gistReset === "busy" ? "Clearing…" : "Reset"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setGistReset("idle")}
                      disabled={gistReset === "busy"}
                      className="hover:text-foreground disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setGistReset("confirm")}
                    className="inline-flex h-7 items-center gap-1.5 text-[11px] font-semibold text-muted transition hover:text-foreground"
                  >
                    <RotateCcw size={12} aria-hidden />
                    {gistReset === "done" ? "Gists can be recommended again" : "Reset gist history"}
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* ── The club they're in ─────────────────────────────────────────────── */}
      {profileClub ? (
        <div className="mt-5 px-4 sm:px-6">
          <ProfileClubCard
            club={profileClub}
            role={profileClubRole}
            isSelf={isSelf}
            signedIn={status === "authenticated"}
          />
        </div>
      ) : null}

      {/* ── Edit form ───────────────────────────────────────────────────────── */}
      {editing && isSelf ? (
        <form
          onSubmit={(e) => void saveProfile(e)}
          className="mt-6 space-y-5 rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] sm:p-6"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            onChange={(e) => {
              void handlePickFile(e.target.files?.[0]);
              if (e.target) e.target.value = "";
            }}
          />

          <div className="flex items-start gap-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-pill ring-1 ring-border">
              <AvatarImage src={image} initials={initials} />
              {imageBusy ? (
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-[11px] font-semibold uppercase tracking-wide text-white">
                  Resizing…
                </span>
              ) : null}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                Profile photo
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={openFilePicker}
                  disabled={imageBusy}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold transition hover:bg-hover disabled:opacity-60"
                >
                  <Camera size={13} aria-hidden />
                  {image ? "Replace photo" : "Upload photo"}
                </button>
                {image ? (
                  <button
                    type="button"
                    onClick={() => {
                      setImage("");
                      setImageError(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-hover"
                  >
                    <Trash2 size={13} aria-hidden /> Remove
                  </button>
                ) : null}
              </div>
              <p className="text-[11px] text-muted">
                Square works best. We resize to 512×512 JPEG automatically.
              </p>
              {imageError ? (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-[12px] font-medium text-red-600 dark:text-red-300">
                  {imageError}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Display name">
              <input
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
                placeholder="Your name"
              />
            </Field>
            <Field label="Image URL (optional)">
              <input
                value={image.startsWith("data:") ? "" : image}
                onChange={(e) => setImage(e.target.value)}
                className={inputCls}
                placeholder="https://…"
              />
            </Field>
          </div>
          <Field label={`Bio (${bio.length}/280)`}>
            <textarea
              rows={3}
              value={bio}
              maxLength={280}
              onChange={(e) => setBio(e.target.value)}
              className={`${inputCls} resize-none`}
              placeholder="What are you reading these days?"
            />
          </Field>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="submit"
              disabled={saving || imageBusy}
              className="rounded-full px-5 py-2 text-sm font-semibold text-white shadow-[var(--shadow-pop)] disabled:opacity-60"
              style={{ background: "var(--gradient-brand)" }}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setImage(user.image ?? "");
                setName(user.name ?? "");
                setBio(user.bio ?? "");
                setMood(profileMood);
                previewMood(profileMood); // discard live preview
                setImageError(null);
              }}
              className="rounded-full border border-border bg-card px-5 py-2 text-sm font-semibold transition hover:bg-hover"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {/* ── Top Shelf — no header needed, the shelf IS the statement ───────── */}
      <section id="recommendations" className="mt-10 scroll-mt-24">
        <Reveal>
          <TopShelfShowcase
            books={recommendations}
            isSelf={isSelf}
            mood={profileMood}
            onMove={moveRecommendation}
            onRemove={removeRecommendation}
            onAdd={() => setShelfModalTab("read")}
            visitorActions={visitorActions}
          />
        </Reveal>
      </section>

      {/* ── Read ────────────────────────────────────────────────────────────── */}
      <section id="read" className="mt-12 scroll-mt-24">
        <Reveal>
          <SectionHeader
            icon={CheckCircle2}
            title="Read"
            count={counts.read}
            hint={isSelf ? "Your trophy shelf — books you've read." : "Books they've already read."}
            action={
              readBooks.length ? (
                <SeeAllButton onClick={() => setShelfModalTab("read")} />
              ) : null
            }
          />
        </Reveal>
        <Reveal delay={60}>
          <CoverShelf
            books={readBooks}
            total={counts.read}
            onSeeAll={() => setShelfModalTab("read")}
            emptyHint={
              isSelf
                ? "Mark books as read from book pages or your wishlist."
                : "No completed books showcased yet."
            }
            itemActions={
              isSelf
                ? (b) => {
                    const recommended = recommendations.some((r) => r.id === b.id);
                    return (
                      <button
                        type="button"
                        onClick={() => void addRecommendation(b.id)}
                        disabled={recommended || recommendations.length >= 10}
                        title={
                          recommended
                            ? "Already on your Top Shelf"
                            : recommendations.length >= 10
                              ? "Top Shelf is full (10 max)"
                              : "Add to your Top Shelf"
                        }
                        className={`mt-1.5 flex w-full items-center justify-center gap-0.5 rounded-md border px-1 py-1 text-[10px] font-semibold transition ${
                          recommended
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "border-border bg-card text-muted hover:bg-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        }`}
                      >
                        {recommended ? (
                          <>
                            <Check size={10} aria-hidden /> Picked
                          </>
                        ) : (
                          <>
                            Recommend
                          </>
                        )}
                      </button>
                    );
                  }
                : visitorActions
            }
          />
        </Reveal>
      </section>

      {/* ── Currently reading (books followed) ──────────────────────────────── */}
      <section id="following" className="mt-12 scroll-mt-24">
        <Reveal>
          <SectionHeader
            icon={Library}
            title="Currently reading"
            count={counts.following}
            hint={
              isSelf
                ? "Books you're reading right now."
                : "Books they're reading right now."
            }
            action={
              following.length ? (
                <SeeAllButton onClick={() => setShelfModalTab("following")} />
              ) : null
            }
          />
        </Reveal>
        <Reveal delay={60}>
          <CoverShelf
            books={following}
            total={counts.following}
            onSeeAll={() => setShelfModalTab("following")}
            emptyHint={
              isSelf
                ? "Follow a book you're reading to see it here."
                : "Nothing on the nightstand right now."
            }
            itemActions={
              isSelf
                ? (b) => (
                    <button
                      type="button"
                      onClick={() => void finishReading(b)}
                      title="Move to Read"
                      className="mt-1.5 flex w-full items-center justify-center gap-0.5 rounded-md border border-border bg-card px-1 py-1 text-[10px] font-semibold text-muted transition hover:bg-hover hover:text-foreground"
                    >
                      <CheckCircle2 size={10} aria-hidden /> Read
                    </button>
                  )
                : visitorActions
            }
          />
        </Reveal>
      </section>

      {/* ── Wishlist ────────────────────────────────────────────────────────── */}
      <section id="wishlist" className="mt-12 scroll-mt-24">
        <Reveal>
          <SectionHeader
            icon={Bookmark}
            title="Wishlist"
            count={counts.wantToRead}
            hint={isSelf ? "Books waiting for their turn." : "What they're planning to read next."}
            action={
              wantToRead.length ? (
                <SeeAllButton onClick={() => setShelfModalTab("want-to-read")} />
              ) : null
            }
          />
        </Reveal>
        <Reveal delay={60}>
          <CoverShelf
            books={wantToRead}
            total={counts.wantToRead}
            onSeeAll={() => setShelfModalTab("want-to-read")}
            emptyHint={
              isSelf
                ? "Tap “Add to wishlist” on any book page to start the queue."
                : "No planned books yet."
            }
            itemActions={
              isSelf
                ? (b) => (
                    <button
                      type="button"
                      onClick={() => void startReading(b)}
                      title="Move to Currently reading"
                      className="mt-1.5 flex w-full items-center justify-center gap-0.5 rounded-md border border-border bg-card px-1 py-1 text-[10px] font-semibold text-muted transition hover:bg-hover hover:text-foreground"
                    >
                      <Library size={10} aria-hidden /> Start reading
                    </button>
                  )
                : visitorActions
            }
          />
        </Reveal>
      </section>

      {/* ── Memories ────────────────────────────────────────────────────────
          Private to the owner: visitors don't get the section at all, and the
          API refuses to serve anyone else's rows regardless. */}
      {isSelf ? (
        <section id="memories" className="mt-6 scroll-mt-24">
          <div className="mb-2 flex items-center justify-between gap-3 px-2">
            <h2 className="text-sm font-semibold tracking-tight">
              Memories
              <span className="ml-1.5 font-medium text-muted">{memories.length}</span>
            </h2>
            {composeOpen ? null : (
              <MemoryComposeButton onClick={() => setComposeOpen(true)} />
            )}
          </div>

          <div className="px-2">
            <MemoryComposer
              open={composeOpen}
              onClose={() => setComposeOpen(false)}
              onSaved={(memory) => setMemories((prev) => [memory, ...prev])}
            />
          </div>

          {memoriesLoading ? (
            <div className="mt-2 flex flex-col gap-1.5 px-2">
              {Array.from({ length: 3 }, (_, i) => (
                <div
                  key={i}
                  className="h-12 rounded-xl border border-border skeleton-shimmer"
                />
              ))}
            </div>
          ) : memories.length ? (
            <div className={`flex flex-col gap-4 px-3 py-2 ${composeOpen ? "mt-3" : ""}`}>
              {memories.map((m) => (
                <MemoryCard
                  key={m.id}
                  memory={m}
                  onDeleted={(id) =>
                    setMemories((prev) => prev.filter((row) => row.id !== id))
                  }
                  onUpdated={(memory) =>
                    setMemories((prev) =>
                      prev.map((row) => (row.id === memory.id ? memory : row))
                    )
                  }
                />
              ))}
            </div>
          ) : composeOpen ? null : (
            <div className="mt-1">
              <EmptyShelf
                icon={<Grid3X3 size={18} aria-hidden />}
                title="Nothing kept yet"
                hint="Highlight a passage in a gist, or tap Keep a line."
                cta={{ href: "/", label: "Open Gists" }}
              />
            </div>
          )}
        </section>
      ) : null}

      <ShelfModal
        openTab={shelfModalTab}
        onClose={() => setShelfModalTab(null)}
        isSelf={isSelf}
        wantToRead={wantToRead}
        readBooks={readBooks}
        following={following}
        recommendations={recommendations}
        onMarkRead={(bookId) => void updateShelfStatus(bookId, "read")}
        onMoveToWant={(bookId) => void updateShelfStatus(bookId, "want")}
        onRecommend={(bookId) => void addRecommendation(bookId)}
        visitorActions={visitorActions}
      />

      {peopleTab ? (
        <PeopleModal
          username={user.username}
          name={(user.name || user.username).split(" ")[0]}
          openTab={peopleTab}
          followers={followerCount}
          following={followingCount}
          canFollow={Boolean(session?.user?.id)}
          onClose={() => setPeopleTab(null)}
        />
      ) : null}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

/**
 * The club this reader belongs to, badged on their profile. Owners get the
 * louder treatment since the club is theirs; members get the same card in a
 * quieter frame. Signed-out visitors still see it — the tap just routes them
 * to sign in, because a club room is members-only.
 */
function ProfileClubCard({
  club,
  role,
  isSelf,
  signedIn,
}: {
  club: ClubSummary;
  role: "owner" | "member" | null;
  isSelf: boolean;
  signedIn: boolean;
}) {
  const href = signedIn ? `/clubs/${club.slug}` : "/login";
  const isOwner = role === "owner";
  const label = isOwner
    ? isSelf
      ? "Your club"
      : "Runs a club"
    : isSelf
      ? "You're in this club"
      : "Reads with";

  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 rounded-2xl border p-3.5 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-lg sm:p-4 ${
        isOwner
          ? "border-[var(--brand-1)]/40 bg-[color-mix(in_srgb,var(--brand-1)_7%,var(--card))]"
          : "border-border bg-card"
      }`}
    >
      <div className="h-[70px] w-[48px] shrink-0 overflow-hidden rounded-md bg-pill ring-1 ring-border/70">
        {club.currentBook?.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={club.currentBook.thumbnail.replace(/^http:/, "https:")}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-muted">
            <BookOpen size={16} aria-hidden />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
            isOwner ? "text-[var(--brand-1)]" : "text-muted"
          }`}
        >
          {isOwner ? (
            <Crown size={11} aria-hidden />
          ) : (
            <Users size={11} aria-hidden />
          )}
          {label}
        </p>
        <h2 className="mt-0.5 truncate text-[15px] font-bold">{club.name}</h2>
        <p className="truncate text-[12px] text-muted">
          {club.currentBook
            ? `Reading ${club.currentBook.title}`
            : club.tagline || "No book on the rack yet"}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="font-display text-lg font-bold leading-none">
          {club.memberCount}
        </p>
        <p className="text-[10px] uppercase tracking-wide text-muted">
          {club.memberCount === 1 ? "member" : "members"}
        </p>
      </div>
    </Link>
  );
}

function MoodDisplayTab({ mood, name }: { mood: MoodId; name: string }) {
  const m = MOOD_MAP[mood];
  return (
    <span
      className="relative inline-flex h-7 shrink-0 items-center gap-1.5 overflow-hidden rounded-full border border-border px-3"
      title={`${name}’s mood: ${m.label} — ${m.blurb}`}
    >
      <span
        aria-hidden
        className="absolute inset-0"
        style={{ background: `linear-gradient(135deg, ${m.swatch[0]} 0%, ${m.swatch[1]} 100%)`, opacity: 0.18 }}
      />
      <span aria-hidden className="relative text-sm leading-none">
        {m.emoji}
      </span>
      <span className="relative max-w-40 truncate text-[11px] font-bold uppercase tracking-wide">
        {m.label}
      </span>
    </span>
  );
}

/**
 * Context banner shown to visitors: explains *why* the whole app suddenly
 * changed color — because this reader has set a mood and the theme mirrors it.
 * Dismissible; uses the mood's own palette so it reads as part of the vibe.
 */
function MoodThemeBanner({
  mood,
  name,
  onDismiss,
}: {
  mood: MoodId;
  name: string;
  onDismiss: () => void;
}) {
  const m = MOOD_MAP[mood];
  return (
    <div
      className="relative mb-3 flex items-center gap-3 overflow-hidden rounded-2xl border border-border px-4 py-2.5"
      role="status"
    >
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${m.swatch[0]} 0%, ${m.swatch[1]} 100%)`,
          opacity: 0.16,
        }}
      />
      <span
        aria-hidden
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background/70 text-lg leading-none shadow-sm"
      >
        {m.emoji}
      </span>
      <p className="relative min-w-0 flex-1 text-[13px] leading-snug">
        <span className="font-semibold">
          {name} is reading in a {m.label} mood.
        </span>{" "}
        <span className="text-muted">
          That’s why the colors changed — {m.blurb.toLowerCase()}
        </span>
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="relative shrink-0 rounded-full p-1 text-muted transition hover:bg-hover hover:text-foreground"
      >
        <X size={15} aria-hidden />
      </button>
    </div>
  );
}

/** Copy-link / native-share button for the portfolio. */
function ShareProfileButton({ username, name }: { username: string; name: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = `${window.location.origin}/profile/${username}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (very old browser / non-secure context) —
      // fall back to the native share sheet if there is one.
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({
            title: `${name || `@${username}`} on The Gist Club`,
            url,
          });
        } catch {
          // User dismissed the sheet — nothing to do.
        }
      }
    }
  };

  return (
    <button
      type="button"
      onClick={() => void share()}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold transition hover:bg-hover active:translate-y-px"
      aria-live="polite"
    >
      {copied ? (
        <>
          <Check size={13} aria-hidden className="text-emerald-500" /> Copied!
        </>
      ) : (
        <>
          <Share2 size={13} aria-hidden /> Share
        </>
      )}
    </button>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  count,
  hint,
  action,
}: {
  icon: LucideIcon;
  title: string;
  count: number;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3 px-1">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
          style={{ background: "var(--gradient-brand)" }}
        >
          <Icon size={16} aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="font-display truncate text-lg font-bold leading-tight sm:text-xl">
            {title}{" "}
            <span className="align-middle text-sm font-semibold text-muted">
              · {count}
            </span>
          </h2>
          {hint ? <p className="truncate text-xs text-muted">{hint}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function SeeAllButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-0.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-hover hover:text-foreground"
    >
      See all <ChevronRight size={13} aria-hidden />
    </button>
  );
}

/** Renders an avatar that handles both remote URLs and data: URIs, with a
 *  gradient initials fallback. Data URIs bypass next/image optimization. */
function AvatarImage({
  src,
  initials,
}: {
  src?: string;
  initials: string;
}) {
  if (!src) {
    return (
      <span
        aria-hidden
        className="flex h-full w-full items-center justify-center text-2xl font-black text-white"
        style={{ background: "var(--gradient-brand)" }}
      >
        {initials}
      </span>
    );
  }
  if (src.startsWith("data:")) {
    // next/image refuses data URIs without explicit config — use a plain <img>.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className="h-full w-full object-cover" />;
  }
  return (
    <Image
      src={src}
      alt=""
      fill
      sizes="128px"
      className="object-cover"
    />
  );
}

/** Small book cover with initial-tile fallback. */
function CoverThumb({ book, sizes }: { book: ShelfBook; sizes: string }) {
  if (book.thumbnail) {
    return (
      <Image
        src={book.thumbnail.replace(/^http:/, "https:")}
        alt={book.title}
        fill
        sizes={sizes}
        className="object-cover"
      />
    );
  }
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center"
      style={{ background: "var(--gradient-brand)" }}
    >
      <span className="text-xl font-black text-white drop-shadow-sm">
        {book.title.slice(0, 1).toUpperCase()}
      </span>
      <span className="line-clamp-3 text-[10px] font-semibold leading-tight text-white/90">
        {book.title}
      </span>
    </div>
  );
}

/** A horizontal shelf of book covers with a shelf plank underneath. */
function CoverShelf({
  books,
  total,
  onSeeAll,
  emptyHint,
  itemActions,
}: {
  books: ShelfBook[];
  total: number;
  onSeeAll: () => void;
  emptyHint: string;
  /** Optional compact actions rendered under each cover. */
  itemActions?: (book: ShelfBook) => React.ReactNode;
}) {
  if (!books.length) {
    return (
      <p className="mx-1 rounded-2xl border border-dashed border-border bg-card/60 px-4 py-8 text-center text-sm text-muted">
        {emptyHint}
      </p>
    );
  }

  const visible = books.slice(0, 12);
  const overflow = total - visible.length;

  return (
    <div className="px-1">
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {visible.map((b) => (
          <div key={b.id} className="w-[72px] shrink-0 sm:w-[86px]">
            <Link
              href={`/book/${b.slug || b.id}`}
              title={b.title}
              className="group block outline-none"
            >
              <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-pill shadow-sm ring-1 ring-border/70 transition duration-200 group-hover:-translate-y-1.5 group-hover:shadow-[var(--shadow-soft)] group-focus-visible:ring-2 group-focus-visible:ring-sky-400/70">
                <CoverThumb book={b} sizes="86px" />
              </div>
              <p className="mt-1.5 line-clamp-2 min-h-[2.5em] px-0.5 text-[10px] font-semibold leading-tight text-muted group-hover:text-foreground">
                {b.title}
              </p>
            </Link>
            {itemActions ? itemActions(b) : null}
          </div>
        ))}
        {overflow > 0 ? (
          <button
            type="button"
            onClick={onSeeAll}
            className="group w-[72px] shrink-0 self-start sm:w-[86px]"
            aria-label={`See all ${total} books`}
          >
            <div className="flex aspect-[2/3] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-card text-muted transition group-hover:-translate-y-1.5 group-hover:text-foreground">
              <span className="font-display text-lg font-black">+{overflow}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide">more</span>
            </div>
          </button>
        ) : null}
      </div>
      {/* shelf plank */}
      <div
        aria-hidden
        className="mt-0.5 h-2 rounded-full bg-gradient-to-b from-foreground/15 to-foreground/5 shadow-[0_2px_6px_rgba(0,0,0,0.15)]"
      />
    </div>
  );
}

const RANK_CHIPS = [
  "bg-gradient-to-b from-amber-200 via-amber-400 to-yellow-600 text-amber-950 ring-amber-300/70",
  "bg-gradient-to-b from-slate-100 via-slate-300 to-slate-500 text-slate-800 ring-slate-300/70",
  "bg-gradient-to-b from-orange-200 via-orange-400 to-orange-700 text-orange-950 ring-orange-300/70",
] as const;

/** Antique cloth-binding colors for spines, picked deterministically per title. */
const SPINE_CLOTHS = [
  ["#7b2d26", "#55201b"], // oxblood
  ["#1f4d3a", "#143427"], // forest green
  ["#2b3a67", "#1c2745"], // navy
  ["#8a6d1f", "#5f4b14"], // ochre
  ["#5b3a6e", "#3f284d"], // plum
  ["#245c5c", "#163d3d"], // teal
  ["#6e4423", "#4b2e16"], // sienna
  ["#4a2c3c", "#301c27"], // mulberry
] as const;

function titleHash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Trim a book title to what fits on a narrow spine: drop any subtitle after a
 *  colon/dash, then hard-cap the length with an ellipsis. */
function spineLabel(title: string, max = 22) {
  const main = title.split(/\s*[:—–-]\s/)[0].trim() || title.trim();
  return main.length > max ? `${main.slice(0, max - 1).trimEnd()}…` : main;
}

/* ── The Top Shelf: floating wall planks + an open scene behind them ────── */

const WOOD_GRAIN_H =
  "repeating-linear-gradient(91deg, rgba(0,0,0,0.14) 0 1px, transparent 1px 6px, rgba(255,244,214,0.05) 6px 7px, transparent 7px 13px)";

/** Dark walnut wall plank the books stand on. */
const woodPlank: React.CSSProperties = {
  background: `${WOOD_GRAIN_H}, linear-gradient(180deg, #6b4527 0%, #4e2f16 45%, #33200d 100%)`,
  boxShadow:
    "inset 0 2px 1px rgba(255,235,195,0.3), inset 0 -2px 3px rgba(0,0,0,0.45), 0 6px 10px rgba(0,0,0,0.28)",
};

/** Deterministic lean for a few books so the row doesn't look machine-set. */
const SPINE_TILTS = [0, 0, -7, 0, 0, 6, 0, -5, 0, 8] as const;

function ShelfBracket({ side }: { side: "left" | "right" }) {
  return (
    <span
      aria-hidden
      className={`absolute -bottom-2.5 h-2.5 w-4 rounded-b-[6px] ${side === "left" ? "left-7" : "right-7"}`}
      style={{
        background: "linear-gradient(180deg, #4e2f16 0%, #2c1b0a 100%)",
        boxShadow: "0 2px 4px rgba(0,0,0,0.35)",
      }}
    />
  );
}

function CloudPuff({ className, rain }: { className?: string; rain?: boolean }) {
  return (
    <span className={`absolute ${className ?? ""}`}>
      <svg viewBox="0 0 64 28" className="w-full fill-current" aria-hidden>
        <ellipse cx="18" cy="19" rx="14" ry="8" />
        <ellipse cx="35" cy="13" rx="16" ry="10" />
        <ellipse cx="49" cy="20" rx="12" ry="7" />
      </svg>
      {rain ? (
        <span aria-hidden className="absolute inset-x-2 top-full block h-9">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="tgc-rain-drop absolute top-0 h-2 w-px rounded-full bg-sky-300/70"
              style={{ left: `${12 + i * 24}%`, animationDelay: `${i * 0.35}s` }}
            />
          ))}
        </span>
      ) : null}
    </span>
  );
}

function BirdV({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 10"
      aria-hidden
      className={`absolute fill-none stroke-current ${className ?? ""}`}
      strokeWidth={1.8}
      strokeLinecap="round"
    >
      <path d="M2 8 Q7 1 12 8 M12 8 Q17 1 22 8" />
    </svg>
  );
}

function PalmTree({ className, flip }: { className?: string; flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 100 160"
      aria-hidden
      className={`absolute ${flip ? "-scale-x-100" : ""} ${className ?? ""}`}
    >
      <path
        d="M52 160 C50 122 47 90 54 58"
        fill="none"
        stroke="#9a6b3f"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path d="M54 58 C38 42 16 40 4 52 C22 52 40 58 52 65 Z" fill="#2e8f57" />
      <path d="M54 58 C70 42 90 40 98 54 C80 52 64 59 56 65 Z" fill="#36a866" />
      <path d="M54 58 C46 40 34 30 18 30 C32 38 44 50 52 62 Z" fill="#2a7d4f" />
      <path d="M54 58 C62 40 76 30 90 32 C76 40 62 52 56 62 Z" fill="#3aa25f" />
      <path d="M54 58 C52 42 52 30 56 18 C60 32 60 46 58 60 Z" fill="#2e8f57" />
      <circle cx="48" cy="63" r="4.5" fill="#6e4423" />
      <circle cx="59" cy="65" r="4" fill="#5b3517" />
    </svg>
  );
}

/** Night scenery (dark mode): moon, stars, rain clouds. Sits behind the books. */
function NightScene() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 hidden dark:block">
      <span
        className="absolute left-6 top-0 h-14 w-14 rounded-full"
        style={{
          background: "radial-gradient(circle at 36% 34%, #f7f3df 0%, #ddd7ba 65%, #c9c2a2 100%)",
          boxShadow: "0 0 26px 8px rgba(245,240,214,0.22)",
        }}
      >
        <span className="absolute left-[28%] top-[42%] h-2.5 w-2.5 rounded-full bg-stone-400/40" />
        <span className="absolute left-[58%] top-[22%] h-1.5 w-1.5 rounded-full bg-stone-400/40" />
        <span className="absolute left-[52%] top-[62%] h-2 w-2 rounded-full bg-stone-400/30" />
      </span>
      {[
        ["22%", "14%"],
        ["30%", "42%"],
        ["8%", "58%"],
        ["16%", "84%"],
        ["36%", "70%"],
      ].map(([top, left], i) => (
        <span
          key={i}
          className="absolute h-[3px] w-[3px] rounded-full bg-amber-100/70"
          style={{ top, left }}
        />
      ))}
      <CloudPuff rain className="left-[36%] top-1 w-16 text-slate-500/60" />
      <CloudPuff rain className="right-3 top-7 w-14 text-slate-600/60" />
    </div>
  );
}

/** Day scenery (light mode): bright sun, V-birds, drifting cloud. */
function DayScene() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 dark:hidden">
      <Sun className="left-5 top-0" />
      <BirdV className="left-[42%] top-4 w-6 text-slate-500/80" />
      <BirdV className="left-[54%] top-9 w-4 text-slate-500/60" />
      <BirdV className="right-[24%] top-2 w-5 text-slate-500/70" />
      <CloudPuff className="right-4 top-6 w-14 text-slate-300/80" />
    </div>
  );
}

/* ── Mood scene primitives (minimalist, AMOLED-friendly) ───────────────── */

function Stars({ pts }: { pts: [string, string][] }) {
  return (
    <>
      {pts.map(([top, left], i) => (
        <span
          key={i}
          className="tgc-twinkle absolute h-[3px] w-[3px] rounded-full bg-amber-100/80"
          style={{ top, left, animationDelay: `${(i % 4) * 0.7}s` }}
        />
      ))}
    </>
  );
}

function PineTree({ className, color = "#1f5137" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 60 120" aria-hidden className={`absolute ${className ?? ""}`}>
      <rect x="26" y="92" width="8" height="28" rx="2" fill="#5b3a1e" />
      <path d="M30 4 L47 42 L13 42 Z" fill={color} />
      <path d="M30 26 L52 72 L8 72 Z" fill={color} />
      <path d="M30 50 L57 100 L3 100 Z" fill={color} />
    </svg>
  );
}

function CoffeeCup({ className, steamClass = "bg-white/80" }: { className?: string; steamClass?: string }) {
  return (
    <div className={`absolute flex flex-col items-center ${className ?? ""}`}>
      {/* steam rising above the rim */}
      <div className="flex h-5 items-end justify-center gap-[3px]">
        <span className={`tgc-steam h-4 w-[2px] rounded-full ${steamClass}`} />
        <span
          className={`tgc-steam h-5 w-[2px] rounded-full ${steamClass}`}
          style={{ animationDelay: "0.7s" }}
        />
        <span
          className={`tgc-steam h-4 w-[2px] rounded-full ${steamClass}`}
          style={{ animationDelay: "1.3s" }}
        />
      </div>
      <svg viewBox="0 0 52 32" aria-hidden className="w-full drop-shadow-[0_2px_3px_rgba(0,0,0,0.3)]">
        <path d="M6 2 h34 v11 a13 13 0 0 1 -13 13 h-8 a13 13 0 0 1 -13 -13 Z" fill="#c98a58" />
        <path d="M40 5 a7 7 0 0 1 0 13" fill="none" stroke="#c98a58" strokeWidth="3.5" />
        <ellipse cx="23" cy="3" rx="17" ry="2.4" fill="#8a5a33" />
      </svg>
    </div>
  );
}

function PottedPlant({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 44" aria-hidden className={`absolute ${className ?? ""}`}>
      {/* leaves */}
      <path d="M20 26 C10 22 8 10 14 4 C18 10 20 18 20 26 Z" fill="#3f8f5f" />
      <path d="M20 26 C30 22 32 10 26 4 C22 10 20 18 20 26 Z" fill="#4aa66d" />
      <path d="M20 28 C14 24 8 22 4 24 C10 28 15 30 20 30 Z" fill="#357c50" />
      <path d="M20 28 C26 24 32 22 36 24 C30 28 25 30 20 30 Z" fill="#42975f" />
      {/* pot */}
      <path d="M11 28 h18 l-3 14 h-12 Z" fill="#c9703f" />
      <rect x="10" y="26" width="20" height="4" rx="1.5" fill="#e08a55" />
    </svg>
  );
}

function TableLamp({ className }: { className?: string }) {
  return (
    <div className={`absolute ${className ?? ""}`}>
      {/* warm pool cast by the shade */}
      <span
        className="absolute left-1/2 top-2 h-16 w-24 -translate-x-1/2 rounded-full blur-md"
        style={{ background: "radial-gradient(circle, rgba(251,191,36,0.5), transparent 70%)" }}
      />
      <svg viewBox="0 0 44 56" aria-hidden className="relative w-full drop-shadow-[0_3px_4px_rgba(0,0,0,0.4)]">
        {/* shade */}
        <path d="M9 6 h26 l6 16 h-38 Z" fill="#f6c453" />
        <path d="M9 6 h26 l2 5 h-30 Z" fill="#fcd97a" />
        {/* stem + base */}
        <rect x="20" y="22" width="4" height="23" rx="2" fill="#9a6b3c" />
        <rect x="11" y="45" width="22" height="5" rx="2.5" fill="#8a5f36" />
        <ellipse cx="22" cy="51" rx="13" ry="3.5" fill="#6f4a2a" />
      </svg>
    </div>
  );
}

function StreetLamp({ className }: { className?: string }) {
  return (
    <div className={`absolute ${className ?? ""}`}>
      {/* warm halo at the lamp head */}
      <span
        className="absolute right-1 top-3 h-14 w-16 rounded-full blur-md"
        style={{ background: "radial-gradient(circle, rgba(251,191,36,0.45), transparent 70%)" }}
      />
      <svg viewBox="0 0 60 140" aria-hidden className="relative w-full drop-shadow-[0_3px_5px_rgba(0,0,0,0.45)]">
        {/* pole + base */}
        <rect x="10" y="16" width="5" height="120" rx="2" fill="#334155" />
        <rect x="4" y="132" width="17" height="6" rx="2" fill="#1e293b" />
        {/* arm curving out to the right */}
        <path d="M12 18 q24 -12 34 6" fill="none" stroke="#334155" strokeWidth="5" strokeLinecap="round" />
        {/* lamp head */}
        <path d="M40 22 h14 l-3 9 h-8 Z" fill="#475569" />
        <ellipse cx="47" cy="31" rx="6" ry="2.5" fill="#fcd97a" />
      </svg>
    </div>
  );
}

function Car({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 92 46" aria-hidden className={`absolute ${className ?? ""} drop-shadow-[0_3px_4px_rgba(0,0,0,0.4)]`}>
      {/* body */}
      <path d="M6 32 L15 18 Q19 12 29 12 h28 q10 0 16 8 l7 10 q3 3 -1 3 H8 q-4 0 -2 -3 Z" fill="#b45309" />
      <rect x="4" y="30" width="82" height="8" rx="4" fill="#92400e" />
      {/* windows */}
      <path d="M23 16 h13 v8 h-17 Z" fill="#fde68a" opacity="0.85" />
      <path d="M39 16 h15 l6 8 h-21 Z" fill="#fde68a" opacity="0.85" />
      {/* headlight */}
      <circle cx="83" cy="27" r="2.5" fill="#fff7cc" />
      {/* wheels */}
      <circle cx="26" cy="38" r="7" fill="#111827" />
      <circle cx="26" cy="38" r="3" fill="#4b5563" />
      <circle cx="66" cy="38" r="7" fill="#111827" />
      <circle cx="66" cy="38" r="3" fill="#4b5563" />
    </svg>
  );
}

function SunRays({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 200 200" aria-hidden className={`absolute ${className ?? ""}`} style={style}>
      <g stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.55">
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2;
          const inner = 28;
          const outer = 66 + (i % 2) * 24;
          return (
            <line
              key={i}
              x1={100 + Math.cos(a) * inner}
              y1={100 + Math.sin(a) * inner}
              x2={100 + Math.cos(a) * outer}
              y2={100 + Math.sin(a) * outer}
            />
          );
        })}
      </g>
    </svg>
  );
}

function CafeHut({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 130 104"
      aria-hidden
      className={`absolute ${className ?? ""} drop-shadow-[0_5px_7px_rgba(0,0,0,0.35)]`}
    >
      {/* storefront wall */}
      <rect x="12" y="34" width="106" height="66" rx="4" fill="#f4e3c6" stroke="#d8c19a" strokeWidth="1.5" />
      {/* sign band across the top */}
      <rect x="8" y="23" width="114" height="16" rx="3" fill="#6b4a2f" />
      <text x="65" y="35" textAnchor="middle" fontSize="10" fontWeight="800" letterSpacing="2" fill="#ffe6b3">
        CAFÉ
      </text>
      {/* striped awning */}
      {Array.from({ length: 7 }).map((_, i) => (
        <path key={i} d={`M${16 + i * 14} 44 h14 l-4 9 h-14 Z`} fill={i % 2 ? "#e0705a" : "#f7ecd6"} />
      ))}
      <rect x="15" y="42" width="100" height="3" fill="#9c3f30" />
      {/* big storefront window with a warm interior */}
      <rect x="20" y="58" width="56" height="40" rx="2" fill="#ffd77a" stroke="#8a5a33" strokeWidth="2.5" />
      <line x1="48" y1="58" x2="48" y2="98" stroke="#8a5a33" strokeWidth="1.5" />
      <line x1="20" y1="78" x2="76" y2="78" stroke="#8a5a33" strokeWidth="1.5" />
      {/* pendant lamp glowing inside */}
      <line x1="34" y1="58" x2="34" y2="64" stroke="#8a5a33" strokeWidth="1" />
      <path d="M30 64 h8 l-2 4 h-4 Z" fill="#c05442" />
      {/* door */}
      <rect x="84" y="60" width="26" height="40" rx="2" fill="#8a5a33" />
      <rect x="88" y="64" width="18" height="17" rx="1.5" fill="#ffd77a" opacity="0.85" />
      <circle cx="89" cy="83" r="1.8" fill="#f4e3c6" />
      {/* potted plant beside the door */}
      <path d="M114 90 c-4 -3 -5 -10 -2 -15 c2 4 3 10 2 15" fill="#3f8f5f" />
      <path d="M114 90 c4 -3 5 -10 2 -15 c-2 4 -3 10 -2 15" fill="#4aa66d" />
      <path d="M110 90 h8 l-1 10 h-6 Z" fill="#c9703f" />
    </svg>
  );
}

function Snowfall() {
  return (
    <>
      {Array.from({ length: 10 }).map((_, i) => (
        <span
          key={i}
          className="tgc-snow absolute top-0 h-1.5 w-1.5 rounded-full bg-white/85"
          style={{
            left: `${6 + i * 9}%`,
            animationDelay: `${(i % 5) * 0.6}s`,
            animationDuration: `${3 + (i % 3)}s`,
          }}
        />
      ))}
    </>
  );
}

function Fireflies() {
  const spots: [string, string][] = [
    ["30%", "22%"],
    ["52%", "40%"],
    ["24%", "62%"],
    ["60%", "78%"],
    ["44%", "12%"],
  ];
  return (
    <>
      {spots.map(([top, left], i) => (
        <span
          key={i}
          className="tgc-firefly absolute h-1.5 w-1.5 rounded-full"
          style={{
            top,
            left,
            background: "#fde68a",
            boxShadow: "0 0 6px 2px rgba(253,230,138,0.7)",
            animationDelay: `${i * 0.5}s`,
          }}
        />
      ))}
    </>
  );
}

function Skyline({ className, color = "#211d33" }: { className?: string; color?: string }) {
  return (
    <svg
      viewBox="0 0 240 70"
      aria-hidden
      preserveAspectRatio="none"
      className={`absolute ${className ?? ""}`}
    >
      <path
        d="M0 70 V42 h16 V28 h12 V42 h14 V18 h14 V42 h18 V32 h12 V14 h10 V32 h16 V46 h14 V24 h12 V46 h20 V36 h12 V52 h16 V30 h12 V52 h20 V40 h14 V70 Z"
        fill={color}
      />
      {[
        [24, 34],
        [70, 24],
        [120, 20],
        [166, 30],
        [210, 46],
      ].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="3" height="3" fill="#fbbf24" opacity="0.85" />
      ))}
    </svg>
  );
}

function StringLights({ className }: { className?: string }) {
  const bulbs = [18, 54, 92, 130, 168, 206];
  return (
    <svg viewBox="0 0 240 30" aria-hidden className={`absolute ${className ?? ""}`}>
      <path d="M0 5 Q60 26 120 8 T240 5" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
      {bulbs.map((x, i) => {
        const y = 8 + Math.sin((x / 240) * Math.PI * 2) * 6 + 4;
        const colors = ["#fbbf24", "#f97373", "#34d399", "#38bdf8", "#f59e0b", "#a855f7"];
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="2.6"
            fill={colors[i % colors.length]}
            className="tgc-twinkle"
            style={{ animationDelay: `${i * 0.4}s` }}
          />
        );
      })}
    </svg>
  );
}

function Hills({ className, color }: { className?: string; color?: string }) {
  return (
    <svg
      viewBox="0 0 240 60"
      aria-hidden
      preserveAspectRatio="none"
      className={`absolute ${className ?? ""}`}
      style={{ color }}
    >
      <path d="M0 60 Q60 18 120 38 T240 26 V60 Z" fill="currentColor" />
    </svg>
  );
}

function SpeedLines({ className }: { className?: string }) {
  return (
    <div className={`absolute ${className ?? ""}`}>
      {Array.from({ length: 6 }).map((_, i) => (
        <span
          key={i}
          className="tgc-speed absolute h-[2px] rounded-full bg-current"
          style={{
            top: `${12 + i * 14}%`,
            width: `${30 + (i % 3) * 18}px`,
            animationDelay: `${(i % 4) * 0.4}s`,
            opacity: 0.5,
          }}
        />
      ))}
    </div>
  );
}

/* ── Window, weather and cabin props ───────────────────────────────────── */

/**
 * Deterministic star scatter. Generated once at module scope so the sky stays
 * put instead of reshuffling on every re-render.
 */
function scatterStars(count: number, seed: number) {
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  return Array.from({ length: count }, () => {
    const weight = rand();
    return {
      top: `${3 + rand() * 76}%`,
      left: `${2 + rand() * 95}%`,
      size: weight < 0.18 ? 3.5 : weight < 0.55 ? 2.5 : 1.5,
      delay: `${(rand() * 3.4).toFixed(2)}s`,
      duration: `${(2.2 + rand() * 2.8).toFixed(2)}s`,
    };
  });
}

type ScatteredStar = ReturnType<typeof scatterStars>[number];

const MIDNIGHT_STARS = scatterStars(32, 20260815);

/** Stars of mixed sizes twinkling out of sync with each other. */
function TwinkleStars({ stars }: { stars: ScatteredStar[] }) {
  return (
    <>
      {stars.map((st, i) => (
        <span
          key={i}
          className="tgc-twinkle absolute rounded-full bg-amber-50"
          style={{
            top: st.top,
            left: st.left,
            height: st.size,
            width: st.size,
            animationDelay: st.delay,
            animationDuration: st.duration,
            boxShadow:
              st.size > 2 ? "0 0 5px 1px rgba(255,247,214,0.7)" : undefined,
          }}
        />
      ))}
    </>
  );
}

/** Reflections that read as a pane of glass over whatever sits behind it. */
function GlassPane() {
  return (
    <>
      <span
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(114deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.05) 18%, transparent 38%, transparent 58%, rgba(255,255,255,0.10) 72%, transparent 88%)",
        }}
      />
      <span
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 12% 0%, rgba(255,255,255,0.14), transparent 62%)",
        }}
      />
    </>
  );
}

/** Frame bar between window panes. */
const WINDOW_BAR: React.CSSProperties = {
  background: "linear-gradient(180deg, #6a5d8a 0%, #372f52 100%)",
  boxShadow: "0 1px 2px rgba(0,0,0,0.55)",
};

/** Dense rain sweeping the full height of a scene. */
function Downpour({
  count = 32,
  fall = 190,
  className,
}: {
  count?: number;
  fall?: number;
  className?: string;
}) {
  return (
    <div aria-hidden className={`absolute overflow-hidden ${className ?? ""}`}>
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="tgc-downpour absolute top-0 w-px rounded-full"
          style={
            {
              left: `${(i * 37) % 100}%`,
              height: `${9 + (i % 4) * 5}px`,
              background:
                "linear-gradient(180deg, transparent, rgba(203,232,255,0.85))",
              opacity: 0.3 + (i % 3) * 0.22,
              animationDelay: `${((i * 13) % 17) * 0.09}s`,
              animationDuration: `${0.62 + (i % 5) * 0.11}s`,
              "--tgc-fall": `${fall}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

/** A log cabin in the woods — the forest counterpart to the café storefront. */
function WoodCabin({ className }: { className?: string }) {
  return (
    <div className={`absolute ${className ?? ""}`}>
      {/* lamplight spilling out of the windows */}
      <span
        className="absolute inset-x-[18%] bottom-[6%] h-[52%] blur-[10px]"
        style={{
          background:
            "radial-gradient(circle at 50% 60%, rgba(253,204,110,0.55), transparent 70%)",
        }}
      />
      {/* smoke curling out of the chimney */}
      <span aria-hidden className="absolute left-[68%] top-[-6%] h-6 w-6">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="tgc-smoke absolute bottom-0 left-1 h-2.5 w-2.5 rounded-full bg-slate-200/40"
            style={{ animationDelay: `${i * 1.4}s` }}
          />
        ))}
      </span>
      <svg
        viewBox="0 0 140 116"
        aria-hidden
        className="relative w-full drop-shadow-[0_6px_9px_rgba(0,0,0,0.5)]"
      >
        {/* chimney */}
        <rect x="92" y="14" width="14" height="26" rx="2" fill="#6d4a30" />
        <rect x="89" y="11" width="20" height="7" rx="2" fill="#5a3b25" />
        {/* roof */}
        <path d="M70 8 L136 54 H4 Z" fill="#3f2e1e" />
        <path d="M70 8 L136 54 H120 L70 19 Z" fill="#4c3826" />
        <rect x="2" y="52" width="136" height="6" rx="3" fill="#33251a" />
        {/* log wall */}
        <rect x="18" y="58" width="104" height="54" rx="3" fill="#8a5e39" />
        {[64, 71, 78, 85, 92, 99, 106].map((y) => (
          <line
            key={y}
            x1="18"
            y1={y}
            x2="122"
            y2={y}
            stroke="#6f4a2c"
            strokeWidth="1.4"
          />
        ))}
        {/* glowing windows */}
        <rect x="28" y="66" width="26" height="22" rx="2" fill="#ffd071" stroke="#5a3b25" strokeWidth="2.5" />
        <line x1="41" y1="66" x2="41" y2="88" stroke="#5a3b25" strokeWidth="1.6" />
        <line x1="28" y1="77" x2="54" y2="77" stroke="#5a3b25" strokeWidth="1.6" />
        <rect x="90" y="66" width="24" height="22" rx="2" fill="#ffd071" stroke="#5a3b25" strokeWidth="2.5" />
        <line x1="102" y1="66" x2="102" y2="88" stroke="#5a3b25" strokeWidth="1.6" />
        <line x1="90" y1="77" x2="114" y2="77" stroke="#5a3b25" strokeWidth="1.6" />
        {/* door */}
        <rect x="62" y="72" width="22" height="40" rx="2" fill="#5c3d24" />
        <rect x="65" y="76" width="16" height="12" rx="1.5" fill="#ffce74" opacity="0.8" />
        <circle cx="80" cy="95" r="1.8" fill="#e8c98d" />
        {/* stacked firewood by the wall */}
        <g fill="#6f4a2c">
          <circle cx="128" cy="104" r="4" />
          <circle cx="136" cy="104" r="4" />
          <circle cx="132" cy="97" r="4" />
        </g>
        {/* step */}
        <rect x="58" y="110" width="30" height="5" rx="2" fill="#4a3121" />
      </svg>
    </div>
  );
}

/**
 * Mood scenery painted behind the Top Shelf. Each mood is a small set of
 * minimalist props; an empty mood falls back to the theme-aware day/night
 * scene. Props sit at z-0 so they peek out from behind the books.
 */
function MoodScene({ mood }: { mood: "" | MoodId }) {
  const layer = "pointer-events-none absolute inset-0 z-0";
  switch (mood) {
    case "rainy-nook":
      return (
        <div aria-hidden className={layer}>
          {/* an overcast day: cloud cover pushing the whole scene into grey */}
          <span
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(24,34,52,0.66) 0%, rgba(45,58,80,0.46) 42%, rgba(71,85,105,0.20) 100%)",
            }}
          />
          {/* the sun, barely making it through the cloud bank */}
          <VeiledSun className="left-[16%] top-1 h-16 w-16 blur-[7px]" />
          {/* dim warm window glow low behind the books */}
          <span
            className="absolute bottom-0 left-6 h-24 w-40 rounded-[40%] blur-md"
            style={{ background: "radial-gradient(circle, rgba(251,191,36,0.3), transparent 70%)" }}
          />
          {/* a low, unbroken bank of cloud right across the top */}
          <CloudPuff rain className="-left-3 top-2 w-24 text-slate-600/85" />
          <CloudPuff rain className="left-[20%] top-0 w-28 text-slate-700/85" />
          <CloudPuff rain className="left-[46%] top-3 w-24 text-slate-600/85" />
          <CloudPuff rain className="right-1 top-0 w-28 text-slate-700/85" />
          <CloudPuff className="right-[30%] top-9 w-20 text-slate-500/60" />
          <CloudPuff className="left-[8%] top-11 w-16 text-slate-500/50" />
          {/* the downpour itself, falling across the whole scene */}
          <Downpour className="inset-0" count={36} fall={210} />
          {/* quiet wet road running along the base of the shelf */}
          <svg
            viewBox="0 0 300 26"
            preserveAspectRatio="none"
            className="absolute inset-x-0 bottom-0 h-6 w-full"
          >
            <rect x="0" y="6" width="300" height="20" fill="#3a3f4b" />
            <rect x="0" y="6" width="300" height="3" fill="#4b5160" />
            {[10, 50, 90, 130, 170, 210, 250, 290].map((x) => (
              <rect key={x} x={x} y="16" width="18" height="2.5" rx="1" fill="#e5c46b" opacity="0.75" />
            ))}
          </svg>
          {/* tall street lamp on the left + a lone car parked on the right */}
          <StreetLamp className="bottom-0 left-1 w-11" />
          <Car className="bottom-1 right-2 w-20 sm:w-24" />
        </div>
      );
    case "beach-drift":
      return (
        <div aria-hidden className={layer}>
          {/* bright midday sky, bluest up top and warm around the sun */}
          <span
            className="absolute inset-x-0 top-0 h-32"
            style={{
              background:
                "linear-gradient(180deg, rgba(56,189,248,0.34) 0%, rgba(125,211,252,0.18) 52%, transparent 100%)",
            }}
          />
          <span
            className="absolute -left-8 -top-8 h-40 w-56"
            style={{
              background:
                "radial-gradient(circle at 34% 36%, rgba(254,240,138,0.5), rgba(254,240,138,0) 68%)",
            }}
          />
          {/* thin cirrus strokes brushed across the blue */}
          {[
            { top: "9%", left: "26%", w: "16%" },
            { top: "15%", left: "34%", w: "10%" },
            { top: "22%", left: "58%", w: "20%" },
            { top: "30%", left: "68%", w: "12%" },
            { top: "13%", left: "76%", w: "14%" },
          ].map((s, i) => (
            <span
              key={i}
              className="absolute h-[3px] rounded-full bg-white/70"
              style={{ top: s.top, left: s.left, width: s.w }}
            />
          ))}
          <Sun className="left-5 top-0" />
          <BirdV className="left-[44%] top-3 w-6 text-slate-500/80" />
          <BirdV className="left-[56%] top-8 w-4 text-slate-500/60" />
          <PalmTree className="bottom-0 right-2 hidden w-[84px] sm:block" />
          <PalmTree flip className="bottom-0 right-16 hidden w-[58px] opacity-90 sm:block" />
          <PalmTree className="bottom-0 right-0 w-[64px] sm:hidden" />
          {/* sand along the base, with the sea washing in from the left */}
          <svg
            viewBox="0 0 300 26"
            preserveAspectRatio="none"
            className="absolute inset-x-0 bottom-0 h-[26px] w-full"
          >
            <path d="M0 11 Q40 5 80 10 T160 9 T240 10 T300 8 V26 H0 Z" fill="#f4dcaf" />
            <path d="M0 15 Q60 10 120 14 T240 13 T300 13 V26 H0 Z" fill="#e8c98d" opacity="0.9" />
            {/* water */}
            <path d="M0 6 Q28 6 50 12 Q70 18 82 26 H0 Z" fill="#2f9ec4" />
            <path d="M0 12 Q24 13 40 18 Q52 22 58 26 H0 Z" fill="#7fd0e8" opacity="0.7" />
            {/* foam along the waterline */}
            <path
              d="M0 6 Q28 6 50 12 Q70 18 82 26"
              fill="none"
              stroke="#ffffff"
              strokeWidth="1.8"
              opacity="0.85"
            />
          </svg>
          {/* light catching the surface of the water */}
          {[
            { bottom: "9px", left: "3%", w: "22px" },
            { bottom: "5px", left: "10%", w: "14px" },
            { bottom: "13px", left: "1%", w: "12px" },
          ].map((s, i) => (
            <span
              key={i}
              className="tgc-shimmer absolute h-[2px] rounded-full bg-white/75"
              style={{
                bottom: s.bottom,
                left: s.left,
                width: s.w,
                animationDelay: `${i * 1.1}s`,
              }}
            />
          ))}
        </div>
      );
    case "snow-window":
      return (
        <div aria-hidden className={layer}>
          {/* warm fairy lights strung above the window */}
          <StringLights className="left-1/2 top-0 w-64 -translate-x-1/2 text-amber-200/80" />
          {/* a real rectangular window on the (dark, cozy) wall behind the shelf */}
          <div className="absolute left-1/2 top-3 w-52 -translate-x-1/2">
            <div className="relative h-32">
              {/* outer casing */}
              <div
                className="absolute inset-0 rounded-md"
                style={{
                  background: "linear-gradient(180deg, #cbd5e1 0%, #94a3b8 100%)",
                  boxShadow: "0 10px 22px rgba(0,0,0,0.55)",
                }}
              />
              {/* glass — a snowy night outside */}
              <div className="absolute inset-[7px] overflow-hidden rounded-sm">
                <div
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(180deg, #16223f 0%, #2b3f66 55%, #52708f 100%)" }}
                />
                {/* moon */}
                <span
                  className="absolute right-5 top-3 h-6 w-6 rounded-full"
                  style={{
                    background: "radial-gradient(circle at 38% 34%, #fdf6d8 0%, #ddd6ad 100%)",
                    boxShadow: "0 0 12px 3px rgba(253,246,216,0.5)",
                  }}
                />
                <Stars pts={[["16%", "16%"], ["26%", "36%"], ["12%", "58%"], ["34%", "24%"]]} />
                {/* moonlit snowy hills */}
                <svg viewBox="0 0 200 120" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
                  <path d="M0 82 Q52 58 104 76 T200 66 V120 H0 Z" fill="#8ba6c2" />
                  <path d="M0 100 Q60 78 120 95 T200 90 V120 H0 Z" fill="#c6d8e8" />
                </svg>
                {/* pine silhouettes */}
                <PineTree className="bottom-2 left-5 w-7" color="#243f36" />
                <PineTree className="bottom-1 left-10 w-5 opacity-90" color="#2e4c40" />
                {/* snow falling inside the glass */}
                <Snowfall />
              </div>
              {/* muntins (cross bars) dividing the panes */}
              <span className="absolute left-1/2 top-[7px] bottom-[7px] w-[5px] -translate-x-1/2 rounded bg-slate-300 shadow-[0_0_1px_rgba(15,23,42,0.6)]" />
              <span className="absolute left-[7px] right-[7px] top-1/2 h-[5px] -translate-y-1/2 rounded bg-slate-300 shadow-[0_0_1px_rgba(15,23,42,0.6)]" />
            </div>
            {/* sill jutting out past the frame + a tiny potted plant on it */}
            <div
              className="relative -mx-3 h-2.5 rounded-sm"
              style={{ background: "linear-gradient(180deg, #d7dee7 0%, #9aa6b4 100%)", boxShadow: "0 4px 6px rgba(0,0,0,0.45)" }}
            />
            <PottedPlant className="-top-4 right-4 w-6" />
          </div>

          {/* a few flakes drifting down around the mug */}
          <div className="absolute bottom-0 left-0 h-28 w-24">
            <Snowfall />
          </div>
          {/* warm candle glow + steaming mug sitting on the shelf (left margin) */}
          <span
            className="absolute bottom-0 left-2 h-14 w-16 rounded-full blur-[2px]"
            style={{ background: "radial-gradient(circle at 50% 70%, rgba(251,191,36,0.4), transparent 70%)" }}
          />
          <CoffeeCup className="bottom-0 left-4 w-11" />
        </div>
      );
    case "midnight-lamp":
      return (
        <div aria-hidden className={layer}>
          {/* one big window taking the whole wall behind the shelf */}
          <div className="absolute inset-0">
            <div
              className="absolute inset-0 rounded-lg"
              style={{
                background:
                  "linear-gradient(180deg, #4c4266 0%, #2c2444 55%, #1d1830 100%)",
                boxShadow:
                  "0 14px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.16)",
              }}
            />
            {/* the night outside */}
            <div className="absolute inset-[9px] overflow-hidden rounded-[5px] sm:inset-[11px]">
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, #080d24 0%, #161a3c 52%, #2b2452 100%)",
                }}
              />
              <TwinkleStars stars={MIDNIGHT_STARS} />
              <Moon className="right-[13%] top-[9%] h-10 w-10" />
              {/* far-off rooftops give the sky a horizon to sit on */}
              <Skyline className="inset-x-0 bottom-0 h-10 opacity-80" color="#120f24" />
              <GlassPane />
            </div>
            {/* muntins splitting the glass into six panes */}
            <span
              className="absolute bottom-[9px] left-1/3 top-[9px] w-[5px] -translate-x-1/2 rounded-sm sm:bottom-[11px] sm:top-[11px]"
              style={WINDOW_BAR}
            />
            <span
              className="absolute bottom-[9px] left-2/3 top-[9px] w-[5px] -translate-x-1/2 rounded-sm sm:bottom-[11px] sm:top-[11px]"
              style={WINDOW_BAR}
            />
            <span
              className="absolute left-[9px] right-[9px] top-1/2 h-[5px] -translate-y-1/2 rounded-sm sm:left-[11px] sm:right-[11px]"
              style={WINDOW_BAR}
            />
          </div>
          {/* the lamp stands in the room, in front of the glass */}
          <TableLamp className="bottom-0 left-5 w-12" />
        </div>
      );
    case "forest-cabin":
      return (
        <div aria-hidden className={layer}>
          {/* deep-woods dusk settling over the treeline */}
          <span
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(5,30,22,0.5) 0%, rgba(5,30,22,0.18) 58%, transparent 100%)",
            }}
          />
          <PineTree className="bottom-0 left-3 w-12" color="#1f5137" />
          <PineTree className="bottom-0 left-14 w-16" color="#25603f" />
          <PineTree className="bottom-0 left-[30%] w-10 opacity-90" color="#1a4530" />
          <PineTree className="bottom-0 left-[44%] w-14" color="#1c4a31" />
          <span className="absolute bottom-6 left-0 h-8 w-full bg-white/10 blur-md" />
          {/* the cabin tucked into the right edge, like the café storefront */}
          <WoodCabin className="bottom-0 -right-6 w-32 sm:-right-8 sm:w-40" />
          <Fireflies />
        </div>
      );
    case "cafe-corner":
      return (
        <div aria-hidden className={layer}>
          {/* warm sunset — bright sun with orange rays, clouds kept clear of it */}
          <SunRays className="w-40 text-orange-300/70" style={{ left: -22, top: -58 }} />
          <Sun className="left-9 top-0" sizeClass="h-11 w-11" />
          <CloudPuff className="left-[26%] top-1 w-24 text-orange-100" />
          <CloudPuff className="right-5 top-1 w-24 text-amber-100/90" />
          <CloudPuff className="left-1/2 top-9 w-16 text-orange-50" />
          <BirdV className="left-[40%] top-7 w-5 text-slate-400/70" />
          <BirdV className="left-[32%] top-10 w-4 text-slate-400/60" />
          {/* a cozy anime-style café storefront, pushed off the right edge */}
          <CafeHut className="bottom-0 -right-10 w-32 sm:-right-14 sm:w-40" />
          {/* coffee on the table — dark steam so it shows on the light sky */}
          <CoffeeCup className="bottom-0 left-4 w-11" steamClass="bg-slate-700/70" />
        </div>
      );
    case "train-window":
      return (
        <div aria-hidden className={layer}>
          {/* the carriage window: countryside running past outside the glass */}
          <div className="absolute inset-0">
            <div
              className="absolute inset-0 rounded-[16px]"
              style={{
                background:
                  "linear-gradient(180deg, #d5dbe3 0%, #a8b2bf 55%, #8b95a3 100%)",
                boxShadow:
                  "0 12px 26px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.55)",
              }}
            />
            <div className="absolute inset-[10px] overflow-hidden rounded-[10px]">
              {/* blue daytime sky over the fields */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, #9ed8f5 0%, #c6e7f8 48%, #e8f4fb 100%)",
                }}
              />
              <Sun className="right-6 top-0" sizeClass="h-11 w-11" toneClass="text-orange-400" />
              <CloudPuff className="left-4 top-3 w-16 text-white/90" />
              <CloudPuff className="left-[48%] top-1 w-12 text-white/75" />
              <Hills className="inset-x-0 bottom-0 h-16" color="#2f7d57" />
              <div className="absolute inset-x-2 bottom-8 text-white/70">
                <SpeedLines className="inset-0" />
              </div>
              <GlassPane />
            </div>
            {/* vertical mullions across the pane */}
            {[25, 50, 75].map((x) => (
              <span
                key={x}
                className="absolute bottom-[10px] top-[10px] w-[5px] -translate-x-1/2 rounded-sm"
                style={{
                  left: `${x}%`,
                  background:
                    "linear-gradient(180deg, #e2e8f0 0%, #93a0b0 100%)",
                  boxShadow: "0 1px 2px rgba(15,23,42,0.45)",
                }}
              />
            ))}
          </div>
        </div>
      );
    case "rooftop-dusk":
      return (
        <div aria-hidden className={layer}>
          {/* golden-hour sky wash */}
          <span
            className="absolute inset-x-0 top-0 h-24"
            style={{ background: "linear-gradient(180deg, rgba(168,85,247,0.28) 0%, rgba(249,115,22,0.22) 60%, transparent 100%)" }}
          />
          <Sun className="left-[42%] top-4" sizeClass="h-10 w-10" toneClass="text-orange-400" />
          <StringLights className="inset-x-0 top-0 text-amber-200/70" />
          <Skyline className="inset-x-0 bottom-0 h-16" />
        </div>
      );
    default:
      return (
        <>
          <NightScene />
          <DayScene />
        </>
      );
  }
}

const MAX_RECS = 10;
const BOOKS_PER_SHELF = MAX_RECS;

/**
 * The Top Shelf: a single floating wall-mounted plank in an open scene (no
 * bounding panel) — up to 10 books lined up in one row, a few of them leaning.
 * Behind the books: moon, clouds and light rain in dark mode; sun, birds and
 * palm trees in light mode. Hover (or tap on touch) slides a book out and opens
 * a detail card under the unit.
 */
function TopShelfShowcase({
  books,
  isSelf,
  mood,
  onMove,
  onRemove,
  onAdd,
  visitorActions,
}: {
  books: RecommendedBook[];
  isSelf: boolean;
  mood: "" | MoodId;
  onMove: (bookId: string, dir: -1 | 1) => void;
  onRemove: (bookId: string) => void;
  onAdd: () => void;
  visitorActions?: (book: ShelfBook, variant?: "compact" | "labeled") => React.ReactNode;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = books.find((b) => b.id === activeId) ?? null;
  const activeRank = active ? books.findIndex((b) => b.id === active.id) + 1 : 0;

  if (!books.length) {
    return (
      <div className="mx-1 rounded-3xl border border-dashed border-border p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-pill text-foreground">
          <Bookmark size={18} aria-hidden />
        </div>
        <p className="font-display mt-3 text-base font-bold">Your Top Shelf is empty</p>
        <p className="mt-1 text-sm text-muted">
          {isSelf
            ? "Line up to 10 books from your Read shelf — this is the first thing visitors see."
            : "This reader hasn't lined up their Top Shelf yet."}
        </p>
        {isSelf ? (
          <button
            type="button"
            onClick={onAdd}
            className="mt-5 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-pop)]"
            style={{ background: "var(--gradient-brand)" }}
          >
            <Plus size={14} aria-hidden /> Choose from Read shelf
          </button>
        ) : null}
      </div>
    );
  }

  // A single shelf holds all 10 books. The owner's "+" slot sits at the end.
  const rows: RecommendedBook[][] = [];
  for (let i = 0; i < books.length; i += BOOKS_PER_SHELF) {
    rows.push(books.slice(i, i + BOOKS_PER_SHELF));
  }
  const showAdd = isSelf && books.length < MAX_RECS;

  return (
    <div className="overflow-hidden px-1 pb-1">
      <div className="mx-auto max-w-[560px]">
        {rows.map((row, ri) => (
          <div key={ri} className={ri === 0 ? "relative pt-16" : "relative mt-12"}>
            {/* open-air scenery behind the top shelf — reflects the reader's
                mood (or a theme-aware default), no bounding box */}
            {ri === 0 ? (
              <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-3.5 top-0">
                <MoodScene mood={mood} />
              </div>
            ) : null}

            {/* books standing on the plank */}
            <div className="relative z-[1] flex items-end justify-center gap-0.5 px-1 sm:gap-1 sm:px-4">
              {row.map((b) => {
                const rank = books.findIndex((x) => x.id === b.id) + 1;
                const isActive = activeId === b.id;
                const h = titleHash(b.title);
                const cloth = SPINE_CLOTHS[h % SPINE_CLOTHS.length];
                const spineH = 112 + (h % 4) * 10;
                const tilt = SPINE_TILTS[(rank - 1) % SPINE_TILTS.length];
                return (
                  <button
                    key={b.id}
                    type="button"
                    onMouseEnter={() => setActiveId(b.id)}
                    // Open-only on click: hover already opened it on desktop,
                    // so a toggle would close what the user is looking at.
                    // Touch users close via the card's X or another spine.
                    onClick={() => setActiveId(b.id)}
                    aria-expanded={isActive}
                    aria-label={`№${rank}: ${b.title}`}
                    title={b.title}
                    className="relative shrink-0 outline-none transition-[width] duration-300 ease-out focus-visible:ring-2 focus-visible:ring-amber-400/80"
                    style={{ width: isActive ? 84 : 30, height: 156, zIndex: isActive ? 3 : tilt ? 2 : 1 }}
                  >
                    {/* spine — some books lean a little, like a lived-in shelf */}
                    <div
                      className={`absolute bottom-0 left-1/2 flex flex-col items-center justify-between rounded-[3px] pb-1.5 pt-2 transition-all duration-300 ${
                        isActive ? "pointer-events-none opacity-0" : "opacity-100"
                      }`}
                      style={{
                        width: 26,
                        height: spineH,
                        transform: `translateX(-50%) rotate(${tilt}deg)`,
                        transformOrigin: tilt < 0 ? "0% 100%" : tilt > 0 ? "100% 100%" : "50% 100%",
                        background: `linear-gradient(90deg, ${cloth[1]} 0%, ${cloth[0]} 22%, ${cloth[0]} 72%, ${cloth[1]} 100%)`,
                        boxShadow:
                          "inset 2px 0 3px rgba(255,255,255,0.14), inset -3px 0 5px rgba(0,0,0,0.45), 3px 4px 6px rgba(0,0,0,0.35)",
                      }}
                    >
                      <span
                        aria-hidden
                        className="h-[3px] w-[80%] rounded-full opacity-80"
                        style={{ background: "linear-gradient(180deg,#e8c877,#a97e2e)" }}
                      />
                      <span className="font-display max-h-[64%] overflow-hidden px-0.5 text-[9px] font-semibold leading-none tracking-wide text-amber-50/90 [text-orientation:mixed] [writing-mode:vertical-rl]">
                        {spineLabel(b.title)}
                      </span>
                      <span
                        className="font-display flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black text-amber-950 shadow-sm"
                        style={{ background: "linear-gradient(180deg,#ecd08a,#b9903a)" }}
                      >
                        {rank}
                      </span>
                    </div>

                    {/* pulled-out cover */}
                    <div
                      className={`absolute bottom-0 left-1/2 aspect-[2/3] w-[88px] -translate-x-1/2 overflow-hidden rounded-md transition-all duration-300 ${
                        isActive
                          ? "-translate-y-2 opacity-100 shadow-[0_16px_30px_rgba(0,0,0,0.5)] ring-2 ring-amber-400/70"
                          : "pointer-events-none translate-y-1 opacity-0"
                      }`}
                    >
                      <CoverThumb book={b} sizes="88px" />
                    </div>
                  </button>
                );
              })}

              {showAdd && ri === rows.length - 1 ? (
                <button
                  type="button"
                  onClick={onAdd}
                  aria-label="Add a book to your Top Shelf"
                  className="group relative w-[30px] shrink-0 outline-none"
                  style={{ height: 156 }}
                >
                  <div className="absolute bottom-0 left-1/2 flex h-[118px] w-[26px] -translate-x-1/2 items-center justify-center rounded-[3px] border-2 border-dashed border-foreground/25 text-foreground/40 transition group-hover:border-foreground/50 group-hover:text-foreground/70">
                    <Plus size={14} aria-hidden />
                  </div>
                </button>
              ) : null}
            </div>

            {/* floating wall plank with brackets */}
            <div className="relative z-[2] h-3.5 rounded-[4px]" style={woodPlank}>
              <ShelfBracket side="left" />
              <ShelfBracket side="right" />
              {ri === 0 ? (
                <span
                  className="font-display absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center rounded-[3px] px-2.5 py-[2px] text-[8px] font-black uppercase tracking-[0.3em] text-amber-950 shadow-[0_1px_2px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.55)] ring-1 ring-amber-950/60"
                  style={{ background: "linear-gradient(180deg, #ecd08a 0%, #cda44e 55%, #a97e2e 100%)" }}
                >
                  Top Shelf
                </span>
              ) : null}
            </div>
          </div>
        ))}

        {/* ── Floating detail card / hint ── */}
        {active ? (
          <div className="relative z-[1] mt-4 flex items-start gap-3 rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-soft)]">
            <Link
              href={`/book/${active.slug || active.id}`}
              title={active.title}
              className="relative h-[72px] w-12 shrink-0 overflow-hidden rounded-md bg-pill ring-1 ring-border/70"
            >
              <CoverThumb book={active} sizes="48px" />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span
                  className={`font-display inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ring-1 ${
                    RANK_CHIPS[activeRank - 1] ?? "bg-pill text-muted ring-border"
                  }`}
                >
                  {activeRank}
                </span>
                <Link
                  href={`/book/${active.slug || active.id}`}
                  className="min-w-0 truncate text-sm font-bold hover:underline"
                >
                  {active.title}
                </Link>
              </div>
              {active.authors ? (
                <p className="mt-0.5 line-clamp-1 text-xs text-muted">
                  by {(active.authors || "").split(/[;,]/)[0]?.trim()}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {isSelf ? (
                  <>
                    <RecControl
                      label="Move up in ranking"
                      disabled={activeRank === 1}
                      onClick={() => onMove(active.id, -1)}
                    >
                      <ArrowLeft size={13} aria-hidden />
                    </RecControl>
                    <RecControl
                      label="Move down in ranking"
                      disabled={activeRank === books.length}
                      onClick={() => onMove(active.id, 1)}
                    >
                      <ArrowRight size={13} aria-hidden />
                    </RecControl>
                    <RecControl
                      label="Remove from Top Shelf"
                      onClick={() => {
                        onRemove(active.id);
                        setActiveId(null);
                      }}
                    >
                      <Trash2 size={13} aria-hidden />
                    </RecControl>
                  </>
                ) : (
                  visitorActions?.(active, "labeled")
                )}
                <Link
                  href={`/book/${active.slug || active.id}`}
                  className="inline-flex items-center gap-0.5 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:bg-hover hover:text-foreground"
                >
                  View book <ChevronRight size={12} aria-hidden />
                </Link>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveId(null)}
              aria-label="Put the book back"
              className="shrink-0 rounded-full border border-border p-1.5 text-muted transition hover:bg-hover hover:text-foreground"
            >
              <X size={12} aria-hidden />
            </button>
          </div>
        ) : (
          <p className="mt-3 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
            Hover or tap a spine to pull a book out
          </p>
        )}
      </div>
    </div>
  );
}

function RecControl({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="rounded-full border border-border p-1.5 text-muted transition hover:bg-hover hover:text-foreground disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function ShelfBlock({
  books,
  isSelf,
  emptyTitle,
  emptyHint,
  actions,
}: {
  books: ShelfBook[];
  isSelf: boolean;
  emptyTitle: string;
  emptyHint: string;
  actions?: (book: ShelfBook) => React.ReactNode;
}) {
  if (!books.length) {
    return (
      <EmptyShelf
        icon={<Bookmark size={18} aria-hidden />}
        title={emptyTitle}
        hint={emptyHint}
        cta={isSelf ? { href: "/", label: "Browse books" } : null}
      />
    );
  }
  return <ProfileBookGrid books={books} emptyLabel={emptyTitle} actions={actions} />;
}

function ShelfModal({
  openTab,
  onClose,
  isSelf,
  wantToRead,
  readBooks,
  following,
  recommendations,
  onMarkRead,
  onMoveToWant,
  onRecommend,
  visitorActions,
}: {
  openTab: ShelfModalTab | null;
  onClose: () => void;
  isSelf: boolean;
  wantToRead: ShelfBook[];
  readBooks: ShelfBook[];
  following: ShelfBook[];
  recommendations: RecommendedBook[];
  onMarkRead: (bookId: string) => void;
  onMoveToWant: (bookId: string) => void;
  onRecommend: (bookId: string) => void;
  visitorActions?: (book: ShelfBook) => React.ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<ShelfModalTab>("want-to-read");

  useEffect(() => {
    if (!openTab) return;
    setActiveTab(openTab);
  }, [openTab]);

  useEffect(() => {
    if (!openTab) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openTab, onClose]);

  if (!openTab) return null;

  const tabs: { id: ShelfModalTab; label: string; count: number }[] = [
    { id: "want-to-read", label: "Wishlist", count: wantToRead.length },
    { id: "read", label: "Read", count: readBooks.length },
    { id: "following", label: "Currently reading", count: following.length },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/55 backdrop-blur-[1px] sm:items-center sm:justify-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative max-h-[85vh] w-full overflow-hidden rounded-t-3xl border border-border bg-background sm:mx-4 sm:max-w-3xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-sm font-semibold">Library</p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-border p-1.5 text-muted transition hover:bg-hover"
              aria-label="Close modal"
            >
              <X size={14} aria-hidden />
            </button>
          </div>
          <div className="flex border-t border-border/60">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`relative flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-semibold uppercase tracking-wide ${
                  activeTab === t.id ? "text-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                <span>{t.label}</span>
                <span className="rounded-full bg-pill px-1.5 text-[10px] font-bold leading-4">
                  {t.count}
                </span>
                {activeTab === t.id ? (
                  <span
                    aria-hidden
                    className="absolute inset-x-3 -bottom-px h-[2px] rounded-full"
                    style={{ background: "var(--gradient-brand)" }}
                  />
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[calc(85vh-92px)] overflow-y-auto p-3 sm:p-4">
          {activeTab === "want-to-read" ? (
            <ShelfBlock
              books={wantToRead}
              isSelf={isSelf}
              emptyTitle="Wishlist is empty"
              emptyHint={
                isSelf ? "Tap “Add to wishlist” on any book page." : "No planned books yet."
              }
              actions={
                isSelf
                  ? (book) => (
                      <button
                        type="button"
                        onClick={() => onMarkRead(book.id)}
                        className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold transition hover:bg-hover"
                      >
                        Mark read
                      </button>
                    )
                  : visitorActions
              }
            />
          ) : activeTab === "read" ? (
            <ShelfBlock
              books={readBooks}
              isSelf={isSelf}
              emptyTitle="No books marked read yet"
              emptyHint={
                isSelf
                  ? "Mark books as read from book pages or your wishlist."
                  : "No completed books showcased yet."
              }
              actions={
                isSelf
                  ? (book) => (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onMoveToWant(book.id)}
                          className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold transition hover:bg-hover"
                        >
                          Move to wishlist
                        </button>
                        <button
                          type="button"
                          onClick={() => onRecommend(book.id)}
                          disabled={
                            recommendations.some((r) => r.id === book.id) ||
                            recommendations.length >= 10
                          }
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold transition hover:bg-hover disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          <Plus size={11} aria-hidden /> Recommend
                        </button>
                      </div>
                    )
                  : visitorActions
              }
            />
          ) : (
            <ShelfBlock
              books={following}
              isSelf={isSelf}
              emptyTitle="Not following any books"
              emptyHint={
                isSelf
                  ? "Follow books from Explore to tune your home feed."
                  : "When they follow a book, it'll show up here."
              }
              actions={isSelf ? undefined : visitorActions}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyShelf({
  icon,
  title,
  hint,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  cta: { href: string; label: string } | null;
}) {
  return (
    <div className="mx-2 rounded-3xl border border-dashed border-border p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-pill text-foreground">
        {icon}
      </div>
      <p className="mt-3 text-base font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted">{hint}</p>
      {cta ? (
        <Link
          href={cta.href}
          className="mt-5 inline-flex rounded-full px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-pop)]"
          style={{ background: "var(--gradient-brand)" }}
        >
          {cta.label}
        </Link>
      ) : null}
    </div>
  );
}
