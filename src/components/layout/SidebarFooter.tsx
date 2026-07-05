"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDm } from "@/components/dm/DmProvider";
import { ADMIN_USERNAME, ADMIN_DISPLAY_NAME } from "@/lib/admin";
import { BRAND_NAME } from "@/lib/brand";

const links = [
  { href: "/about", label: "About" },
  { href: "/guidelines", label: "Guidelines" },
  { href: "/privacy", label: "Privacy" },
] as const;

export function SidebarFooter() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { openWithUser } = useDm();

  return (
    <footer className="shrink-0 border-t border-border/70 px-3 pt-3 pb-2">
      <nav aria-label="Site information" className="flex flex-wrap gap-x-3 gap-y-1">
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "text-[11px] font-semibold transition hover:text-foreground",
              pathname === item.href
                ? "text-foreground"
                : "text-muted"
            )}
          >
            {item.label}
          </Link>
        ))}
        {session?.user?.id ? (
          <button
            type="button"
            onClick={() => openWithUser(ADMIN_USERNAME)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 transition hover:text-foreground dark:text-sky-300"
          >
            <MessageCircle size={11} aria-hidden />
            Contact
          </button>
        ) : (
          <Link
            href="/about#contact"
            className="text-[11px] font-semibold text-muted transition hover:text-foreground"
          >
            Contact
          </Link>
        )}
      </nav>
      <p className="mt-2 text-[10px] leading-snug text-muted">
        © {new Date().getFullYear()} {BRAND_NAME}. Built for readers who think
        between the lines.
      </p>
    </footer>
  );
}

/** Compact legal links for mobile account menu. */
export function MobileSiteLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { openWithUser } = useDm();
  const { data: session } = useSession();

  return (
    <ul className="border-t border-border/70 py-1.5">
      <li className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
        {BRAND_NAME}
      </li>
      {links.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            onClick={onNavigate}
            className="block px-3 py-2 text-sm font-medium text-foreground/90 transition hover:bg-hover"
          >
            {item.label}
          </Link>
        </li>
      ))}
      <li>
        {session?.user?.id ? (
          <button
            type="button"
            onClick={() => {
              onNavigate?.();
              openWithUser(ADMIN_USERNAME);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-sky-700 transition hover:bg-hover dark:text-sky-300"
          >
            <MessageCircle size={15} aria-hidden />
            Contact {ADMIN_DISPLAY_NAME}
          </button>
        ) : (
          <Link
            href="/about#contact"
            onClick={onNavigate}
            className="block px-3 py-2 text-sm font-medium transition hover:bg-hover"
          >
            Contact
          </Link>
        )}
      </li>
    </ul>
  );
}
