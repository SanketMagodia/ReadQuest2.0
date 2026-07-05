"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { LogIn, LogOut, Shield, UserRound, X } from "lucide-react";
import { MobileSiteLinks } from "@/components/layout/SidebarFooter";

/**
 * Compact account menu shown in the mobile top bar.
 *
 * Anchors a tap-to-open avatar button. When opened, it pops a small card with
 * profile / admin / sign-out actions. Closes on outside click, route change,
 * or escape press.
 *
 * Visible only on mobile (the desktop sidebar already exposes these).
 */
export function MobileAccountMenu() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click / escape.
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

  const username = session?.user?.username;
  const name = session?.user?.name ?? username ?? "Reader";
  const image = session?.user?.image ?? "";
  const role = session?.user?.role;
  const isAuth = status === "authenticated";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-card text-foreground/85 transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
      >
        {isAuth && image ? (
          <Image
            src={image}
            alt=""
            width={32}
            height={32}
            className="h-full w-full object-cover"
          />
        ) : (
          <UserRound size={16} aria-hidden />
        )}
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-60 origin-top-right animate-fade overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]"
        >
          {isAuth ? (
            <>
              <div className="flex items-center gap-3 border-b border-border/70 p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-pill">
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
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{name}</p>
                  {username ? (
                    <p className="truncate text-[11px] text-muted">
                      @{username}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="rounded-full p-1 text-muted hover:bg-hover hover:text-foreground"
                >
                  <X size={14} aria-hidden />
                </button>
              </div>

              <ul className="py-1.5">
                <MenuItem
                  href={username ? `/profile/${username}` : "/"}
                  icon={<UserRound size={16} aria-hidden />}
                  onSelect={() => setOpen(false)}
                >
                  Profile
                </MenuItem>
                {role === "admin" ? (
                  <MenuItem
                    href="/admin"
                    icon={
                      <Shield
                        size={16}
                        aria-hidden
                        className="text-fuchsia-500 dark:text-fuchsia-300"
                      />
                    }
                    onSelect={() => setOpen(false)}
                  >
                    Admin
                  </MenuItem>
                ) : null}
                <li>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      void signOut({ callbackUrl: "/" });
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-medium text-rose-600 transition hover:bg-hover dark:text-rose-300"
                  >
                    <LogOut size={16} aria-hidden />
                    Sign out
                  </button>
                </li>
              </ul>
              <MobileSiteLinks onNavigate={() => setOpen(false)} />
            </>
          ) : (
            <>
              <ul className="py-1.5">
                <MenuItem
                  href="/login"
                  icon={<LogIn size={16} aria-hidden />}
                  onSelect={() => setOpen(false)}
                >
                  Sign in
                </MenuItem>
                <MenuItem
                  href="/register"
                  icon={<UserRound size={16} aria-hidden />}
                  onSelect={() => setOpen(false)}
                >
                  Create account
                </MenuItem>
              </ul>
              <MobileSiteLinks onNavigate={() => setOpen(false)} />
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  href,
  icon,
  children,
  onSelect,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <li>
      <Link
        href={href}
        role="menuitem"
        onClick={onSelect}
        className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition hover:bg-hover"
      >
        {icon}
        {children}
      </Link>
    </li>
  );
}
