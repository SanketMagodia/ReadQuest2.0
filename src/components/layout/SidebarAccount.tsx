"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { ChevronsUpDown, LogOut, Shield, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The account control at the foot of the sidebar.
 *
 * Signed in, it's the reader's own avatar and handle; the menu behind it holds
 * profile, admin and sign-out. Signed out, the same slot becomes the sign-in
 * call to action — so identity and authentication live in one predictable
 * place instead of being scattered through the nav list.
 */
export function SidebarAccount() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (rootRef.current && target && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("touchstart", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("touchstart", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // A route change should never leave the menu hanging open.
  useEffect(() => setOpen(false), [pathname]);

  // Reserve the row while the session resolves so the sidebar doesn't jump.
  if (status === "loading") {
    return (
      <div className="px-2 pb-1">
        <div className="flex items-center gap-2.5 p-1.5">
          <span className="h-9 w-9 shrink-0 rounded-full skeleton-shimmer" />
          <span className="h-6 flex-1 rounded-full skeleton-shimmer" />
        </div>
      </div>
    );
  }

  // Signed out, the join card directly above already carries "Get started" and
  // "Sign in" — a second set of buttons here would just compete with it.
  if (status !== "authenticated" || !session?.user) return null;

  const username = session.user.username ?? "";
  const name = session.user.name || username || "Reader";
  const image = session.user.image ?? "";
  const isAdmin = session.user.role === "admin";

  return (
    <div ref={rootRef} className="relative px-2 pb-1">
      {open ? (
        <div
          role="menu"
          aria-label="Account"
          className="absolute bottom-[calc(100%+6px)] left-2 right-2 z-50 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-pop)]"
        >
          <ul className="py-1.5">
            <li>
              <Link
                href={`/profile/${username}`}
                role="menuitem"
                className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition hover:bg-hover"
              >
                <UserRound size={16} aria-hidden />
                Your profile
              </Link>
            </li>
            {isAdmin ? (
              <li>
                <Link
                  href="/admin"
                  role="menuitem"
                  className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition hover:bg-hover"
                >
                  <Shield
                    size={16}
                    aria-hidden
                    className="text-fuchsia-500 dark:text-fuchsia-300"
                  />
                  Admin
                </Link>
              </li>
            ) : null}
            <li className="my-1 border-t border-border/70" aria-hidden />
            <li>
              <button
                type="button"
                role="menuitem"
                onClick={() => void signOut({ callbackUrl: "/" })}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-medium text-rose-600 transition hover:bg-hover dark:text-rose-300"
              >
                <LogOut size={16} aria-hidden />
                Sign out @{username}
              </button>
            </li>
          </ul>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-full p-1.5 pr-2 text-left transition",
          open ? "bg-hover" : "hover:bg-hover"
        )}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-pill text-muted ring-1 ring-border/70">
          {image ? (
            <Image
              src={image}
              alt=""
              width={36}
              height={36}
              className="h-full w-full object-cover"
            />
          ) : (
            <UserRound size={17} aria-hidden />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold leading-tight">
            {name}
          </span>
          <span className="block truncate text-[11.5px] leading-tight text-muted">
            @{username}
          </span>
        </span>
        <ChevronsUpDown size={14} aria-hidden className="shrink-0 text-muted" />
      </button>
    </div>
  );
}
