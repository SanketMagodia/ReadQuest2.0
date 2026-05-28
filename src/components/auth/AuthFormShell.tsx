"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AuthFormShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-3 -z-10 hidden max-sm:block"
      >
        <div
          className="absolute left-1/2 top-1/2 h-40 w-[92%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] opacity-30 blur-3xl"
          style={{ background: "var(--gradient-brand)" }}
        />
      </div>

      <div
        className={cn(
          "relative overflow-hidden rounded-[26px] border border-border bg-card p-6 shadow-[var(--shadow-soft)] sm:p-9",
          "max-sm:rounded-[32px] max-sm:border-transparent max-sm:bg-card/85 max-sm:p-5 max-sm:backdrop-blur-xl",
          "max-sm:shadow-[0_28px_64px_-32px_color-mix(in_srgb,var(--brand-2)_50%,transparent)]",
          "max-sm:ring-1 max-sm:ring-border/50",
          className
        )}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1 max-sm:h-1.5"
          style={{ background: "var(--gradient-brand)" }}
        />
        {children}
      </div>
    </motion.div>
  );
}
