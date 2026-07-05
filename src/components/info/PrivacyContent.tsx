"use client";

import { useState } from "react";
import {
  ChevronDown,
  Database,
  Eye,
  Lock,
  MessageSquare,
  Server,
  SlidersHorizontal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { BRAND_NAME } from "@/lib/brand";
import { InfoLink, InfoPageLayout } from "@/components/info/InfoPageLayout";
import { cn } from "@/lib/utils";

type Section = {
  id: string;
  title: string;
  icon: LucideIcon;
  accent: string;
  content: React.ReactNode;
};

function buildSections(year: number): Section[] {
  return [
    {
      id: "collect",
      title: "What we collect",
      icon: Database,
      accent: "sky",
      content: (
        <ul className="space-y-3 text-[14px] leading-relaxed">
          <li>
            <strong className="text-foreground">Account data</strong> — username,
            display name, optional email, profile photo, and bio
          </li>
          <li>
            <strong className="text-foreground">Your content</strong> — posts,
            comments, messages, readlists, and reading activity on the platform
          </li>
          <li>
            <strong className="text-foreground">Technical data</strong> — logs
            needed to run and secure the service (IP, browser, session cookies)
          </li>
        </ul>
      ),
    },
    {
      id: "use",
      title: "How we use it",
      icon: Server,
      accent: "amber",
      content: (
        <>
          <ul className="space-y-2 text-[14px] leading-relaxed">
            <li>· Operate accounts, feeds, messaging, and notifications</li>
            <li>· Improve discovery, safety, and product quality</li>
            <li>· Respond to support messages and enforce guidelines</li>
          </ul>
          <p className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/8 px-3 py-2 text-[13px] font-medium text-emerald-800 dark:text-emerald-200">
            We do not sell your personal information to advertisers.
          </p>
        </>
      ),
    },
    {
      id: "messages",
      title: "Messages & chat",
      icon: MessageSquare,
      accent: "violet",
      content: (
        <p className="text-[14px] leading-relaxed">
          Direct messages with friends — or the {BRAND_NAME} admin team — are
          stored so conversations can be delivered. Don&apos;t send sensitive data
          you wouldn&apos;t want kept on a social platform.
        </p>
      ),
    },
    {
      id: "choices",
      title: "Your choices",
      icon: SlidersHorizontal,
      accent: "emerald",
      content: (
        <ul className="space-y-2 text-[14px] leading-relaxed">
          <li>· Update your profile anytime</li>
          <li>· Delete posts and comments you authored where allowed</li>
          <li>· Contact us via chat for account or data questions</li>
        </ul>
      ),
    },
    {
      id: "contact",
      title: "Questions?",
      icon: Eye,
      accent: "rose",
      content: (
        <p className="text-[14px] leading-relaxed">
          Privacy questions? Message the team from the in-app chat bubble or visit
          our <InfoLink href="/about#contact">About page</InfoLink>. Last updated{" "}
          {year}.
        </p>
      ),
    },
  ];
}

export function PrivacyContent() {
  const year = new Date().getFullYear();
  const sections = buildSections(year);
  const [openId, setOpenId] = useState<string>("collect");

  return (
    <InfoPageLayout
      variant="privacy"
      eyebrow="Legal"
      title="Privacy Policy"
      lead={`Plain language on what ${BRAND_NAME} collects, why, and what you control. Updated ${year}.`}
    >
      <Reveal>
        <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/80 px-4 py-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-300">
            <Lock size={18} aria-hidden />
          </span>
          <p className="text-[13px] leading-relaxed text-muted">
            Tap a section to expand. No legalese maze — just the essentials.
          </p>
        </div>
      </Reveal>

      <div className="space-y-2">
        {sections.map((s, i) => {
          const Icon = s.icon;
          const isOpen = openId === s.id;
          return (
            <Reveal key={s.id} delay={i * 50}>
              <div
                className={cn(
                  "info-accordion overflow-hidden rounded-2xl border transition",
                  isOpen
                    ? "border-sky-400/35 bg-card shadow-[var(--shadow-soft)]"
                    : "border-border/70 bg-card/70 hover:border-border"
                )}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenId(isOpen ? "" : s.id)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-hover/50 sm:px-5"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pill text-sky-600 dark:text-sky-300">
                    <Icon size={16} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 text-[15px] font-bold">{s.title}</span>
                  <ChevronDown
                    size={18}
                    aria-hidden
                    className={cn(
                      "shrink-0 text-muted transition-transform duration-300",
                      isOpen && "rotate-180"
                    )}
                  />
                </button>
                <div
                  className={cn(
                    "info-accordion-body grid transition-[grid-template-rows] duration-300 ease-out",
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="border-t border-border/60 px-4 pb-4 pt-3 text-foreground/88 sm:px-5 sm:pb-5">
                      {s.content}
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </InfoPageLayout>
  );
}
