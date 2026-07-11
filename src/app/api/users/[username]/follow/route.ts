import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import connectDB from "@/lib/db";
import User from "@/models/User";
import UserFollow from "@/models/UserFollow";
import { getFollowCounts, isFollowing } from "@/lib/follows";

async function resolveTarget(username: string) {
  await connectDB();
  return User.findOne({ username: username.toLowerCase() })
    .select("_id isBot")
    .lean<{ _id: Types.ObjectId; isBot?: boolean } | null>();
}

/** Follow state (viewer's perspective) + follower/following counts. */
export async function GET(
  _: Request,
  ctx: { params: Promise<{ username: string }> }
) {
  const { username } = await ctx.params;
  const target = await resolveTarget(username);
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const counts = await getFollowCounts(target._id);
  const session = await getAppSession();
  let following = false;
  let followsYou = false;
  if (session?.user?.id && !target._id.equals(session.user.id)) {
    const me = new Types.ObjectId(session.user.id);
    [following, followsYou] = await Promise.all([
      isFollowing(me, target._id),
      isFollowing(target._id, me),
    ]);
  }

  return NextResponse.json({
    following,
    followsYou,
    followers: counts.followers,
    followingCount: counts.following,
  });
}

/** Follow the target user. */
export async function POST(
  _: Request,
  ctx: { params: Promise<{ username: string }> }
) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { username } = await ctx.params;
  const target = await resolveTarget(username);
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const me = new Types.ObjectId(session.user.id);
  if (target._id.equals(me)) {
    return NextResponse.json({ error: "You can't follow yourself" }, { status: 400 });
  }
  if (target.isBot) {
    return NextResponse.json({ error: "You can't follow a bot account" }, { status: 400 });
  }

  await UserFollow.updateOne(
    { follower: me, following: target._id },
    { $setOnInsert: { follower: me, following: target._id } },
    { upsert: true }
  );

  const counts = await getFollowCounts(target._id);
  return NextResponse.json({ ok: true, following: true, followers: counts.followers });
}

/** Unfollow the target user. */
export async function DELETE(
  _: Request,
  ctx: { params: Promise<{ username: string }> }
) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { username } = await ctx.params;
  const target = await resolveTarget(username);
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const me = new Types.ObjectId(session.user.id);
  await UserFollow.deleteOne({ follower: me, following: target._id });

  const counts = await getFollowCounts(target._id);
  return NextResponse.json({ ok: true, following: false, followers: counts.followers });
}
