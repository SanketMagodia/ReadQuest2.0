"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { ComposerForm } from "@/components/compose/ComposerForm";
import type { PostDTO } from "@/lib/serialize";

/** The composer as a dialog, opened from the feed. */
export function ComposeModal({
  open,
  onClose,
  onPublished,
  initialBookId,
}: {
  open: boolean;
  onClose: () => void;
  onPublished: (post: PostDTO) => void;
  initialBookId?: string;
}) {
  // Close on Escape, and stop the page behind from scrolling.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-start sm:p-6 sm:pt-[8vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Create a post"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-border bg-background shadow-[var(--shadow-pop)] sm:rounded-3xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border/70 px-4 py-3">
          <h2 className="font-display text-base font-bold">New post</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-muted transition hover:bg-hover hover:text-foreground"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <ComposerForm
            autoFocus
            compact
            initialBookId={initialBookId}
            onPublished={onPublished}
          />
        </div>
      </div>
    </div>
  );
}
