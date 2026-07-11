/* One-time backfill: ensure every accepted friendship has mutual follow edges.
 *
 * Run with:  npm run backfill-friend-follows
 *
 * Friends now auto-follow each other, but friendships formed before the follow
 * feature shipped have no follow rows. Safe to re-run — uses idempotent upserts,
 * so only missing edges are created.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { Types } from "mongoose";
import connectDB from "../src/lib/db";
import Friendship from "../src/models/Friendship";
import { ensureMutualFollow } from "../src/lib/follows";

const BATCH_SIZE = 200;

async function main() {
  await connectDB();
  const total = await Friendship.countDocuments({ status: "accepted" });
  console.log(`Accepted friendships to check: ${total}`);
  if (!total) {
    console.log("No accepted friendships. Done.");
    process.exit(0);
  }

  let processed = 0;
  const cursor = Friendship.find({ status: "accepted" })
    .select("requester recipient")
    .lean<{ requester: Types.ObjectId; recipient: Types.ObjectId }[]>()
    .cursor({ batchSize: BATCH_SIZE });

  for await (const f of cursor) {
    processed += 1;
    try {
      await ensureMutualFollow(f.requester, f.recipient);
    } catch (e) {
      console.warn(`! could not link follows for friendship:`, e);
    }
    if (processed % 200 === 0) {
      console.log(`  progress: ${processed}/${total}`);
    }
  }

  console.log(`Done. processed=${processed}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
