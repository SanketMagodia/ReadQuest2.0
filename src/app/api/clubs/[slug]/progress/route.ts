import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getAppSession } from "@/lib/session";
import connectDB from "@/lib/db";
import Club from "@/models/Club";
import ClubMessage from "@/models/ClubMessage";
import "@/models/Book";
import { clubProgressSchema } from "@/lib/validators";
import { getClubMembers, setProgress } from "@/lib/clubs";

type ClubRef = {
  _id: Types.ObjectId;
  currentBook?:
    | Types.ObjectId
    | { _id: Types.ObjectId; title?: string }
    | null;
};

function bookTitleOf(book: ClubRef["currentBook"]): string {
  if (!book || book instanceof Types.ObjectId) return "";
  return typeof book.title === "string" ? book.title.trim() : "";
}

function bookIdOf(book: ClubRef["currentBook"]): Types.ObjectId | null {
  if (!book) return null;
  if (book instanceof Types.ObjectId) return book;
  return book._id ?? null;
}

/** Build the chat line, naming the book when we know it. */
function progressLine(progress: number, bookTitle: string): string {
  const book = bookTitle ? ` “${bookTitle}”` : "";
  if (progress === 100) return `finished${book || " the book"}`;
  if (progress === 0) {
    return bookTitle
      ? `reset their progress on “${bookTitle}”`
      : "reset their progress";
  }
  return bookTitle
    ? `is ${progress}% through “${bookTitle}”`
    : `is ${progress}% through`;
}

/**
 * POST — move your marker on the club's current book.
 *
 * A matching "progress" line is written into the room only when the value
 * actually changes, so re-tapping the same step doesn't spam the chat.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { slug } = await params;

  const parsed = clubProgressSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Pick 0, 25, 50, 75 or 100." }, { status: 400 });
  }

  await connectDB();
  const club = await Club.findOne({ slug: slug.toLowerCase() })
    .select("_id currentBook")
    .populate("currentBook", "title")
    .lean<ClubRef | null>();
  if (!club) {
    return NextResponse.json({ error: "Club not found" }, { status: 404 });
  }

  const bookId = bookIdOf(club.currentBook);
  const bookTitle = bookTitleOf(club.currentBook);

  const saved = await setProgress(
    club._id,
    session.user.id,
    parsed.data.progress,
    bookId
  );
  if (saved === null) {
    return NextResponse.json(
      { error: "Join the club to track your progress here." },
      { status: 403 }
    );
  }

  // Members first — if populate fails we must not leave a chat event without
  // a successful response to the client (that was the "message but no UI" bug).
  const members = await getClubMembers(club._id);

  const changed = saved.progress !== saved.previous;
  if (changed) {
    await ClubMessage.create({
      club: club._id,
      sender: new Types.ObjectId(session.user.id),
      kind: "progress",
      progress: saved.progress,
      content: progressLine(saved.progress, bookTitle),
    }).catch(() => {});

    await Club.updateOne(
      { _id: club._id },
      { $set: { lastMessageAt: new Date() } }
    ).catch(() => {});
  }

  return NextResponse.json({
    progress: saved.progress,
    previous: saved.previous,
    changed,
    members,
  });
}
