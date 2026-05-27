import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppSession } from "@/lib/session";
import {
  getOrCreateTodayPick,
  getStreakState,
  markTodayComplete,
  utcDay,
} from "@/lib/daily";
import BookSummary from "@/models/BookSummary";
import DailyBookPick from "@/models/DailyBookPick";
import connectDB from "@/lib/db";

/**
 * GET — returns the caller's pick for today (creating it if missing) along
 * with their current streak state and whether a cached summary exists.
 *
 *  { pick: DailyPickWithBook | null,
 *    streak: StreakState,
 *    summaryReady: boolean }
 */
export async function GET() {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const [pick, streak] = await Promise.all([
    getOrCreateTodayPick(userId),
    getStreakState(userId),
  ]);

  let summaryReady = false;
  if (pick) {
    await connectDB();
    const existing = await BookSummary.findOne({ book: pick.book.id })
      .select("_id")
      .lean();
    summaryReady = !!existing;
  }

  return NextResponse.json({ pick, streak, summaryReady });
}

/**
 * POST — marks today's daily read as complete. Idempotent: a second call on
 * the same day is a no-op (already counted).
 */
export async function POST() {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pick = await getOrCreateTodayPick(session.user.id);
  if (!pick) {
    return NextResponse.json(
      { error: "No daily pick available yet." },
      { status: 400 }
    );
  }

  const streak = await markTodayComplete(session.user.id);
  return NextResponse.json({ pick: { ...pick, completed: true }, streak });
}

const progressSchema = z.object({
  farthestPage: z.number().int().min(0).max(2000),
});

/** PATCH — record the furthest page the reader has reached today (resume hint). */
export async function PATCH(req: Request) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = progressSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(parsed.error.flatten().fieldErrors, {
      status: 400,
    });
  }

  await connectDB();
  await DailyBookPick.updateOne(
    { user: session.user.id, day: utcDay() },
    { $max: { farthestPage: parsed.data.farthestPage } }
  );
  return NextResponse.json({ ok: true });
}
