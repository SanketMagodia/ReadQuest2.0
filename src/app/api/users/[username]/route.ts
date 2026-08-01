import { Types } from "mongoose";
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { peekStreak } from "@/lib/daily";
import { getFollowCounts } from "@/lib/follows";
import Club from "@/models/Club";
import { serializeClub, type LeanClub } from "@/lib/clubs";

export async function GET(
  _: Request,
  ctx: { params: Promise<{ username: string }> }
) {
  const { username } = await ctx.params;
  await connectDB();
  const user = await User.findOne({
    username: username.toLowerCase(),
  }).lean();

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const userId = (user._id as Types.ObjectId).toString();
  const [streak, follows] = await Promise.all([
    peekStreak(userId),
    getFollowCounts(userId),
  ]);

  // A club they run and keep active gets a shout-out on their profile.
  const ownedClub = await Club.findOne({ owner: user._id, active: true })
    .populate("owner", "username name image")
    .populate("currentBook", "slug title authors thumbnail")
    .lean();

  return NextResponse.json({
    club: ownedClub ? serializeClub(ownedClub as unknown as LeanClub) : null,
    user: {
      id: userId,
      username: user.username,
      name: user.name,
      image: user.image,
      bio: user.bio,
      mood: (user as { mood?: string }).mood ?? "",
      streak,
      followerCount: follows.followers,
      followingCount: follows.following,
      createdAt: (user as { createdAt?: Date }).createdAt,
    },
  });
}
