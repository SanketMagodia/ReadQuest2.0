/**
 * Reading "moods" — a vibe a reader sets on their profile. A mood re-themes the
 * app (accent/brand palette + ambient tint) and paints a matching minimalist
 * scene around their Top Shelf. When you visit someone's profile, the app is
 * temporarily re-themed to *their* mood so you feel what they feel.
 *
 * This file is the single source of truth: ids, copy, palettes (light + dark),
 * and which scene component to render.
 */

export const MOOD_IDS = [
  "rainy-nook",
  "beach-drift",
  "snow-window",
  "midnight-lamp",
  "forest-cabin",
  "cafe-corner",
  "train-window",
  "rooftop-dusk",
] as const;

export type MoodId = (typeof MOOD_IDS)[number];

export type MoodVars = Record<string, string>;

export type Mood = {
  id: MoodId;
  label: string;
  emoji: string;
  /** One-liner shown on the profile + picker. */
  blurb: string;
  /** Two swatch colors for the picker chip preview. */
  swatch: [string, string];
  /** The light/dark mode this mood forces while it's active. */
  theme: "light" | "dark";
  light: MoodVars;
  dark: MoodVars;
};

/** The CSS custom properties a mood is allowed to override, app-wide. */
export const MOOD_VAR_KEYS = [
  "--brand-1",
  "--brand-2",
  "--brand-3",
  "--gradient-brand",
  "--ring",
  "--accent",
  "--accent-2",
  "--mood-tint",
] as const;

/** Build the light/dark variable maps from a small set of anchor colors. */
function palette(
  b1: string,
  b2: string,
  b3: string,
  tint: string
): { light: MoodVars; dark: MoodVars } {
  const gradient = `linear-gradient(135deg, ${b3} 0%, ${b1} 52%, ${b2} 100%)`;
  return {
    light: {
      "--brand-1": b1,
      "--brand-2": b2,
      "--brand-3": b3,
      "--gradient-brand": gradient,
      "--ring": b1,
      "--accent": `color-mix(in srgb, ${b1} 14%, #ffffff)`,
      "--accent-2": `color-mix(in srgb, ${b3} 18%, #ffffff)`,
      "--mood-tint": tint,
    },
    dark: {
      "--brand-1": b3,
      "--brand-2": b1,
      "--brand-3": b2,
      "--gradient-brand": gradient,
      "--ring": b3,
      "--accent": `color-mix(in srgb, ${b1} 20%, transparent)`,
      "--accent-2": `color-mix(in srgb, ${b3} 16%, transparent)`,
      "--mood-tint": tint,
    },
  };
}

export const MOODS: Mood[] = [
  {
    id: "rainy-nook",
    label: "Rainy Nook",
    emoji: "🌧️",
    blurb: "Curled up indoors, rain on the glass.",
    swatch: ["#64748b", "#334155"],
    theme: "light",
    ...palette("#64748b", "#334155", "#94a3b8", "rgba(100,116,139,0.14)"),
  },
  {
    id: "beach-drift",
    label: "Beach Drift",
    emoji: "🏖️",
    blurb: "Light, breezy vacation reads.",
    swatch: ["#06b6d4", "#f59e0b"],
    theme: "light",
    ...palette("#06b6d4", "#0891b2", "#22d3ee", "rgba(34,211,238,0.16)"),
  },
  {
    id: "snow-window",
    label: "Snow Window",
    emoji: "❄️",
    blurb: "Snowfall outside, coffee on the sill.",
    swatch: ["#7dd3fc", "#e0f2fe"],
    theme: "dark",
    ...palette("#38bdf8", "#0ea5e9", "#7dd3fc", "rgba(125,211,252,0.16)"),
  },
  {
    id: "midnight-lamp",
    label: "Midnight Lamp",
    emoji: "🌙",
    blurb: "Late-night, deep in a story.",
    swatch: ["#f59e0b", "#7c3aed"],
    theme: "dark",
    ...palette("#f59e0b", "#b45309", "#fbbf24", "rgba(245,158,11,0.14)"),
  },
  {
    id: "forest-cabin",
    label: "Forest Cabin",
    emoji: "🌲",
    blurb: "Off-the-grid, slow and quiet.",
    swatch: ["#10b981", "#065f46"],
    theme: "dark",
    ...palette("#10b981", "#047857", "#34d399", "rgba(16,185,129,0.14)"),
  },
  {
    id: "cafe-corner",
    label: "Café Corner",
    emoji: "☕",
    blurb: "Bright cloudy day, coffee in hand.",
    swatch: ["#f59e0b", "#d97706"],
    theme: "light",
    ...palette("#d97706", "#b45309", "#fbbf24", "rgba(217,119,6,0.14)"),
  },
  {
    id: "train-window",
    label: "Train Window",
    emoji: "🚆",
    blurb: "Landscape rushing by, page on the tray.",
    swatch: ["#0ea5e9", "#f97316"],
    theme: "light",
    ...palette("#0ea5e9", "#0284c7", "#f97316", "rgba(14,165,233,0.15)"),
  },
  {
    id: "rooftop-dusk",
    label: "Rooftop Dusk",
    emoji: "🌆",
    blurb: "Golden hour, string lights, city below.",
    swatch: ["#a855f7", "#f97316"],
    theme: "dark",
    ...palette("#a855f7", "#7c3aed", "#f97316", "rgba(168,85,247,0.15)"),
  },
];

export const MOOD_MAP: Record<MoodId, Mood> = Object.fromEntries(
  MOODS.map((m) => [m.id, m])
) as Record<MoodId, Mood>;

export function isMoodId(v: unknown): v is MoodId {
  return typeof v === "string" && (MOOD_IDS as readonly string[]).includes(v);
}
