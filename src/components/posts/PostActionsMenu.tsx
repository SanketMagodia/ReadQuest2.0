"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { MoreHorizontal, Flag } from "lucide-react";

export function PostActionsMenu({ postId }: { postId: string }) {
  const { status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  async function reportPost() {
    if (busy) return;
    if (status !== "authenticated") {
      const next = pathname || "/";
      router.push(`/login?callbackUrl=${encodeURIComponent(next)}`);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/posts/${postId}/report`, { method: "POST" });
      if (res.ok) setReported(true);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative ml-auto shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Post actions"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-hover hover:text-foreground"
      >
        <MoreHorizontal size={16} aria-hidden />
      </button>

      {open ? (
        <div className="absolute right-0 top-9 z-20 w-44 rounded-xl border border-border bg-card p-1.5 shadow-[var(--shadow-soft)]">
          <button
            type="button"
            onClick={() => void reportPost()}
            disabled={busy}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-foreground transition hover:bg-hover disabled:opacity-60"
          >
            <Flag size={14} aria-hidden className="text-rose-500 dark:text-rose-300" />
            {busy ? "Reporting…" : reported ? "Reported" : "Report post"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
