"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { AtSign, Mail, KeyRound, Eye, EyeOff } from "lucide-react";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { AuthFormShell } from "@/components/auth/AuthFormShell";
import { BRAND_SHORT } from "@/lib/brand";
export default function RegisterClient() {
  const searchParams = useSearchParams();
  const nextUrl = searchParams?.get("next")?.trim() || "/";
  const nextQuery =
    nextUrl && nextUrl.startsWith("/") && nextUrl !== "/"
      ? `?next=${encodeURIComponent(nextUrl)}`
      : "";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username.toLowerCase(),
        password,
        email: email || undefined,
        name: username,
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      setError(txt || "Could not register");
      setSubmitting(false);
      return;
    }
    await signIn("credentials", {
      username: username.toLowerCase(),
      password,
      redirect: true,
      callbackUrl: nextUrl.startsWith("/") ? nextUrl : "/",
    });
  }

  return (
    <AuthFormShell>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted max-sm:text-center">
          Create your profile
        </p>
        <h1 className="mt-1.5 text-[26px] font-black leading-tight tracking-tight max-sm:text-center sm:text-[30px]">
          Join {BRAND_SHORT}
        </h1>
        <p className="mt-2 text-sm text-muted max-sm:text-center">
          Already with us?{" "}
          <Link
            className="font-semibold text-foreground underline-offset-4 hover:underline"
            href={`/login${nextQuery}`}
          >
            Sign in
          </Link>
        </p>
        <p className="mt-1 hidden text-center text-[12px] font-medium text-sky-700 dark:text-sky-300 max-sm:block">
          Takes 30 seconds — then you&apos;re in.
        </p>

        {submitting ? (
          <LoadingIndicator className="my-8" label="Creating your account…" />
        ) : null}

        <form
          onSubmit={(e) => void submit(e)}
          className={`mt-6 space-y-3 max-sm:mt-4 max-sm:space-y-2.5 ${submitting ? "pointer-events-none opacity-40" : ""}`}
        >
          <Field
            icon={<AtSign size={16} aria-hidden />}
            value={username}
            onChange={setUsername}
            placeholder="letters, numbers, _"
            autoComplete="username"
            label="Username"
          />
          <Field
            icon={<Mail size={16} aria-hidden />}
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="optional"
            autoComplete="email"
            label="Email"
          />
          <Field
            icon={<KeyRound size={16} aria-hidden />}
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={setPassword}
            placeholder="min 8 characters"
            autoComplete="new-password"
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
            Launch profile
          </button>
        </form>

        <p className="mt-4 text-[11px] leading-relaxed text-muted max-sm:hidden sm:mt-5">
          By joining you agree to our{" "}
          <Link href="/guidelines" className="font-semibold underline-offset-2 hover:underline">
            Guidelines
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="font-semibold underline-offset-2 hover:underline">
            Privacy Policy
          </Link>
          . We won&apos;t spam your inbox.
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
        <label className="block px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted max-sm:text-[10px]">
          {label}
        </label>
      ) : null}
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 transition focus-within:border-transparent focus-within:ring-2 focus-within:ring-violet-400/70 max-sm:rounded-[18px] max-sm:py-2.5">
        <span className="shrink-0 text-muted">{icon}</span>
        <input
          type={type}
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted/80"
        />
        {trailing ? <span className="shrink-0">{trailing}</span> : null}
      </div>
    </div>
  );
}
