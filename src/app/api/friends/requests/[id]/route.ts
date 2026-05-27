import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppSession } from "@/lib/session";
import connectDB from "@/lib/db";
import User from "@/models/User";
import Friendship from "@/models/Friendship";
import { notifyFriendAccepted } from "@/lib/notifications";

const actionSchema = z.object({
  action: z.enum(["accept", "decline", "cancel"]),
});

/**
 * Apply an action to a pending friend request:
 *   - accept: only the recipient may do this
 *   - decline: only the recipient may do this (deletes the row)
 *   - cancel: only the requester may do this (deletes the row)
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const raw = await req.json().catch(() => ({}));
  const parsed = actionSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  await connectDB();
  const me = new Types.ObjectId(session.user.id);

  const row = await Friendship.findById(id);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isRequester = row.requester.equals(me);
  const isRecipient = row.recipient.equals(me);
  if (!isRequester && !isRecipient) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const action = parsed.data.action;

  if (action === "accept") {
    if (!isRecipient) {
      return NextResponse.json(
        { error: "Only the recipient can accept" },
        { status: 403 }
      );
    }
    if (row.status === "accepted") {
      return NextResponse.json({ ok: true, status: "friends", already: true });
    }
    row.status = "accepted";
    row.acceptedAt = new Date();
    await row.save();

    void (async () => {
      const actor = await User.findById(me)
        .select("username name")
        .lean<{ username: string; name?: string } | null>();
      await notifyFriendAccepted({
        recipientId: row.requester,
        actorId: me,
        actorName: actor?.name || actor?.username || "Someone",
        actorUsername: actor?.username || "someone",
      });
    })();

    return NextResponse.json({ ok: true, status: "friends" });
  }

  if (action === "decline") {
    if (!isRecipient) {
      return NextResponse.json(
        { error: "Only the recipient can decline" },
        { status: 403 }
      );
    }
    await row.deleteOne();
    return NextResponse.json({ ok: true, status: "none" });
  }

  // cancel
  if (!isRequester) {
    return NextResponse.json(
      { error: "Only the requester can cancel" },
      { status: 403 }
    );
  }
  await row.deleteOne();
  return NextResponse.json({ ok: true, status: "none" });
}
