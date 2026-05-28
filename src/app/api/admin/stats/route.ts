import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import connectDB from "@/lib/db";
import Post from "@/models/Post";
import Book from "@/models/Book";
import User from "@/models/User";
import Comment from "@/models/Comment";
import BookFollow from "@/models/BookFollow";
import ReadList from "@/models/ReadList";
import Friendship from "@/models/Friendship";
import Notification from "@/models/Notification";
import { getBotUserIds, humanUserFilter } from "@/lib/human-users";

function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export async function GET() {
  const gate = await requireAdmin();
  if (gate.response) return gate.response;

  await connectDB();

  const today = startOfDay();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const botUserIds = await getBotUserIds();
  const humans = humanUserFilter(botUserIds);

  const [
    posts,
    books,
    users,
    comments,
    bots,
    postsToday,
    commentsToday,
    usersToday,
    postsWeek,
    usersWeek,
    friendships,
    readlists,
    bookFollows,
    notifications,
    activePostersWeek,
  ] = await Promise.all([
    Post.countDocuments(),
    Book.countDocuments(),
    User.countDocuments(humans),
    Comment.countDocuments(),
    User.countDocuments({ _id: { $in: botUserIds } }),
    Post.countDocuments({ createdAt: { $gte: today } }),
    Comment.countDocuments({ createdAt: { $gte: today } }),
    User.countDocuments({ ...humans, createdAt: { $gte: today } }),
    Post.countDocuments({ createdAt: { $gte: weekAgo } }),
    User.countDocuments({ ...humans, createdAt: { $gte: weekAgo } }),
    Friendship.countDocuments({ status: "accepted" }),
    ReadList.countDocuments(),
    BookFollow.countDocuments(),
    Notification.countDocuments(),
    Post.distinct("author", {
      createdAt: { $gte: weekAgo },
      author: { $nin: botUserIds },
    }),
  ]);

  const recent = await Post.find()
    .sort({ _id: -1 })
    .limit(8)
    .populate("author", "username name isBot")
    .populate("book", "title")
    .lean();

  const recentUsers = await User.find(humans)
    .sort({ createdAt: -1 })
    .limit(8)
    .select("username name role createdAt isBot")
    .lean<
      {
        _id: Types.ObjectId;
        username: string;
        name?: string;
        role?: string;
        createdAt: Date;
      }[]
    >();

  return NextResponse.json({
    counts: {
      posts,
      books,
      users,
      comments,
      bots,
      friendships,
      readlists,
      bookFollows,
      notifications,
    },
    today: {
      posts: postsToday,
      comments: commentsToday,
      users: usersToday,
    },
    week: {
      posts: postsWeek,
      users: usersWeek,
      activePosters: activePostersWeek.length,
    },
    recentPosts: recent.map((p) => ({
      id: (p._id as Types.ObjectId).toString(),
      content: p.content.slice(0, 160),
      author: p.author as { username: string; name: string },
      book: p.book as { title: string },
      createdAt: (p as { createdAt?: Date }).createdAt,
    })),
    recentUsers: recentUsers.map((u) => ({
      id: u._id.toString(),
      username: u.username,
      name: u.name || u.username,
      role: u.role ?? "user",
      createdAt: u.createdAt.toISOString(),
    })),
  });
}
