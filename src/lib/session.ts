import { cache } from "react";
import { cookies } from "next/headers";
import { getServerSession, type Session } from "next-auth";
import { decode } from "next-auth/jwt";
import { authOptions } from "@/auth-options";
import { getAuthSecret } from "@/lib/auth-secret";

const SESSION_COOKIES = [
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
];

type CookieStore = Awaited<ReturnType<typeof cookies>>;

/** The session JWT, reassembled the way NextAuth does when it's chunked. */
function readSessionCookie(store: CookieStore): string | null {
  for (const name of SESSION_COOKIES) {
    const parts = store
      .getAll()
      .filter((c) => c.name === name || c.name.startsWith(`${name}.`))
      .sort((a, b) => {
        const n = (s: string) => parseInt(s.split(".").pop() ?? "0", 10) || 0;
        return n(a.name) - n(b.name);
      });
    if (parts.length) return parts.map((c) => c.value).join("");
  }
  return null;
}

/**
 * The signed-in reader, read straight from the session JWT.
 *
 * `getServerSession` would run the `session` callback, which loads the avatar
 * (a data URL, often tens of KB) from Mongo on every call — and nearly every
 * API route calls this. Server code only ever needs id, username and role, so
 * the avatar is left to the client session (`/api/auth/session`). Memoized per
 * request, so a page and its metadata share one decode.
 */
export const getAppSession = cache(async (): Promise<Session | null> => {
  const secret = getAuthSecret();
  if (!secret) return null;

  const raw = readSessionCookie(await cookies());
  if (!raw) return null;

  const token = await decode({ token: raw, secret }).catch(() => null);
  if (!token) return null;

  const id = (typeof token.uid === "string" && token.uid) || token.sub || "";
  if (!id) return null;

  // Tokens minted before username/role lived on the JWT get hydrated by the
  // `jwt` callback; let NextAuth do that rather than duplicating it here.
  if (typeof token.username !== "string" || typeof token.role !== "string") {
    return getServerSession(authOptions);
  }

  return {
    user: {
      id,
      username: token.username,
      role: token.role === "admin" ? "admin" : "user",
      name: typeof token.name === "string" ? token.name : null,
      email: typeof token.email === "string" ? token.email : null,
      image: null,
    },
    expires: new Date(
      (typeof token.exp === "number" ? token.exp : Date.now() / 1000) * 1000
    ).toISOString(),
  };
});
