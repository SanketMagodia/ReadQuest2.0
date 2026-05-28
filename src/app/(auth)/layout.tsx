import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ReadquestLogo } from "@/components/brand/ReadquestLogo";
import { BookCarousel } from "@/components/auth/BookCarousel";
import { UnlockFeaturesAuthStrip } from "@/components/auth/UnlockFeatures";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-background text-foreground">
      {/* Theme-aware ambient brand wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(900px 520px at 8% -8%, color-mix(in srgb, var(--brand-1) 18%, transparent), transparent 60%), radial-gradient(900px 520px at 100% 110%, color-mix(in srgb, var(--brand-3) 16%, transparent), transparent 60%)",
        }}
      />

      {/* Phone-only playful blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 hidden max-sm:block">
        <div
          className="absolute -left-16 top-[18%] h-40 w-40 rounded-full opacity-25 blur-3xl"
          style={{ background: "var(--brand-1)" }}
        />
        <div
          className="absolute -right-12 top-[42%] h-36 w-36 rounded-full opacity-20 blur-3xl"
          style={{ background: "var(--brand-3)" }}
        />
        <div
          className="absolute bottom-[12%] left-1/3 h-32 w-32 rounded-full opacity-15 blur-3xl"
          style={{ background: "var(--brand-2)" }}
        />
      </div>

      {/* Top bar */}
      <header className="mx-auto flex w-full max-w-6xl shrink-0 items-center justify-between px-4 pt-4 sm:px-8 sm:pt-8 lg:pt-8">
        <ReadquestLogo height={30} priority />
        <Link
          href="/"
          aria-label="Back home"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted backdrop-blur transition hover:text-foreground sm:px-3 sm:text-[11px] sm:tracking-[0.18em]"
        >
          <ArrowLeft size={12} aria-hidden />
          <span className="hidden sm:inline">Back home</span>
        </Link>
      </header>

      {/*
        Phone: intro top → form centered → carousel bottom.
        Desktop: classic two-column — marketing left, form right.
      */}
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 pb-5 pt-3 sm:gap-6 sm:px-8 sm:pb-8 sm:pt-5 lg:flex-row lg:items-start lg:gap-14 lg:pb-24 lg:pt-14">
        <div className="contents lg:flex lg:min-w-0 lg:flex-1 lg:flex-col lg:gap-8 lg:pt-4">
          <section className="order-1 min-w-0 space-y-2.5 max-sm:text-center sm:space-y-3 lg:space-y-4">
            <h2 className="text-[24px] font-black leading-[1.05] tracking-tight sm:text-[34px] lg:text-[42px]">
              Where readers meet{" "}
              <span className="gradient-brand-text max-sm:mt-0.5 max-sm:block sm:inline">
                between the lines.
              </span>
            </h2>
            <p className="hidden max-w-xl text-[13px] font-medium leading-relaxed text-muted max-sm:block">
              Quote the good lines. Find your people. Keep the streak alive.
            </p>
            <p className="max-w-xl text-[13px] leading-relaxed text-muted max-sm:hidden sm:text-[15px]">
              Quote the lines that moved you, build a readlist that reflects
              you, and follow books and people who think hard about what they
              read.
            </p>
            <UnlockFeaturesAuthStrip />
          </section>

          <section className="order-3 mt-auto shrink-0 lg:mt-0">
            <p className="mb-1 hidden text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-muted max-sm:block">
              Now on shelves
            </p>
            <BookCarousel
              size="sm"
              durationSec={55}
              className="sm:hidden max-sm:-mx-4"
            />
            <BookCarousel size="md" className="hidden sm:block lg:hidden" />
            <BookCarousel size="lg" className="hidden lg:block" />
          </section>
        </div>

        <section className="order-2 flex min-h-0 w-full min-w-0 flex-1 items-center justify-center max-sm:px-0.5 sm:py-1 lg:w-[440px] lg:flex-none lg:items-start lg:justify-start lg:py-0">
          <div className="w-full lg:sticky lg:top-10">{children}</div>
        </section>
      </div>
    </div>
  );
}
