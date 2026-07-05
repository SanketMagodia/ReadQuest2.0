"use client";

import { useSession } from "next-auth/react";
import { MessageCircle } from "lucide-react";
import { useDm } from "@/components/dm/DmProvider";
import { ADMIN_USERNAME } from "@/lib/admin";

export function ContactAdminButton({
  className,
  label = "Message the team",
}: {
  className?: string;
  label?: string;
}) {
  const { data: session } = useSession();
  const { openWithUser } = useDm();

  if (!session?.user?.id) {
    return (
      <a
        href="/login?next=/about"
        className={
          className ??
          "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-pop)]"
        }
        style={{ background: "var(--gradient-brand)" }}
      >
        <MessageCircle size={15} aria-hidden />
        Sign in to message us
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={() => openWithUser(ADMIN_USERNAME)}
      className={
        className ??
        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-pop)]"
      }
      style={{ background: "var(--gradient-brand)" }}
    >
      <MessageCircle size={15} aria-hidden />
      {label}
    </button>
  );
}
