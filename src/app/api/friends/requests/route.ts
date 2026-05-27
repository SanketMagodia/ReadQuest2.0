import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppSession } from "@/lib/session";
import connectDB from "@/lib/db";
import User from "@/models/User";
import Friendship from "@/models/Friendship";
import { notifyFriendRequest } from "@/lib/notifications";

type ActorLite = {
  _id: Types.ObjectId;
  username: string;
  name?: string;
  image?: string;
};

type Row = {
  _id: Types.ObjectId;
  requester: ActorLite;
  recipient: ActorLite;
  status: string;
  createdAt: Date;
};

/** List pending friend requests for the signed-in user, in both directions. */
export async function GET(req: Request) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const me = new Types.ObjectId(session.user.id);

  const url = new URL(req.url);
  const direction = url.searchParams.get("direction"); // "incoming" | "outgoing" | null=both

  const filter: Record<string, unknown> = { status: "pending" };
  if (direction === "incoming") filter.recipient = me;
  else if (direction === "outgoing") filter.requester = me;
  else filter.$or = [{ requester: me }, { recipient: me }];

  const rows = await Friendship.find(filter)
    .sort({ createdAt: -1 })
    .populate("requester", "username name image")
    .populate("recipient", "username name image")
    .lean<Row[]>();

  const incoming = rows
    .filter((r) => r.recipient._id.equals(me))
    .map((r) => ({
      id: r._id.toString(),
      createdAt: r.createdAt.toISOString(),
      user: {
        id: r.requester._id.toString(),
        username: r.requester.username,
        name: r.requester.name || r.requester.username,
        image: r.requester.image ?? null,
      },
    }));

  const outgoing = rows
    .filter((r) => r.requester._id.equals(me))
    .map((r) => ({
      id: r._id.toString(),
      createdAt: r.createdAt.toISOString(),
      user: {
        id: r.recipient._id.toString(),
        username: r.recipient.username,
        name: r.recipient.name || r.recipient.username,
        image: r.recipient.image ?? null,
      },
    }));

  return NextResponse.json({ incoming, outgoing });
}

const sendSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1)
    .max(48)
    .transform((s) => s.toLowerCase().replace(/^@/, "")),
});

/**
 * Send a friend request to the user identified by `username`. Idempotent: if
 * a row already exists in either direction we degrade gracefully — an
 * existing outgoing request is reused, an existing incoming request gets
 * auto-accepted (mutual click = instant friendship).
 */
export async function POST(req: Request) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await req.json().catch(() => ({}));
  const parsed = sendSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }

  await connectDB();
  const me = new Types.ObjectId(session.user.id);

  const target = await User.findOne({
    username: parsed.data.username,
  })
    .select("_id username name image isBot")
    .lean<
      {
        _id: Types.ObjectId;
        username: string;
        name?: string;
        image?: string;
        isBot?: boolean;
      } | null
    >();

  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (target.isBot) {
    return NextResponse.json(
      { error: "You can't friend a bot account" },
      { status: 400 }
    );
  }
  if (target._id.equals(me)) {
    return NextResponse.json(
      { error: "You can't friend yourself" },
      { status: 400 }
    );
  }

  const other = target._id;

  const existing = await Friendship.findOne({
    $or: [
      { requester: me, recipient: other },
      { requester: other, recipient: me },
    ],
  });

  if (existing) {
    if (existing.status === "accepted") {
      return NextResponse.json({ ok: true, status: "friends", already: true });
    }
    if (existing.requester.equals(other)) {
      // They sent us one earlier; clicking back accepts it.
      existing.status = "accepted";
      existing.acceptedAt = new Date();
      await existing.save();
      return NextResponse.json({ ok: true, status: "friends", auto: true });
    }
    return NextResponse.json({
      ok: true,
      status: "outgoing_request",
      already: true,
    });
  }

  await Friendship.create({
    requester: me,
    recipient: other,
    status: "pending",
  });

  // Best-effort notification — never let it block the request.
  void (async () => {
    const actor = await User.findById(me)
      .select("username name")
      .lean<{ username: string; name?: string } | null>();
    const actorName = actor?.name || actor?.username || "Someone";
    const actorUsername = actor?.username || "someone";
    await notifyFriendRequest({
      recipientId: other,
      actorId: me,
      actorName,
      actorUsername,
    });
  })();

  return NextResponse.json({
    ok: true,
    status: "outgoing_request",
    user: {
      id: target._id.toString(),
      username: target.username,
      name: target.name || target.username,
      image: target.image ?? null,
    },
  });
}
