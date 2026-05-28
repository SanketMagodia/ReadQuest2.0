import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/** Must match `getAuthSecret()` — inlined here because Next.js only bundles
 *  env vars into middleware when they are referenced directly in this file. */
function middlewareAuthSecret() {
  return (
    process.env.NEXTAUTH_SECRET ??
    process.env.AUTH_SECRET ??
    (process.env.NODE_ENV !== "production" ?
      "readquest-dev-secret-do-not-deploy-please-32-characters"
    : undefined)
  );
}

export async function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith("/admin")) return NextResponse.next();

  const secret = middlewareAuthSecret();
  if (!secret) {
    console.error("[middleware] NEXTAUTH_SECRET is not configured");
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const token = await getToken({
    req,
    secret,
    secureCookie: (process.env.NEXTAUTH_URL ?? "").startsWith("https://"),
  });

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  const role = typeof token.role === "string" ? token.role : "";
  if (role !== "admin") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
