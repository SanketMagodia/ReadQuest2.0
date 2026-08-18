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
  /**
   * The reader's own mood, which themes the whole app for them: their saved
   * mood when signed in, the light/dark-matched default when browsing as a
   * guest.
   */
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

// Default moods for unauthenticated visitors — matched to their light/dark pref.
const GUEST_DARK_MOOD: MoodId = "midnight-lamp";
const GUEST_LIGHT_MOOD: MoodId = "beach-drift";

export function MoodProvider({ children }: { children: ReactNode }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { status } = useSession();
  const [savedMood, setSavedMood] = useState<MoodValue>("");
  const [preview, setPreview] = useState<MoodValue | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const isGuest = status !== "authenticated";

  useEffect(() => {
    setHydrated(true);
  }, []);

  /**
   * Guests have no saved mood, so they get a palette that mirrors their
   * light/dark choice.
   *
   * Derived during render rather than stored: writing it to state from an
   * effect keyed on `resolvedTheme` closed a loop, because the mood then drove
   * `setTheme`, which drove `resolvedTheme`, which re-ran the effect. Toggling
   * the theme while logged out blew the update-depth limit. The theme has to
   * stay the single source of truth here.
   *
   * Empty until after hydration: next-themes reads localStorage on the client
   * and is empty on the server, so using `resolvedTheme` on the first paint
   * would mount MoodAtmosphere on one side only.
   */
  const guestMood: MoodValue =
    !hydrated || !resolvedTheme
      ? ""
      : resolvedTheme === "dark"
        ? GUEST_DARK_MOOD
        : GUEST_LIGHT_MOOD;

  const ownMood: MoodValue = isGuest ? guestMood : savedMood;
  const activeMood: MoodValue = preview ?? ownMood;

  /**
   * The mood someone actually picked, as opposed to the guest default. Only
   * this one is allowed to force a light/dark mode — the guest default is
   * derived *from* the theme, so pushing it back would be circular.
   */
  const chosenMood: MoodValue = preview ?? (isGuest ? "" : savedMood);

  // Remember the reader's own theme choice while no chosen mood is overriding
  // it, so we can restore it when the last one clears — e.g. a logged-out
  // visitor leaving a moody profile returns to their toggle setting.
  const restoreThemeRef = useRef<string | undefined>(theme);
  useEffect(() => {
    if (!chosenMood) restoreThemeRef.current = theme;
  }, [theme, chosenMood]);

  // Load the signed-in reader's saved mood so the whole app reflects it.
  useEffect(() => {
    if (status !== "authenticated") {
      setSavedMood("");
      return;
    }
    let alive = true;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { user?: { mood?: string } } | null) => {
        if (!alive) return;
        const m = data?.user?.mood;
        setSavedMood(isMoodId(m) ? m : "");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [status]);

  useEffect(() => {
    paintMood(activeMood);
  }, [activeMood]);

  // Kept separate from painting: a chosen mood also dictates light/dark, and
  // when it clears we hand the reader their own setting back.
  useEffect(() => {
    if (chosenMood) {
      setTheme(MOOD_MAP[chosenMood as MoodId].theme);
    } else if (restoreThemeRef.current) {
      setTheme(restoreThemeRef.current);
    }
  }, [chosenMood, setTheme]);

  const previewMood = useCallback((mood: MoodValue | null) => {
    setPreview(mood);
  }, []);

  const value = useMemo<MoodContextValue>(
    () => ({ ownMood, activeMood, setOwnMood: setSavedMood, previewMood }),
    [ownMood, activeMood, previewMood]
  );

  return <MoodContext.Provider value={value}>{children}</MoodContext.Provider>;
}
