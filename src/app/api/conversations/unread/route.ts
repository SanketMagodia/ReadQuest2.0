import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import connectDB from "@/lib/db";
import Conversation from "@/models/Conversation";
import { unreadForUser } from "@/lib/dm";

/** Total unread DM count — polled by the chat bubble badge. */
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
    .select("unread")
    .lean<{ unread?: Record<string, number> }[]>();

  const unread = rows.reduce(
    (sum, r) => sum + unreadForUser(r, me),
    0
  );

  return NextResponse.json({ unread });
}
