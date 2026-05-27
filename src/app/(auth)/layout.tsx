import type { ReactNode } from "react";
import Link from "next/link";
import {
  Sparkles,
  Quote,
  Users,
  BookmarkCheck,
  ArrowLeft,
} from "lucide-react";
import { ReadquestLogo } from "@/components/brand/ReadquestLogo";
import { BookCarousel } from "@/components/auth/BookCarousel";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-background text-foreground">
      {/* Theme-aware ambient brand wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(900px 520px at 8% -8%, color-mix(in srgb, var(--brand-1) 18%, transparent), transparent 60%), radial-gradient(900px 520px at 100% 110%, color-mix(in srgb, var(--brand-3) 16%, transparent), transparent 60%)",
        }}
      />

      {/* Top bar */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-6 sm:px-8 sm:pt-8">
        <ReadquestLogo height={30} priority />
        <Link
          href="/"
          className="hidden items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted backdrop-blur transition hover:text-foreground sm:inline-flex"
        >
          <ArrowLeft size={12} aria-hidden /> Back home
        </Link>
      </header>

      {/* Body — flex layout: form column is hard-pinned to 440px on lg+. */}
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pb-20 pt-8 sm:px-8 sm:pt-10 lg:flex-row lg:items-start lg:gap-14 lg:pb-24 lg:pt-14">
        {/* === Marketing column === */}
        <section className="order-2 flex min-w-0 flex-1 flex-col gap-6 lg:order-1 lg:gap-8 lg:pt-4">
          <div className="space-y-3 lg:space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted backdrop-blur">
              <Sparkles size={11} aria-hidden /> Readquest
            </span>
            <h2 className="text-[26px] font-black leading-[1.08] tracking-tight sm:text-[34px] lg:text-[42px]">
              Where readers meet{" "}
              <span className="gradient-brand-text">between the lines.</span>
            </h2>
            <p className="max-w-xl text-[14px] leading-relaxed text-muted sm:text-[15px]">
              Quote the lines that moved you, build a readlist that reflects
              you, and follow books and people who think hard about what they
              read.
            </p>
          </div>

          {/* Carousel — small on mobile, medium on tablet, large on desktop */}
          <BookCarousel size="sm" className="sm:hidden" />
          <BookCarousel size="md" className="hidden sm:block lg:hidden" />
          <BookCarousel size="lg" className="hidden lg:block" />

          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <FeatureChip
              icon={<Quote size={14} aria-hidden />}
              label="Threaded quotes"
            />
            <FeatureChip
              icon={<Sparkles size={14} aria-hidden />}
              label="Personalized feed"
            />
            <FeatureChip
              icon={<BookmarkCheck size={14} aria-hidden />}
              label="Travel-friendly readlists"
            />
            <FeatureChip
              icon={<Users size={14} aria-hidden />}
              label="Made for readers"
            />
          </ul>
        </section>

        {/* === Form column — first on mobile, right side on desktop === */}
        <section className="order-1 w-full min-w-0 lg:order-2 lg:w-[440px] lg:shrink-0">
          <div className="lg:sticky lg:top-10">{children}</div>
        </section>
      </div>
    </div>
  );
}

function FeatureChip({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <li className="flex items-center gap-2 rounded-2xl border border-border bg-card/70 px-3 py-2 text-[12px] font-semibold text-foreground/85 backdrop-blur">
      <span className="text-muted">{icon}</span>
      {label}
    </li>
  );
}
