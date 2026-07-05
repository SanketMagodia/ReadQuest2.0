import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import connectDB from "@/lib/db";
import User from "@/models/User";
import Conversation from "@/models/Conversation";
import {
  otherParticipantId,
  serializeUserLite,
  unreadForUser,
} from "@/lib/dm";

/** Inbox — conversations with at least one message, newest first. */
export async function GET() {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const me = new Types.ObjectId(session.user.id);

  const rows = await Conversation.find({
    participants: me,
    lastMessageAt: { $exists: true, $ne: null },
  })
    .sort({ lastMessageAt: -1 })
    .limit(50)
    .lean<
      {
        _id: Types.ObjectId;
        participants: Types.ObjectId[];
        lastMessageAt?: Date;
        lastPreview?: string;
        lastSender?: Types.ObjectId;
        unread?: Record<string, number>;
      }[]
    >();

  if (!rows.length) {
    return NextResponse.json({ conversations: [], unread: 0 });
  }

  const otherIds = rows.map((r) => otherParticipantId(r, me));
  const users = await User.find({ _id: { $in: otherIds } })
    .select("username name image bio")
    .lean<
      {
        _id: Types.ObjectId;
        username: string;
        name?: string;
        image?: string;
        bio?: string;
      }[]
    >();
  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  let totalUnread = 0;
  const conversations = rows.map((r) => {
    const otherId = otherParticipantId(r, me);
    const u = userMap.get(otherId.toString());
    const unread = unreadForUser(r, me);
    totalUnread += unread;
    return {
      id: r._id.toString(),
      otherUser: u
        ? serializeUserLite(u)
        : {
            id: otherId.toString(),
            username: "unknown",
            name: "Unknown",
            image: null,
            bio: "",
          },
      lastPreview: r.lastPreview ?? "",
      lastMessageAt: r.lastMessageAt?.toISOString() ?? null,
      unread,
      fromMe: r.lastSender?.equals(me) ?? false,
    };
  });

  return NextResponse.json({ conversations, unread: totalUnread });
}
