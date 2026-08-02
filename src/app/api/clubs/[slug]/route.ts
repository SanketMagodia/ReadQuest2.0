import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getAppSession } from "@/lib/session";
import connectDB from "@/lib/db";
import Club from "@/models/Club";
import ClubMembership from "@/models/ClubMembership";
import Book from "@/models/Book";
import { clubUpdateSchema } from "@/lib/validators";
import { isMoodId } from "@/lib/moods";
import {
  ALREADY_IN_CLUB,
  findClubBySlug,
  getClubMembers,
  getClubShelf,
  serializeClub,
  setClubActive,
  setCurrentBook,
} from "@/lib/clubs";

/**
 * Query result shapes are declared as named aliases and every read is `.lean()`
 * with an explicit type. Letting Mongoose infer hydrated-document types through
 * chained `.populate()` here was enough to blow tsc's type-instantiation budget.
 */
type MembershipRef = { club: Types.ObjectId };

type ClubEditable = {
  _id: Types.ObjectId;
  slug: string;
  owner: Types.ObjectId;
};

/** GET — club detail plus the viewer's relationship to it. Public. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const club = await findClubBySlug(slug);
  if (!club) {
    return NextResponse.json({ error: "Club not found" }, { status: 404 });
  }

  const session = await getAppSession();
  const viewerId = session?.user?.id ?? null;

  let isMember = false;
  let isOwner = false;
  let inAnotherClub = false;

  if (viewerId && Types.ObjectId.isValid(viewerId)) {
    const me = new Types.ObjectId(viewerId);
    const ownerId =
      club.owner && "_id" in club.owner ? club.owner._id : club.owner;
    isOwner = ownerId instanceof Types.ObjectId ? ownerId.equals(me) : false;

    const membership = await ClubMembership.findOne({ user: me })
      .select("club")
      .lean<MembershipRef | null>();
    if (membership) {
      isMember = membership.club.equals(club._id);
      inAnotherClub = !isMember;
    }
  }

  const shelf = await getClubShelf(club._id);
  const members = await getClubMembers(club._id);

  return NextResponse.json({
    club: serializeClub(club),
    shelf,
    members,
    viewer: { isMember, isOwner, inAnotherClub, signedIn: !!viewerId },
  });
}

/** PATCH — owner-only edits: name, tagline, mood, active flag, top rack. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { slug } = await params;

  await connectDB();
  const club = await Club.findOne({ slug: slug.toLowerCase() })
    .select("_id slug owner")
    .lean<ClubEditable | null>();
  if (!club) {
    return NextResponse.json({ error: "Club not found" }, { status: 404 });
  }

  const me = new Types.ObjectId(session.user.id);
  if (!club.owner.equals(me)) {
    return NextResponse.json(
      { error: "Only the club owner can change this." },
      { status: 403 }
    );
  }

  const parsed = clubUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid update" },
      { status: 400 }
    );
  }
  const p = parsed.data;

  const updates: Record<string, unknown> = {};
  if (typeof p.name === "string") updates.name = p.name;
  if (typeof p.tagline === "string") updates.tagline = p.tagline;
  if (typeof p.mood === "string") updates.mood = isMoodId(p.mood) ? p.mood : "";
  if (Object.keys(updates).length) {
    await Club.updateOne({ _id: club._id }, { $set: updates });
  }

  if (p.currentBookId !== undefined) {
    if (!p.currentBookId) {
      await setCurrentBook(club._id, null);
    } else {
      if (!Types.ObjectId.isValid(p.currentBookId)) {
        return NextResponse.json({ error: "Unknown book" }, { status: 400 });
      }
      const exists = await Book.exists({ _id: p.currentBookId });
      if (!exists) {
        return NextResponse.json({ error: "Unknown book" }, { status: 400 });
      }
      await setCurrentBook(club._id, p.currentBookId);
    }
  }

  if (typeof p.active === "boolean") {
    try {
      await setClubActive(club._id, me, p.active);
    } catch (err) {
      if (err instanceof Error && err.message === ALREADY_IN_CLUB) {
        return NextResponse.json(
          {
            error:
              "You've joined another club. Leave it first to reactivate this one.",
            code: ALREADY_IN_CLUB,
          },
          { status: 409 }
        );
      }
      throw err;
    }
  }

  const fresh = await findClubBySlug(club.slug);
  return NextResponse.json({ club: fresh ? serializeClub(fresh) : null });
}
