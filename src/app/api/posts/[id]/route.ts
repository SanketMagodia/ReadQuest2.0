import { Types } from "mongoose";
import { NextResponse } from "next/server";
import Post from "@/models/Post";
import connectDB from "@/lib/db";
import { serializePosts } from "@/lib/serialize";
import { getAppSession } from "@/lib/session";

export async function GET(
  _: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid post" }, { status: 400 });
  }
  await connectDB();
  const p = await Post.findById(id).lean();
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = await getAppSession();
  const [full] = await serializePosts([id], { viewerId: session?.user?.id });
  return NextResponse.json({ post: full });
}
