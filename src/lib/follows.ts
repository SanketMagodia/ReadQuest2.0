import { Types } from "mongoose";
import connectDB from "@/lib/db";
import UserFollow from "@/models/UserFollow";

type ID = string | Types.ObjectId;

function toId(v: ID): Types.ObjectId {
  return v instanceof Types.ObjectId ? v : new Types.ObjectId(v);
}

/** Does `followerId` currently follow `followingId`? */
export async function isFollowing(
  followerId: ID,
  followingId: ID
): Promise<boolean> {
  await connectDB();
  const exists = await UserFollow.exists({
    follower: toId(followerId),
    following: toId(followingId),
  });
  return Boolean(exists);
}

/** Follower + following counts for a single user. */
export async function getFollowCounts(
  userId: ID
): Promise<{ followers: number; following: number }> {
  await connectDB();
  const id = toId(userId);
  const [followers, following] = await Promise.all([
    UserFollow.countDocuments({ following: id }),
    UserFollow.countDocuments({ follower: id }),
  ]);
  return { followers, following };
}

/** Idempotently create a single follow edge (`follower` → `following`). */
export async function ensureFollow(
  followerId: ID,
  followingId: ID
): Promise<void> {
  const follower = toId(followerId);
  const following = toId(followingId);
  if (follower.equals(following)) return;
  await connectDB();
  await UserFollow.updateOne(
    { follower, following },
    { $setOnInsert: { follower, following } },
    { upsert: true }
  );
}

/**
 * Make two users follow each other. Called when a friendship is formed —
 * friends should always appear in each other's following list.
 */
export async function ensureMutualFollow(a: ID, b: ID): Promise<void> {
  await Promise.all([ensureFollow(a, b), ensureFollow(b, a)]);
}

/**
 * Of the given candidate ids, return the subset that `viewerId` follows.
 * Used to badge follow buttons in follower/following lists.
 */
export async function followingSubset(
  viewerId: ID,
  candidateIds: ID[]
): Promise<Set<string>> {
  if (!candidateIds.length) return new Set();
  await connectDB();
  const rows = await UserFollow.find({
    follower: toId(viewerId),
    following: { $in: candidateIds.map(toId) },
  })
    .select("following")
    .lean<{ following: Types.ObjectId }[]>();
  return new Set(rows.map((r) => r.following.toString()));
}
