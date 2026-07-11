import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import connectDB from "@/lib/db";
import User from "@/models/User";
import UserFollow from "@/models/UserFollow";
import { followingSubset } from "@/lib/follows";

type PopulatedUser = {
  _id: Types.ObjectId;
  username: string;
  name?: string;
  image?: string;
  bio?: string;
};

type Row = { following: PopulatedUser | null };

/** Readers this user follows. */
export async function GET(
  _: Request,
  ctx: { params: Promise<{ username: string }> }
) {
  const { username } = await ctx.params;
  await connectDB();
  const target = await User.findOne({ username: username.toLowerCase() })
    .select("_id")
    .lean<{ _id: Types.ObjectId } | null>();
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await UserFollow.find({ follower: target._id })
    .sort({ createdAt: -1 })
    .limit(200)
    .populate("following", "username name image bio")
    .lean<Row[]>();

  const people = rows
    .map((r) => r.following)
    .filter((u): u is PopulatedUser => Boolean(u?._id));

  const session = await getAppSession();
  const iFollow = session?.user?.id
    ? await followingSubset(
        session.user.id,
        people.map((u) => u._id)
      )
    : new Set<string>();

  return NextResponse.json({
    users: people.map((u) => ({
      id: u._id.toString(),
      username: u.username,
      name: u.name || u.username,
      image: u.image ?? null,
      bio: u.bio ?? "",
      isFollowing: iFollow.has(u._id.toString()),
      isSelf: session?.user?.id === u._id.toString(),
    })),
  });
}
