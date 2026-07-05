"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { DmProvider } from "@/components/dm/DmProvider";

export function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="readquest-theme">
        <DmProvider>{children}</DmProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
