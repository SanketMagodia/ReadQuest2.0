import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-guard";
import connectDB from "@/lib/db";
import Announcement from "@/models/Announcement";

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(600),
  link: z.string().trim().max(500).optional().or(z.literal("")),
  linkLabel: z.string().trim().max(40).optional().or(z.literal("")),
  expiresAt: z.string().datetime().optional().nullable(),
});

export async function GET() {
  const gate = await requireAdmin();
  if (gate.response) return gate.response;

  await connectDB();
  const rows = await Announcement.find()
    .sort({ createdAt: -1 })
    .limit(50)
    .populate("createdBy", "username name")
    .lean<
      {
        _id: Types.ObjectId;
        title: string;
        body: string;
        link?: string;
        linkLabel?: string;
        active: boolean;
        expiresAt?: Date;
        createdAt: Date;
        createdBy?: { username: string; name?: string };
      }[]
    >();

  return NextResponse.json({
    items: rows.map((r) => ({
      id: r._id.toString(),
      title: r.title,
      body: r.body,
      link: r.link ?? "",
      linkLabel: r.linkLabel ?? "",
      active: r.active,
      expiresAt: r.expiresAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      author: r.createdBy
        ? {
            username: r.createdBy.username,
            name: r.createdBy.name || r.createdBy.username,
          }
        : null,
    })),
  });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate.response) return gate.response;

  const raw = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  await connectDB();
  // Broadcasts are day-notes: default to a 24h lifetime, and never allow an
  // explicit expiry to stretch past that.
  const maxExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const requested = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
  const expiresAt = requested && requested < maxExpiry ? requested : maxExpiry;
  const doc = await Announcement.create({
    title: parsed.data.title,
    body: parsed.data.body,
    link: parsed.data.link || "",
    linkLabel: parsed.data.linkLabel || "",
    active: true,
    createdBy: new Types.ObjectId(gate.session!.user!.id),
    expiresAt,
  });

  return NextResponse.json(
    {
      item: {
        id: doc._id.toString(),
        title: doc.title,
        body: doc.body,
        link: doc.link,
        linkLabel: doc.linkLabel,
        active: doc.active,
        createdAt: doc.createdAt.toISOString(),
      },
    },
    { status: 201 }
  );
}
