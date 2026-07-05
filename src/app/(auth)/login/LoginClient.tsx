"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { AtSign, KeyRound, Eye, EyeOff } from "lucide-react";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { AuthFormShell } from "@/components/auth/AuthFormShell";
import { BRAND_NAME } from "@/lib/brand";

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams?.get("next")?.trim() || "/";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await signIn("credentials", {
      redirect: false,
      username: username.toLowerCase(),
      password,
    });

    if ((res as unknown as { ok?: boolean })?.ok) {
      router.push(nextUrl.startsWith("/") ? nextUrl : "/");
      return;
    }

    setError("Incorrect username or password.");
    setSubmitting(false);
  }

  return (
    <AuthFormShell>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted max-sm:text-center">
          Welcome back
        </p>
        <h1 className="mt-1.5 text-[26px] font-black leading-tight tracking-tight max-sm:text-center sm:text-[30px]">
          Sign in to {BRAND_NAME}
        </h1>
        <p className="mt-2 text-sm text-muted max-sm:text-center">
          New here?{" "}
          <Link
            className="font-semibold text-foreground underline-offset-4 hover:underline"
            href="/register"
          >
            Create an account
          </Link>
        </p>

        {submitting ? (
          <LoadingIndicator className="my-8" label="Signing in…" />
        ) : null}

        <form
          onSubmit={(e) => void submit(e)}
          className={`mt-6 space-y-3 max-sm:mt-5 max-sm:space-y-2.5 ${submitting ? "pointer-events-none opacity-40" : ""}`}
        >
          <Field
            icon={<AtSign size={16} aria-hidden />}
            autoComplete="username"
            value={username}
            onChange={setUsername}
            placeholder="Username"
            label="Username"
          />
          <Field
            icon={<KeyRound size={16} aria-hidden />}
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
            placeholder="Password"
            label="Password"
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="rounded-full p-1.5 text-muted transition hover:bg-hover hover:text-foreground"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            }
          />
          {error ? (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-300">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            className="mt-1 w-full rounded-full px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-pop)] transition active:translate-y-px max-sm:py-3.5 max-sm:text-[15px]"
            style={{ background: "var(--gradient-brand)" }}
          >
            Sign in
          </button>
        </form>

        <div className="my-4 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted max-sm:my-3.5 sm:my-5">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          onClick={() =>
            void signIn("google", {
              callbackUrl: nextUrl.startsWith("/") ? nextUrl : "/",
            })
          }
          className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-border bg-background px-5 py-3 text-sm font-semibold transition hover:bg-hover max-sm:py-3.5"
        >
          <GoogleMark />
          Continue with Google
        </button>

        <p className="mt-4 text-[11px] leading-relaxed text-muted max-sm:hidden sm:mt-5">
          By signing in you agree to our{" "}
          <Link href="/guidelines" className="font-semibold underline-offset-2 hover:underline">
            Guidelines
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="font-semibold underline-offset-2 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
    </AuthFormShell>
  );
}

function Field({
  icon,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  label,
  trailing,
}: {
  icon: React.ReactNode;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete?: string;
  label?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      {label ? (
        <label className="block px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          {label}
        </label>
      ) : null}
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 transition focus-within:border-transparent focus-within:ring-2 focus-within:ring-sky-400/70 max-sm:rounded-[18px] max-sm:py-2.5">
        <span className="shrink-0 text-muted">{icon}</span>
        <input
          type={type}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted/80"
        />
        {trailing ? <span className="shrink-0">{trailing}</span> : null}
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.7 4.8-6.3 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.5 16 18.9 13 24 13c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5 0-9.6-3.2-11.3-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.4-2.4 4.4-4.5 5.7l6.2 5.2C40.7 36 44 30.7 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
