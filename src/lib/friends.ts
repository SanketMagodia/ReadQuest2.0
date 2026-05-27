import { Types } from "mongoose";
import connectDB from "@/lib/db";
import Friendship from "@/models/Friendship";

type ID = string | Types.ObjectId;

function toId(v: ID): Types.ObjectId {
  return v instanceof Types.ObjectId ? v : new Types.ObjectId(v);
}

/** Sort the two ObjectIds so we can build a deterministic pair key. */
export function pairKey(a: ID, b: ID): string {
  const x = toId(a).toString();
  const y = toId(b).toString();
  return x < y ? `${x}:${y}` : `${y}:${x}`;
}

export type RelationshipStatus =
  | "self"
  | "none"
  | "incoming_request"
  | "outgoing_request"
  | "friends";

/**
 * Returns the relationship between two users from `viewer`'s perspective.
 * Cheap — single Friendship lookup that touches the unique index in either
 * direction.
 */
export async function getRelationship(
  viewerId: ID,
  otherId: ID
): Promise<RelationshipStatus> {
  const v = toId(viewerId);
  const o = toId(otherId);
  if (v.equals(o)) return "self";

  await connectDB();

  const row = await Friendship.findOne({
    $or: [
      { requester: v, recipient: o },
      { requester: o, recipient: v },
    ],
  })
    .select("requester status")
    .lean<{ requester: Types.ObjectId; status: string } | null>();

  if (!row) return "none";
  if (row.status === "accepted") return "friends";
  return row.requester.equals(v) ? "outgoing_request" : "incoming_request";
}

/** Returns the ObjectIds of every accepted friend for `userId`. */
export async function getFriendIds(userId: ID): Promise<Types.ObjectId[]> {
  await connectDB();
  const me = toId(userId);
  const rows = await Friendship.find({
    status: "accepted",
    $or: [{ requester: me }, { recipient: me }],
  })
    .select("requester recipient")
    .lean<{ requester: Types.ObjectId; recipient: Types.ObjectId }[]>();
  return rows.map((r) => (r.requester.equals(me) ? r.recipient : r.requester));
}
