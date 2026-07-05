import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Announcement from "@/models/Announcement";

/** Broadcasts are day-notes: they disappear for readers 24h after publish. */
const BROADCAST_TTL_MS = 24 * 60 * 60 * 1000;

/** Active admin broadcasts for the right rail (wide) or feed (compact). */
export async function GET() {
  await connectDB();
  const now = new Date();
  const rows = await Announcement.find({
    active: true,
    // Hard 24h cap (also covers legacy rows created without expiresAt)…
    createdAt: { $gt: new Date(now.getTime() - BROADCAST_TTL_MS) },
    // …while still honoring an explicit earlier expiry when one is set.
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: now } },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean<
      {
        _id: import("mongoose").Types.ObjectId;
        title: string;
        body: string;
        link?: string;
        linkLabel?: string;
        createdAt: Date;
      }[]
    >();

  return NextResponse.json({
    items: rows.map((r) => ({
      id: r._id.toString(),
      title: r.title,
      body: r.body,
      link: r.link ?? "",
      linkLabel: r.linkLabel ?? "",
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
