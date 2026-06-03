import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import connectDB from "@/lib/db";
import PostReport from "@/models/PostReport";
import { deletePostById } from "@/lib/content-delete";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ postId: string }> }
) {
  const gate = await requireAdmin();
  if (gate.response) return gate.response;

  const { postId } = await ctx.params;
  if (!Types.ObjectId.isValid(postId)) {
    return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
  }

  const raw = (await req.json().catch(() => null)) as { action?: string } | null;
  const action = raw?.action;
  if (action !== "ignore" && action !== "delete") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  await connectDB();
  const postObjectId = new Types.ObjectId(postId);

  if (action === "ignore") {
    const result = await PostReport.deleteMany({ post: postObjectId });
    return NextResponse.json({ ok: true, action, cleared: result.deletedCount ?? 0 });
  }

  await deletePostById(postId);
  await PostReport.deleteMany({ post: postObjectId });
  return NextResponse.json({ ok: true, action });
}
