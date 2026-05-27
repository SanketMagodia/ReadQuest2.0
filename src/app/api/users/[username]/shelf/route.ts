import { Types } from "mongoose";
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";
import ReadList from "@/models/ReadList";
import BookFollow from "@/models/BookFollow";
import Post from "@/models/Post";
import "@/models/Book";

type PopulatedBook = {
  _id: Types.ObjectId;
  slug?: string;
  title: string;
  authors?: string;
  thumbnail?: string;
};

function serializeBooks(
  rows: { book: PopulatedBook | null }[]
): { id: string; slug: string; title: string; authors: string; thumbnail?: string }[] {
  return rows
    .map((r) => r.book)
    .filter((b): b is PopulatedBook => Boolean(b && b._id))
    .map((b) => ({
      id: b._id.toString(),
      slug: b.slug ?? "",
      title: b.title,
      authors: b.authors ?? "",
      thumbnail: b.thumbnail,
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

  const [readRows, followRows, postCount] = await Promise.all([
    ReadList.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate("book", "title authors thumbnail slug")
      .limit(120)
      .lean(),
    BookFollow.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate("book", "title authors thumbnail slug")
      .limit(120)
      .lean(),
    Post.countDocuments({ author: userId }),
  ]);

  const readlist = serializeBooks(readRows as { book: PopulatedBook | null }[]);
  const following = serializeBooks(followRows as { book: PopulatedBook | null }[]);

  return NextResponse.json({
    counts: {
      posts: postCount,
      readlist: readlist.length,
      following: following.length,
    },
    readlist,
    following,
  });
}
