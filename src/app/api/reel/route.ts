import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppSession } from "@/lib/session";
import connectDB from "@/lib/db";
import ReelImpression from "@/models/ReelImpression";
import {
  buildRandomReel,
  buildReel,
  buildRelatedReel,
  buildStarterReel,
} from "@/lib/reel";

// Ranking a batch is one LLM call, which can outrun the default budget on a
// cold provider.
export const maxDuration = 60;

/**
 * GET /api/reel?exclude=id,id,…&starter=1&random=1&related=<bookId>
 *
 * The next run of personalized cards. `exclude` carries ids the client is
 * still holding but hasn't reported an action on yet, so prefetching the next
 * batch mid-scroll can't hand back a book already on screen.
 *
 * `starter=1` skips the ranker and answers from the shared hourly rotation,
 * which is what the client opens with while the personalized run is still in
 * flight. `random=1` samples summarized books the reader may already have
 * seen, for when the ranked pool is empty. `related=<bookId>` returns the
 * books that belong under that one, for a reel opened from a book page.
 *
 * Related and random runs carry no reader in them, so they answer for
 * signed-out visitors too — a book page is public and so is the reel it opens.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const exclude = (url.searchParams.get("exclude") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100);

  const related = url.searchParams.get("related");
  if (related) {
    if (!/^[a-f0-9]{24}$/i.test(related)) {
      return NextResponse.json({ error: "Invalid book" }, { status: 400 });
    }
    return NextResponse.json({ cards: await buildRelatedReel(related, exclude) });
  }

  if (url.searchParams.get("random") === "1") {
    return NextResponse.json({ cards: await buildRandomReel(exclude) });
  }

  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cards =
    url.searchParams.get("starter") === "1"
      ? await buildStarterReel(session.user.id, exclude)
      : await buildReel(session.user.id, exclude);
  return NextResponse.json({ cards });
}

const impressionSchema = z.object({
  bookId: z.string().regex(/^[a-f0-9]{24}$/i),
  action: z.enum(["served", "skipped", "read", "saved"]),
  dwellSeconds: z.coerce.number().min(0).max(36_000).optional().default(0),
});

/** Rank of an action, so a weaker signal never overwrites a stronger one. */
const WEIGHT: Record<string, number> = {
  served: 0,
  skipped: 1,
  read: 2,
  saved: 3,
};

/**
 * POST /api/reel — record what the reader did with a card.
 *
 * This is the only feedback the ranker gets, so it runs on `sendBeacon` from
 * the client and always answers 200-ish quickly.
 */
export async function POST(req: Request) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = impressionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid impression" }, { status: 400 });
  }
  const { bookId, action, dwellSeconds } = parsed.data;

  await connectDB();
  const filter = {
    user: new Types.ObjectId(session.user.id),
    book: new Types.ObjectId(bookId),
  };

  const existing = await ReelImpression.findOne(filter).select("action").lean();
  const keepExisting =
    existing && (WEIGHT[existing.action] ?? 0) > (WEIGHT[action] ?? 0);

  await ReelImpression.updateOne(
    filter,
    {
      $set: keepExisting ? {} : { action },
      $max: { dwellSeconds },
      $setOnInsert: filter,
    },
    { upsert: true }
  );

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/reel — forget which gists this reader has already been shown.
 *
 * Shelves, follows, and saved books stay. Only the viewed-history rows go, so
 * those books can be recommended again.
 */
export async function DELETE() {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const result = await ReelImpression.deleteMany({
    user: new Types.ObjectId(session.user.id),
  });

  return NextResponse.json({ ok: true, cleared: result.deletedCount });
}
