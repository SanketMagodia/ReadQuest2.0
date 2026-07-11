import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import { getStreakState } from "@/lib/daily";

/** Lightweight streak read for the signed-in user (powers the top-bar badge). */
export async function GET() {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const s = await getStreakState(session.user.id);
  return NextResponse.json({
    current: s.current,
    longest: s.longest,
    completedToday: s.completedToday,
  });
}
