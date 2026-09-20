import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import connectDB from "@/lib/db";
import Book from "@/models/Book";
import User from "@/models/User";
import BookFollow from "@/models/BookFollow";
import BookSummary from "@/models/BookSummary";
import DailyBookPick from "@/models/DailyBookPick";
import Memory from "@/models/Memory";
import ReadList from "@/models/ReadList";
import ReelImpression from "@/models/ReelImpression";
import Friendship from "@/models/Friendship";
import Notification from "@/models/Notification";
import { humanUserFilter } from "@/lib/human-users";

function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export async function GET() {
  const gate = await requireAdmin();
  if (gate.response) return gate.response;

  await connectDB();

  const today = startOfDay();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const humans = humanUserFilter();

  const [
    books,
    users,
    eligibleBooks,
    remainingSummaries,
    memories,
    quests,
    usersToday,
    questsToday,
    gistsReadToday,
    usersWeek,
    gistsReadWeek,
    friendships,
    readlists,
    bookFollows,
    notifications,
    activeReadersWeek,
  ] = await Promise.all([
    Book.countDocuments(),
    User.countDocuments(humans),
    Book.countDocuments({ description: { $type: "string", $ne: "" } }),
    Book.aggregate([
      { $match: { description: { $type: "string", $ne: "" } } },
      {
        $lookup: {
          from: BookSummary.collection.name,
          localField: "_id",
          foreignField: "book",
          as: "s",
        },
      },
      { $match: { s: { $size: 0 } } },
      { $count: "n" },
    ]),
    Memory.countDocuments(),
    DailyBookPick.countDocuments({ completed: true }),
    User.countDocuments({ ...humans, createdAt: { $gte: today } }),
    DailyBookPick.countDocuments({ completed: true, completedAt: { $gte: today } }),
    ReelImpression.countDocuments({ action: "read", updatedAt: { $gte: today } }),
    User.countDocuments({ ...humans, createdAt: { $gte: weekAgo } }),
    ReelImpression.countDocuments({ action: "read", updatedAt: { $gte: weekAgo } }),
    Friendship.countDocuments({ status: "accepted" }),
    ReadList.countDocuments(),
    BookFollow.countDocuments(),
    Notification.countDocuments(),
    ReelImpression.distinct("user", { updatedAt: { $gte: weekAgo } }),
  ]);

  // The reel is the product's pulse now, so "recent activity" means the books
  // readers actually got through rather than anything they published.
  const recentReads = await ReelImpression.find({ action: { $in: ["read", "saved"] } })
    .sort({ updatedAt: -1 })
    .limit(8)
    .populate("user", "username name")
    .populate("book", "title")
    .lean();

  const recentUsers = await User.find(humans)
    .sort({ createdAt: -1 })
    .limit(8)
    .select("username name role createdAt")
    .lean<
      {
        _id: Types.ObjectId;
        username: string;
        name?: string;
        role?: string;
        createdAt: Date;
      }[]
    >();

  const remaining = (remainingSummaries[0] as { n?: number } | undefined)?.n ?? 0;
  const summarized = Math.max(0, eligibleBooks - remaining);
  const summaryCoverage = books ? Math.round((summarized / books) * 100) : 0;
  const eligibleCoverage = eligibleBooks
    ? Math.round((summarized / eligibleBooks) * 100)
    : 0;

  return NextResponse.json({
    counts: {
      books,
      users,
      summaries: summarized,
      eligibleBooks,
      remainingSummaries: remaining,
      summaryCoverage,
      eligibleCoverage,
      memories,
      quests,
      friendships,
      readlists,
      bookFollows,
      notifications,
    },
    today: {
      users: usersToday,
      quests: questsToday,
      gistsRead: gistsReadToday,
    },
    week: {
      users: usersWeek,
      gistsRead: gistsReadWeek,
      activeReaders: activeReadersWeek.length,
    },
    recentReads: recentReads.map((r) => ({
      id: r._id.toString(),
      action: r.action,
      user: r.user as unknown as { username: string; name: string },
      book: r.book as unknown as { title: string },
      at: r.updatedAt,
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
