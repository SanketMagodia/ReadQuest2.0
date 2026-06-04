import { Types } from "mongoose";
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";
import ReadList from "@/models/ReadList";
import BookFollow from "@/models/BookFollow";
import Post from "@/models/Post";
import UserRecommendation from "@/models/UserRecommendation";
import "@/models/Book";

type PopulatedBook = {
  _id: Types.ObjectId;
  slug?: string;
  title: string;
  authors?: string;
  thumbnail?: string;
};

function serializeBooks(
  rows: { book: PopulatedBook | null; rank?: number }[]
): {
  id: string;
  slug: string;
  title: string;
  authors: string;
  thumbnail?: string;
  rank?: number;
}[] {
  return rows
    .filter((r) => Boolean(r.book && r.book._id))
    .map((r) => ({
      id: r.book!._id.toString(),
      slug: r.book!.slug ?? "",
      title: r.book!.title,
      authors: r.book!.authors ?? "",
      thumbnail: r.book!.thumbnail,
      rank: typeof r.rank === "number" ? r.rank : undefined,
    }));
}

export async function GET(
  _: Request,
  ctx: { params: Promise<{ username: string }> }
) {
  const { username } = await ctx.params;
  await connectDB();

  const user = await User.findOne({ username: username.toLowerCase() }).select("_id").lean();
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const userId = user._id as Types.ObjectId;

  const [wantRows, readRows, followRows, recRows, postCount] = await Promise.all([
    ReadList.find({ user: userId, $or: [{ status: "want" }, { status: { $exists: false } }] })
      .sort({ createdAt: -1 })
      .populate("book", "title authors thumbnail slug")
      .limit(120)
      .lean(),
    ReadList.find({ user: userId, status: "read" })
      .sort({ createdAt: -1 })
      .populate("book", "title authors thumbnail slug")
      .limit(120)
      .lean(),
    BookFollow.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate("book", "title authors thumbnail slug")
      .limit(120)
      .lean(),
    UserRecommendation.find({ user: userId })
      .sort({ rank: 1, createdAt: 1 })
      .populate("book", "title authors thumbnail slug")
      .limit(12)
      .lean(),
    Post.countDocuments({ author: userId }),
  ]);

  const wantToRead = serializeBooks(
    wantRows as unknown as { book: PopulatedBook | null; rank?: number }[]
  );
  const read = serializeBooks(
    readRows as unknown as { book: PopulatedBook | null; rank?: number }[]
  );
  const following = serializeBooks(followRows as { book: PopulatedBook | null }[]);
  const recommendations = serializeBooks(
    recRows as unknown as { book: PopulatedBook | null; rank?: number }[]
  );

  return NextResponse.json({
    counts: {
      posts: postCount,
      wantToRead: wantToRead.length,
      read: read.length,
      following: following.length,
      recommendations: recommendations.length,
    },
    wantToRead,
    read,
    following,
    recommendations,
  });
}
