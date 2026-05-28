"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Bookmark,
  Grid3X3,
  Library,
  Pencil,
  CalendarDays,
  Sparkles,
  Camera,
  Trash2,
  X,
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
  readlist: number;
  following: number;
};

type ProfileTab = "posts" | "readlist" | "following";

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
  const [readlist, setReadlist] = useState<ShelfBook[]>([]);
  const [following, setFollowing] = useState<ShelfBook[]>([]);
  const [counts, setCounts] = useState<ShelfCounts>({
    posts: 0,
    readlist: 0,
    following: 0,
  });
  const [tab, setTab] = useState<ProfileTab>("posts");
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
            readlist?: ShelfBook[];
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
      setReadlist(shelf?.readlist ?? []);
      setFollowing(shelf?.following ?? []);
      setCounts(
        shelf?.counts ?? {
          posts: Array.isArray(pjson) ? pjson.length : 0,
          readlist: shelf?.readlist?.length ?? 0,
          following: shelf?.following?.length ?? 0,
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

  const tabs: { id: ProfileTab; label: string; icon: typeof Grid3X3; count: number }[] = [
    { id: "posts", label: "Posts", icon: Grid3X3, count: counts.posts },
    { id: "readlist", label: "Readlist", icon: Bookmark, count: counts.readlist },
    { id: "following", label: "Following", icon: Library, count: counts.following },
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

        <div className="mt-6 grid grid-cols-3 divide-x divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex flex-col items-center gap-0.5 px-2 py-3 text-center transition ${
                tab === t.id ? "bg-pill" : "hover:bg-hover"
              }`}
              aria-pressed={tab === t.id}
            >
              <span className="text-lg font-bold sm:text-xl">{t.count}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                {t.label}
              </span>
            </button>
          ))}
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
        {tabs.map(({ id, label, icon: Icon }) => (
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
        ) : tab === "readlist" ? (
          <ShelfBlock
            books={readlist}
            isSelf={isSelf}
            emptyTitle="Readlist is empty"
            emptyHint={
              isSelf
                ? "Tap “Add to readlist” on any book page."
                : "No saved books yet."
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
      </section>
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
}: {
  books: ShelfBook[];
  isSelf: boolean;
  emptyTitle: string;
  emptyHint: string;
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
  return <ProfileBookGrid books={books} emptyLabel={emptyTitle} />;
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
