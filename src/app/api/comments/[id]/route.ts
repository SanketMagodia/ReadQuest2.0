import { Types } from "mongoose";
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Comment from "@/models/Comment";
import { getAppSession } from "@/lib/session";
import { canDeleteContent } from "@/lib/content-permissions";
import { deleteCommentById } from "@/lib/content-delete";

export async function DELETE(
  _: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid comment" }, { status: 400 });
  }

  await connectDB();
  const comment = await Comment.findById(id).select("author").lean();
  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const authorId = comment.author.toString();
  if (!canDeleteContent(session.user, authorId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await deleteCommentById(id);
  return NextResponse.json({ ok: true });
}
