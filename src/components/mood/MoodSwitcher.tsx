"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { MOODS, MOOD_MAP, type MoodId } from "@/lib/moods";

/**
 * Compact chip that opens the eight reading moods. Used on your own profile
 * and in the desktop sidebar — same control, so the picker never drifts.
 */
export function MoodSwitcher({
  value,
  onChange,
  placement = "down",
  fullWidth = false,
}: {
  value: "" | MoodId;
  onChange: (mood: "" | MoodId) => void;
  /** Sidebar sits at the foot, so the menu opens upward there. */
  placement?: "down" | "up";
  fullWidth?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = value ? MOOD_MAP[value] : null;
  const swatch = current ? current.swatch : (["#94a3b8", "#475569"] as const);

  return (
    <div ref={ref} className={cn("relative shrink-0", fullWidth && "w-full")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={current ? `${current.label} — ${current.blurb}` : "Set your reading mood"}
        className={cn(
          "relative inline-flex h-7 items-center gap-1.5 overflow-hidden rounded-full border border-border px-3 text-left transition hover:brightness-105 active:translate-y-px",
          fullWidth && "h-9 w-full px-2.5"
        )}
      >
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${swatch[0]} 0%, ${swatch[1]} 100%)`,
            opacity: current ? 0.18 : 0.1,
          }}
        />
        <span aria-hidden className="relative text-sm leading-none">
          {current ? current.emoji : "🎭"}
        </span>
        <span
          className={cn(
            "relative truncate text-[11px] font-bold uppercase tracking-wide",
            fullWidth ? "flex-1" : "max-w-32"
          )}
        >
          {current ? current.label : "Set a mood"}
        </span>
        <ChevronDown
          size={12}
          aria-hidden
          className={`relative shrink-0 text-muted transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className={cn(
            "z-50 rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-pop)]",
            // Grow past the trigger when the page has room, so each name
            // can sit in full. The cap keeps it on screen on a narrow phone.
            "w-max max-w-[calc(100vw-1.5rem)]",
            placement === "up"
              ? "absolute bottom-[calc(100%+8px)] left-0"
              : "absolute left-0 mt-2"
          )}
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
              Reading mood
            </p>
            {value ? (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="text-[11px] font-semibold text-muted underline-offset-2 hover:text-foreground hover:underline"
              >
                Clear
              </button>
            ) : null}
          </div>
          <p className="mb-2 text-[11px] text-muted">
            Themes your whole space — visitors briefly feel it too.
          </p>
          <div className="grid grid-cols-[repeat(2,minmax(0,max-content))] gap-2">
            {MOODS.map((m) => {
              const selected = value === m.id;
              const light = m.theme === "light";
              // A light mood is a pale wash of its own color; a dark mood is
              // the same color sunk toward black. Subtle either way.
              const mix = selected ? (light ? 30 : 46) : light ? 20 : 36;
              const base = light ? "#f6f3ec" : "#0c0e13";
              return (
                <button
                  key={m.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  onClick={() => {
                    onChange(m.id);
                    setOpen(false);
                  }}
                  title={`${m.blurb} · ${light ? "Light" : "Dark"} background`}
                  className={`group relative overflow-hidden rounded-xl border p-2 text-left transition ${
                    light ? "border-black/10 text-stone-900" : "border-white/10 text-stone-100"
                  } ${selected ? "ring-2 ring-[var(--ring)]" : ""}`}
                >
                  <span
                    aria-hidden
                    className="absolute inset-0 transition group-hover:brightness-110"
                    style={{
                      background: `linear-gradient(135deg, color-mix(in srgb, ${m.swatch[0]} ${mix}%, ${base}) 0%, color-mix(in srgb, ${m.swatch[1]} ${mix}%, ${base}) 100%)`,
                    }}
                  />
                  <span className="relative flex items-center gap-1.5">
                    <span aria-hidden className="text-sm">
                      {m.emoji}
                    </span>
                    <span className="whitespace-nowrap text-[12px] font-bold">{m.label}</span>
                    <span className="sr-only">
                      {light ? "Light background" : "Dark background"}
                    </span>
                  </span>
                  <span
                    className={`relative mt-0.5 block w-0 min-w-full truncate text-[10px] ${
                      light ? "text-stone-600" : "text-stone-400"
                    }`}
                  >
                    {m.blurb}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
