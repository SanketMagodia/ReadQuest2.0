import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import connectDB from "@/lib/db";
import ReadList from "@/models/ReadList";

export async function GET(req: Request) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const peek = url.searchParams.get("bookId");
  await connectDB();
  const Book = (await import("@/models/Book")).default;

  if (peek && Types.ObjectId.isValid(peek)) {
    const yes = await ReadList.exists({
      user: session.user.id,
      book: peek,
    });
    return NextResponse.json({ onList: Boolean(yes) });
  }

  const rows = await ReadList.find({ user: session.user.id })
    .sort({ createdAt: -1 })
    .populate("book")
    .limit(200)
    .lean();

  const books = rows
    .map((r) => r.book as unknown as { _id: Types.ObjectId; title: string; authors: string; thumbnail?: string } | null)
    .filter(Boolean)
    .map((b) => ({
      id: b!._id.toString(),
      title: b!.title,
      authors: b!.authors,
      thumbnail: b!.thumbnail,
    }));

  return NextResponse.json({ books });
}

export async function POST(req: Request) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { bookId } = (await req.json()) as { bookId?: string };
  if (!bookId || !Types.ObjectId.isValid(bookId)) {
    return NextResponse.json({ error: "Invalid bookId" }, { status: 400 });
  }
  await connectDB();
  try {
    await ReadList.create({
      user: new Types.ObjectId(session.user.id),
      book: new Types.ObjectId(bookId),
    });
  } catch {
    return NextResponse.json({ ok: true, already: true });
  }
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
  await ReadList.deleteOne({
    user: session.user.id,
    book: bookId,
  });
  return NextResponse.json({ ok: true });
}
