import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getAppSession } from "@/lib/session";
import connectDB from "@/lib/db";
import Club from "@/models/Club";
import {
  ALREADY_IN_CLUB,
  OWNER_MUST_DEACTIVATE,
  joinClub,
  leaveClub,
} from "@/lib/clubs";

/** POST — join this club. Fails if the reader is already in one. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { slug } = await params;

  await connectDB();
  const club = await Club.findOne({ slug: slug.toLowerCase() })
    .select("_id mood")
    .lean<{ _id: Types.ObjectId; mood?: string } | null>();
  if (!club) {
    return NextResponse.json({ error: "Club not found" }, { status: 404 });
  }

  try {
    const memberCount = await joinClub(session.user.id, club._id);
    // The mood travels back so the client can offer to adopt it.
    return NextResponse.json({ joined: true, memberCount, mood: club.mood ?? "" });
  } catch (err) {
    if (err instanceof Error && err.message === ALREADY_IN_CLUB) {
      return NextResponse.json(
        {
          error:
            "You're already in a club. Leave it — or deactivate the one you own — before joining this one.",
          code: ALREADY_IN_CLUB,
        },
        { status: 409 }
      );
    }
    console.error("[clubs] join failed", err);
    return NextResponse.json({ error: "Could not join" }, { status: 500 });
  }
}

/** DELETE — leave whichever club the reader is in. */
export async function DELETE() {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await leaveClub(session.user.id);
    return NextResponse.json({ left: true });
  } catch (err) {
    if (err instanceof Error && err.message === OWNER_MUST_DEACTIVATE) {
      return NextResponse.json(
        {
          error:
            "You own this club. Mark it inactive to step away and join another.",
          code: OWNER_MUST_DEACTIVATE,
        },
        { status: 409 }
      );
    }
    console.error("[clubs] leave failed", err);
    return NextResponse.json({ error: "Could not leave" }, { status: 500 });
  }
}
