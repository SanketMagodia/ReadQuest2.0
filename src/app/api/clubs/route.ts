import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getAppSession } from "@/lib/session";
import connectDB from "@/lib/db";
import Club from "@/models/Club";
import ClubMembership from "@/models/ClubMembership";
import { clubCreateSchema } from "@/lib/validators";
import { slugifyText, withUniqueSuffix } from "@/lib/slug";
import { isMoodId } from "@/lib/moods";
import { serializeClub, ALREADY_IN_CLUB, type LeanClub } from "@/lib/clubs";

const PAGE = 18;

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * GET — browse active clubs, newest activity first. Public: signed-out readers
 * can look around, they just can't join until they log in.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const cursor = url.searchParams.get("cursor");
    const limit = Math.min(
      PAGE,
      Math.max(1, parseInt(url.searchParams.get("limit") ?? String(PAGE), 10) || PAGE)
    );

    await connectDB();

    const filter: Record<string, unknown> = { active: true };
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ name: rx }, { tagline: rx }];
    }
    const offset = cursor && /^\d+$/.test(cursor) ? parseInt(cursor, 10) : 0;

    const rows = await Club.find(filter)
      .sort({ lastMessageAt: -1, memberCount: -1, _id: -1 })
      .skip(offset)
      .limit(limit + 1)
      .populate("owner", "username name image")
      .populate("currentBook", "slug title authors thumbnail")
      .lean();

    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;

    return NextResponse.json({
      clubs: (slice as unknown as LeanClub[]).map(serializeClub),
      nextCursor: hasMore ? String(offset + limit) : null,
    });
  } catch (e) {
    console.error("[clubs] list failed", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** POST — start a club. The creator becomes its owner and only member. */
export async function POST(req: Request) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = clubCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid club details" },
      { status: 400 }
    );
  }

  await connectDB();
  const ownerId = new Types.ObjectId(session.user.id);

  const existing = await ClubMembership.findOne({ user: ownerId })
    .select("club")
    .lean<{ club: Types.ObjectId } | null>();
  if (existing) {
    return NextResponse.json(
      {
        error:
          "You're already in a club. Leave it — or deactivate the one you own — before starting another.",
        code: ALREADY_IN_CLUB,
      },
      { status: 409 }
    );
  }

  const base = slugifyText(parsed.data.name) || "club";
  const slug = await withUniqueSuffix(base, async (candidate) => {
    return !!(await Club.exists({ slug: candidate }));
  });

  const club = await Club.create({
    name: parsed.data.name,
    slug,
    tagline: parsed.data.tagline,
    mood: isMoodId(parsed.data.mood) ? parsed.data.mood : "",
    owner: ownerId,
    active: true,
    memberCount: 1,
  });

  try {
    await ClubMembership.create({
      club: club._id,
      user: ownerId,
      role: "owner",
    });
  } catch {
    // Lost a race for the one-club-per-reader slot — undo the club.
    await Club.deleteOne({ _id: club._id });
    return NextResponse.json(
      { error: "You're already in a club.", code: ALREADY_IN_CLUB },
      { status: 409 }
    );
  }

  return NextResponse.json(
    { club: { id: club._id.toString(), slug: club.slug, name: club.name } },
    { status: 201 }
  );
}
