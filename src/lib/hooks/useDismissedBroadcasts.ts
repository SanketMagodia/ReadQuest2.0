"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "readquest:dismissed-broadcasts";

function readDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const ids = JSON.parse(raw) as unknown;
    if (!Array.isArray(ids)) return new Set();
    return new Set(ids.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

function writeDismissed(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    /* quota / private mode */
  }
}

/** Tracks broadcast cards the viewer has dismissed (per browser). */
export function useDismissedBroadcasts() {
  const [dismissed, setDismissed] = useState<Set<string> | null>(null);

  useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      const base = prev ?? new Set<string>();
      const next = new Set(base);
      next.add(id);
      writeDismissed(next);
      return next;
    });
  }, []);

  const isVisible = useCallback(
    (id: string) => dismissed !== null && !dismissed.has(id),
    [dismissed]
  );

  return { ready: dismissed !== null, dismiss, isVisible };
}
