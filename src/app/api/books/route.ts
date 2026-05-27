import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getAppSession } from "@/lib/session";
import connectDB from "@/lib/db";
import Book from "@/models/Book";
import { bookCreateSchema, bookSearchSchema } from "@/lib/validators";
import { makeBookSlug, withUniqueSuffix } from "@/lib/slug";
import { searchOpenLibrary, type OLBookResult } from "@/lib/openlibrary";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = bookSearchSchema.safeParse({
      q: url.searchParams.get("q") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(parsed.error.flatten().fieldErrors, { status: 400 });
    }

    const { q, category, cursor, limit } = parsed.data;
    await connectDB();

    const filter: Record<string, unknown> = {};
    if (category) {
      filter.categories = { $regex: new RegExp(escapeRegex(category), "i") };
    }
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ title: rx }, { authors: rx }, { categories: rx }];
    }

    let query = Book.find(filter).sort({ _id: -1 });

    if (cursor && Types.ObjectId.isValid(cursor)) {
      query = query.where({ _id: { $lt: new Types.ObjectId(cursor) } });
    }

    const rows = await query.limit(limit + 1).lean();

    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor =
      hasMore && slice.length ? (slice[slice.length - 1]._id as Types.ObjectId).toString() : null;

    const localBooks = slice.map((b) => ({
      source: "local" as const,
      id: (b._id as Types.ObjectId).toString(),
      slug: (b as { slug?: string }).slug ?? "",
      title: b.title,
      subtitle: b.subtitle,
      authors: b.authors,
      categories: b.categories,
      thumbnail: b.thumbnail,
      publishedYear: b.publishedYear,
      averageRating: b.averageRating,
    }));

    /**
     * Open Library fallback — only on the first page of a query (no cursor)
     * and only when local results don't already cover the space. We hide OL
     * candidates that look like books we already have so the UI doesn't
     * duplicate.
     */
    let openLibrary: OLBookResult[] = [];
    if (q && !cursor) {
      const desired = Math.max(0, Math.min(8, limit - localBooks.length + 3));
      if (desired > 0) {
        const olRaw = await searchOpenLibrary(q, 12);
        const localTitleKey = new Set(
          localBooks.map((b) =>
            `${(b.title ?? "").toLowerCase()}|${(b.authors ?? "")
              .split(/[,;]/)[0]
              .trim()
              .toLowerCase()}`
          )
        );
        // Avoid re-suggesting books we've already adopted from OL.
        const adoptedKeys = new Set(
          (
            await Book.find({
              olKey: { $in: olRaw.map((d) => d.olKey) },
            })
              .select("olKey")
              .lean()
          ).map((b) => (b as { olKey?: string }).olKey)
        );
        openLibrary = olRaw
          .filter((d) => !adoptedKeys.has(d.olKey))
          .filter((d) => {
            const k = `${d.title.toLowerCase()}|${
              d.authors.split(/[,;]/)[0].trim().toLowerCase()
            }`;
            return !localTitleKey.has(k);
          })
          .slice(0, desired);
      }
    }

    return NextResponse.json({
      books: localBooks,
      openLibrary,
      nextCursor,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function findDuplicateBook(title: string, authors: string) {
  const titleRx = new RegExp(`^${escapeRegex(title.trim())}$`, "i");
  const authorsRx = new RegExp(`^${escapeRegex(authors.trim())}$`, "i");
  return Book.findOne({ title: titleRx, authors: authorsRx }).select("_id title").lean();
}

export async function POST(req: Request) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await req.json();
  const parsed = bookCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(parsed.error.flatten().fieldErrors, { status: 400 });
  }

  await connectDB();

  const duplicate = await findDuplicateBook(parsed.data.title, parsed.data.authors ?? "");
  if (duplicate) {
    return NextResponse.json(
      {
        error: "A book with this title and author already exists.",
        existingBookId: (duplicate._id as Types.ObjectId).toString(),
      },
      { status: 409 }
    );
  }

  const baseSlug = makeBookSlug(parsed.data.title, parsed.data.authors ?? "");
  const slug = await withUniqueSuffix(baseSlug, async (candidate) => {
    const exists = await Book.exists({ slug: candidate });
    return !!exists;
  });

  const b = await Book.create({
    title: parsed.data.title,
    subtitle: parsed.data.subtitle,
    authors: parsed.data.authors,
    categories: parsed.data.categories,
    description: parsed.data.description ?? "",
    thumbnail: parsed.data.thumbnail || "",
    publishedYear: parsed.data.publishedYear,
    source: "user",
    addedBy: new Types.ObjectId(session.user.id),
    slug,
  });

  return NextResponse.json(
    {
      book: {
        id: b._id.toString(),
        slug,
        title: b.title,
      },
    },
    { status: 201 }
  );
}
