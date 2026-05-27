"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Variant = "icon" | "pill";

export function ThemeToggle({
  className,
  variant = "icon",
}: {
  className?: string;
  variant?: Variant;
}) {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const Icon = mounted ? (isDark ? Sun : Moon) : Moon;
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  const baseBtn =
    "inline-flex items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70";

  if (variant === "pill") {
    return (
      <button
        type="button"
        aria-label={label}
        onClick={() => mounted && setTheme(isDark ? "light" : "dark")}
        className={cn(
          baseBtn,
          "gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground/80 shadow-[var(--shadow-soft)] hover:bg-hover",
          className
        )}
      >
        <Icon size={16} aria-hidden />
        <span>{mounted ? (isDark ? "Light" : "Dark") : "Theme"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => mounted && setTheme(isDark ? "light" : "dark")}
      className={cn(
        baseBtn,
        "h-10 w-10 rounded-full border border-border bg-card text-foreground/80 shadow-[var(--shadow-soft)] hover:bg-hover",
        className
      )}
    >
      <Icon size={18} aria-hidden />
    </button>
  );
}
