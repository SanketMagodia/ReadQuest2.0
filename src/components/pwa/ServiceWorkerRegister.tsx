"use client";

import { useEffect } from "react";

/**
 * Registers the Readquest service worker on the client.
 * - Only runs in the browser, on HTTPS (or localhost) where SW is allowed.
 * - Skips registration in `next dev` to avoid stale caches during development.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {
          /* swallow — service worker is best-effort */
        });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
  }, []);

  return null;
}
