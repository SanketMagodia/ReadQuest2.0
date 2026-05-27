import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import connectDB from "@/lib/db";
import User from "@/models/User";
import Friendship from "@/models/Friendship";
import type { RelationshipStatus } from "@/lib/friends";

/**
 * Lightweight typeahead for the friends finder. Accepts `q` as a partial
 * username (case-insensitive prefix-ish match), returns a small page of
 * candidates with each row's relationship to the viewer already baked in so
 * the client can render the right CTA without a follow-up round trip.
 */
export async function GET(req: Request) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const limit = Math.min(Number(url.searchParams.get("limit") || 10), 25);

  if (q.length < 2) {
    return NextResponse.json({ users: [] });
  }

  // Mongo $regex needs escaping so users can search "_" / "." without surprises.
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rx = new RegExp(`^${escaped}`, "i");

  await connectDB();

  const me = new Types.ObjectId(session.user.id);

  const rawCandidates = await User.find({
    _id: { $ne: me },
    isBot: { $ne: true },
    $or: [{ username: rx }, { name: rx }],
  })
    .select("username name image bio")
    .limit(limit)
    .lean<
      {
        _id: Types.ObjectId;
        username: string;
        name?: string;
        image?: string;
        bio?: string;
      }[]
    >();

  if (!rawCandidates.length) {
    return NextResponse.json({ users: [] });
  }

  const ids = rawCandidates.map((u) => u._id);
  const edges = await Friendship.find({
    $or: [
      { requester: me, recipient: { $in: ids } },
      { recipient: me, requester: { $in: ids } },
    ],
  })
    .select("requester recipient status")
    .lean<
      {
        requester: Types.ObjectId;
        recipient: Types.ObjectId;
        status: string;
      }[]
    >();

  const edgeFor = new Map<string, RelationshipStatus>();
  for (const e of edges) {
    const other = e.requester.equals(me) ? e.recipient : e.requester;
    if (e.status === "accepted") {
      edgeFor.set(other.toString(), "friends");
    } else if (e.requester.equals(me)) {
      edgeFor.set(other.toString(), "outgoing_request");
    } else {
      edgeFor.set(other.toString(), "incoming_request");
    }
  }

  const users = rawCandidates.map((u) => ({
    id: u._id.toString(),
    username: u.username,
    name: u.name || u.username,
    image: u.image ?? null,
    bio: u.bio ?? "",
    relationship: edgeFor.get(u._id.toString()) ?? ("none" as RelationshipStatus),
  }));

  return NextResponse.json({ users });
}
