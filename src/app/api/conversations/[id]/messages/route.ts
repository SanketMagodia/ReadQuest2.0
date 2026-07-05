import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import connectDB from "@/lib/db";
import User from "@/models/User";
import Message from "@/models/Message";
import {
  clearUnread,
  loadConversationForViewer,
  otherParticipantId,
  serializeUserLite,
  trimPreview,
  bumpUnread,
} from "@/lib/dm";
import { dmMessageSchema } from "@/lib/validators";
import { notifyDirectMessage } from "@/lib/notifications";

const PAGE = 40;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const conv = await loadConversationForViewer(id, session.user.id);
  if (!conv) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await connectDB();
  const me = new Types.ObjectId(session.user.id);
  const otherId = otherParticipantId(conv, me);
  const other = await User.findById(otherId)
    .select("username name image bio")
    .lean<{
      _id: Types.ObjectId;
      username: string;
      name?: string;
      image?: string;
      bio?: string;
    } | null>();

  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");

  const filter: Record<string, unknown> = { conversation: conv._id };
  if (cursor && Types.ObjectId.isValid(cursor)) {
    filter._id = { $lt: new Types.ObjectId(cursor) };
  }

  const rows = await Message.find(filter)
    .sort({ _id: -1 })
    .limit(PAGE + 1)
    .lean<
      {
        _id: Types.ObjectId;
        sender: Types.ObjectId;
        content: string;
        createdAt: Date;
      }[]
    >();

  const hasMore = rows.length > PAGE;
  const slice = hasMore ? rows.slice(0, PAGE) : rows;
  const nextCursor = hasMore ? slice[slice.length - 1]._id.toString() : null;

  const messages = slice
    .reverse()
    .map((m) => ({
      id: m._id.toString(),
      content: m.content,
      createdAt: m.createdAt.toISOString(),
      fromMe: m.sender.equals(me),
      sender: m.sender.equals(me)
        ? null
        : other
          ? serializeUserLite(other)
          : null,
    }));

  return NextResponse.json({
    conversationId: conv._id.toString(),
    otherUser: other ? serializeUserLite(other) : null,
    messages,
    nextCursor,
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const conv = await loadConversationForViewer(id, session.user.id);
  if (!conv) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = dmMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid message" },
      { status: 400 }
    );
  }

  await connectDB();
  const me = new Types.ObjectId(session.user.id);
  const otherId = otherParticipantId(conv, me);

  const msg = await Message.create({
    conversation: conv._id,
    sender: me,
    content: parsed.data.content,
  });

  const preview = trimPreview(parsed.data.content);
  await bumpUnread(conv._id, otherId, preview, me);

  const actorName = session.user.name || session.user.username || "Someone";
  void notifyDirectMessage({
    recipientId: otherId,
    actorId: me,
    actorName,
    actorUsername: session.user.username,
    conversationId: conv._id,
    preview,
  });

  return NextResponse.json({
    message: {
      id: msg._id.toString(),
      content: msg.content,
      createdAt: msg.createdAt.toISOString(),
      fromMe: true,
      sender: null,
    },
  });
}
