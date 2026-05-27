import { Types } from "mongoose";
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";

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

  return NextResponse.json({
    user: {
      id: (user._id as Types.ObjectId).toString(),
      username: user.username,
      name: user.name,
      image: user.image,
      bio: user.bio,
      createdAt: (user as { createdAt?: Date }).createdAt,
    },
  });
}
