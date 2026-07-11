"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { DmProvider } from "@/components/dm/DmProvider";
import { MoodProvider } from "@/components/mood/MoodProvider";
import { AnalyticsIdentity } from "@/components/analytics/AnalyticsIdentity";

export function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="readquest-theme">
        <AnalyticsIdentity />
        <MoodProvider>
          <DmProvider>{children}</DmProvider>
        </MoodProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
