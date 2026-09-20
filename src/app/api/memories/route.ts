import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import connectDB from "@/lib/db";
import Memory from "@/models/Memory";
import Book from "@/models/Book";
import { memoryCreateSchema } from "@/lib/validators";
import { serializeMemory } from "@/lib/memories";

const PAGE_SIZE = 20;

/**
 * Memories are private. There is deliberately no `?username=` parameter here —
 * the only readable set is the caller's own, so a profile visitor can never
 * pull someone else's saved lines.
 */
export async function GET(req: Request) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");
  const bookId = url.searchParams.get("bookId");

  await connectDB();

  const filter: Record<string, unknown> = {
    user: new Types.ObjectId(session.user.id),
  };
  if (bookId && Types.ObjectId.isValid(bookId)) {
    filter.book = new Types.ObjectId(bookId);
  }
  if (cursor && Types.ObjectId.isValid(cursor)) {
    filter._id = { $lt: new Types.ObjectId(cursor) };
  }

  const rows = await Memory.find(filter)
    .sort({ _id: -1 })
    .limit(PAGE_SIZE + 1)
    .populate("book", "title authors thumbnail slug")
    .lean();

  const page = rows.slice(0, PAGE_SIZE);
  const nextCursor =
    rows.length > PAGE_SIZE ? page[page.length - 1]?._id.toString() : null;

  return NextResponse.json({
    memories: page.map((r) => serializeMemory(r)),
    nextCursor,
  });
}

export async function POST(req: Request) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = memoryCreateSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid memory" },
      { status: 400 }
    );
  }

  await connectDB();

  const { bookId, quote, note, page } = parsed.data;
  if (bookId && !(await Book.exists({ _id: bookId }))) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  const created = await Memory.create({
    user: new Types.ObjectId(session.user.id),
    book: bookId ? new Types.ObjectId(bookId) : null,
    kind: quote ? "quote" : "note",
    quote,
    note,
    page: page ?? null,
  });

  const row = await Memory.findById(created._id)
    .populate("book", "title authors thumbnail slug")
    .lean();

  return NextResponse.json(
    { memory: row ? serializeMemory(row) : null },
    { status: 201 }
  );
}
