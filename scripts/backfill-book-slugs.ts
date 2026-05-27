/* One-time backfill: assign URL slugs to every Book that doesn't have one.
 *
 * Run with:  npm run backfill-slugs
 *
 * Safe to re-run — only books with a missing/empty `slug` field are touched.
 * Handles collisions by appending `-2`, `-3`, … then falling back to a short
 * random suffix if too many duplicates exist (rare).
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import connectDB from "../src/lib/db";
import Book from "../src/models/Book";
import { makeBookSlug, withUniqueSuffix } from "../src/lib/slug";

const BATCH_SIZE = 200;

async function main() {
  await connectDB();
  const total = await Book.countDocuments({
    $or: [{ slug: { $exists: false } }, { slug: "" }, { slug: null }],
  });
  console.log(`Books needing a slug: ${total}`);
  if (!total) {
    console.log("All books already have slugs. Done.");
    process.exit(0);
  }

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  const cursor = Book.find({
    $or: [{ slug: { $exists: false } }, { slug: "" }, { slug: null }],
  })
    .select("_id title authors slug")
    .lean()
    .cursor({ batchSize: BATCH_SIZE });

  for await (const b of cursor) {
    processed += 1;
    const base = makeBookSlug(b.title ?? "", b.authors ?? "");
    if (!base) {
      skipped += 1;
      continue;
    }

    try {
      const slug = await withUniqueSuffix(base, async (candidate) => {
        const existing = await Book.exists({
          slug: candidate,
          _id: { $ne: b._id },
        });
        return !!existing;
      });
      await Book.updateOne({ _id: b._id }, { $set: { slug } });
      updated += 1;
    } catch (e) {
      console.warn(`! could not slug book ${b._id}:`, e);
      skipped += 1;
    }

    if (processed % 200 === 0) {
      console.log(`  progress: ${processed}/${total} (updated=${updated})`);
    }
  }

  console.log(`Done. processed=${processed} updated=${updated} skipped=${skipped}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
