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
        Follow books. Save a readlist. Keep the lines that moved you.
      </p>
      <TileCTA href="/explore">Find your next book</TileCTA>
    </TileShell>
  );
}

function TodaysPromptTile({ username }: { username?: string }) {
  return (
    <TileShell>
      <Eyebrow label="Today's prompt" tone="warm" icon={Coffee} />
      <p className="mt-2 text-[15px] font-semibold leading-snug">
        {todaysPrompt()}
      </p>
      <p className="mt-1 text-[12px] text-muted">
        Answer it in your memories — nobody else sees them.
      </p>
      {username ? (
        <TileCTA href={`/profile/${username}#memories`} variant="warm">
          Keep a line
        </TileCTA>
      ) : null}
    </TileShell>
  );
}

function GeneralTipTile() {
  return (
    <TileShell>
      <Eyebrow label="Tip" icon={Lightbulb} tone="warm" />
      <p className="mt-2 text-[13px] leading-relaxed text-foreground/85">
        Follow books and save them to a shelf — Gists reads those signals
        and gets sharper every day.
      </p>
    </TileShell>
  );
}

function MemoriesTile({ username }: { username?: string }) {
  return (
    <TileShell>
      <Eyebrow label="Memories" tone="rose" icon={Quote} />
      <p className="mt-2 text-[13px] leading-relaxed text-foreground/85">
        Highlight any passage while you read the gist and keep it. Your
        memories are private — only you ever see them.
      </p>
      {username ? (
        <TileCTA href={`/profile/${username}#memories`} variant="outline">
          Open your memories
        </TileCTA>
      ) : null}
    </TileShell>
  );
}

function ReelHowToTile() {
  return (
    <TileShell variant="dashed">
      <Eyebrow label="Gists" tone="brand" icon={Sprout} />
      <p className="mt-2 text-[13px] leading-relaxed text-foreground/85">
        Left or right turns the page. Up skips. Save a line as a memory —
        only you see it. Follow and shelf books so the next gist is sharper.
      </p>
    </TileShell>
  );
}

function SummaryNextTile() {
  return (
    <TileShell>
      <Eyebrow label="Keep going" tone="warm" icon={BookOpen} />
      <p className="mt-2 text-[13px] leading-relaxed text-foreground/85">
        The next gist is a book close to this one. Swipe up and that shelf
        keeps going.
      </p>
      <ul className="mt-3 space-y-1.5 text-[12px] leading-relaxed text-muted">
        <li>· Share sends the page, the title, and an invite.</li>
        <li>· Highlight a line to keep it. Only you see it.</li>
        <li>· The title opens that book&apos;s page.</li>
      </ul>
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
      <Eyebrow label="Book rooms" tone="brand" icon={Flame} />
      <p className="mt-2 text-[13px] leading-relaxed text-foreground/85">
        The busiest rooms surface on top. Shelving a book, following it, or
        finishing its gist all count toward the ranking.
      </p>
    </TileShell>
  );
}

/**
 * No CTA here on purpose: only the page itself knows whether this book has a
 * gist yet, and it puts the button next to the cover when it does.
 */
function BookRoomTile() {
  return (
    <TileShell variant="gradient-frame">
      <Eyebrow label="Book room" tone="brand" icon={BookOpen} />
      <p className="mt-2 text-base font-semibold leading-snug">
        The whole book, in one sitting.
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        An AI-written retelling in the book&apos;s own voice — long enough to
        matter, short enough to finish. Keep scrolling and the books next to it
        follow.
      </p>
    </TileShell>
  );
}

function ProfileTipTile({ ownProfile }: { ownProfile: boolean }) {
  return (
    <TileShell>
      <Eyebrow label="Profile" tone="cool" icon={UserRound} />
      <p className="mt-2 text-[13px] leading-relaxed text-foreground/85">
        {ownProfile
          ? "Add a bio and a photo — your shelves say more with a voice behind them."
          : "Hit follow to keep an eye on what they're reading."}
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
            Dashboard
          </Link>{" "}
          — readers, books, and broadcasts at a glance.
        </li>
        <li>Broadcasts land on every reader&apos;s home.</li>
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
        right now.
      </p>
      <ul className="mt-3 space-y-1.5 text-[12px] leading-relaxed text-muted">
        <li>· Requests show up here and in your notifications.</li>
        <li>· Shelves are shared; memories never are.</li>
        <li>· Remove anyone from the list anytime.</li>
      </ul>
    </TileShell>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Route → tile composition
// ──────────────────────────────────────────────────────────────────────────────

function tilesFor(
  pathname: string,
  authenticated: boolean,
  username?: string
): ReactNode[] {
  // 1) Routes that should not render a right rail at all.
  if (pathname.startsWith("/login") || pathname.startsWith("/register"))
    return [];

  // A book's gist reel: the same reading tips as home, plus what the scroll does.
  if (/^\/book\/[^/]+\/summary\/?$/.test(pathname)) {
    return [
      <ReelHowToTile key="gist" />,
      <SummaryNextTile key="next" />,
    ];
  }

  // 2) Per-route compositions. Home keeps announcements + one short tip.
  if (pathname === "/" || pathname.startsWith("/?")) {
    return [<ReelHowToTile key="gist" />];
  }

  if (pathname.startsWith("/explore")) {
    return [
      <ExploreDiscoverTile key="discover" />,
      <ExploreCommunitiesTile key="comm" />,
      <InstallPrompt key="install" variant="card" />,
    ];
  }

  if (/^\/book\/[^/]+\/?$/.test(pathname)) {
    return [
      <BookRoomTile key="book" />,
      <MemoriesTile key="memories" username={username} />,
    ];
  }

  if (pathname.startsWith("/profile/")) {
    return [
      <ProfileTipTile key="profile" ownProfile />,
      <TodaysPromptTile key="prompt" username={username} />,
    ];
  }

  if (pathname.startsWith("/friends")) {
    return [
      <FriendsHowToTile key="friends" />,
      <GeneralTipTile key="tip" />,
    ];
  }

  if (pathname.startsWith("/admin")) {
    return [<AdminTile key="admin" />, <GeneralTipTile key="tip" />];
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
  const { data: session, status } = useSession();
  const authenticated = status === "authenticated";

  const tiles = tilesFor(pathname, authenticated, session?.user?.username);
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
