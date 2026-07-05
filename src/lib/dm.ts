import { Types } from "mongoose";
import connectDB from "@/lib/db";
import User from "@/models/User";
import Conversation from "@/models/Conversation";
import { getRelationship, pairKey, type RelationshipStatus } from "@/lib/friends";
import {
  ADMIN_DISPLAY_NAME,
  getAdminUsername,
  isAdminUsername,
} from "@/lib/admin";

type ID = string | Types.ObjectId;

function toId(v: ID): Types.ObjectId {
  return v instanceof Types.ObjectId ? v : new Types.ObjectId(v);
}

/** Sorted participant pair — same order `pairKey` expects. */
export function sortedParticipants(a: ID, b: ID): [Types.ObjectId, Types.ObjectId] {
  const x = toId(a);
  const y = toId(b);
  return x.toString() < y.toString() ? [x, y] : [y, x];
}

export function trimPreview(text: string, max = 180): string {
  const s = text.replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

export async function requireFriendship(
  viewerId: ID,
  otherId: ID
): Promise<RelationshipStatus> {
  if (await canMessage(viewerId, otherId)) {
    const status = await getRelationship(viewerId, otherId);
    return status === "friends" ? status : "none";
  }
  const status = await getRelationship(viewerId, otherId);
  if (status !== "friends") {
    throw new Error("NOT_FRIENDS");
  }
  return status;
}

/** Friends, or the site admin account — always messageable when signed in. */
export async function canMessage(viewerId: ID, otherId: ID): Promise<boolean> {
  if (toId(viewerId).equals(toId(otherId))) return false;
  await connectDB();
  const other = await User.findById(otherId).select("username role").lean<{
    username: string;
    role?: string;
  } | null>();
  if (!other) return false;
  if (other.role === "admin" || isAdminUsername(other.username)) return true;
  return (await getRelationship(viewerId, otherId)) === "friends";
}

export async function resolveUserByUsername(username: string) {
  await connectDB();
  const u = await User.findOne({ username: username.toLowerCase() })
    .select("username name image bio")
    .lean<{
      _id: Types.ObjectId;
      username: string;
      name?: string;
      image?: string;
      bio?: string;
    } | null>();
  return u;
}

export async function getOrCreateConversation(viewerId: ID, otherId: ID) {
  await connectDB();
  const allowed = await canMessage(viewerId, otherId);
  if (!allowed) throw new Error("NOT_FRIENDS");

  const key = pairKey(viewerId, otherId);
  let conv = await Conversation.findOne({ pairKey: key });
  if (!conv) {
    const participants = sortedParticipants(viewerId, otherId);
    conv = await Conversation.create({
      pairKey: key,
      participants,
      unread: new Map(),
    });
  }
  return conv;
}

export async function loadConversationForViewer(
  conversationId: ID,
  viewerId: ID
) {
  await connectDB();
  const conv = await Conversation.findById(conversationId);
  if (!conv) return null;
  const me = toId(viewerId);
  const isParticipant = conv.participants.some((p: Types.ObjectId) =>
    toId(p).equals(me)
  );
  if (!isParticipant) return null;
  return conv;
}

export function otherParticipantId(
  conv: { participants: Types.ObjectId[] },
  viewerId: ID
): Types.ObjectId {
  const me = toId(viewerId);
  const other = conv.participants.find((p) => !toId(p).equals(me));
  if (!other) throw new Error("INVALID_CONVERSATION");
  return toId(other);
}

type UnreadField = Map<string, number> | Record<string, number> | undefined;

function asUnreadMap(unread: UnreadField): Map<string, number> {
  if (!unread) return new Map();
  if (unread instanceof Map) return unread;
  return new Map(Object.entries(unread));
}

export function unreadForUser(
  conv: { unread?: UnreadField },
  userId: ID
): number {
  const key = toId(userId).toString();
  const unread = conv.unread;
  if (!unread) return 0;
  if (unread instanceof Map) return unread.get(key) ?? 0;
  return unread[key] ?? 0;
}

export async function bumpUnread(
  convId: ID,
  recipientId: ID,
  preview: string,
  senderId: ID
) {
  await connectDB();
  const key = toId(recipientId).toString();
  const conv = await Conversation.findById(convId);
  if (!conv) return;
  if (!(conv.unread instanceof Map)) {
    conv.unread = asUnreadMap(conv.unread as UnreadField);
  }
  const current = conv.unread.get(key) ?? 0;
  conv.unread.set(key, current + 1);
  conv.lastMessageAt = new Date();
  conv.lastPreview = preview;
  conv.lastSender = toId(senderId);
  conv.markModified("unread");
  await conv.save();
}

export async function clearUnread(convId: ID, viewerId: ID) {
  await connectDB();
  const conv = await Conversation.findById(convId);
  if (!conv) return;
  if (!(conv.unread instanceof Map)) {
    conv.unread = asUnreadMap(conv.unread as UnreadField);
  }
  conv.unread.set(toId(viewerId).toString(), 0);
  conv.markModified("unread");
  await conv.save();
}

export function serializeUserLite(u: {
  _id: Types.ObjectId;
  username: string;
  name?: string;
  image?: string;
  bio?: string;
  role?: string;
}) {
  return {
    id: u._id.toString(),
    username: u.username,
    name: u.name || u.username,
    image: u.image ?? null,
    bio: u.bio ?? "",
    isAdmin: u.role === "admin" || isAdminUsername(u.username),
  };
}

/** Public admin contact card for chat UI. */
export async function getAdminContact() {
  await connectDB();
  const u = await User.findOne({ username: getAdminUsername() })
    .select("username name image bio role")
    .lean<{
      _id: Types.ObjectId;
      username: string;
      name?: string;
      image?: string;
      bio?: string;
      role?: string;
    } | null>();
  if (!u) return null;
  return {
    ...serializeUserLite(u),
    displayName: ADMIN_DISPLAY_NAME,
  };
}
