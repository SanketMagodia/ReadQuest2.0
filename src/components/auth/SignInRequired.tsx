import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { LogIn, Lock, UserPlus } from "lucide-react";
import { BRAND_NAME } from "@/lib/brand";

export function SignInRequired({
  title,
  description,
  icon: Icon = Lock,
  nextPath,
  hints,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  /** Where to send the user after they sign in or register. */
  nextPath: string;
  hints?: string[];
}) {
  const next = encodeURIComponent(nextPath);

  return (
    <section className="mx-auto w-full max-w-lg px-3 py-8 sm:py-14">
      <div
        className="overflow-hidden rounded-3xl p-px shadow-[var(--shadow-soft)]"
        style={{ background: "var(--gradient-brand)" }}
      >
        <div className="rounded-[22px] bg-card px-6 py-10 text-center sm:px-9 sm:py-12">
          <div
            aria-hidden
            className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-[var(--shadow-pop)]"
            style={{ background: "var(--gradient-brand)" }}
          >
            <Icon size={26} strokeWidth={2} aria-hidden />
          </div>

          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
            Members only
          </p>
          <h1 className="mt-2 text-[22px] font-extrabold leading-tight tracking-tight sm:text-[26px]">
            {title}
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-[14px] leading-relaxed text-muted">
            {description}
          </p>

          {hints && hints.length > 0 ? (
            <ul className="mx-auto mt-5 max-w-xs space-y-2 text-left text-[13px] text-foreground/85">
              {hints.map((hint) => (
                <li key={hint} className="flex gap-2.5">
                  <span
                    aria-hidden
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: "var(--gradient-brand)" }}
                  />
                  <span>{hint}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-8 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
            <Link
              href={`/login?next=${next}`}
              className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-pop)] transition active:translate-y-px"
              style={{ background: "var(--gradient-brand)" }}
            >
              <LogIn size={16} aria-hidden />
              Sign in
            </Link>
            <Link
              href={`/register?next=${next}`}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-5 py-3 text-sm font-semibold transition hover:bg-hover"
            >
              <UserPlus size={16} aria-hidden />
              Create account
            </Link>
          </div>

          <p className="mt-6 text-[11px] leading-relaxed text-muted">
            Free to join · Part of {BRAND_NAME}
          </p>
        </div>
      </div>
    </section>
  );
}
