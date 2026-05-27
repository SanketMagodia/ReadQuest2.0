import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import connectDB from "@/lib/db";
import User from "@/models/User";
import Post from "@/models/Post";
import "@/models/Book";
import Friendship from "@/models/Friendship";

type BookLite = {
  _id: Types.ObjectId;
  slug?: string;
  title: string;
  authors?: string;
  thumbnail?: string;
};

type LatestPost = {
  _id: Types.ObjectId;
  author: Types.ObjectId;
  book: BookLite | null;
  content: string;
  createdAt: Date;
};

/**
 * List the viewer's accepted friends, each with their most recent post (so the
 * UI can say "Alice is reading X" without a second round trip). One Friendship
 * scan + one User populate + one Post aggregation (latest-per-author).
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

  // Most recent post per friend (used as a lightweight "reading now" hint).
  const latestRows = (await Post.aggregate([
    { $match: { author: { $in: friendIds } } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$author",
        post: { $first: "$$ROOT" },
      },
    },
    {
      $lookup: {
        from: "books",
        localField: "post.book",
        foreignField: "_id",
        as: "book",
      },
    },
    { $unwind: { path: "$book", preserveNullAndEmptyArrays: true } },
  ])) as {
    _id: Types.ObjectId;
    post: { _id: Types.ObjectId; content: string; createdAt: Date };
    book?: BookLite;
  }[];

  const latestByAuthor = new Map<string, LatestPost>();
  for (const row of latestRows) {
    latestByAuthor.set(row._id.toString(), {
      _id: row.post._id,
      author: row._id,
      book: row.book ?? null,
      content: row.post.content,
      createdAt: row.post.createdAt,
    });
  }

  const friends = edges.map((e) => {
    const otherId = (
      e.requester.equals(me) ? e.recipient : e.requester
    ).toString();
    const u = userMap.get(otherId);
    const latest = latestByAuthor.get(otherId) ?? null;
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
      reading: latest && latest.book
        ? {
            postId: latest._id.toString(),
            preview: latest.content.slice(0, 220),
            createdAt: latest.createdAt.toISOString(),
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
