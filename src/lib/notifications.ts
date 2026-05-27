import { Types } from "mongoose";
import connectDB from "@/lib/db";
import Notification from "@/models/Notification";
import User from "@/models/User";

type ID = string | Types.ObjectId;

function toId(v: ID): Types.ObjectId {
  return v instanceof Types.ObjectId ? v : new Types.ObjectId(v);
}

function eq(a: ID, b: ID): boolean {
  return toId(a).equals(toId(b));
}

function trim(text: string, max = 140): string {
  const s = text.replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/** Pulls a recipient's `isBot` flag without leaking the rest. */
async function isBotRecipient(recipientId: ID): Promise<boolean> {
  const u = await User.findById(recipientId).select("isBot").lean();
  return !!(u as { isBot?: boolean } | null)?.isBot;
}

type CreateOpts = {
  recipient: ID;
  actor?: ID;
  type: string;
  link: string;
  message: string;
  preview?: string;
  book?: ID;
};

/**
 * Create one notification, skipping self-actions and bot recipients.
 * Idempotent-ish: if we already wrote the same (recipient, actor, type, link)
 * in the last 5 minutes we just bump its `createdAt` and clear `read` so it
 * resurfaces, which is what users actually want — no spam from rapid toggles.
 */
export async function createNotification(opts: CreateOpts): Promise<void> {
  try {
    if (opts.actor && eq(opts.recipient, opts.actor)) return;
    await connectDB();
    if (await isBotRecipient(opts.recipient)) return;

    const fiveMinAgo = new Date(Date.now() - 5 * 60_000);
    const existing = await Notification.findOne({
      recipient: toId(opts.recipient),
      actor: opts.actor ? toId(opts.actor) : null,
      type: opts.type,
      link: opts.link,
      createdAt: { $gte: fiveMinAgo },
    });

    if (existing) {
      existing.read = false;
      existing.message = opts.message;
      existing.preview = opts.preview ?? existing.preview;
      existing.createdAt = new Date();
      await existing.save();
      return;
    }

    await Notification.create({
      recipient: toId(opts.recipient),
      actor: opts.actor ? toId(opts.actor) : undefined,
      type: opts.type,
      link: opts.link,
      message: opts.message,
      preview: opts.preview ?? "",
      book: opts.book ? toId(opts.book) : undefined,
    });
  } catch (err) {
    // Notifications are never critical — log and move on so the request
    // that triggered them still succeeds.
    console.warn("[notifications] create failed", err);
  }
}

/**
 * Fan out a single event to many recipients in one insertMany. Used when a
 * new post lands in a book room — every follower of that book gets one row.
 */
export async function fanOutNotification(opts: {
  recipients: ID[];
  actor?: ID;
  type: string;
  link: string;
  message: string;
  preview?: string;
  book?: ID;
}): Promise<void> {
  try {
    if (!opts.recipients.length) return;
    await connectDB();
    const actor = opts.actor ? toId(opts.actor) : undefined;

    // Strip out actor + dupes.
    const unique = Array.from(
      new Set(
        opts.recipients.map((r) => toId(r).toString())
      )
    )
      .map((s) => new Types.ObjectId(s))
      .filter((id) => !actor || !id.equals(actor));

    if (!unique.length) return;

    // Drop bot recipients.
    const bots = await User.find({
      _id: { $in: unique },
      isBot: true,
    })
      .select("_id")
      .lean();
    const botSet = new Set(
      bots.map((b) => (b as { _id: Types.ObjectId })._id.toString())
    );
    const finalRecipients = unique.filter(
      (id) => !botSet.has(id.toString())
    );
    if (!finalRecipients.length) return;

    const now = new Date();
    const docs = finalRecipients.map((recipient) => ({
      recipient,
      actor,
      type: opts.type,
      link: opts.link,
      message: opts.message,
      preview: opts.preview ?? "",
      book: opts.book ? toId(opts.book) : undefined,
      read: false,
      createdAt: now,
      updatedAt: now,
    }));

    await Notification.insertMany(docs, { ordered: false }).catch((err) => {
      // ordered:false continues past individual errors (e.g. validation).
      console.warn("[notifications] fanOut partial failure", err);
    });
  } catch (err) {
    console.warn("[notifications] fanOut failed", err);
  }
}

// ─── high-level helpers used by the trigger sites ──────────────────────────

export async function notifyPostReaction(args: {
  postId: ID;
  postAuthorId: ID;
  actorId: ID;
  actorName: string;
  reaction: "like" | "dislike";
  postPreview: string;
}) {
  return createNotification({
    recipient: args.postAuthorId,
    actor: args.actorId,
    type: args.reaction === "like" ? "post_like" : "post_dislike",
    link: `/post/${toId(args.postId).toString()}`,
    message:
      args.reaction === "like"
        ? `${args.actorName} liked your post`
        : `${args.actorName} disliked your post`,
    preview: trim(args.postPreview),
  });
}

export async function notifyCommentReaction(args: {
  commentId: ID;
  commentAuthorId: ID;
  actorId: ID;
  actorName: string;
  reaction: "like" | "dislike";
  parentPostId: ID;
  commentPreview: string;
}) {
  return createNotification({
    recipient: args.commentAuthorId,
    actor: args.actorId,
    type: args.reaction === "like" ? "comment_like" : "comment_dislike",
    link: `/post/${toId(args.parentPostId).toString()}#comment-${toId(args.commentId).toString()}`,
    message:
      args.reaction === "like"
        ? `${args.actorName} liked your comment`
        : `${args.actorName} disliked your comment`,
    preview: trim(args.commentPreview),
  });
}

export async function notifyPostComment(args: {
  postId: ID;
  postAuthorId: ID;
  actorId: ID;
  actorName: string;
  commentPreview: string;
}) {
  return createNotification({
    recipient: args.postAuthorId,
    actor: args.actorId,
    type: "post_comment",
    link: `/post/${toId(args.postId).toString()}`,
    message: `${args.actorName} commented on your post`,
    preview: trim(args.commentPreview),
  });
}

export async function notifyCommentReply(args: {
  parentCommentId: ID;
  parentAuthorId: ID;
  actorId: ID;
  actorName: string;
  parentPostId: ID;
  replyPreview: string;
}) {
  return createNotification({
    recipient: args.parentAuthorId,
    actor: args.actorId,
    type: "comment_reply",
    link: `/post/${toId(args.parentPostId).toString()}#comment-${toId(args.parentCommentId).toString()}`,
    message: `${args.actorName} replied to your comment`,
    preview: trim(args.replyPreview),
  });
}

export async function notifyFriendRequest(args: {
  recipientId: ID;
  actorId: ID;
  actorName: string;
  actorUsername: string;
}) {
  return createNotification({
    recipient: args.recipientId,
    actor: args.actorId,
    type: "friend_request",
    link: "/friends?tab=requests",
    message: `${args.actorName} sent you a friend request`,
    preview: `@${args.actorUsername}`,
  });
}

export async function notifyFriendAccepted(args: {
  recipientId: ID;
  actorId: ID;
  actorName: string;
  actorUsername: string;
}) {
  return createNotification({
    recipient: args.recipientId,
    actor: args.actorId,
    type: "friend_accept",
    link: `/profile/${args.actorUsername}`,
    message: `${args.actorName} accepted your friend request`,
    preview: `@${args.actorUsername}`,
  });
}

export async function notifyFollowedBookPost(args: {
  postId: ID;
  bookId: ID;
  bookTitle: string;
  actorId: ID;
  actorName: string;
  followerIds: ID[];
  postPreview: string;
}) {
  return fanOutNotification({
    recipients: args.followerIds,
    actor: args.actorId,
    type: "followed_book_post",
    link: `/post/${toId(args.postId).toString()}`,
    message: `${args.actorName} posted in ${args.bookTitle}`,
    preview: trim(args.postPreview),
    book: args.bookId,
  });
}
