import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import { getMyClub } from "@/lib/clubs";

/**
 * GET — the one club the caller belongs to, or null. Drives the home screen
 * swap and the "you're already in a club" guards in the UI.
 */
export async function GET() {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ club: null, role: null });
  }
  try {
    const mine = await getMyClub(session.user.id);
    return NextResponse.json({
      club: mine?.club ?? null,
      role: mine?.role ?? null,
    });
  } catch (e) {
    console.error("[clubs] me failed", e);
    return NextResponse.json({ club: null, role: null });
  }
}
