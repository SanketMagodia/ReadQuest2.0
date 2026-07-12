import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import connectDB from "@/lib/db";
import Post from "@/models/Post";
import Book from "@/models/Book";
import BookFollow from "@/models/BookFollow";
import ReadList from "@/models/ReadList";
import { serializePosts } from "@/lib/serialize";
import { spreadByAuthor } from "@/lib/feed-rank";
import "@/models/User";

/**
 * Ranked home feed.
 * - mode=for-you (default when logged in): personalized ranking
 * - mode=latest: pure recency
 * Cursor is based on candidate set's oldest _id; ranking is applied within
 * each cursor window so newly loaded items still get sorted.
 */
export async function GET(req: Request) {
  const session = await getAppSession();
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 10), 1), 30);
  const mode = url.searchParams.get("mode") === "latest" ? "latest" : "for-you";

  await connectDB();

  const baseFilter: Record<string, unknown> = {};
  if (cursor && Types.ObjectId.isValid(cursor)) {
    baseFilter._id = { $lt: new Types.ObjectId(cursor) };
  }

  if (mode === "latest" || !session?.user?.id) {
    const candidateLimit = limit * 6;
    const rows = await Post.find(baseFilter)
      .sort({ _id: -1 })
      .limit(candidateLimit + 1)
      .lean();
    const hasMore = rows.length > candidateLimit;
    const candidateSlice = hasMore ? rows.slice(0, candidateLimit) : rows;

    const ranked = candidateSlice.map((p, i) => ({
      id: (p._id as Types.ObjectId).toString(),
      authorId: (p.author as Types.ObjectId).toString(),
      score: candidateSlice.length - i,
    }));
    const spread = spreadByAuthor(ranked, limit);
    const ids = spread.map((s) => s.id);
    const posts = await serializePosts(ids, { viewerId: session?.user?.id });
    const oldest = candidateSlice[candidateSlice.length - 1];
    const nextCursor =
      hasMore && oldest
        ? (oldest._id as Types.ObjectId).toString()
        : null;
    return NextResponse.json({ posts, nextCursor, mode: "latest" });
  }

  const userId = session.user.id;

  const [follows, readlist] = await Promise.all([
    BookFollow.find({ user: userId }).select("book").lean(),
    ReadList.find({ user: userId }).select("book").lean(),
  ]);

  const followSet = new Set(
    follows.map((f) => (f.book as Types.ObjectId).toString())
  );
  const readSet = new Set(
    readlist.map((r) => (r.book as Types.ObjectId).toString())
  );

  const signalBookIds = [
    ...new Set([...Array.from(followSet), ...Array.from(readSet)]),
  ];

  const userCats = new Set<string>();
  if (signalBookIds.length) {
    const signalBooks = await Book.find({
      _id: { $in: signalBookIds.map((id) => new Types.ObjectId(id)) },
    })
      .select("categories")
      .lean();
    for (const b of signalBooks) {
      const raw = (b as { categories?: string }).categories ?? "";
      raw
        .split(",")
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean)
        .forEach((c) => userCats.add(c));
    }
  }

  const candidateLimit = limit * 6;
  const candidates = await Post.find(baseFilter)
    .sort({ _id: -1 })
    .limit(candidateLimit + 1)
    .lean();

  if (!candidates.length) {
    return NextResponse.json({ posts: [], nextCursor: null, mode: "for-you" });
  }

  const hasMore = candidates.length > candidateLimit;
  const candidateSlice = hasMore ? candidates.slice(0, candidateLimit) : candidates;

  const candidateBookIds = Array.from(
    new Set(candidateSlice.map((p) => (p.book as Types.ObjectId).toString()))
  );
  const candidateBooks = await Book.find({
    _id: { $in: candidateBookIds.map((id) => new Types.ObjectId(id)) },
  })
    .select("categories")
    .lean();
  const bookCats = new Map<string, string[]>();
  for (const b of candidateBooks) {
    const cats = ((b as { categories?: string }).categories ?? "")
      .split(",")
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean);
    bookCats.set((b._id as Types.ObjectId).toString(), cats);
  }

  const now = Date.now();
  const scored = candidateSlice.map((p) => {
    const bookId = (p.book as Types.ObjectId).toString();
    let score = 0;
    if (followSet.has(bookId)) score += 5;
    if (readSet.has(bookId)) score += 3;
    const cats = bookCats.get(bookId) ?? [];
    let overlap = 0;
    for (const c of cats) if (userCats.has(c)) overlap += 1;
    score += Math.min(overlap, 3);

    const created = (p as { createdAt?: Date }).createdAt;
    const ageH = created
      ? (now - new Date(created).getTime()) / 3_600_000
      : 9999;
    score += 2 * Math.exp(-ageH / 24);

    return {
      id: (p._id as Types.ObjectId).toString(),
      authorId: (p.author as Types.ObjectId).toString(),
      score,
      ageH,
    };
  });

  const spread = spreadByAuthor(
    scored.map(({ id, authorId, score }) => ({ id, authorId, score })),
    limit
  );
  const topIds = spread.map((s) => s.id);
  const posts = await serializePosts(topIds, { viewerId: userId });

  const oldest = candidateSlice[candidateSlice.length - 1];
  const nextCursor = hasMore
    ? (oldest._id as Types.ObjectId).toString()
    : null;

  return NextResponse.json({
    posts,
    nextCursor,
    mode: "for-you",
    signals: {
      following: followSet.size,
      readlist: readSet.size,
      categories: userCats.size,
    },
  });
}
