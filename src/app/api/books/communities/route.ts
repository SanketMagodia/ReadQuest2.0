import { Types } from "mongoose";
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Post from "@/models/Post";
import Comment from "@/models/Comment";
import Book from "@/models/Book";

/**
 * Returns the most active book "communities": books with the most threads
 * and engaged people (posters + commenters). Activity is sorted by recency-
 * weighted score so a book that just woke up still surfaces.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 6), 1), 24);

  await connectDB();

  // 1) Roll up posts by book — postCount, distinct authors, last post.
  //    We pull a wider candidate set than `limit` so we can still rank well
  //    after combining post + comment signals below.
  const candidatePoolSize = Math.max(limit * 4, 16);
  const rollup = (await Post.aggregate([
    {
      $group: {
        _id: "$book",
        postCount: { $sum: 1 },
        postAuthors: { $addToSet: "$author" },
        postIds: { $push: "$_id" },
        lastPostAt: { $max: "$createdAt" },
      },
    },
    { $sort: { postCount: -1, lastPostAt: -1 } },
    { $limit: candidatePoolSize },
  ])) as Array<{
    _id: Types.ObjectId;
    postCount: number;
    postAuthors: Types.ObjectId[];
    postIds: Types.ObjectId[];
    lastPostAt: Date;
  }>;

  if (!rollup.length) {
    return NextResponse.json({ communities: [] });
  }

  // 2) Pull every comment in the candidate post universe, group by book.
  const postToBook = new Map<string, string>();
  const allPostIds: Types.ObjectId[] = [];
  for (const row of rollup) {
    const bookId = row._id.toString();
    for (const pid of row.postIds) {
      postToBook.set(pid.toString(), bookId);
      allPostIds.push(pid);
    }
  }

  type CommentLean = { post: Types.ObjectId; author: Types.ObjectId; createdAt: Date };
  const commentRows = (await Comment.find({ post: { $in: allPostIds } })
    .select("post author createdAt")
    .lean()) as CommentLean[];

  type CommentAgg = {
    commentCount: number;
    authors: Set<string>;
    lastCommentAt: Date | null;
  };
  const commentByBook = new Map<string, CommentAgg>();
  for (const c of commentRows) {
    const bookId = postToBook.get(c.post.toString());
    if (!bookId) continue;
    let entry = commentByBook.get(bookId);
    if (!entry) {
      entry = { commentCount: 0, authors: new Set(), lastCommentAt: null };
      commentByBook.set(bookId, entry);
    }
    entry.commentCount += 1;
    entry.authors.add(c.author.toString());
    if (!entry.lastCommentAt || c.createdAt > entry.lastCommentAt) {
      entry.lastCommentAt = c.createdAt;
    }
  }

  // 3) Resolve book metadata in one query.
  const books = (await Book.find({ _id: { $in: rollup.map((r) => r._id) } })
    .select("_id slug title authors categories thumbnail")
    .lean()) as Array<{
    _id: Types.ObjectId;
    slug?: string;
    title: string;
    authors?: string;
    categories?: string;
    thumbnail?: string;
  }>;
  const bookMap = new Map(books.map((b) => [b._id.toString(), b]));

  // 4) Score = post weight + comment weight + distinct people, with mild recency boost.
  const now = Date.now();
  const merged = rollup
    .map((r) => {
      const bookId = r._id.toString();
      const book = bookMap.get(bookId);
      if (!book) return null;

      const commentAgg = commentByBook.get(bookId);
      const commentCount = commentAgg?.commentCount ?? 0;
      const allAuthors = new Set<string>(
        r.postAuthors.map((a) => a.toString())
      );
      if (commentAgg) {
        for (const a of commentAgg.authors) allAuthors.add(a);
      }
      const engagedUsers = allAuthors.size;

      const lastActivityAtDate =
        commentAgg?.lastCommentAt && commentAgg.lastCommentAt > r.lastPostAt
          ? commentAgg.lastCommentAt
          : r.lastPostAt;
      const ageH = (now - new Date(lastActivityAtDate).getTime()) / 3_600_000;
      const recency = 6 * Math.exp(-ageH / 168); // half-life ~ 1 week

      const score =
        r.postCount * 2 + commentCount * 1.2 + engagedUsers * 1.5 + recency;

      const categories = (book.categories || "")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

      return {
        id: bookId,
        slug: book.slug ?? bookId,
        title: book.title,
        authors: book.authors ?? "",
        thumbnail: book.thumbnail ?? "",
        category: categories[0] ?? "",
        postCount: r.postCount,
        commentCount,
        engagedUsers,
        lastActivityAt: new Date(lastActivityAtDate).toISOString(),
        score,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  merged.sort((a, b) => b.score - a.score);
  const top = merged.slice(0, limit).map(({ score: _score, ...rest }) => {
    void _score;
    return rest;
  });

  return NextResponse.json({ communities: top });
}
