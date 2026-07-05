import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { BRAND_NAME } from "@/lib/brand";

const LINKS = [
  { href: "/about", label: "About" },
  { href: "/guidelines", label: "Guidelines" },
  { href: "/privacy", label: "Privacy" },
  { href: "/about#contact", label: "Contact" },
] as const;

/**
 * Site footer for auth pages (login / register) — builds trust without
 * cluttering the form column.
 */
export function AuthFooter() {
  return (
    <footer className="mx-auto w-full max-w-6xl shrink-0 border-t border-border/50 px-4 py-6 sm:px-8 sm:py-8">
      <nav
        aria-label="Site information"
        className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2"
      >
        {LINKS.map((item, i) => (
          <span key={item.href} className="inline-flex items-center gap-2">
            {i > 0 ? (
              <span aria-hidden className="text-[10px] text-border">
                ·
              </span>
            ) : null}
            <Link
              href={item.href}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-muted transition hover:text-foreground"
            >
              {item.label === "Contact" ? (
                <MessageCircle size={12} aria-hidden className="opacity-80" />
              ) : null}
              {item.label}
            </Link>
          </span>
        ))}
      </nav>
      <p className="mt-4 text-center text-[11px] leading-relaxed text-muted">
        © {new Date().getFullYear()} {BRAND_NAME}. Built for readers who think
        between the lines.
      </p>
      <p className="mt-1.5 text-center text-[10px] text-muted/80">
        By signing in you agree to our{" "}
        <Link
          href="/guidelines"
          className="font-medium text-foreground/70 underline-offset-2 hover:underline"
        >
          Community Guidelines
        </Link>{" "}
        and{" "}
        <Link
          href="/privacy"
          className="font-medium text-foreground/70 underline-offset-2 hover:underline"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </footer>
  );
}
