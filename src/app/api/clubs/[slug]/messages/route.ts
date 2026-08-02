import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getAppSession } from "@/lib/session";
import connectDB from "@/lib/db";
import Club from "@/models/Club";
import ClubMembership from "@/models/ClubMembership";
import ClubMessage from "@/models/ClubMessage";
import { clubMessageSchema } from "@/lib/validators";
import { trimPreview } from "@/lib/dm";

const PAGE = 40;

type LeanClubRef = { _id: Types.ObjectId };

type MessageRow = {
  _id: Types.ObjectId;
  content: string;
  createdAt: Date;
  kind?: "text" | "progress";
  progress?: number | null;
  sender: {
    _id: Types.ObjectId;
    username?: string;
    name?: string;
    image?: string;
  } | null;
};

async function loadClub(slug: string) {
  await connectDB();
  return Club.findOne({ slug: slug.toLowerCase() })
    .select("_id")
    .lean<LeanClubRef | null>();
}

/**
 * GET — the room's messages, oldest last, cursor-paginated on `_id`.
 *
 * Readable by anyone signed in, member or not: the spec is that visitors can
 * read the conversation and decide whether they like it enough to join.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { slug } = await params;
  const club = await loadClub(slug);
  if (!club) {
    return NextResponse.json({ error: "Club not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");
  const filter: Record<string, unknown> = { club: club._id };
  if (cursor && Types.ObjectId.isValid(cursor)) {
    filter._id = { $lt: new Types.ObjectId(cursor) };
  }

  const rows = await ClubMessage.find(filter)
    .sort({ _id: -1 })
    .limit(PAGE + 1)
    .populate("sender", "username name image")
    .lean<MessageRow[]>();

  const hasMore = rows.length > PAGE;
  const slice = hasMore ? rows.slice(0, PAGE) : rows;
  const nextCursor = hasMore ? slice[slice.length - 1]._id.toString() : null;
  const me = session.user.id;

  const messages = slice.reverse().map((m) => ({
    id: m._id.toString(),
    content: m.content,
    createdAt: new Date(m.createdAt).toISOString(),
    kind: m.kind === "progress" ? ("progress" as const) : ("text" as const),
    progress: typeof m.progress === "number" ? m.progress : null,
    fromMe: m.sender?._id.toString() === me,
    author: m.sender
      ? {
          username: m.sender.username ?? "",
          name: m.sender.name || m.sender.username || "",
          image: m.sender.image ?? "",
        }
      : null,
  }));

  // Reading the room clears the member's unread marker.
  await ClubMembership.updateOne(
    { club: club._id, user: new Types.ObjectId(me) },
    { $set: { lastReadAt: new Date() } }
  ).catch(() => {});

  return NextResponse.json({ messages, nextCursor });
}

/** POST — say something. Members only. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { slug } = await params;
  const club = await loadClub(slug);
  if (!club) {
    return NextResponse.json({ error: "Club not found" }, { status: 404 });
  }

  const me = new Types.ObjectId(session.user.id);
  const membership = await ClubMembership.findOne({ club: club._id, user: me })
    .select("_id")
    .lean();
  if (!membership) {
    return NextResponse.json(
      { error: "Join the club to join the conversation." },
      { status: 403 }
    );
  }

  const parsed = clubMessageSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid message" },
      { status: 400 }
    );
  }

  const doc = await ClubMessage.create({
    club: club._id,
    sender: me,
    content: parsed.data.content,
  });

  await Club.updateOne(
    { _id: club._id },
    {
      $set: {
        lastMessageAt: new Date(),
        lastPreview: trimPreview(parsed.data.content),
      },
    }
  ).catch(() => {});

  return NextResponse.json({
    message: {
      id: doc._id.toString(),
      content: doc.content,
      createdAt: doc.createdAt.toISOString(),
      kind: "text" as const,
      progress: null,
      fromMe: true,
      author: {
        username: session.user.username ?? "",
        name: session.user.name ?? session.user.username ?? "",
        image: session.user.image ?? "",
      },
    },
  });
}
