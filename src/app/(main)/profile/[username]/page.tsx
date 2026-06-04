"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Bookmark,
  CheckCircle2,
  Grid3X3,
  Library,
  Pencil,
  CalendarDays,
  Sparkles,
  Camera,
  Trash2,
  X,
  ArrowDown,
  ArrowUp,
  Plus,
} from "lucide-react";
import type { PostDTO } from "@/lib/serialize";
import { PostCard } from "@/components/posts/PostCard";
import {
  ProfileBookGrid,
  type ShelfBook,
} from "@/components/profile/ProfileBookGrid";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { PostSkeletonList } from "@/components/feed/PostSkeleton";
import { resizeAvatar } from "@/lib/image";

type PublicUser = {
  id: string;
  username: string;
  name: string;
  image?: string;
  bio: string;
  createdAt?: string;
};

type ShelfCounts = {
  posts: number;
  wantToRead: number;
  read: number;
  following: number;
  recommendations: number;
};

type ReadStatus = "want" | "read";

type RecommendedBook = ShelfBook & { rank: number };

type ProfileTab = "posts" | "recommendations";
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

export default function ProfilePage() {
  const params = useParams<{ username: string }>();
  const username = typeof params?.username === "string" ? params.username : "";
  const { data: session } = useSession();

  const [user, setUser] = useState<PublicUser | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [posts, setPosts] = useState<PostDTO[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [wantToRead, setWantToRead] = useState<ShelfBook[]>([]);
  const [readBooks, setReadBooks] = useState<ShelfBook[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendedBook[]>([]);
  const [following, setFollowing] = useState<ShelfBook[]>([]);
  const [counts, setCounts] = useState<ShelfCounts>({
    posts: 0,
    wantToRead: 0,
    read: 0,
    following: 0,
    recommendations: 0,
  });
  const [tab, setTab] = useState<ProfileTab>("posts");
  const [shelfModalTab, setShelfModalTab] = useState<ShelfModalTab | null>(null);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [saving, setSaving] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isSelf =
    session?.user?.username?.toLowerCase() === username.toLowerCase();

  useEffect(() => {
    async function load() {
      setPostsLoading(true);
      const [ru, rp, rs] = await Promise.all([
        fetch(`/api/users/${encodeURIComponent(username)}`, { cache: "no-store" }),
        fetch(`/api/posts?username=${encodeURIComponent(username)}`, {
          cache: "no-store",
        }),
        fetch(`/api/users/${encodeURIComponent(username)}/shelf`, {
          cache: "no-store",
        }),
      ]);
      const ujson = ru.ok ? await ru.json() : null;
      const pjson = rp.ok
        ? (((await rp.json()) as unknown) as { posts?: PostDTO[] }).posts
        : [];
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

      setUser(udoc);
      setBio(udoc?.bio ?? "");
      setName(udoc?.name ?? "");
      setImage(udoc?.image ?? "");
      setPosts(Array.isArray(pjson) ? pjson : []);
      setWantToRead(shelf?.wantToRead ?? []);
      setReadBooks(shelf?.read ?? []);
      setRecommendations(
        (shelf?.recommendations ?? []).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
      );
      setFollowing(shelf?.following ?? []);
      setCounts(
        shelf?.counts ?? {
          posts: Array.isArray(pjson) ? pjson.length : 0,
          wantToRead: shelf?.wantToRead?.length ?? 0,
          read: shelf?.read?.length ?? 0,
          following: shelf?.following?.length ?? 0,
          recommendations: shelf?.recommendations?.length ?? 0,
        }
      );
      setPostsLoading(false);
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

  const initials = useMemo(
    () => (user ? user.username.slice(0, 2).toUpperCase() : "RQ"),
    [user]
  );

  if (!user && !loadedOnce) {
    return <LoadingIndicator fullPage label="Loading profile…" />;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-lg font-semibold">Profile not found</p>
        <Link
          href="/explore"
          className="mt-3 inline-flex rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-hover"
        >
          Back to Explore
        </Link>
      </div>
    );
  }

  const primaryTabs: { id: ProfileTab; label: string; icon: typeof Grid3X3 }[] = [
    { id: "posts", label: "Posts", icon: Grid3X3 },
    { id: "recommendations", label: "Recommendations", icon: Sparkles },
  ];
  const quickShelfLinks: {
    id: ShelfModalTab;
    label: string;
    count: number;
  }[] = [
    { id: "want-to-read", label: "Wishlist", count: counts.wantToRead },
    { id: "read", label: "Read", count: counts.read },
    { id: "following", label: "Following", count: counts.following },
  ];

  const joined = formatJoined(user.createdAt);

  return (
    <div className="mx-auto w-full max-w-3xl px-2 pb-12 sm:px-4">
      <div
        aria-hidden
        className="relative h-32 sm:h-44 rounded-b-[28px] overflow-hidden"
        style={{ background: "var(--gradient-brand)" }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.35),transparent_55%),radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.25),transparent_55%)]" />
      </div>

      <header className="px-4 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-7">
          {/* Avatar floats up into the cover banner, separate from the rest */}
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

          {/* Right column sits below the cover, safe from overlap */}
          <div className="min-w-0 flex-1 pt-1 sm:pt-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
                  {user.name || `@${user.username}`}
                </h1>
                <p className="mt-0.5 text-sm text-muted">@{user.username}</p>
              </div>
              <div className="ml-auto flex flex-col items-end gap-2">
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
                ) : null}
                <div className="flex flex-wrap justify-end gap-2">
                  {quickShelfLinks.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setShelfModalTab(item.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        shelfModalTab === item.id
                          ? "border-sky-400/60 bg-sky-500/15 text-foreground"
                          : "border-border bg-card text-muted hover:bg-hover hover:text-foreground"
                      }`}
                    >
                      <span className="text-[13px] font-black leading-none">{item.count}</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-3 max-w-prose whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/90">
              {user.bio || (isSelf ? "Add a bio so readers know your vibe." : "Quiet reader vibes.")}
            </p>
            {joined ? (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-pill px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                <CalendarDays size={12} aria-hidden />
                Joined {joined}
              </p>
            ) : null}
          </div>
        </div>

      </header>

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
                setImageError(null);
              }}
              className="rounded-full border border-border bg-card px-5 py-2 text-sm font-semibold transition hover:bg-hover"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <nav
        className="mt-6 flex border-b border-border"
        aria-label="Profile sections"
      >
        {primaryTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`relative flex flex-1 items-center justify-center gap-2 py-3 text-xs font-semibold uppercase tracking-wide transition ${
              tab === id ? "text-foreground" : "text-muted hover:text-foreground"
            }`}
            aria-current={tab === id ? "page" : undefined}
          >
            <Icon size={16} aria-hidden strokeWidth={tab === id ? 2.4 : 1.75} />
            <span className="hidden sm:inline">{label}</span>
            {tab === id ? (
              <span
                aria-hidden
                className="absolute inset-x-3 -bottom-px h-[2px] rounded-full"
                style={{ background: "var(--gradient-brand)" }}
              />
            ) : null}
          </button>
        ))}
      </nav>

      <section className="min-h-[200px] pt-5">
        {tab === "posts" ? (
          postsLoading ? (
            <div className="px-2">
              <PostSkeletonList count={3} />
            </div>
          ) : posts.length ? (
            <div className="flex flex-col gap-4 px-2">
              {posts.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  onDeleted={(postId) =>
                    setPosts((prev) => prev.filter((row) => row.id !== postId))
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyShelf
              icon={<Sparkles size={18} aria-hidden />}
              title="No posts yet"
              hint={
                isSelf
                  ? "Share a line from a book — head to Compose."
                  : "When they post, it'll show up here."
              }
              cta={isSelf ? { href: "/compose", label: "Compose a post" } : null}
            />
          )
        ) : (
          <RecommendationsBlock
            books={recommendations}
            isSelf={isSelf}
            onMove={moveRecommendation}
            onRemove={removeRecommendation}
            emptyHint={
              isSelf
                ? "Add up to 8 books from your Read shelf and rank them."
                : "No recommendations shared yet."
            }
          />
        )}
      </section>

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
      />
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
        cta={isSelf ? { href: "/explore", label: "Browse books" } : null}
      />
    );
  }
  return <ProfileBookGrid books={books} emptyLabel={emptyTitle} actions={actions} />;
}

function RecommendationsBlock({
  books,
  isSelf,
  onMove,
  onRemove,
  emptyHint,
}: {
  books: RecommendedBook[];
  isSelf: boolean;
  onMove: (bookId: string, dir: -1 | 1) => void;
  onRemove: (bookId: string) => void;
  emptyHint: string;
}) {
  if (!books.length) {
    return (
      <EmptyShelf
        icon={<Sparkles size={18} aria-hidden />}
        title="No recommendations yet"
        hint={emptyHint}
        cta={null}
      />
    );
  }

  return (
    <ul className="mx-2 space-y-2">
      {books.map((b, idx) => (
        <li
          key={b.id}
          className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2.5"
        >
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pill text-xs font-black">
            #{idx + 1}
          </span>
          <Link href={`/book/${b.slug || b.id}`} className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{b.title}</p>
            {b.authors ? (
              <p className="truncate text-xs text-muted">
                by {(b.authors || "").split(/[;,]/)[0]?.trim()}
              </p>
            ) : null}
          </Link>
          {isSelf ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onMove(b.id, -1)}
                disabled={idx === 0}
                className="rounded-full border border-border p-1.5 text-muted transition hover:bg-hover disabled:opacity-40"
                aria-label="Move up"
              >
                <ArrowUp size={13} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => onMove(b.id, 1)}
                disabled={idx === books.length - 1}
                className="rounded-full border border-border p-1.5 text-muted transition hover:bg-hover disabled:opacity-40"
                aria-label="Move down"
              >
                <ArrowDown size={13} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => onRemove(b.id)}
                className="rounded-full border border-border p-1.5 text-muted transition hover:bg-hover"
                aria-label="Remove recommendation"
              >
                <Trash2 size={13} aria-hidden />
              </button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
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
    { id: "following", label: "Following", count: following.length },
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
                  : undefined
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
                            recommendations.length >= 8
                          }
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold transition hover:bg-hover disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          <Plus size={11} aria-hidden /> Recommend
                        </button>
                      </div>
                    )
                  : undefined
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
