import { Types } from "mongoose";
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { getFollowCounts } from "@/lib/follows";
import { getClubForUser } from "@/lib/clubs";

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
  const follows = await getFollowCounts(userId);

  // Whichever club they're in — running it or just reading along — so visitors
  // can see where this reader hangs out.
  const membership = await getClubForUser(userId);

  return NextResponse.json({
    club: membership?.club ?? null,
    clubRole: membership?.role ?? null,
    user: {
      id: userId,
      username: user.username,
      name: user.name,
      image: user.image,
      bio: user.bio,
      mood: (user as { mood?: string }).mood ?? "",
      followerCount: follows.followers,
      followingCount: follows.following,
      createdAt: (user as { createdAt?: Date }).createdAt,
    },
  });
}
