import { Types } from "mongoose";
import Comment from "@/models/Comment";
import CommentReaction from "@/models/CommentReaction";
import Notification from "@/models/Notification";
import Post from "@/models/Post";
import PostReport from "@/models/PostReport";
import PostReaction from "@/models/PostReaction";

function commentDescendantIds(
  rootId: string,
  rows: Array<{ _id: Types.ObjectId; parent?: Types.ObjectId | null }>
) {
  const children = new Map<string, string[]>();
  for (const row of rows) {
    const parentId = row.parent?.toString();
    if (!parentId) continue;
    const list = children.get(parentId) ?? [];
    list.push(row._id.toString());
    children.set(parentId, list);
  }

  const ids = [rootId];
  const queue = [rootId];
  while (queue.length) {
    const current = queue.shift()!;
    for (const childId of children.get(current) ?? []) {
      ids.push(childId);
      queue.push(childId);
    }
  }
  return ids;
}

export async function deletePostById(postId: string) {
  const postObjectId = new Types.ObjectId(postId);
  const comments = await Comment.find({ post: postObjectId }).select("_id").lean();
  const commentIds = comments.map((c) => c._id);

  await Promise.all([
    PostReaction.deleteMany({ post: postObjectId }),
    commentIds.length ?
      CommentReaction.deleteMany({ comment: { $in: commentIds } })
    : Promise.resolve(),
    Comment.deleteMany({ post: postObjectId }),
    Post.deleteOne({ _id: postObjectId }),
    PostReport.deleteMany({ post: postObjectId }),
    Notification.deleteMany({
      $or: [
        { link: `/post/${postId}` },
        { link: { $regex: `^/post/${postId}(#|$)` } },
      ],
    }),
  ]);
}

export async function deleteCommentById(commentId: string) {
  const root = await Comment.findById(commentId).select("post").lean();
  if (!root) return false;

  const postId = root.post.toString();
  const rows = await Comment.find({ post: root.post }).select("_id parent").lean();
  const ids = commentDescendantIds(commentId, rows);
  const objectIds = ids.map((id) => new Types.ObjectId(id));

  await Promise.all([
    CommentReaction.deleteMany({ comment: { $in: objectIds } }),
    Comment.deleteMany({ _id: { $in: objectIds } }),
    Notification.deleteMany({
      link: {
        $in: ids.flatMap((id) => [
          `/post/${postId}#comment-${id}`,
          `/post/${postId}`,
        ]),
      },
    }),
  ]);

  return true;
}
