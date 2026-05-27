import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import connectDB from "@/lib/db";
import Book from "@/models/Book";
import { getAppSession } from "@/lib/session";
import { fetchOpenLibraryWork } from "@/lib/openlibrary";
import { translateToEnglish, translateTermsToEnglish } from "@/lib/translate";
import { makeBookSlug, withUniqueSuffix } from "@/lib/slug";

const importSchema = z.object({
  olKey: z
    .string()
    .trim()
    .regex(
      /^\/?works\/OL[A-Z0-9]+W?$/,
      "Expected an Open Library work key like /works/OL45804W"
    ),
  title: z.string().trim().min(1).max(400),
  authors: z.string().trim().max(400).optional().default(""),
  thumbnail: z.string().trim().max(800).optional().default(""),
  categories: z.string().trim().max(800).optional().default(""),
  publishedYear: z.number().int().optional(),
  isbn: z.string().trim().max(30).optional(),
  numPages: z.number().int().positive().optional(),
  averageRating: z.number().min(0).max(5).optional(),
  ratingsCount: z.number().int().min(0).optional(),
});

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Adopt an Open Library result into our database. Idempotent — if a book
 * with the same olKey, ISBN-13, or (title, primary author) already exists,
 * we return that one instead of creating a duplicate.
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
  const olKey = p.olKey.startsWith("/") ? p.olKey : `/${p.olKey}`;

  await connectDB();

  // ── Deduplication passes ──────────────────────────────────────────────────
  let existing = await Book.findOne({ olKey }).lean();
  if (!existing && p.isbn && p.isbn.length === 13) {
    existing = await Book.findOne({ isbn13: p.isbn }).lean();
  }
  if (!existing) {
    const titleRx = new RegExp(`^${escapeRegex(p.title)}$`, "i");
    const primaryAuthor = (p.authors || "").split(/[,;]/)[0].trim();
    if (primaryAuthor) {
      const authorRx = new RegExp(escapeRegex(primaryAuthor), "i");
      existing = await Book.findOne({
        title: titleRx,
        authors: authorRx,
      }).lean();
    } else {
      existing = await Book.findOne({ title: titleRx }).lean();
    }
  }

  if (existing) {
    const b = existing as { _id: Types.ObjectId; slug?: string; title: string };
    // Backfill the olKey if the existing record predates this association.
    if (!("olKey" in (existing as object))) {
      await Book.updateOne({ _id: b._id }, { $set: { olKey } }).catch(() => {});
    }
    return NextResponse.json({
      book: { id: b._id.toString(), slug: b.slug ?? "", title: b.title },
      created: false,
      reused: true,
    });
  }

  // ── Enrich with description + subjects from the work endpoint ────────────
  const { description: rawDescription, categories: workCategories } =
    await fetchOpenLibraryWork(olKey);

  /**
   * Open Library hosts entries in many languages. Translate the long-form
   * description and any non-English subject labels to English before saving
   * so search, summaries, and feed signals all stay coherent. Both helpers
   * fall back to the original text on any failure.
   */
  const mergedRawCategories = [
    ...new Set(
      [
        ...p.categories
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean),
        ...workCategories
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean),
      ].slice(0, 8)
    ),
  ].join(", ");

  const [description, mergedCategories] = await Promise.all([
    translateToEnglish(rawDescription),
    translateTermsToEnglish(mergedRawCategories),
  ]);

  // ── Slug + create ─────────────────────────────────────────────────────────
  const baseSlug = makeBookSlug(p.title, p.authors);
  const slug = await withUniqueSuffix(baseSlug, async (candidate) => {
    const exists = await Book.exists({ slug: candidate });
    return !!exists;
  });

  try {
    const b = await Book.create({
      olKey,
      isbn13: p.isbn && p.isbn.length === 13 ? p.isbn : undefined,
      isbn10: p.isbn && p.isbn.length === 10 ? p.isbn : undefined,
      title: p.title,
      authors: p.authors,
      categories: mergedCategories,
      thumbnail: p.thumbnail,
      description,
      publishedYear: p.publishedYear,
      numPages: p.numPages,
      averageRating: p.averageRating,
      ratingsCount: p.ratingsCount,
      source: "openlibrary",
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
    // Race: another request inserted the same olKey/isbn between our check
    // and write. Re-fetch and return the winner.
    if ((err as { code?: number }).code === 11000) {
      const winner = await Book.findOne({
        $or: [
          { olKey },
          ...(p.isbn && p.isbn.length === 13 ? [{ isbn13: p.isbn }] : []),
        ],
      }).lean();
      if (winner) {
        const w = winner as { _id: Types.ObjectId; slug?: string; title: string };
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
