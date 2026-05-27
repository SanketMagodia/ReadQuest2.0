import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppSession } from "@/lib/session";
import connectDB from "@/lib/db";
import Notification from "@/models/Notification";

const bodySchema = z.union([
  z.object({ ids: z.array(z.string()).min(1).max(200) }),
  z.object({ all: z.literal(true) }),
]);

/** Mark some — or all — of the viewer's notifications as read. */
export async function POST(req: Request) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  await connectDB();

  const recipient = new Types.ObjectId(session.user.id);

  if ("all" in parsed.data) {
    await Notification.updateMany(
      { recipient, read: false },
      { $set: { read: true } }
    );
  } else {
    const ids = parsed.data.ids
      .filter((s) => Types.ObjectId.isValid(s))
      .map((s) => new Types.ObjectId(s));
    if (!ids.length) {
      return NextResponse.json({ ok: true, updated: 0 });
    }
    await Notification.updateMany(
      { _id: { $in: ids }, recipient, read: false },
      { $set: { read: true } }
    );
  }

  const unread = await Notification.countDocuments({
    recipient,
    read: false,
  });

  return NextResponse.json({ ok: true, unread });
}
