import { NextResponse } from "next/server";
import { isAllowedCoverUrl } from "@/lib/cover-url";

/**
 * GET /api/cover?url=
 *
 * Same-origin copy of a book jacket. The gist snapshot draws the reel card
 * onto a canvas, and the cover hosts do not send CORS headers, so the browser
 * cannot read those images directly.
 */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("url") ?? "";
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Bad image" }, { status: 400 });
  }
  if (target.protocol === "http:") target.protocol = "https:";
  if (!isAllowedCoverUrl(target.href)) {
    return NextResponse.json({ error: "Bad image" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(target.href, {
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }

  if (!upstream.ok || !isAllowedCoverUrl(upstream.url)) {
    return new NextResponse(null, { status: 502 });
  }

  const type = upstream.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) {
    return new NextResponse(null, { status: 415 });
  }

  const bytes = await upstream.arrayBuffer();
  if (bytes.byteLength > 2_000_000) {
    return new NextResponse(null, { status: 413 });
  }

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
