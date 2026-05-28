"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  kind: "post" | "comment";
  id: string;
  label?: string;
  className?: string;
  onDeleted?: () => void;
};

export function DeleteContentButton({
  kind,
  id,
  label,
  className,
  onDeleted,
}: Props) {
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    const noun = kind === "post" ? "post" : "comment";
    const ok = window.confirm(
      kind === "post" ?
        "Delete this post and all replies? This cannot be undone."
      : "Delete this comment and its replies? This cannot be undone."
    );
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/${kind === "post" ? "posts" : "comments"}/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        window.alert(data?.error ?? `Could not delete ${noun}`);
        return;
      }
      onDeleted?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleDelete()}
      disabled={busy}
      aria-label={label ?? `Delete ${kind}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-semibold text-red-600 transition hover:bg-red-500/10 disabled:opacity-50 dark:text-red-300",
        className
      )}
    >
      <Trash2 size={13} aria-hidden />
      <span className="hidden sm:inline">{busy ? "Deleting…" : "Delete"}</span>
    </button>
  );
}
