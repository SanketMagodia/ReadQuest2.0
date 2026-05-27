import { Types } from "mongoose";
import Post from "@/models/Post";
import "@/models/User";
import "@/models/Book";

export type PostDTO = {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    username: string;
    name: string;
    image?: string;
  };
  book: {
    id: string;
    slug: string;
    title: string;
    authors: string;
    thumbnail?: string;
  };
  commentCount: number;
  likes: number;
  dislikes: number;
  myReaction: "like" | "dislike" | null;
};

type SerializeOptions = {
  viewerId?: string;
};

export async function serializePosts(
  ids: string[],
  opts: SerializeOptions = {}
): Promise<PostDTO[]> {
  if (!ids.length) return [];
  const posts = await Post.find({ _id: { $in: ids } })
    .populate("author", "username name image")
    .populate("book", "title authors thumbnail slug")
    .lean();

  const Comment = (await import("@/models/Comment")).default;
  const counts = await Comment.aggregate([
    { $match: { post: { $in: ids.map((id) => new Types.ObjectId(id)) } } },
    { $group: { _id: "$post", n: { $sum: 1 } } },
  ]);
  const countMap = new Map<string, number>(
    counts.map((c) => [(c._id as Types.ObjectId).toString(), c.n as number])
  );

  // Reactions (likes / dislikes / viewer's own choice) — one aggregation for the batch.
  const PostReaction = (await import("@/models/PostReaction")).default;
  const objectIds = ids.map((id) => new Types.ObjectId(id));
  const reactionCounts = await PostReaction.aggregate([
    { $match: { post: { $in: objectIds } } },
    { $group: { _id: { post: "$post", type: "$type" }, n: { $sum: 1 } } },
  ]);
  const likeMap = new Map<string, number>();
  const dislikeMap = new Map<string, number>();
  for (const row of reactionCounts) {
    const pid = (row._id.post as Types.ObjectId).toString();
    if (row._id.type === "like") likeMap.set(pid, row.n);
    else if (row._id.type === "dislike") dislikeMap.set(pid, row.n);
  }

  // Viewer's own reactions in a single query.
  const myReactionMap = new Map<string, "like" | "dislike">();
  if (opts.viewerId && Types.ObjectId.isValid(opts.viewerId)) {
    const mine = await PostReaction.find({
      user: new Types.ObjectId(opts.viewerId),
      post: { $in: objectIds },
    })
      .select("post type")
      .lean();
    for (const r of mine as Array<{ post: Types.ObjectId; type: "like" | "dislike" }>) {
      myReactionMap.set(r.post.toString(), r.type);
    }
  }

  const order = new Map(ids.map((id, i) => [id, i]));
  posts.sort(
    (a, b) =>
      (order.get((a._id as Types.ObjectId).toString()) ?? 0) -
      (order.get((b._id as Types.ObjectId).toString()) ?? 0)
  );

  return posts.map((p) => {
    const pid = (p._id as Types.ObjectId).toString();
    const author = p.author as unknown as {
      _id: Types.ObjectId;
      username: string;
      name: string;
      image?: string;
    };
    const book = p.book as unknown as {
      _id: Types.ObjectId;
      title: string;
      authors: string;
      thumbnail?: string;
      slug?: string;
    };
    const bookId = book._id.toString();
    return {
      id: pid,
      content: p.content,
      createdAt: (p as { createdAt?: Date }).createdAt?.toISOString() ?? "",
      author: {
        id: author._id.toString(),
        username: author.username,
        name: author.name,
        image: author.image,
      },
      book: {
        id: bookId,
        slug: book.slug ?? bookId,
        title: book.title,
        authors: book.authors,
        thumbnail: book.thumbnail,
      },
      commentCount: countMap.get(pid) ?? 0,
      likes: likeMap.get(pid) ?? 0,
      dislikes: dislikeMap.get(pid) ?? 0,
      myReaction: myReactionMap.get(pid) ?? null,
    };
  });
}
