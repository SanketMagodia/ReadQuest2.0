"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTheme } from "next-themes";
import { useSession } from "next-auth/react";
import { MOOD_MAP, MOOD_VAR_KEYS, isMoodId, type MoodId } from "@/lib/moods";

type MoodValue = "" | MoodId;

type MoodContextValue = {
  /** The logged-in user's own saved mood (themes the whole app for them). */
  ownMood: MoodValue;
  /** The mood currently painted on screen (preview overrides own). */
  activeMood: MoodValue;
  /** Update own mood locally after saving it on the server. */
  setOwnMood: (mood: MoodValue) => void;
  /**
   * Temporarily theme the app to another reader's mood (e.g. while viewing
   * their profile). Pass null to drop the preview and fall back to own mood.
   */
  previewMood: (mood: MoodValue | null) => void;
};

const MoodContext = createContext<MoodContextValue | null>(null);

export function useMood(): MoodContextValue {
  const ctx = useContext(MoodContext);
  if (!ctx) throw new Error("useMood must be used within MoodProvider");
  return ctx;
}

function paintMood(mood: MoodValue) {
  const el = document.documentElement;
  const def = mood ? MOOD_MAP[mood as MoodId] : null;
  if (!def) {
    for (const key of MOOD_VAR_KEYS) el.style.removeProperty(key);
    el.removeAttribute("data-mood");
    return;
  }
  // A mood forces its own light/dark mode, so use that variant's palette.
  const vars = def.theme === "dark" ? def.dark : def.light;
  for (const [key, value] of Object.entries(vars)) {
    el.style.setProperty(key, value);
  }
  el.setAttribute("data-mood", mood);
}

export function MoodProvider({ children }: { children: ReactNode }) {
  const { theme, setTheme } = useTheme();
  const { status } = useSession();
  const [ownMood, setOwnMood] = useState<MoodValue>("");
  const [preview, setPreview] = useState<MoodValue | null>(null);

  const activeMood: MoodValue = preview ?? ownMood;

  // Remember the user's *own* theme choice (only tracked while no mood is
  // forcing one) so we can restore it when the last mood clears — e.g. a
  // logged-out visitor leaving a moody profile returns to their toggle setting.
  const restoreThemeRef = useRef<string | undefined>(theme);
  useEffect(() => {
    if (!activeMood) restoreThemeRef.current = theme;
  }, [theme, activeMood]);

  // Load the signed-in reader's saved mood so the whole app reflects it.
  useEffect(() => {
    if (status !== "authenticated") {
      setOwnMood("");
      return;
    }
    let alive = true;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { user?: { mood?: string } } | null) => {
        if (!alive) return;
        const m = data?.user?.mood;
        setOwnMood(isMoodId(m) ? m : "");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [status]);

  // Paint the active mood's palette + force its light/dark mode. When no mood
  // is active, drop the palette and restore the user's own theme choice.
  useEffect(() => {
    paintMood(activeMood);
    if (activeMood) {
      setTheme(MOOD_MAP[activeMood as MoodId].theme);
    } else if (restoreThemeRef.current) {
      setTheme(restoreThemeRef.current);
    }
  }, [activeMood, setTheme]);

  const previewMood = useCallback((mood: MoodValue | null) => {
    setPreview(mood);
  }, []);

  const value = useMemo<MoodContextValue>(
    () => ({ ownMood, activeMood, setOwnMood, previewMood }),
    [ownMood, activeMood, previewMood]
  );

  return <MoodContext.Provider value={value}>{children}</MoodContext.Provider>;
}
