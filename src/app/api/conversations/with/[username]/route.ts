import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import {
  getOrCreateConversation,
  resolveUserByUsername,
  serializeUserLite,
} from "@/lib/dm";

/** Get-or-create a 1:1 thread with a friend by username. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { username } = await params;
  const other = await resolveUserByUsername(username);
  if (!other) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (other._id.equals(session.user.id)) {
    return NextResponse.json({ error: "Cannot message yourself" }, { status: 400 });
  }

  try {
    const conv = await getOrCreateConversation(session.user.id, other._id);
    return NextResponse.json({
      conversationId: conv._id.toString(),
      otherUser: serializeUserLite(other),
    });
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_FRIENDS") {
      return NextResponse.json(
        { error: "You can only message friends" },
        { status: 403 }
      );
    }
    throw e;
  }
}
