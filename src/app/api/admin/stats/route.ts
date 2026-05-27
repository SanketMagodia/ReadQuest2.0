import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import connectDB from "@/lib/db";
import Post from "@/models/Post";
import Book from "@/models/Book";
import User from "@/models/User";
import Comment from "@/models/Comment";

export async function GET() {
  const session = await getAppSession();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();
  const [posts, books, users, comments] = await Promise.all([
    Post.countDocuments(),
    Book.countDocuments(),
    User.countDocuments(),
    Comment.countDocuments(),
  ]);

  const recent = await Post.find()
    .sort({ _id: -1 })
    .limit(8)
    .populate("author", "username name")
    .populate("book", "title")
    .lean();

  return NextResponse.json({
    counts: { posts, books, users, comments },
    recentPosts: recent.map((p) => ({
      id: p._id.toString(),
      content: p.content.slice(0, 160),
      author: p.author as { username: string; name: string },
      book: p.book as { title: string },
      createdAt: (p as { createdAt?: Date }).createdAt,
    })),
  });
}
