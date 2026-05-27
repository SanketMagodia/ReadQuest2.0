import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppSession } from "@/lib/session";
import connectDB from "@/lib/db";
import Post from "@/models/Post";
import User from "@/models/User";
import PostReaction from "@/models/PostReaction";
import { notifyPostReaction } from "@/lib/notifications";

const reactSchema = z.object({
  type: z.union([z.literal("like"), z.literal("dislike"), z.null()]),
});

async function aggregate(postId: string, viewerId?: string) {
  const counts = await PostReaction.aggregate([
    { $match: { post: new Types.ObjectId(postId) } },
    { $group: { _id: "$type", n: { $sum: 1 } } },
  ]);
  const likes = counts.find((c) => c._id === "like")?.n ?? 0;
  const dislikes = counts.find((c) => c._id === "dislike")?.n ?? 0;
  let myReaction: "like" | "dislike" | null = null;
  if (viewerId) {
    const mine = await PostReaction.findOne({
      user: new Types.ObjectId(viewerId),
      post: new Types.ObjectId(postId),
    })
      .select("type")
      .lean();
    myReaction =
      (mine as { type?: "like" | "dislike" } | null)?.type ?? null;
  }
  return { likes, dislikes, myReaction };
}

/** Toggle/set a reaction for the signed-in user on this post.
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
    return NextResponse.json({ error: "Invalid post" }, { status: 400 });
  }

  const raw = await req.json().catch(() => ({}));
  const parsed = reactSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(parsed.error.flatten().fieldErrors, { status: 400 });
  }

  await connectDB();
  const post = await Post.findById(id)
    .select("_id author content")
    .lean();
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const userId = new Types.ObjectId(session.user.id);
  const postId = new Types.ObjectId(id);

  if (parsed.data.type === null) {
    await PostReaction.deleteOne({ user: userId, post: postId });
  } else {
    await PostReaction.updateOne(
      { user: userId, post: postId },
      { $set: { type: parsed.data.type } },
      { upsert: true }
    );

    // Fire-and-forget notification to the post author. We use the actor's
    // display name so the notification card reads naturally.
    const actor = await User.findById(userId)
      .select("name username")
      .lean();
    const actorName =
      (actor as { name?: string; username?: string } | null)?.name ||
      (actor as { username?: string } | null)?.username ||
      "Someone";
    void notifyPostReaction({
      postId: id,
      postAuthorId: (post as { author: Types.ObjectId }).author,
      actorId: userId,
      actorName,
      reaction: parsed.data.type,
      postPreview: (post as { content?: string }).content ?? "",
    });
  }

  const result = await aggregate(id, session.user.id);
  return NextResponse.json(result);
}
