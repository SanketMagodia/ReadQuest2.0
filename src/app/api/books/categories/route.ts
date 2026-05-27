import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Book from "@/models/Book";

const STOP_WORDS = new Set(["", "general", "n/a", "none"]);

const FALLBACK_CATEGORIES = [
  "Fiction",
  "Mystery",
  "Romance",
  "Science Fiction",
  "Fantasy",
  "History",
  "Biography",
  "Nonfiction",
  "Philosophy",
  "Poetry",
];

export async function GET() {
  await connectDB();

  const rows = (await Book.aggregate([
    { $match: { categories: { $type: "string", $ne: "" } } },
    {
      $project: {
        cats: {
          $map: {
            input: { $split: ["$categories", ","] },
            as: "c",
            in: { $trim: { input: "$$c" } },
          },
        },
      },
    },
    { $unwind: "$cats" },
    { $match: { cats: { $ne: "" } } },
    { $group: { _id: { $toLower: "$cats" }, count: { $sum: 1 }, sample: { $first: "$cats" } } },
    { $sort: { count: -1 } },
    { $limit: 40 },
  ])) as { _id: string; count: number; sample: string }[];

  const cleaned = rows
    .filter((r) => !STOP_WORDS.has(r._id) && r.sample && r.sample.length <= 40)
    .map((r) => ({ label: r.sample, count: r.count }));

  const merged =
    cleaned.length > 0
      ? cleaned
      : FALLBACK_CATEGORIES.map((c) => ({ label: c, count: 0 }));

  return NextResponse.json({ categories: merged.slice(0, 24) });
}
