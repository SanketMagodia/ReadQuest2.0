import { Types } from "mongoose";
import connectDB from "@/lib/db";
import Club from "@/models/Club";
import ClubMembership from "@/models/ClubMembership";
import ClubShelfEntry from "@/models/ClubShelfEntry";
import "@/models/User";
import { isMoodId } from "@/lib/moods";

type ID = string | Types.ObjectId;

function toId(v: ID): Types.ObjectId {
  return v instanceof Types.ObjectId ? v : new Types.ObjectId(v);
}

/** Thrown when a reader tries to be in two clubs at once. */
export const ALREADY_IN_CLUB = "ALREADY_IN_CLUB";
/** Thrown when an owner tries to leave instead of deactivating. */
export const OWNER_MUST_DEACTIVATE = "OWNER_MUST_DEACTIVATE";

export type ClubBookLite = {
  id: string;
  slug: string;
  title: string;
  authors: string;
  thumbnail: string;
};

export type ClubSummary = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  mood: string;
  active: boolean;
  memberCount: number;
  lastMessageAt: string | null;
  owner: { username: string; name: string; image: string } | null;
  currentBook: ClubBookLite | null;
};

type PopulatedOwner = {
  _id: Types.ObjectId;
  username?: string;
  name?: string;
  image?: string;
};

type PopulatedBook = {
  _id: Types.ObjectId;
  slug?: string;
  title?: string;
  authors?: string;
  thumbnail?: string;
};

/** A club read with `.lean()`, `owner` and `currentBook` optionally populated. */
export type LeanClub = {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  tagline?: string;
  mood?: string;
  active?: boolean;
  memberCount?: number;
  lastMessageAt?: Date | null;
  owner?: PopulatedOwner | Types.ObjectId | null;
  currentBook?: PopulatedBook | Types.ObjectId | null;
};

function isPopulated<T extends { _id: Types.ObjectId }>(
  v: T | Types.ObjectId | null | undefined
): v is T {
  return !!v && typeof v === "object" && !(v instanceof Types.ObjectId);
}

export function serializeBookLite(b: PopulatedBook): ClubBookLite {
  return {
    id: b._id.toString(),
    slug: b.slug || b._id.toString(),
    title: b.title ?? "",
    authors: b.authors ?? "",
    thumbnail: b.thumbnail ?? "",
  };
}

/** Shape a club document (owner/currentBook populated) for the client. */
export function serializeClub(c: LeanClub): ClubSummary {
  const owner = isPopulated<PopulatedOwner>(c.owner) ? c.owner : null;
  const book = isPopulated<PopulatedBook>(c.currentBook) ? c.currentBook : null;
  return {
    id: c._id.toString(),
    slug: c.slug,
    name: c.name,
    tagline: c.tagline ?? "",
    mood: isMoodId(c.mood) ? c.mood : "",
    active: c.active !== false,
    memberCount: c.memberCount ?? 0,
    lastMessageAt: c.lastMessageAt ? new Date(c.lastMessageAt).toISOString() : null,
    owner: owner
      ? {
          username: owner.username ?? "",
          name: owner.name || owner.username || "",
          image: owner.image ?? "",
        }
      : null,
    currentBook: book ? serializeBookLite(book) : null,
  };
}

const OWNER_FIELDS = "username name image";
const BOOK_FIELDS = "slug title authors thumbnail";

export async function findClubBySlug(slug: string) {
  await connectDB();
  return Club.findOne({ slug: slug.toLowerCase() })
    .populate("owner", OWNER_FIELDS)
    .populate("currentBook", BOOK_FIELDS)
    .lean<LeanClub | null>();
}

/** The one club this reader belongs to, if any. */
export async function getMyMembership(userId: ID) {
  await connectDB();
  return ClubMembership.findOne({ user: toId(userId) })
    .select("club role lastReadAt")
    .lean<{
      _id: Types.ObjectId;
      club: Types.ObjectId;
      role: "owner" | "member";
      lastReadAt?: Date;
    } | null>();
}

/**
 * The one club a reader belongs to, fully populated, with their role in it.
 * Feeds the home screen for the signed-in reader and the club badge on
 * anybody's profile.
 */
export async function getClubForUser(userId: ID) {
  const membership = await getMyMembership(userId);
  if (!membership) return null;
  const club = await Club.findById(membership.club)
    .populate("owner", OWNER_FIELDS)
    .populate("currentBook", BOOK_FIELDS)
    .lean<LeanClub | null>();
  if (!club) return null;
  return { club: serializeClub(club), role: membership.role };
}

/** True member count, used to repair the denormalised counter after writes. */
export async function recountMembers(clubId: ID) {
  await connectDB();
  const count = await ClubMembership.countDocuments({ club: toId(clubId) });
  await Club.updateOne({ _id: toId(clubId) }, { $set: { memberCount: count } });
  return count;
}

/**
 * Join a club. Relies on the unique index on `ClubMembership.user`, so two
 * simultaneous joins can't both succeed.
 */
export async function joinClub(userId: ID, clubId: ID) {
  await connectDB();
  try {
    await ClubMembership.create({
      club: toId(clubId),
      user: toId(userId),
      role: "member",
    });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      throw new Error(ALREADY_IN_CLUB);
    }
    throw err;
  }
  return recountMembers(clubId);
}

/**
 * Leave whichever club the reader is in. Owners of an active club must
 * deactivate instead — that is the documented way to free yourself up.
 */
export async function leaveClub(userId: ID) {
  await connectDB();
  const membership = await getMyMembership(userId);
  if (!membership) return null;

  if (membership.role === "owner") {
    const club = await Club.findById(membership.club).select("active").lean<{
      active?: boolean;
    } | null>();
    if (club?.active !== false) throw new Error(OWNER_MUST_DEACTIVATE);
  }

  await ClubMembership.deleteOne({ _id: membership._id });
  await recountMembers(membership.club);
  return membership.club.toString();
}

/**
 * Flip a club's active flag.
 *
 * Deactivating also drops the owner's membership, which is what lets them go
 * and join someone else's club. Reactivating re-adds it, and therefore fails if
 * they have since joined another club.
 */
export async function setClubActive(clubId: ID, ownerId: ID, active: boolean) {
  await connectDB();
  const club = toId(clubId);
  const owner = toId(ownerId);

  if (active) {
    try {
      await ClubMembership.create({ club, user: owner, role: "owner" });
    } catch (err) {
      const existing = await ClubMembership.findOne({ user: owner })
        .select("club")
        .lean<{ club: Types.ObjectId } | null>();
      // Re-owning our own club is fine; being in someone else's is not.
      if (!existing || !existing.club.equals(club)) {
        if ((err as { code?: number }).code === 11000) {
          throw new Error(ALREADY_IN_CLUB);
        }
        throw err;
      }
    }
  } else {
    await ClubMembership.deleteOne({ club, user: owner, role: "owner" });
  }

  await Club.updateOne({ _id: club }, { $set: { active } });
  return recountMembers(club);
}

/**
 * Put a new book on the top rack, filing the outgoing one on the club shelf.
 * Passing null just clears the rack.
 */
export async function setCurrentBook(clubId: ID, bookId: ID | null) {
  await connectDB();
  const club = toId(clubId);
  const existing = await Club.findById(club).select("currentBook").lean<{
    currentBook?: Types.ObjectId | null;
  } | null>();

  const outgoing = existing?.currentBook ?? null;
  const incoming = bookId ? toId(bookId) : null;

  if (outgoing && (!incoming || !outgoing.equals(incoming))) {
    await ClubShelfEntry.updateOne(
      { club, book: outgoing },
      { $setOnInsert: { club, book: outgoing, finishedAt: new Date() } },
      { upsert: true }
    ).catch(() => {});
  }

  await Club.updateOne(
    { _id: club },
    {
      $set: {
        currentBook: incoming,
        currentBookSince: incoming ? new Date() : null,
      },
    }
  );

  // A new book means everyone starts over.
  if (!outgoing || !incoming || !outgoing.equals(incoming)) {
    await ClubMembership.updateMany(
      { club },
      { $set: { progress: 0, progressBook: incoming, progressAt: null } }
    );
  }
}

export type ClubMember = {
  /** The user's Mongo id — preferred for matching the signed-in viewer. */
  id: string;
  username: string;
  name: string;
  image: string;
  role: "owner" | "member";
  progress: number;
  progressAt: string | null;
};

type MemberRow = {
  role?: "owner" | "member";
  progress?: number;
  progressAt?: Date | null;
  user: {
    _id: Types.ObjectId;
    username?: string;
    name?: string;
    image?: string;
  } | null;
};

/** Everyone in the club with how far along they are, furthest first. */
export async function getClubMembers(clubId: ID, limit = 60) {
  await connectDB();
  const rows = await ClubMembership.find({ club: toId(clubId) })
    .sort({ progress: -1, createdAt: 1 })
    .limit(limit)
    .populate("user", "username name image")
    .lean<MemberRow[]>();

  return rows
    .filter((r) => r.user)
    .map<ClubMember>((r) => ({
      id: r.user?._id?.toString() ?? "",
      username: r.user?.username ?? "",
      name: r.user?.name || r.user?.username || "",
      image: r.user?.image ?? "",
      role: r.role === "owner" ? "owner" : "member",
      progress: typeof r.progress === "number" ? r.progress : 0,
      progressAt: r.progressAt ? new Date(r.progressAt).toISOString() : null,
    }));
}

/**
 * Move a member's marker on the current book.
 * Returns `{ progress, previous }` or null if they aren't in this club.
 * Writes through the native collection so a stale hot-reloaded schema can't
 * strip the newly-added progress paths.
 */
export async function setProgress(
  clubId: ID,
  userId: ID,
  progress: number,
  bookId: Types.ObjectId | null
) {
  await connectDB();
  const club = toId(clubId);
  const user = toId(userId);

  const existing = await ClubMembership.collection.findOne(
    { club, user },
    { projection: { progress: 1 } }
  );
  if (!existing) return null;

  const previous =
    typeof existing.progress === "number" ? existing.progress : 0;

  await ClubMembership.collection.updateOne(
    { club, user },
    {
      $set: {
        progress,
        progressBook: bookId,
        progressAt: new Date(),
        updatedAt: new Date(),
      },
    }
  );

  return { progress, previous };
}

/** Books the club has finished, newest first. */
export async function getClubShelf(clubId: ID, limit = 24) {
  await connectDB();
  const rows = await ClubShelfEntry.find({ club: toId(clubId) })
    .sort({ finishedAt: -1 })
    .limit(limit)
    .populate("book", BOOK_FIELDS)
    .lean<{ book: PopulatedBook | null }[]>();
  return rows
    .map((r) => (r.book ? serializeBookLite(r.book) : null))
    .filter((b): b is ClubBookLite => !!b);
}
