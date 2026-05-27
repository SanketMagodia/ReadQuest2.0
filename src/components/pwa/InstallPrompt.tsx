"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Props = {
  className?: string;
  /** Visual style — pill (default) or card */
  variant?: "pill" | "card";
};

const DISMISS_KEY = "rq-install-dismissed";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function InstallPrompt({ className, variant = "pill" }: Props) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) {
      setInstalled(true);
      return;
    }
    try {
      const flag = window.localStorage.getItem(DISMISS_KEY);
      if (flag === "1") setDismissed(true);
    } catch {
      /* ignore */
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
    }
    setDeferred(null);
  }, [deferred]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  if (installed || dismissed || !deferred) return null;

  if (variant === "card") {
    return (
      <section
        className={cn(
          "rounded-3xl p-px shadow-[var(--shadow-soft)]",
          className
        )}
        style={{ background: "var(--gradient-brand)" }}
      >
        <div className="rounded-[22px] bg-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Install
          </p>
          <p className="mt-2 text-base font-semibold leading-snug">
            Add Readquest to your home screen
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            Open as a standalone app, launch in one tap, and read offline.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleInstall()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-pop)]"
              style={{ background: "var(--gradient-brand)" }}
            >
              <Download size={14} aria-hidden />
              Install app
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-full px-3 py-2 text-xs font-semibold text-muted hover:bg-hover"
            >
              Not now
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void handleInstall()}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground/85 transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70",
        className
      )}
      aria-label="Install Readquest as an app"
    >
      <Download size={14} aria-hidden />
      Install app
    </button>
  );
}
