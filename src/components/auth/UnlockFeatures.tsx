import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Flame,
  MessageCircle,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BRAND_SHORT } from "@/lib/brand";

export const UNLOCK_FEATURES = [
  {
    icon: BookOpen,
    short: "Summaries",
    title: "Generate any summary",
    hint: "AI book summaries on demand",
  },
  {
    icon: Users,
    short: "Friends",
    title: "Make friends",
    hint: "See what your circle is reading",
  },
  {
    icon: Sparkles,
    short: "Your feed",
    title: "Personalised feed",
    hint: "Tuned to your books and taste",
  },
  {
    icon: MessageCircle,
    short: "Threads",
    title: "Post & join threads",
    hint: "Share lines and reply in book rooms",
  },
  {
    icon: Flame,
    short: "Daily quest",
    title: "Daily quest & streak",
    hint: "One pick a day — keep the flame alive",
  },
] as const satisfies ReadonlyArray<{
  icon: LucideIcon;
  short: string;
  title: string;
  hint: string;
}>;

/** Tiny chip row for login/register marketing column. */
export function UnlockFeaturesAuthStrip({ className }: { className?: string }) {
  return (
    <div className={cn("max-w-xl max-sm:max-w-none", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted max-sm:text-center">
        Sign in to unlock
      </p>
      <ul
        className={cn(
          "mt-2 flex gap-1.5 sm:flex-wrap",
          "max-sm:-mx-1 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:px-1 max-sm:pb-1 max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden"
        )}
      >
        {UNLOCK_FEATURES.map(({ icon: Icon, short }) => (
          <li
            key={short}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border border-border/60 bg-pill/35 px-2 py-0.5 text-[10px] font-medium text-foreground/85",
              "max-sm:shrink-0 max-sm:border-border/40 max-sm:bg-card/90 max-sm:px-2.5 max-sm:py-1 max-sm:shadow-[0_8px_20px_-14px_rgba(15,23,42,0.35)]"
            )}
          >
            <Icon
              size={10}
              strokeWidth={2.2}
              aria-hidden
              className="text-sky-600 dark:text-sky-300"
            />
            {short}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function UnlockFeaturesList({ className }: { className?: string }) {
  return (
    <ul
      className={cn(
        "grid gap-2 sm:grid-cols-2",
        className
      )}
    >
      {UNLOCK_FEATURES.map(({ icon: Icon, title, hint }) => (
        <li
          key={title}
          className="flex items-start gap-2.5 rounded-2xl border border-border/70 bg-pill/50 px-3 py-2.5"
        >
          <span
            aria-hidden
            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-pill text-sky-600 dark:text-sky-300"
          >
            <Icon size={13} strokeWidth={2.2} />
          </span>
          <span className="min-w-0">
            <span className="block text-[12px] font-semibold leading-snug text-foreground/90">
              {title}
            </span>
            <span className="block text-[11px] leading-snug text-muted">
              {hint}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Gradient-framed sidebar pitch shown when logged out (wide layout). */
export function JoinReadquestSidebarCard() {
  const perks = UNLOCK_FEATURES.map((f) => f.short).join(" · ");
  return (
    <div
      className="mx-3 mb-4 mt-auto shrink-0 rounded-2xl p-px"
      style={{ background: "var(--gradient-brand)" }}
    >
      <div className="rounded-[14px] bg-card p-3">
        <p className="text-[12px] font-semibold leading-tight">Join {BRAND_SHORT}</p>
        <p className="mt-1 text-[10px] leading-snug text-muted">{perks}</p>
        <Link
          href="/register"
          className="mt-2.5 block w-full rounded-full px-3 py-1.5 text-center text-[11px] font-semibold text-white shadow-[var(--shadow-pop)]"
          style={{ background: "var(--gradient-brand)" }}
        >
          Get started free
        </Link>
        <p className="mt-1.5 text-center text-[10px] text-muted">
          Have an account?{" "}
          <Link href="/login" className="font-semibold text-foreground hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

/**
 * Guest-only card shown in the Daily-quest slot on Home. It stretches to fill
 * its grid cell (h-full) so it lines up with the "Top 5 Today" card beside it,
 * and lays the perks out vertically so a narrow phone column reads as a tall,
 * scannable "here's what you're missing" pitch instead of a squat strip.
 */
export function JoinReadquestFeedCard() {
  return (
    <article
      className="flex h-full min-h-[13rem] flex-col overflow-hidden rounded-2xl border border-border/70 p-3.5 shadow-[var(--shadow-soft)] layout-compact:shadow-none layout-wide:min-h-[18rem] layout-wide:rounded-3xl layout-wide:p-5"
      style={{
        background:
          "linear-gradient(155deg, color-mix(in srgb, var(--brand-1) 13%, var(--card)), color-mix(in srgb, var(--brand-2) 8%, var(--card)) 55%, var(--card))",
      }}
    >
      <div>
        <p className="inline-flex items-center gap-1 rounded-full bg-background/55 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-sky-600 backdrop-blur-sm dark:text-sky-300">
          <Sparkles size={10} strokeWidth={2.4} aria-hidden />
          Free to join
        </p>
        <h2 className="mt-2 text-[17px] font-extrabold leading-[1.12] tracking-tight layout-wide:text-[20px]">
          You&apos;re missing the good part
        </h2>
        <p className="mt-1 text-[11px] leading-snug text-muted layout-wide:text-[12px]">
          Create a free account to make it yours.
        </p>
      </div>

      <ul className="mt-3 grid flex-1 content-start gap-1.5 layout-wide:grid-cols-2 layout-wide:gap-2">
        {UNLOCK_FEATURES.map(({ icon: Icon, title, hint }) => (
          <li key={title} className="flex items-center gap-2">
            <span
              aria-hidden
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-background/70 text-sky-600 shadow-sm dark:text-sky-300"
            >
              <Icon size={12} strokeWidth={2.3} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[12px] font-semibold leading-tight text-foreground/90">
                {title}
              </span>
              <span className="hidden truncate text-[10.5px] leading-tight text-muted layout-wide:block">
                {hint}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3">
        <Link
          href="/register"
          className="block w-full rounded-full px-3 py-2 text-center text-[12px] font-bold text-white shadow-[var(--shadow-pop)]"
          style={{ background: "var(--gradient-brand)" }}
        >
          Create free account
        </Link>
        <p className="mt-1.5 text-center text-[10.5px] text-muted">
          Have an account?{" "}
          <Link href="/login" className="font-semibold text-foreground hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </article>
  );
}

/** Right-rail variant for logged-out wide layout. */
export function JoinReadquestRailPitch() {
  return (
    <section className="rounded-3xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-600 dark:text-sky-300">
        Join {BRAND_SHORT}
      </p>
      <p className="mt-1.5 text-[14px] font-semibold leading-snug">
        Sign in before you dive in
      </p>
      <UnlockFeaturesAuthStrip className="mt-2.5 [&>p]:hidden" />
      <div className="mt-3 flex flex-col gap-2">
        <Link
          href="/register"
          className="block w-full rounded-full px-3 py-1.5 text-center text-xs font-semibold text-white shadow-[var(--shadow-pop)]"
          style={{ background: "var(--gradient-brand)" }}
        >
          Create free account
        </Link>
        <Link
          href="/login"
          className="block w-full rounded-full border border-border bg-background px-3 py-1.5 text-center text-xs font-semibold transition hover:bg-hover"
        >
          Sign in
        </Link>
      </div>
    </section>
  );
}
