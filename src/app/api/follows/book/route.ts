import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import connectDB from "@/lib/db";
import BookFollow from "@/models/BookFollow";

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
    await BookFollow.create({
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
  await BookFollow.deleteOne({
    user: session.user.id,
    book: bookId,
  });
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ bookIds: [] });
  }
  const url = new URL(req.url);
  const peek = url.searchParams.get("bookId");
  await connectDB();
  if (peek && Types.ObjectId.isValid(peek)) {
    const yes = await BookFollow.exists({
      user: session.user.id,
      book: peek,
    });
    return NextResponse.json({ following: Boolean(yes) });
  }
  const rows = await BookFollow.find({ user: session.user.id }).select("book").lean();
  return NextResponse.json({
    bookIds: rows.map((r) => (r.book as Types.ObjectId).toString()),
  });
}
