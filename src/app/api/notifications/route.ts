import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import connectDB from "@/lib/db";
import Notification from "@/models/Notification";

type ActorLite = {
  _id: Types.ObjectId;
  username: string;
  name?: string;
  image?: string;
};

type Row = {
  _id: Types.ObjectId;
  type: string;
  message: string;
  preview: string;
  link: string;
  read: boolean;
  createdAt: Date;
  actor?: ActorLite | null;
};

/** List the viewer's most recent notifications + unread count. */
export async function GET(req: Request) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || 30), 100);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const onlyUnread = url.searchParams.get("unread") === "1";

  await connectDB();

  const filter: Record<string, unknown> = {
    recipient: new Types.ObjectId(session.user.id),
  };
  if (cursor && Types.ObjectId.isValid(cursor)) {
    filter._id = { $lt: new Types.ObjectId(cursor) };
  }
  if (onlyUnread) filter.read = false;

  const [rows, unread] = await Promise.all([
    Notification.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate("actor", "username name image")
      .lean<Row[]>(),
    Notification.countDocuments({
      recipient: new Types.ObjectId(session.user.id),
      read: false,
    }),
  ]);

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore
    ? slice[slice.length - 1]._id.toString()
    : null;

  const items = slice.map((r) => ({
    id: r._id.toString(),
    type: r.type,
    message: r.message,
    preview: r.preview || "",
    link: r.link,
    read: r.read,
    createdAt: r.createdAt.toISOString(),
    actor: r.actor
      ? {
          id: r.actor._id.toString(),
          username: r.actor.username,
          name: r.actor.name ?? r.actor.username,
          image: r.actor.image ?? null,
        }
      : null,
  }));

  return NextResponse.json({ items, nextCursor, unread });
}
