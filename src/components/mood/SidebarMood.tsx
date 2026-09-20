"use client";

import { useSession } from "next-auth/react";
import { useMood } from "@/components/mood/MoodProvider";
import { MoodSwitcher } from "@/components/mood/MoodSwitcher";
import { isMoodId, type MoodId } from "@/lib/moods";

/**
 * Reading-mood picker at the foot of the wide-layout sidebar, just below
 * the account button. Guests don't get it — they have no mood to save.
 */
export function SidebarMood() {
  const { status } = useSession();
  const { ownMood, setOwnMood } = useMood();

  if (status !== "authenticated") return null;

  const value: "" | MoodId = isMoodId(ownMood) ? ownMood : "";

  async function save(next: "" | MoodId) {
    const prev = value;
    setOwnMood(next);
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mood: next }),
    });
    if (!res.ok) setOwnMood(prev);
  }

  return (
    <div className="px-2">
      <MoodSwitcher
        value={value}
        onChange={(m) => void save(m)}
        placement="up"
        fullWidth
      />
    </div>
  );
}
