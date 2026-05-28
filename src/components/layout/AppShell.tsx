"use client";

import Link from "next/link";
import {
  Compass,
  PenSquare,
  Library,
  UserRound,
  Users,
  Shield,
  LogIn,
  LogOut,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";
import { ReadquestLogo } from "@/components/brand/ReadquestLogo";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { RightRail } from "./RightRail";
import { MobileAccountMenu } from "./MobileAccountMenu";
import { NotificationsBell } from "./NotificationsBell";
import { JoinReadquestSidebarCard } from "@/components/auth/UnlockFeatures";

const navMain = [
  { href: "/", label: "Feed", icon: Library },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/compose", label: "Compose", icon: PenSquare },
  { href: "/friends", label: "Friends", icon: Users },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const username = session?.user?.username;
  const role = session?.user?.role;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl gap-0 px-3 layout-wide:px-5 layout-wide:gap-5 xl:gap-0">
      {/* Wide layout sidebar (landscape tablets / desktops) */}
      <aside className="sticky top-0 z-20 hidden h-[100dvh] min-h-0 shrink-0 flex-col overflow-hidden border-r border-border/70 bg-background/75 py-6 backdrop-blur layout-wide:flex lg:w-52 xl:w-60">
        <div className="mb-6 shrink-0 flex items-center justify-between gap-2 px-4">
          <ReadquestLogo height={32} priority />
          <ThemeToggle />
        </div>

        <nav
          className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-2"
          aria-label="Primary"
        >
          {navMain.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-4 rounded-full px-4 py-3 text-[16px] font-semibold transition",
                  active
                    ? "bg-pill text-foreground"
                    : "text-muted hover:bg-hover hover:text-foreground"
                )}
              >
                {active ? (
                  <span
                    aria-hidden
                    className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full"
                    style={{ background: "var(--gradient-brand)" }}
                  />
                ) : null}
                <Icon
                  size={20}
                  aria-hidden
                  strokeWidth={active ? 2.4 : 1.9}
                  className={active ? "text-foreground" : ""}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {username ? (
            <div className="mt-2 space-y-1 border-t border-border/70 pt-4">
              <NotificationsBell variant="sidebar" />
              <Link
                href={`/profile/${username}`}
                className={cn(
                  "flex items-center gap-4 rounded-full px-4 py-3 text-[15px] font-semibold transition",
                  pathname.startsWith("/profile")
                    ? "bg-pill text-foreground"
                    : "text-muted hover:bg-hover hover:text-foreground"
                )}
              >
                <UserRound size={20} aria-hidden />
                Profile
              </Link>
              {role === "admin" ? (
                <Link
                  href="/admin"
                  className="flex items-center gap-4 rounded-full px-4 py-3 text-[15px] font-semibold text-fuchsia-600 transition hover:bg-hover dark:text-fuchsia-300"
                >
                  <Shield size={20} aria-hidden />
                  Admin
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => void signOut({ callbackUrl: "/" })}
                className="flex w-full items-center gap-4 rounded-full px-4 py-3 text-[14px] font-medium text-muted transition hover:bg-hover"
              >
                <LogOut size={18} aria-hidden />
                Sign out
              </button>
            </div>
          ) : (
            <div className="mt-2 border-t border-border/70 pt-4">
              <Link
                href="/login"
                className="flex items-center gap-4 rounded-full px-4 py-3 text-[15px] font-semibold text-sky-700 hover:bg-hover dark:text-sky-300"
              >
                <LogIn size={20} aria-hidden />
                Sign in
              </Link>
            </div>
          )}
        </nav>

        {!username ? <JoinReadquestSidebarCard /> : null}
      </aside>

      {/* Main column. `min-w-0` is critical: without it, any unbreakable long
          string (URLs, code) in children would force this flex item wider
          than its share and overflow the whole shell on narrow phones. */}
      <main className="min-w-0 min-h-[100dvh] flex-1 pb-28 layout-wide:pb-12">
        {/* Compact layout top bar (phones + portrait tablets) */}
        <div className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border/70 bg-background/85 px-3 py-2.5 backdrop-blur layout-wide:hidden">
          <ReadquestLogo height={24} />
          <div className="flex items-center gap-1.5">
            <InstallPrompt />
            <NotificationsBell variant="topbar" />
            <ThemeToggle />
            <MobileAccountMenu />
          </div>
        </div>
        {children}
      </main>

      {/* Right rail (lg+) — content adapts per route. */}
      <RightRail />

      {/* Compact layout bottom nav */}
      <nav
        aria-label="Bottom"
        className="fixed bottom-3 left-1/2 z-40 flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 items-stretch justify-between rounded-2xl border border-border bg-background/90 p-1.5 shadow-[var(--shadow-soft)] backdrop-blur layout-wide:hidden"
      >
        {navMain.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-[10px] font-semibold transition",
                active ? "text-foreground" : "text-muted"
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full",
                  active ? "bg-pill" : ""
                )}
                style={
                  active
                    ? {
                        background:
                          "color-mix(in srgb, var(--brand-1) 14%, transparent)",
                      }
                    : undefined
                }
              >
                <Icon size={20} aria-hidden strokeWidth={active ? 2.4 : 1.9} />
              </span>
              {item.label}
            </Link>
          );
        })}
        <Link
          href={username ? `/profile/${username}` : "/login"}
          aria-label="Profile"
          aria-current={pathname.startsWith("/profile") ? "page" : undefined}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-[10px] font-semibold transition",
            pathname.startsWith("/profile") ? "text-foreground" : "text-muted"
          )}
        >
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full",
              pathname.startsWith("/profile") ? "bg-pill" : ""
            )}
          >
            <UserRound size={20} aria-hidden />
          </span>
          You
        </Link>
      </nav>
    </div>
  );
}
