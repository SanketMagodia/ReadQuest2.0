import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import connectDB from "@/lib/db";
import User from "@/models/User";
import ReadList from "@/models/ReadList";
import "@/models/Book";
import Friendship from "@/models/Friendship";

type BookLite = {
  _id: Types.ObjectId;
  slug?: string;
  title: string;
  authors?: string;
  thumbnail?: string;
};

type LatestShelving = {
  book: BookLite;
  status: "want" | "read";
  at: Date;
};

/**
 * List the viewer's accepted friends, each with the last book they shelved (so
 * the UI can say "Alice is reading X" without a second round trip). One
 * Friendship scan + one User populate + one ReadList aggregation
 * (latest-per-user).
 */
export async function GET() {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const me = new Types.ObjectId(session.user.id);

  const edges = await Friendship.find({
    status: "accepted",
    $or: [{ requester: me }, { recipient: me }],
  })
    .sort({ acceptedAt: -1, createdAt: -1 })
    .select("requester recipient acceptedAt createdAt")
    .lean<
      {
        _id: Types.ObjectId;
        requester: Types.ObjectId;
        recipient: Types.ObjectId;
        acceptedAt?: Date;
        createdAt: Date;
      }[]
    >();

  if (!edges.length) {
    return NextResponse.json({ friends: [] });
  }

  const friendIds = edges.map((e) =>
    e.requester.equals(me) ? e.recipient : e.requester
  );

  const users = await User.find({ _id: { $in: friendIds } })
    .select("username name image bio")
    .lean<
      {
        _id: Types.ObjectId;
        username: string;
        name?: string;
        image?: string;
        bio?: string;
      }[]
    >();
  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  // Most recently shelved book per friend — the lightweight "reading now" hint.
  const latestRows = (await ReadList.aggregate([
    { $match: { user: { $in: friendIds } } },
    { $sort: { updatedAt: -1 } },
    {
      $group: {
        _id: "$user",
        entry: { $first: "$$ROOT" },
      },
    },
    {
      $lookup: {
        from: "books",
        localField: "entry.book",
        foreignField: "_id",
        as: "book",
      },
    },
    { $unwind: { path: "$book", preserveNullAndEmptyArrays: true } },
  ])) as {
    _id: Types.ObjectId;
    entry: { status?: "want" | "read"; updatedAt: Date };
    book?: BookLite;
  }[];

  const latestByUser = new Map<string, LatestShelving>();
  for (const row of latestRows) {
    if (!row.book) continue;
    latestByUser.set(row._id.toString(), {
      book: row.book,
      status: row.entry.status ?? "want",
      at: row.entry.updatedAt,
    });
  }

  const friends = edges.map((e) => {
    const otherId = (
      e.requester.equals(me) ? e.recipient : e.requester
    ).toString();
    const u = userMap.get(otherId);
    const latest = latestByUser.get(otherId) ?? null;
    return {
      friendshipId: e._id.toString(),
      user: u
        ? {
            id: otherId,
            username: u.username,
            name: u.name || u.username,
            image: u.image ?? null,
            bio: u.bio ?? "",
          }
        : { id: otherId, username: "unknown", name: "Unknown", image: null, bio: "" },
      since: (e.acceptedAt ?? e.createdAt).toISOString(),
      reading: latest
        ? {
            status: latest.status,
            at: latest.at.toISOString(),
            book: {
              id: latest.book._id.toString(),
              slug: latest.book.slug ?? "",
              title: latest.book.title,
              authors: latest.book.authors ?? "",
              thumbnail: latest.book.thumbnail,
            },
          }
        : null,
    };
  });

  return NextResponse.json({ friends });
}
