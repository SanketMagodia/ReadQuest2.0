"use client";

import Image from "next/image";
import { useSession } from "next-auth/react";
import { ImagePlus, PenSquare, UserRound } from "lucide-react";

/**
 * The "what are you reading?" row that sits at the top of the feed. It isn't a
 * real input — tapping anywhere opens the composer dialog, which keeps the
 * heavy form out of the timeline until it's wanted.
 */
export function ComposePrompt({ onOpen }: { onOpen: () => void }) {
  const { data: session } = useSession();
  const image = session?.user?.image ?? "";
  const firstName = (session?.user?.name || session?.user?.username || "")
    .trim()
    .split(/\s+/)[0];

  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-soft)] sm:p-3.5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-pill text-muted">
          {image ? (
            <Image
              src={image}
              alt=""
              width={40}
              height={40}
              className="h-full w-full object-cover"
            />
          ) : (
            <UserRound size={18} aria-hidden />
          )}
        </span>

        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-left text-[14.5px] text-muted transition hover:bg-hover"
        >
          {firstName
            ? `What are you reading, ${firstName}?`
            : "What are you reading?"}
        </button>

        <button
          type="button"
          onClick={onOpen}
          className="hidden shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-semibold text-white shadow-[var(--shadow-pop)] transition active:translate-y-px sm:inline-flex"
          style={{ background: "var(--gradient-brand)" }}
        >
          <PenSquare size={13} aria-hidden />
          Post
        </button>
      </div>

      <div className="mt-2 flex items-center gap-3 pl-[52px] text-[11px] font-semibold text-muted">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-1 transition hover:text-foreground"
        >
          <ImagePlus size={12} aria-hidden />
          Photo
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-1 transition hover:text-foreground"
        >
          Write with AI
        </button>
      </div>
    </div>
  );
}
