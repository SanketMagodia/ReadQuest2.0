import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import connectDB from "@/lib/db";
import Post from "@/models/Post";
import Book from "@/models/Book";
import BookFollow from "@/models/BookFollow";
import User from "@/models/User";
import { postCreateSchema } from "@/lib/validators";
import { serializePosts } from "@/lib/serialize";
import { notifyFollowedBookPost } from "@/lib/notifications";

export async function GET(req: Request) {
  const session = await getAppSession();
  const url = new URL(req.url);
  const username = url.searchParams.get("username")?.toLowerCase();
  const bookId = url.searchParams.get("bookId") ?? undefined;
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limit = Math.min(Number(url.searchParams.get("limit") || 20), 50);

  await connectDB();

  const filter: Record<string, unknown> = {};
  if (bookId && Types.ObjectId.isValid(bookId)) {
    filter.book = bookId;
  }

  let query = Post.find(filter).sort({ _id: -1 });

  if (username) {
    const User = (await import("@/models/User")).default;
    const u = await User.findOne({ username }).select("_id").lean();
    if (!u) {
      return NextResponse.json({ posts: [], nextCursor: null });
    }
    query = query.where({ author: u._id });
  }

  if (cursor && Types.ObjectId.isValid(cursor)) {
    query = query.where({ _id: { $lt: new Types.ObjectId(cursor) } });
  }

  const rows = await query.limit(limit + 1).lean();
  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;

  const nextCursor =
    hasMore && slice.length ? (slice[slice.length - 1]._id as Types.ObjectId).toString() : null;

  const posts = await serializePosts(
    slice.map((r) => (r._id as Types.ObjectId).toString()),
    { viewerId: session?.user?.id }
  );

  return NextResponse.json({ posts, nextCursor });
}

export async function POST(req: Request) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await req.json();
  const parsed = postCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(parsed.error.flatten().fieldErrors, { status: 400 });
  }

  await connectDB();

  const p = await Post.create({
    author: new Types.ObjectId(session.user.id),
    book: new Types.ObjectId(parsed.data.bookId),
    content: parsed.data.content,
  });

  // Fan out to followers of this book. Best-effort — never block the
  // POST response on it. The notifier caps work at a reasonable list size.
  void (async () => {
    try {
      const [book, follows, actor] = await Promise.all([
        Book.findById(parsed.data.bookId).select("title").lean(),
        BookFollow.find({ book: new Types.ObjectId(parsed.data.bookId) })
          .select("user")
          .lean(),
        User.findById(session.user!.id).select("name username").lean(),
      ]);
      const followerIds = (follows as { user: Types.ObjectId }[]).map(
        (f) => f.user
      );
      if (!followerIds.length) return;
      const actorName =
        (actor as { name?: string; username?: string } | null)?.name ||
        (actor as { username?: string } | null)?.username ||
        "Someone";
      await notifyFollowedBookPost({
        postId: p._id as Types.ObjectId,
        bookId: new Types.ObjectId(parsed.data.bookId),
        bookTitle:
          (book as { title?: string } | null)?.title || "a book you follow",
        actorId: session.user!.id,
        actorName,
        followerIds,
        postPreview: parsed.data.content,
      });
    } catch (err) {
      console.warn("[notifications] new-post fan-out failed", err);
    }
  })();

  const [full] = await serializePosts([p._id.toString()], {
    viewerId: session.user.id,
  });
  return NextResponse.json({ post: full }, { status: 201 });
}
