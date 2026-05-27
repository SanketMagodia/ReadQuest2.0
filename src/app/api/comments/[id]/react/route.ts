import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppSession } from "@/lib/session";
import connectDB from "@/lib/db";
import Comment from "@/models/Comment";
import User from "@/models/User";
import CommentReaction from "@/models/CommentReaction";
import { notifyCommentReaction } from "@/lib/notifications";

const reactSchema = z.object({
  type: z.union([z.literal("like"), z.literal("dislike"), z.null()]),
});

async function aggregate(commentId: string, viewerId?: string) {
  const counts = await CommentReaction.aggregate([
    { $match: { comment: new Types.ObjectId(commentId) } },
    { $group: { _id: "$type", n: { $sum: 1 } } },
  ]);
  const likes = counts.find((c) => c._id === "like")?.n ?? 0;
  const dislikes = counts.find((c) => c._id === "dislike")?.n ?? 0;
  let myReaction: "like" | "dislike" | null = null;
  if (viewerId && Types.ObjectId.isValid(viewerId)) {
    const mine = await CommentReaction.findOne({
      user: new Types.ObjectId(viewerId),
      comment: new Types.ObjectId(commentId),
    })
      .select("type")
      .lean();
    myReaction =
      (mine as { type?: "like" | "dislike" } | null)?.type ?? null;
  }
  return { likes, dislikes, myReaction };
}

/** Toggle/set the viewer's reaction for this comment.
 *  Body: `{ type: "like" | "dislike" | null }` (null clears). */
export async function POST(
  req: Request,
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

  const raw = await req.json().catch(() => ({}));
  const parsed = reactSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(parsed.error.flatten().fieldErrors, { status: 400 });
  }

  await connectDB();
  const comment = await Comment.findById(id)
    .select("_id author content post")
    .lean();
  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const userId = new Types.ObjectId(session.user.id);
  const commentId = new Types.ObjectId(id);

  if (parsed.data.type === null) {
    await CommentReaction.deleteOne({ user: userId, comment: commentId });
  } else {
    await CommentReaction.updateOne(
      { user: userId, comment: commentId },
      { $set: { type: parsed.data.type } },
      { upsert: true }
    );

    const actor = await User.findById(userId).select("name username").lean();
    const actorName =
      (actor as { name?: string; username?: string } | null)?.name ||
      (actor as { username?: string } | null)?.username ||
      "Someone";
    void notifyCommentReaction({
      commentId,
      commentAuthorId: (comment as { author: Types.ObjectId }).author,
      actorId: userId,
      actorName,
      reaction: parsed.data.type,
      parentPostId: (comment as { post: Types.ObjectId }).post,
      commentPreview: (comment as { content?: string }).content ?? "",
    });
  }

  const result = await aggregate(id, session.user.id);
  return NextResponse.json(result);
}
