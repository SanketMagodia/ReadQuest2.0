import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import connectDB from "@/lib/db";
import User from "@/models/User";
import Friendship from "@/models/Friendship";
import { getRelationship } from "@/lib/friends";

/** Return the viewer's relationship with the given username. */
export async function GET(
  _: Request,
  ctx: { params: Promise<{ username: string }> }
) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ relationship: "none", anonymous: true });
  }
  const { username } = await ctx.params;
  await connectDB();
  const u = await User.findOne({
    username: username.toLowerCase(),
  })
    .select("_id")
    .lean<{ _id: Types.ObjectId } | null>();
  if (!u) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const relationship = await getRelationship(session.user.id, u._id);
  return NextResponse.json({ relationship });
}

/** Remove a friend / cancel a pending request, regardless of direction. */
export async function DELETE(
  _: Request,
  ctx: { params: Promise<{ username: string }> }
) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { username } = await ctx.params;
  await connectDB();
  const me = new Types.ObjectId(session.user.id);
  const other = await User.findOne({ username: username.toLowerCase() })
    .select("_id")
    .lean<{ _id: Types.ObjectId } | null>();
  if (!other) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await Friendship.deleteMany({
    $or: [
      { requester: me, recipient: other._id },
      { requester: other._id, recipient: me },
    ],
  });
  return NextResponse.json({ ok: true, relationship: "none" });
}
