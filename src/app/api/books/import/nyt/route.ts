import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import connectDB from "@/lib/db";
import Book from "@/models/Book";
import { getAppSession } from "@/lib/session";
import { makeBookSlug, withUniqueSuffix } from "@/lib/slug";

const importSchema = z.object({
  title: z.string().trim().min(1).max(400),
  author: z.string().trim().max(400).optional().default(""),
  description: z.string().trim().max(4000).optional().default(""),
  isbn13: z.string().trim().max(20).optional().default(""),
  isbn10: z.string().trim().max(20).optional().default(""),
  thumbnail: z.string().trim().max(800).optional().default(""),
  publisher: z.string().trim().max(400).optional().default(""),
  category: z.string().trim().max(200).optional().default(""),
});

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Adopt a New York Times bestseller into our library, then navigate to it.
 * Dedupes by ISBN-13, then ISBN-10, then (title, primary author) so we never
 * create a second copy of a book Readquest already knows about — including
 * ones adopted earlier from Open Library.
 */
export async function POST(req: Request) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = importSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(parsed.error.flatten().fieldErrors, {
      status: 400,
    });
  }
  const p = parsed.data;
  const isbn13 = p.isbn13.length === 13 ? p.isbn13 : "";
  const isbn10 = p.isbn10.length === 10 ? p.isbn10 : "";

  await connectDB();

  // ── Deduplication passes ──────────────────────────────────────────────────
  let existing = null;
  if (isbn13) existing = await Book.findOne({ isbn13 }).lean();
  if (!existing && isbn10) existing = await Book.findOne({ isbn10 }).lean();
  if (!existing) {
    const titleRx = new RegExp(`^${escapeRegex(p.title)}$`, "i");
    const primaryAuthor = (p.author || "").split(/[,;]/)[0].trim();
    existing = primaryAuthor
      ? await Book.findOne({
          title: titleRx,
          authors: new RegExp(escapeRegex(primaryAuthor), "i"),
        }).lean()
      : await Book.findOne({ title: titleRx }).lean();
  }

  if (existing) {
    const b = existing as { _id: Types.ObjectId; slug?: string; title: string };
    return NextResponse.json({
      book: { id: b._id.toString(), slug: b.slug ?? "", title: b.title },
      created: false,
      reused: true,
    });
  }

  // ── Slug + create ─────────────────────────────────────────────────────────
  const baseSlug = makeBookSlug(p.title, p.author);
  const slug = await withUniqueSuffix(baseSlug, async (candidate) => {
    const exists = await Book.exists({ slug: candidate });
    return !!exists;
  });

  try {
    const b = await Book.create({
      isbn13: isbn13 || undefined,
      isbn10: isbn10 || undefined,
      title: p.title,
      authors: p.author,
      categories: p.category,
      thumbnail: p.thumbnail,
      description: p.description,
      source: "nyt",
      addedBy: new Types.ObjectId(session.user.id),
      slug,
    });

    return NextResponse.json(
      {
        book: { id: b._id.toString(), slug, title: b.title },
        created: true,
        reused: false,
      },
      { status: 201 }
    );
  } catch (err) {
    // Race: a sibling inserted the same ISBN between our check and write.
    if ((err as { code?: number }).code === 11000 && isbn13) {
      const winner = await Book.findOne({ isbn13 }).lean();
      if (winner) {
        const w = winner as {
          _id: Types.ObjectId;
          slug?: string;
          title: string;
        };
        return NextResponse.json({
          book: { id: w._id.toString(), slug: w.slug ?? "", title: w.title },
          created: false,
          reused: true,
        });
      }
    }
    throw err;
  }
}
