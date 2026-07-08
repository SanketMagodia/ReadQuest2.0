"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  BookOpen,
  Coffee,
  Compass,
  Flame,
  Lightbulb,
  MessageCircle,
  PenSquare,
  Quote,
  Shield,
  Sparkles,
  Sprout,
  UserRound,
  Users,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { JoinReadquestRailPitch } from "@/components/auth/UnlockFeatures";
import { AnnouncementRailStrip } from "@/components/announcements/AnnouncementStrips";
import { BRAND_SHORT } from "@/lib/brand";

// ──────────────────────────────────────────────────────────────────────────────
// Tile primitives
// ──────────────────────────────────────────────────────────────────────────────

type Eyebrow = {
  label: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  tone?: "brand" | "warm" | "cool" | "muted" | "rose";
};

const toneTextClass: Record<NonNullable<Eyebrow["tone"]>, string> = {
  brand: "text-sky-600 dark:text-sky-300",
  warm: "text-amber-600 dark:text-amber-300",
  cool: "text-emerald-600 dark:text-emerald-300",
  muted: "text-muted",
  rose: "text-rose-600 dark:text-rose-300",
};

function TileShell({
  children,
  variant = "card",
  className = "",
}: {
  children: ReactNode;
  variant?: "card" | "gradient-frame" | "dashed";
  className?: string;
}) {
  if (variant === "gradient-frame") {
    return (
      <section
        className={`rounded-3xl p-px shadow-[var(--shadow-soft)] ${className}`}
        style={{ background: "var(--gradient-brand)" }}
      >
        <div className="rounded-[22px] bg-card p-5">{children}</div>
      </section>
    );
  }
  if (variant === "dashed") {
    return (
      <section
        className={`rounded-3xl border border-dashed border-border bg-card/60 p-5 ${className}`}
      >
        {children}
      </section>
    );
  }
  return (
    <section
      className={`rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] ${className}`}
    >
      {children}
    </section>
  );
}

function Eyebrow({ label, icon: Icon, tone = "muted" }: Eyebrow) {
  return (
    <p
      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] ${toneTextClass[tone]}`}
    >
      {Icon ? <Icon size={11} aria-hidden /> : null}
      {label}
    </p>
  );
}

function TileCTA({
  href,
  children,
  variant = "brand",
}: {
  href: string;
  children: ReactNode;
  variant?: "brand" | "warm" | "cool" | "outline";
}) {
  if (variant === "outline") {
    return (
      <Link
        href={href}
        className="mt-4 block w-full rounded-full border border-border bg-card px-4 py-2 text-center text-sm font-semibold hover:bg-hover"
      >
        {children}
      </Link>
    );
  }
  const bg =
    variant === "warm"
      ? "var(--gradient-warm)"
      : variant === "cool"
        ? "var(--gradient-cool)"
        : "var(--gradient-brand)";
  return (
    <Link
      href={href}
      className="mt-4 block w-full rounded-full px-4 py-2 text-center text-sm font-semibold text-white shadow-[var(--shadow-pop)] transition hover:brightness-110"
      style={{ background: bg }}
    >
      {children}
    </Link>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Individual tiles
// ──────────────────────────────────────────────────────────────────────────────

const dailyPrompts = [
  "What's a line you keep returning to?",
  "A book that wrecked you in the best way?",
  "Quote a sentence that earned a full stop.",
  "Which book aged into a new meaning for you?",
  "A character whose silence said the most.",
  "What did you underline this week?",
  "Pair two unlikely books that secretly share a soul.",
  "A first line that hooked you instantly.",
];

function todaysPrompt() {
  // Deterministic per day so it doesn't flicker on re-render.
  const day = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  return dailyPrompts[day % dailyPrompts.length];
}

function BrandTile({ authenticated }: { authenticated: boolean }) {
  if (!authenticated) {
    return <JoinReadquestRailPitch />;
  }
  return (
    <TileShell variant="gradient-frame">
      <Eyebrow label={BRAND_SHORT} tone="brand" icon={Sparkles} />
      <p className="mt-2 text-base font-semibold leading-snug">
        For readers who live in the margins.
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        Follow books. Save a readlist. Thread the lines that moved you.
      </p>
      <TileCTA href="/compose">Share a quote</TileCTA>
    </TileShell>
  );
}

function TodaysPromptTile() {
  return (
    <TileShell>
      <Eyebrow label="Today's prompt" tone="warm" icon={Coffee} />
      <p className="mt-2 text-[15px] font-semibold leading-snug">
        {todaysPrompt()}
      </p>
      <p className="mt-1 text-[12px] text-muted">
        Drop a quick post — even one line counts.
      </p>
      <TileCTA href="/compose" variant="warm">
        Compose
      </TileCTA>
    </TileShell>
  );
}

function GeneralTipTile() {
  return (
    <TileShell>
      <Eyebrow label="Tip" icon={Lightbulb} tone="warm" />
      <p className="mt-2 text-[13px] leading-relaxed text-foreground/85">
        Follow books from Explore to personalize your feed. We rank posts by
        what you read, save, and follow.
      </p>
    </TileShell>
  );
}

function ExploreDiscoverTile() {
  const chips = ["Fiction", "Memoir", "Sci-fi", "Poetry", "Essays"];
  return (
    <TileShell>
      <Eyebrow label="Discover" tone="cool" icon={Compass} />
      <p className="mt-2 text-[15px] font-semibold leading-snug">
        Pick a mood. Find a book room.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <Link
            key={c}
            href={`/explore?q=${encodeURIComponent(c)}`}
            className="rounded-full bg-pill px-2.5 py-1 text-[11px] font-semibold text-foreground/80 hover:bg-hover"
          >
            #{c}
          </Link>
        ))}
      </div>
    </TileShell>
  );
}

function ExploreCommunitiesTile() {
  return (
    <TileShell variant="dashed">
      <Eyebrow label="Communities" tone="brand" icon={Flame} />
      <p className="mt-2 text-[13px] leading-relaxed text-foreground/85">
        Active book rooms surface on top. Posts, comments, and engaged readers
        feed the ranking — show up and you&apos;ll climb.
      </p>
    </TileShell>
  );
}

function ComposePlaybookTile() {
  return (
    <TileShell>
      <Eyebrow label="Posting playbook" tone="brand" icon={PenSquare} />
      <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-foreground/85">
        <li className="flex gap-2">
          <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
          Tag a book — your post lands in its room.
        </li>
        <li className="flex gap-2">
          <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
          One sharp thought beats three vague ones.
        </li>
        <li className="flex gap-2">
          <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-fuchsia-500" />
          Mark a spoiler with <code className="rounded bg-pill px-1">[spoiler]</code> in the title.
        </li>
      </ul>
    </TileShell>
  );
}

function ComposeQuoteTile() {
  return (
    <TileShell variant="gradient-frame">
      <Eyebrow label="Quote etiquette" tone="brand" icon={Quote} />
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        Format quotes as <em>&ldquo;the line&rdquo; — Author</em>. Brief context
        below the quote earns the most replies.
      </p>
    </TileShell>
  );
}

function ThreadEtiquetteTile() {
  return (
    <TileShell>
      <Eyebrow label="Thread kit" tone="rose" icon={MessageCircle} />
      <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-foreground/85">
        <li>Reply to the line, not the reader.</li>
        <li>If you disagree, quote what you&apos;re responding to.</li>
        <li>Long take? Make a new post and link this thread.</li>
      </ul>
    </TileShell>
  );
}

function BookRoomTile({ slug }: { slug?: string }) {
  return (
    <TileShell variant="gradient-frame">
      <Eyebrow label="Book room" tone="brand" icon={BookOpen} />
      <p className="mt-2 text-base font-semibold leading-snug">
        Read deeper, together.
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        Open the AI-written summary, then jump back to threads from other
        readers on this book.
      </p>
      {slug ? (
        <TileCTA href={`/book/${slug}/summary`}>Read summary</TileCTA>
      ) : null}
    </TileShell>
  );
}

function ProfileTipTile({ ownProfile }: { ownProfile: boolean }) {
  return (
    <TileShell>
      <Eyebrow label="Profile" tone="cool" icon={UserRound} />
      <p className="mt-2 text-[13px] leading-relaxed text-foreground/85">
        {ownProfile
          ? "Add a bio and a photo — followers stick around when a profile has a voice."
          : "Hit follow to keep an eye on what they post and quote."}
      </p>
    </TileShell>
  );
}

function AdminTile() {
  return (
    <TileShell variant="dashed">
      <Eyebrow label="Admin" tone="rose" icon={Shield} />
      <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-foreground/85">
        <li>
          <Link href="/admin" className="font-semibold underline-offset-4 hover:underline">
            Bot manager
          </Link>{" "}
          — schedule personas, replies, auto-responses.
        </li>
        <li>Force a tick if the feed feels sleepy.</li>
      </ul>
    </TileShell>
  );
}

function FriendsHowToTile() {
  return (
    <TileShell>
      <Eyebrow label="Friends" tone="brand" icon={Users} />
      <p className="mt-2 text-[13px] leading-relaxed text-foreground/85">
        Search a username, send a request, and see what they&apos;re reading
        the moment they post.
      </p>
      <ul className="mt-3 space-y-1.5 text-[12px] leading-relaxed text-muted">
        <li>· Requests show up here and in your notifications.</li>
        <li>· Friends only sees public posts — nothing private.</li>
        <li>· Remove anyone from the list anytime.</li>
      </ul>
    </TileShell>
  );
}

function FeedGrowTile() {
  return (
    <TileShell variant="dashed">
      <Eyebrow label="Grow your feed" tone="cool" icon={Sprout} />
      <p className="mt-2 text-[13px] leading-relaxed text-foreground/85">
        Follow a few books from{" "}
        <Link href="/explore" className="font-semibold underline-offset-4 hover:underline">
          Explore
        </Link>{" "}
        and your top posts will feel made for you within a day.
      </p>
    </TileShell>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Route → tile composition
// ──────────────────────────────────────────────────────────────────────────────

function tilesFor(pathname: string, authenticated: boolean): ReactNode[] {
  // 1) Routes that should not render a right rail at all.
  if (/^\/book\/[^/]+\/summary\/?$/.test(pathname)) return [];
  if (pathname.startsWith("/login") || pathname.startsWith("/register"))
    return [];

  // 2) Per-route compositions.
  if (pathname === "/" || pathname.startsWith("/?")) {
    return [
      <TodaysPromptTile key="prompt" />,
      <GeneralTipTile key="tip" />,
      <InstallPrompt key="install" variant="card" />,
    ];
  }

  if (pathname.startsWith("/explore")) {
    return [
      <ExploreDiscoverTile key="discover" />,
      <ExploreCommunitiesTile key="comm" />,
      <InstallPrompt key="install" variant="card" />,
    ];
  }

  if (pathname.startsWith("/compose")) {
    return [
      <ComposePlaybookTile key="playbook" />,
      <ComposeQuoteTile key="quote" />,
    ];
  }

  if (pathname.startsWith("/post/")) {
    return [
      <ThreadEtiquetteTile key="thread" />,
      <FeedGrowTile key="grow" />,
    ];
  }

  if (/^\/book\/[^/]+\/?$/.test(pathname)) {
    const slug = pathname.split("/")[2];
    return [
      <BookRoomTile key="book" slug={slug} />,
      <ThreadEtiquetteTile key="thread" />,
    ];
  }

  if (pathname.startsWith("/profile/")) {
    return [
      <ProfileTipTile key="profile" ownProfile />,
      <GeneralTipTile key="tip" />,
    ];
  }

  if (pathname.startsWith("/friends")) {
    return [
      <FriendsHowToTile key="friends" />,
      <GeneralTipTile key="tip" />,
    ];
  }

  if (pathname.startsWith("/admin")) {
    return [<AdminTile key="admin" />, <FeedGrowTile key="grow" />];
  }

  // 3) Fallback for everything else (404, settings, etc.).
  return [
    <BrandTile key="brand" authenticated={authenticated} />,
    <GeneralTipTile key="tip" />,
  ];
}

// ──────────────────────────────────────────────────────────────────────────────
// Exported component
// ──────────────────────────────────────────────────────────────────────────────

export function RightRail() {
  const pathname = usePathname() ?? "/";
  const { status } = useSession();
  const authenticated = status === "authenticated";

  const tiles = tilesFor(pathname, authenticated);
  if (!tiles.length) return null;

  return (
    <aside
      className="sticky top-0 z-10 hidden max-h-[100dvh] min-h-0 w-[220px] shrink-0 flex-col gap-3 overflow-y-auto overscroll-contain py-4 layout-wide:flex xl:w-[240px]"
      aria-label="Sidebar"
    >
      <AnnouncementRailStrip />
      {tiles}
    </aside>
  );
}
