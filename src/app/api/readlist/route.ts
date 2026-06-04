import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import connectDB from "@/lib/db";
import ReadList from "@/models/ReadList";

type ReadStatus = "want" | "read";

function normalizeStatus(raw?: string | null): ReadStatus | null {
  if (raw === "want" || raw === "read") return raw;
  return null;
}

export async function GET(req: Request) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const peek = url.searchParams.get("bookId");
  await connectDB();

  if (peek && Types.ObjectId.isValid(peek)) {
    const row = await ReadList.findOne({
      user: session.user.id,
      book: peek,
    })
      .select("status")
      .lean();
    const status = normalizeStatus(
      (row as { status?: string | null } | null)?.status ?? null
    );
    return NextResponse.json({ onList: Boolean(row), status: status ?? "want" });
  }

  const rows = await ReadList.find({ user: session.user.id })
    .sort({ createdAt: -1 })
    .populate("book")
    .limit(200)
    .lean();

  const books = rows
    .map((r) => ({
      status: normalizeStatus((r as { status?: string }).status) ?? "want",
      book: r.book as unknown as {
        _id: Types.ObjectId;
        title: string;
        authors: string;
        thumbnail?: string;
      } | null,
    }))
    .filter((r) => Boolean(r.book))
    .map((r) => ({
      id: r.book!._id.toString(),
      title: r.book!.title,
      authors: r.book!.authors,
      thumbnail: r.book!.thumbnail,
      status: r.status,
    }));

  return NextResponse.json({ books });
}

export async function POST(req: Request) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as
    | { bookId?: string; status?: ReadStatus }
    | null;
  const bookId = body?.bookId;
  if (!bookId || !Types.ObjectId.isValid(bookId)) {
    return NextResponse.json({ error: "Invalid bookId" }, { status: 400 });
  }
  const status = normalizeStatus(body?.status ?? "want");
  if (!status) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  await connectDB();
  await ReadList.updateOne(
    {
      user: new Types.ObjectId(session.user.id),
      book: new Types.ObjectId(bookId),
    },
    {
      $set: {
        status,
        completedAt: status === "read" ? new Date() : null,
      },
      $setOnInsert: {
        user: new Types.ObjectId(session.user.id),
        book: new Types.ObjectId(bookId),
      },
    },
    { upsert: true }
  );
  return NextResponse.json({ ok: true, status });
}

export async function PATCH(req: Request) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as
    | { bookId?: string; status?: ReadStatus }
    | null;
  const bookId = body?.bookId;
  if (!bookId || !Types.ObjectId.isValid(bookId)) {
    return NextResponse.json({ error: "Invalid bookId" }, { status: 400 });
  }
  const status = normalizeStatus(body?.status);
  if (!status) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  await connectDB();
  await ReadList.updateOne(
    { user: session.user.id, book: bookId },
    {
      $set: {
        status,
        completedAt: status === "read" ? new Date() : null,
      },
      $setOnInsert: {
        user: new Types.ObjectId(session.user.id),
        book: new Types.ObjectId(bookId),
      },
    },
    { upsert: true }
  );
  return NextResponse.json({ ok: true, status });
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
