import { Types } from "mongoose";
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { getAppSession } from "@/lib/session";
import User from "@/models/User";
import ReadList from "@/models/ReadList";
import UserRecommendation from "@/models/UserRecommendation";

const MAX_RECOMMENDATIONS = 10;

type PopulatedBook = {
  _id: Types.ObjectId;
  slug?: string;
  title: string;
  authors?: string;
  thumbnail?: string;
};

function serializeRows(
  rows: { rank: number; book: PopulatedBook | null }[]
): Array<{
  id: string;
  slug: string;
  title: string;
  authors: string;
  thumbnail?: string;
  rank: number;
}> {
  return rows
    .map((r) => ({
      rank: r.rank,
      book: r.book,
    }))
    .filter((r): r is { rank: number; book: PopulatedBook } => Boolean(r.book?._id))
    .map((r) => ({
      id: r.book._id.toString(),
      slug: r.book.slug ?? "",
      title: r.book.title,
      authors: r.book.authors ?? "",
      thumbnail: r.book.thumbnail,
      rank: r.rank,
    }))
    .sort((a, b) => a.rank - b.rank);
}

async function resolveTargetUserId(username?: string) {
  if (!username) return null;
  const user = await User.findOne({ username: username.toLowerCase() })
    .select("_id")
    .lean();
  return (user?._id as Types.ObjectId | undefined) ?? null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const username = url.searchParams.get("username")?.trim().toLowerCase();

  await connectDB();
  let userId: Types.ObjectId | null = null;

  if (username) {
    userId = await resolveTargetUserId(username);
    if (!userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  } else {
    const session = await getAppSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = new Types.ObjectId(session.user.id);
  }

  const rows = await UserRecommendation.find({ user: userId })
    .sort({ rank: 1 })
    .populate("book", "title authors thumbnail slug")
    .lean();

  return NextResponse.json({
    max: MAX_RECOMMENDATIONS,
    recommendations: serializeRows(
      rows as unknown as { rank: number; book: PopulatedBook | null }[]
    ),
  });
}

export async function POST(req: Request) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { bookId?: string } | null;
  const bookId = body?.bookId;
  if (!bookId || !Types.ObjectId.isValid(bookId)) {
    return NextResponse.json({ error: "Invalid bookId" }, { status: 400 });
  }

  await connectDB();
  const userId = new Types.ObjectId(session.user.id);
  const bookObj = new Types.ObjectId(bookId);

  const already = await UserRecommendation.exists({ user: userId, book: bookObj });
  if (already) return NextResponse.json({ ok: true, already: true });

  const recCount = await UserRecommendation.countDocuments({ user: userId });
  if (recCount >= MAX_RECOMMENDATIONS) {
    return NextResponse.json(
      { error: `You can showcase up to ${MAX_RECOMMENDATIONS} books.` },
      { status: 400 }
    );
  }

  const onRead = await ReadList.exists({
    user: userId,
    book: bookObj,
    status: "read",
  });
  if (!onRead) {
    return NextResponse.json(
      { error: "Only books marked as read can be recommended." },
      { status: 400 }
    );
  }

  await UserRecommendation.create({
    user: userId,
    book: bookObj,
    rank: recCount + 1,
  });

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { bookIds?: string[] } | null;
  const ids = body?.bookIds;
  if (!Array.isArray(ids)) {
    return NextResponse.json({ error: "bookIds array is required" }, { status: 400 });
  }
  if (ids.length > MAX_RECOMMENDATIONS) {
    return NextResponse.json(
      { error: `Max ${MAX_RECOMMENDATIONS} recommendations allowed.` },
      { status: 400 }
    );
  }
  if (new Set(ids).size !== ids.length) {
    return NextResponse.json({ error: "bookIds must be unique" }, { status: 400 });
  }
  if (ids.some((id) => !Types.ObjectId.isValid(id))) {
    return NextResponse.json({ error: "Invalid bookIds" }, { status: 400 });
  }

  await connectDB();
  const userId = new Types.ObjectId(session.user.id);
  const allowed = await UserRecommendation.find({
    user: userId,
    book: { $in: ids.map((id) => new Types.ObjectId(id)) },
  })
    .select("book")
    .lean();
  if (allowed.length !== ids.length) {
    return NextResponse.json({ error: "Unknown recommendation book id." }, { status: 400 });
  }

  await Promise.all(
    ids.map((bookId, idx) =>
      UserRecommendation.updateOne(
        { user: userId, book: new Types.ObjectId(bookId) },
        { $set: { rank: idx + 1 } }
      )
    )
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const bookId = url.searchParams.get("bookId");
  if (!bookId || !Types.ObjectId.isValid(bookId)) {
    return NextResponse.json({ error: "Invalid bookId" }, { status: 400 });
  }

  await connectDB();
  const userId = new Types.ObjectId(session.user.id);
  await UserRecommendation.deleteOne({
    user: userId,
    book: new Types.ObjectId(bookId),
  });

  // Re-pack ranks after deletion.
  const rows = await UserRecommendation.find({ user: userId })
    .sort({ rank: 1, createdAt: 1 })
    .select("_id")
    .lean();
  await Promise.all(
    rows.map((r, idx) =>
      UserRecommendation.updateOne({ _id: r._id }, { $set: { rank: idx + 1 } })
    )
  );

  return NextResponse.json({ ok: true });
}
