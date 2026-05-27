import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import connectDB from "@/lib/db";
import Comment from "@/models/Comment";
import CommentReaction from "@/models/CommentReaction";
import Post from "@/models/Post";
import User from "@/models/User";
import Bot from "@/models/Bot";
import { commentCreateSchema } from "@/lib/validators";
import { generateAutoResponse } from "@/lib/bots/generate";
import { notifyPostComment, notifyCommentReply } from "@/lib/notifications";

type Populated = {
  _id: Types.ObjectId;
  content: string;
  createdAt: Date;
  parent: Types.ObjectId | null;
  author: { _id: Types.ObjectId; username: string; name: string; image?: string };
};

export async function GET(
  _: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid post" }, { status: 400 });
  }
  await connectDB();
  const exists = await Post.exists({ _id: id });
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const raw = (await Comment.find({ post: id })
    .sort({ createdAt: 1 })
    .populate("author", "username name image")
    .lean()) as Populated[];

  // Batch-load reactions for every comment in this thread.
  const session = await getAppSession();
  const viewerId = session?.user?.id;
  const commentObjectIds = raw.map((c) => c._id);

  const reactionCounts = await CommentReaction.aggregate([
    { $match: { comment: { $in: commentObjectIds } } },
    { $group: { _id: { comment: "$comment", type: "$type" }, n: { $sum: 1 } } },
  ]);
  const likeMap = new Map<string, number>();
  const dislikeMap = new Map<string, number>();
  for (const row of reactionCounts) {
    const cid = (row._id.comment as Types.ObjectId).toString();
    if (row._id.type === "like") likeMap.set(cid, row.n);
    else if (row._id.type === "dislike") dislikeMap.set(cid, row.n);
  }

  const myReactionMap = new Map<string, "like" | "dislike">();
  if (viewerId && Types.ObjectId.isValid(viewerId)) {
    const mine = await CommentReaction.find({
      user: new Types.ObjectId(viewerId),
      comment: { $in: commentObjectIds },
    })
      .select("comment type")
      .lean();
    for (const r of mine as Array<{
      comment: Types.ObjectId;
      type: "like" | "dislike";
    }>) {
      myReactionMap.set(r.comment.toString(), r.type);
    }
  }

  const comments = raw.map((c) => {
    const cid = c._id.toString();
    return {
      id: cid,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      parentId: c.parent?.toString() ?? null,
      author: {
        id: c.author._id.toString(),
        username: c.author.username,
        name: c.author.name,
        image: c.author.image,
      },
      likes: likeMap.get(cid) ?? 0,
      dislikes: dislikeMap.get(cid) ?? 0,
      myReaction: myReactionMap.get(cid) ?? null,
    };
  });

  return NextResponse.json({ comments });
}

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

  const body = await req.json();
  const parsed = commentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(parsed.error.flatten().fieldErrors, { status: 400 });
  }

  await connectDB();
  const post = await Post.findById(id).select("_id author").lean();
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let parent: Types.ObjectId | null = null;
  let parentAuthor: Types.ObjectId | null = null;
  if (parsed.data.parentId) {
    const parentDoc = await Comment.findOne({
      _id: parsed.data.parentId,
      post: id,
    })
      .select("_id author")
      .lean();
    if (!parentDoc) {
      return NextResponse.json({ error: "Invalid parent comment" }, { status: 400 });
    }
    parent = (parentDoc as { _id: Types.ObjectId })._id;
    parentAuthor =
      (parentDoc as { author: Types.ObjectId }).author ?? null;
  }

  const c = await Comment.create({
    post: new Types.ObjectId(id),
    author: new Types.ObjectId(session.user.id),
    parent,
    content: parsed.data.content,
  });

  // Notifications: notify post author for top-level comments, and the
  // parent comment author for replies. The notifier dedupes self-actions.
  void (async () => {
    try {
      const actorUser = await User.findById(session.user!.id)
        .select("name username")
        .lean();
      const actorName =
        (actorUser as { name?: string; username?: string } | null)?.name ||
        (actorUser as { username?: string } | null)?.username ||
        "Someone";
      const postAuthorId = (post as { author: Types.ObjectId }).author;
      if (parent && parentAuthor) {
        await notifyCommentReply({
          parentCommentId: parent,
          parentAuthorId: parentAuthor,
          actorId: session.user!.id,
          actorName,
          parentPostId: new Types.ObjectId(id),
          replyPreview: parsed.data.content,
        });
        // Also let the post author know their thread has new activity,
        // but only if they're not the parent commenter (dedupe handled
        // inside the notifier — same actor + type + link gate).
        if (postAuthorId && !postAuthorId.equals(parentAuthor)) {
          await notifyPostComment({
            postId: new Types.ObjectId(id),
            postAuthorId,
            actorId: session.user!.id,
            actorName,
            commentPreview: parsed.data.content,
          });
        }
      } else {
        await notifyPostComment({
          postId: new Types.ObjectId(id),
          postAuthorId,
          actorId: session.user!.id,
          actorName,
          commentPreview: parsed.data.content,
        });
      }
    } catch (err) {
      console.warn("[notifications] comment fan-out failed", err);
    }
  })();

  // Fire-and-forget: if the commenter is human, schedule any involved bots
  // to respond to THIS comment with a small natural delay.
  void scheduleBotAutoResponses(
    new Types.ObjectId(id),
    c._id as Types.ObjectId,
    session.user.id
  ).catch((err) => {
    console.error("[bots] auto-response scheduling failed", err);
  });

  const populated = await Comment.findById(c._id)
    .populate("author", "username name image")
    .lean();

  const p = populated as unknown as Populated;

  return NextResponse.json(
    {
      comment: {
        id: p._id.toString(),
        content: p.content,
        createdAt: p.createdAt.toISOString(),
        parentId: p.parent?.toString() ?? null,
        author: {
          id: p.author._id.toString(),
          username: p.author.username,
          name: p.author.name,
          image: p.author.image,
        },
      },
    },
    { status: 201 }
  );
}

/**
 * Best-effort: trigger any enabled bot with `autoRespondToComments` that's
 * involved in this thread (authored the post, or has previously commented)
 * to react to the new human comment. Runs after a short randomized delay so
 * the reply feels human rather than instant.
 */
async function scheduleBotAutoResponses(
  postId: Types.ObjectId,
  commentId: Types.ObjectId,
  commenterId: string
): Promise<void> {
  // Skip if the commenter themselves is a bot — prevents feedback loops.
  const commenter = await User.findById(commenterId).select("isBot").lean();
  if ((commenter as { isBot?: boolean } | null)?.isBot) return;

  // Find users who are involved in this thread.
  const [post, threadComments] = await Promise.all([
    Post.findById(postId).select("author").lean(),
    Comment.find({ post: postId }).select("author").lean(),
  ]);
  if (!post) return;

  const involvedUserIds = new Set<string>();
  involvedUserIds.add(
    ((post as { author: Types.ObjectId }).author as Types.ObjectId).toString()
  );
  for (const c of threadComments as { author: Types.ObjectId }[]) {
    involvedUserIds.add(c.author.toString());
  }
  if (!involvedUserIds.size) return;

  const bots = await Bot.find({
    enabled: true,
    autoRespondToComments: true,
    user: {
      $in: Array.from(involvedUserIds).map((id) => new Types.ObjectId(id)),
    },
  })
    .select("_id")
    .lean();
  if (!bots.length) return;

  for (const b of bots) {
    const botId = (b._id as Types.ObjectId).toString();
    // 30–90s randomized delay so the bot's reply feels considered rather than instant.
    const delayMs = 30_000 + Math.floor(Math.random() * 60_000);
    setTimeout(() => {
      generateAutoResponse(botId, commentId.toString()).catch((err) => {
        console.error("[bots] auto-response failed", botId, err);
      });
    }, delayMs).unref?.();
  }
}
