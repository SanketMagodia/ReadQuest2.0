"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Ban,
  HandHeart,
  Scale,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { BRAND_NAME } from "@/lib/brand";
import {
  InfoBulletList,
  InfoCard,
  InfoLink,
  InfoPageLayout,
} from "@/components/info/InfoPageLayout";
import { cn } from "@/lib/utils";

const TABS = [
  {
    id: "reader",
    label: "Be a reader",
    icon: HandHeart,
    title: "Be a good reader",
    accent: "sky" as const,
    items: [
      "Post in good faith — quotes, reactions, and discussion about books",
      "Credit authors and flag spoilers before you drop a big twist",
      "Disagree with ideas, not people; zero harassment or hate speech",
      "Don't impersonate readers, authors, or publishers",
    ],
  },
  {
    id: "authentic",
    label: "Stay real",
    icon: Sparkles,
    title: "Keep it authentic",
    accent: "amber" as const,
    items: [
      "No spam, scams, or repetitive promotional posts",
      "Don't scrape, bot, or automate interactions without permission",
      "Report content that feels off — we review reports promptly",
    ],
  },
  {
    id: "safety",
    label: "Safety",
    icon: ShieldCheck,
    title: "Privacy & safety",
    accent: "violet" as const,
    body: (
      <>
        Don&apos;t share private information about yourself or others. If you see
        something that puts someone at risk, contact the team immediately via{" "}
        <InfoLink href="/about#contact">chat</InfoLink>.
      </>
    ),
  },
  {
    id: "enforce",
    label: "Enforcement",
    icon: Scale,
    title: "When we step in",
    accent: "rose" as const,
    body: (
      <>
        We may remove content, limit accounts, or suspend access when guidelines
        are violated. Serious or repeated abuse means permanent removal — we
        protect the community, not settle literary debates.
      </>
    ),
  },
] as const;

export function GuidelinesContent() {
  const [active, setActive] = useState<(typeof TABS)[number]["id"]>("reader");
  const tab = TABS.find((t) => t.id === active) ?? TABS[0];
  const TabIcon = tab.icon;

  return (
    <InfoPageLayout
      variant="guidelines"
      eyebrow="Community"
      title="Community Guidelines"
      lead={`${BRAND_NAME} works when readers feel safe to share. Tap a topic below — same rules, friendlier packaging.`}
    >
      <Reveal>
        <div
          role="tablist"
          aria-label="Guideline topics"
          className="flex flex-wrap gap-2"
        >
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = active === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActive(t.id)}
                className={cn(
                  "info-guideline-tab inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-[12px] font-semibold transition",
                  isActive
                    ? "border-transparent text-white shadow-[var(--shadow-pop)]"
                    : "border-border bg-card text-muted hover:border-sky-400/40 hover:text-foreground"
                )}
                style={isActive ? { background: "var(--gradient-brand)" } : undefined}
              >
                <Icon size={14} aria-hidden />
                {t.label}
              </button>
            );
          })}
        </div>
      </Reveal>

      <Reveal delay={60}>
        <div key={tab.id} className="info-panel-enter">
          <InfoCard title={tab.title} icon={TabIcon} accent={tab.accent}>
            {"items" in tab && tab.items ? (
              <InfoBulletList items={[...tab.items]} />
            ) : "body" in tab ? (
              <div>{tab.body}</div>
            ) : null}
          </InfoCard>
        </div>
      </Reveal>

      <Reveal delay={120}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex gap-3 rounded-2xl border border-border/70 bg-card/80 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-300">
              <AlertTriangle size={16} aria-hidden />
            </span>
            <div>
              <p className="text-[13px] font-bold">See something wrong?</p>
              <p className="mt-1 text-[12px] text-muted">
                Use report on posts and comments. Urgent? Message the team.
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded-2xl border border-border/70 bg-card/80 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-300">
              <Ban size={16} aria-hidden />
            </span>
            <div>
              <p className="text-[13px] font-bold">Three strikes mindset</p>
              <p className="mt-1 text-[12px] text-muted">
                Honest mistakes happen; patterns of abuse don&apos;t get a pass.
              </p>
            </div>
          </div>
        </div>
      </Reveal>
    </InfoPageLayout>
  );
}
