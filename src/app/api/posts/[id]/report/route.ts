import { Types } from "mongoose";
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Post from "@/models/Post";
import PostReport from "@/models/PostReport";
import { getAppSession } from "@/lib/session";

export async function POST(
  _: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid post" }, { status: 400 });
  }

  await connectDB();
  const exists = await Post.exists({ _id: id });
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await PostReport.updateOne(
    {
      post: new Types.ObjectId(id),
      reporter: new Types.ObjectId(session.user.id),
    },
    { $setOnInsert: { reason: "general" } },
    { upsert: true }
  );

  return NextResponse.json({
    ok: true,
    created: result.upsertedCount > 0,
  });
}
