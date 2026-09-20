import { Types, type PipelineStage } from "mongoose";
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Book from "@/models/Book";
import BookFollow from "@/models/BookFollow";
import ReadList from "@/models/ReadList";
import ReelImpression from "@/models/ReelImpression";

type Rollup = {
  _id: Types.ObjectId;
  count: number;
  users: Types.ObjectId[];
  lastAt: Date;
};

/** One `$group` shape reused across the three signal collections. */
function groupByBook(
  match: Record<string, unknown>,
  poolSize: number
): PipelineStage[] {
  return [
    ...(Object.keys(match).length ? [{ $match: match }] : []),
    {
      $group: {
        _id: "$book",
        count: { $sum: 1 },
        users: { $addToSet: "$user" },
        lastAt: { $max: "$updatedAt" },
      },
    },
    { $sort: { count: -1, lastAt: -1 } },
    { $limit: poolSize },
  ];
}

/**
 * The book rooms readers are actually gathering in.
 *
 * With the public timeline gone, "activity" is what people do with a book
 * rather than what they say about it: shelving it, following it, and getting
 * through its gist. Ranking is recency-weighted so a book that just woke up
 * still surfaces above one that was busy last year.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit") || 6), 1),
    24
  );

  await connectDB();

  // A wider candidate set than `limit` so the merged ranking still has room
  // to reorder once all three signals are combined.
  const poolSize = Math.max(limit * 4, 16);

  const [shelves, follows, reads] = (await Promise.all([
    ReadList.aggregate(groupByBook({}, poolSize)),
    BookFollow.aggregate(groupByBook({}, poolSize)),
    ReelImpression.aggregate(
      groupByBook({ action: { $in: ["read", "saved"] } }, poolSize)
    ),
  ])) as [Rollup[], Rollup[], Rollup[]];

  type Merged = {
    shelved: number;
    followers: number;
    readers: number;
    people: Set<string>;
    lastAt: Date;
  };
  const byBook = new Map<string, Merged>();

  const absorb = (rows: Rollup[], key: "shelved" | "followers" | "readers") => {
    for (const row of rows) {
      const id = row._id?.toString();
      if (!id) continue;
      const entry =
        byBook.get(id) ??
        ({
          shelved: 0,
          followers: 0,
          readers: 0,
          people: new Set<string>(),
          lastAt: new Date(0),
        } satisfies Merged);
      entry[key] += row.count;
      for (const u of row.users ?? []) entry.people.add(u.toString());
      const last = row.lastAt ? new Date(row.lastAt) : new Date(0);
      if (last > entry.lastAt) entry.lastAt = last;
      byBook.set(id, entry);
    }
  };

  absorb(shelves, "shelved");
  absorb(follows, "followers");
  absorb(reads, "readers");

  if (!byBook.size) {
    return NextResponse.json({ communities: [] });
  }

  const books = (await Book.find({
    _id: { $in: [...byBook.keys()].map((id) => new Types.ObjectId(id)) },
  })
    .select("_id slug title authors categories thumbnail")
    .lean()) as Array<{
    _id: Types.ObjectId;
    slug?: string;
    title: string;
    authors?: string;
    categories?: string;
    thumbnail?: string;
  }>;

  const now = Date.now();
  const merged = books
    .map((book) => {
      const id = book._id.toString();
      const agg = byBook.get(id);
      if (!agg) return null;

      const ageH = (now - agg.lastAt.getTime()) / 3_600_000;
      const recency = 6 * Math.exp(-ageH / 168); // half-life ≈ 1 week
      const engagedUsers = agg.people.size;

      const categories = (book.categories || "")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

      return {
        id,
        slug: book.slug ?? id,
        title: book.title,
        authors: book.authors ?? "",
        thumbnail: book.thumbnail ?? "",
        category: categories[0] ?? "",
        shelved: agg.shelved,
        followers: agg.followers,
        readers: agg.readers,
        engagedUsers,
        lastActivityAt: agg.lastAt.toISOString(),
        score:
          agg.shelved * 2 +
          agg.followers * 1.5 +
          agg.readers * 1.2 +
          engagedUsers * 1.5 +
          recency,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  merged.sort((a, b) => b.score - a.score);
  const communities = merged.slice(0, limit).map(({ score: _score, ...rest }) => {
    void _score;
    return rest;
  });

  return NextResponse.json({ communities });
}
