import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import connectDB from "@/lib/db";
import User from "@/models/User";
import Post from "@/models/Post";
import { getBotUserIds, humanUserFilter } from "@/lib/human-users";

export async function GET(req: Request) {
  const gate = await requireAdmin();
  if (gate.response) return gate.response;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const limit = Math.min(Number(url.searchParams.get("limit") || 40), 100);
  const cursor = url.searchParams.get("cursor") ?? undefined;

  await connectDB();

  const botUserIds = await getBotUserIds();
  const filter: Record<string, unknown> = { ...humanUserFilter(botUserIds) };
  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(escaped, "i");
    filter.$or = [{ username: rx }, { name: rx }, { email: rx }];
  }
  if (cursor && Types.ObjectId.isValid(cursor)) {
    filter._id = { $lt: new Types.ObjectId(cursor) };
  }

  const rows = await User.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .select("username name email role createdAt image bio")
    .lean<
      {
        _id: Types.ObjectId;
        username: string;
        name?: string;
        email?: string;
        role?: string;
        createdAt: Date;
        image?: string;
        bio?: string;
      }[]
    >();

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const ids = slice.map((u) => u._id);

  const postCounts = ids.length
    ? await Post.aggregate([
        { $match: { author: { $in: ids } } },
        { $group: { _id: "$author", posts: { $sum: 1 } } },
      ])
    : [];
  const postMap = new Map<string, number>(
    postCounts.map((r) => [(r._id as Types.ObjectId).toString(), r.posts as number])
  );

  const nextCursor =
    hasMore && slice.length ?
      slice[slice.length - 1]._id.toString()
    : null;

  return NextResponse.json({
    users: slice.map((u) => ({
      id: u._id.toString(),
      username: u.username,
      name: u.name || u.username,
      email: u.email ?? "",
      role: u.role ?? "user",
      bio: u.bio ?? "",
      image: u.image ?? null,
      posts: postMap.get(u._id.toString()) ?? 0,
      createdAt: u.createdAt.toISOString(),
    })),
    nextCursor,
  });
}
