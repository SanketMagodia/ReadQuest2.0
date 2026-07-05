"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  FileText,
  Lock,
  Shield,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BRAND_NAME, BRAND_SHORT } from "@/lib/brand";

const PAGE_NAV = [
  { href: "/about", label: "About", icon: Sparkles },
  { href: "/guidelines", label: "Guidelines", icon: Shield },
  { href: "/privacy", label: "Privacy", icon: Lock },
] as const;

type PageVariant = "about" | "guidelines" | "privacy";

const VARIANT_META: Record<
  PageVariant,
  { icon: LucideIcon; accent: string; glyph: LucideIcon }
> = {
  about: { icon: Sparkles, accent: "sky", glyph: BookOpen },
  guidelines: { icon: Shield, accent: "amber", glyph: FileText },
  privacy: { icon: Lock, accent: "violet", glyph: Shield },
};

export function InfoPageLayout({
  variant,
  eyebrow,
  title,
  lead,
  children,
}: {
  variant: PageVariant;
  eyebrow: string;
  title: string;
  lead: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const meta = VARIANT_META[variant];
  const HeroIcon = meta.icon;
  const Glyph = meta.glyph;

  return (
    <article className="info-page mx-auto w-full max-w-2xl px-3 py-5 sm:px-0 sm:py-8">
      <Link
        href="/explore"
        className="info-back mb-4 inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card/60 px-3 py-1.5 text-[12px] font-semibold text-muted backdrop-blur-sm transition hover:border-border hover:text-foreground"
      >
        <ArrowLeft size={14} aria-hidden />
        Back to Home
      </Link>

      {/* Page switcher */}
      <nav
        aria-label="Site information"
        className="info-tabs mb-5 flex gap-1 rounded-2xl border border-border bg-card/80 p-1 shadow-[var(--shadow-soft)] backdrop-blur-sm"
      >
        {PAGE_NAV.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "info-tab flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[11px] font-semibold uppercase tracking-wide transition sm:text-[12px]",
                active
                  ? "text-white shadow-[var(--shadow-pop)]"
                  : "text-muted hover:bg-hover hover:text-foreground"
              )}
              style={active ? { background: "var(--gradient-brand)" } : undefined}
            >
              <Icon size={13} aria-hidden />
              <span className="hidden sm:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Hero band */}
      <header className={`info-hero info-hero--${variant} relative mb-8 overflow-hidden rounded-3xl p-px`}>
        <div
          className="info-hero-inner relative rounded-[22px] px-5 py-7 sm:px-7 sm:py-9"
          style={{
            background:
              "linear-gradient(155deg, color-mix(in srgb, var(--card) 92%, transparent), var(--card))",
          }}
        >
          <div aria-hidden className="info-hero-glow" />
          <div aria-hidden className="info-hero-glyphs">
            <span className="info-hero-glyph info-hero-glyph--1">
              <Glyph size={18} strokeWidth={1.8} />
            </span>
            <span className="info-hero-glyph info-hero-glyph--2">
              <HeroIcon size={14} strokeWidth={2} />
            </span>
            <span className="info-hero-glyph info-hero-glyph--3">
              <BookOpen size={12} strokeWidth={2} />
            </span>
          </div>

          <div className="relative z-[1]">
            <p className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted backdrop-blur-sm">
              <HeroIcon size={11} aria-hidden className="text-sky-600 dark:text-sky-300" />
              {eyebrow}
            </p>
            <h1
              className="mt-4 text-[26px] font-black leading-[1.08] tracking-tight sm:text-[32px]"
              style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}
            >
              {title}
            </h1>
            <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-muted sm:text-[15px]">
              {lead}
            </p>
            <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted/80">
              {BRAND_NAME} · {BRAND_SHORT}
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-5">{children}</div>
    </article>
  );
}

export function InfoCard({
  title,
  icon: Icon,
  accent = "sky",
  children,
  className,
  id,
}: {
  title: string;
  icon?: LucideIcon;
  accent?: "sky" | "amber" | "violet" | "rose" | "emerald";
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const accentMap = {
    sky: "from-sky-500/20 to-sky-600/5 text-sky-600 dark:text-sky-300",
    amber: "from-amber-500/20 to-amber-600/5 text-amber-600 dark:text-amber-300",
    violet: "from-violet-500/20 to-violet-600/5 text-violet-600 dark:text-violet-300",
    rose: "from-rose-500/20 to-rose-600/5 text-rose-600 dark:text-rose-300",
    emerald: "from-emerald-500/20 to-emerald-600/5 text-emerald-600 dark:text-emerald-300",
  };

  return (
    <section
      id={id}
      className={cn(
        "info-card group rounded-2xl border border-border/80 bg-card p-5 shadow-[var(--shadow-soft)] transition hover:border-border hover:shadow-[var(--shadow-pop)] sm:p-6",
        className
      )}
    >
      <div className="flex items-start gap-3">
        {Icon ? (
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br",
              accentMap[accent]
            )}
          >
            <Icon size={18} aria-hidden strokeWidth={2.2} />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-bold tracking-tight">{title}</h2>
          <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-foreground/88">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

export function InfoLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="font-semibold text-sky-700 underline-offset-4 transition hover:underline dark:text-sky-300"
    >
      {children}
    </Link>
  );
}

export function InfoBulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5">
          <span
            aria-hidden
            className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: "var(--gradient-brand)" }}
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
