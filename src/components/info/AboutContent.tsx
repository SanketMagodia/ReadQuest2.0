"use client";

import {
  BookMarked,
  Compass,
  Heart,
  MessageCircle,
  Quote,
  Users,
} from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { BRAND_NAME } from "@/lib/brand";
import { ADMIN_DISPLAY_NAME, ADMIN_USERNAME } from "@/lib/admin";
import { ContactAdminButton } from "@/components/dm/ContactAdminButton";
import {
  InfoCard,
  InfoLink,
  InfoPageLayout,
} from "@/components/info/InfoPageLayout";

const FEATURES = [
  {
    icon: Quote,
    title: "Share the lines",
    hint: "Quote what moved you — tied to the book you're in.",
    accent: "sky" as const,
  },
  {
    icon: Compass,
    title: "Discover deeply",
    hint: "Bestsellers, summaries, and rooms built around titles.",
    accent: "amber" as const,
  },
  {
    icon: BookMarked,
    title: "Curate your shelf",
    hint: "A readlist and profile that actually reflect your taste.",
    accent: "violet" as const,
  },
  {
    icon: Users,
    title: "Find your people",
    hint: "Friends, DMs, and threads with readers who get it.",
    accent: "emerald" as const,
  },
];

export function AboutContent() {
  return (
    <InfoPageLayout
      variant="about"
      eyebrow="About us"
      title={`The vision behind ${BRAND_NAME}`}
      lead="A calm, reader-first social space — for people who underline sentences, argue about endings, and want company on the page."
    >
      <Reveal>
        <blockquote className="info-quote rounded-2xl border border-border/60 bg-pill/40 px-5 py-5 text-center sm:px-6">
          <p
            className="text-[18px] font-semibold leading-snug tracking-tight sm:text-[20px]"
            style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}
          >
            &ldquo;Books are not content to scroll past.&rdquo;
          </p>
          <p className="mt-2 text-[13px] text-muted">
            A good line can change your week — we built a home for those moments.
          </p>
        </blockquote>
      </Reveal>

      <Reveal delay={80}>
        <InfoCard title="What we believe" icon={Heart} accent="rose">
          <p>
            {BRAND_NAME} is where authenticity beats algorithmic noise: real readers,
            real reactions, and conversations organized around the books themselves.
            Discovery matters, but depth matters more.
          </p>
        </InfoCard>
      </Reveal>

      <Reveal delay={120}>
        <div className="grid gap-3 sm:grid-cols-2">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="info-feature group rounded-2xl border border-border/70 bg-card p-4 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:border-sky-400/30 hover:shadow-[var(--shadow-pop)]"
                style={{ transitionDelay: `${i * 40}ms` }}
              >
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-sky-600 dark:text-sky-300"
                  style={{
                    background: `linear-gradient(135deg, color-mix(in srgb, var(--brand-1) ${12 + i * 4}%, transparent), transparent)`,
                  }}
                >
                  <Icon size={17} aria-hidden strokeWidth={2.2} />
                </span>
                <p className="mt-3 text-[14px] font-bold">{f.title}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-muted">{f.hint}</p>
              </div>
            );
          })}
        </div>
      </Reveal>

      <Reveal delay={160}>
        <InfoCard title="How we run things" icon={Users} accent="sky">
          <p>
            We moderate thoughtfully, respond to reports, and keep the platform
            focused on reading. Automated accounts are clearly labeled. Your data
            runs the service — it is not sold as a product.
          </p>
          <p>
            Dig into our <InfoLink href="/guidelines">Community Guidelines</InfoLink>{" "}
            and <InfoLink href="/privacy">Privacy Policy</InfoLink>.
          </p>
        </InfoCard>
      </Reveal>

      <Reveal delay={200}>
        <section
          id="contact"
          className="info-contact relative overflow-hidden rounded-3xl p-px"
          style={{ background: "var(--gradient-brand)" }}
        >
          <div className="relative rounded-[22px] bg-card px-5 py-6 sm:px-7 sm:py-8">
            <div aria-hidden className="info-contact-pulse absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full text-white opacity-90">
              <MessageCircle size={18} aria-hidden />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
              Get in touch
            </p>
            <h2 className="mt-2 text-[20px] font-extrabold tracking-tight">
              Contact {ADMIN_DISPLAY_NAME}
            </h2>
            <p className="mt-2 max-w-md text-[14px] leading-relaxed text-muted">
              Questions, feedback, or something that needs a human? Open the chat
              bubble anywhere on the site and message{" "}
              <span className="font-semibold text-foreground">@{ADMIN_USERNAME}</span>{" "}
              — no friend request needed.
            </p>
            <div className="mt-5">
              <ContactAdminButton label="Open chat with the team" />
            </div>
            <p className="mt-3 text-[12px] text-muted">
              We read every message. Typical reply within a few business days.
            </p>
          </div>
        </section>
      </Reveal>
    </InfoPageLayout>
  );
}
