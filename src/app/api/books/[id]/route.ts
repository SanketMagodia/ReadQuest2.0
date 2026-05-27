import { NextResponse } from "next/server";
import { Types } from "mongoose";
import connectDB from "@/lib/db";
import Book from "@/models/Book";
import Post from "@/models/Post";
import { looksLikeObjectId } from "@/lib/slug";

/**
 * Accepts either a Mongo ObjectId or a URL slug as the `id` segment, so old
 * /book/<objectid> links keep working while new traffic uses slugs.
 */
export async function GET(
  _: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    await connectDB();

    const book = await (looksLikeObjectId(id)
      ? Book.findById(id).lean()
      : Book.findOne({ slug: id }).lean());

    if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const _id = (book._id as Types.ObjectId).toString();
    const postCount = await Post.countDocuments({ book: _id });

    return NextResponse.json({
      book: {
        id: _id,
        slug: (book as { slug?: string }).slug ?? "",
        title: book.title,
        subtitle: book.subtitle,
        authors: book.authors,
        categories: book.categories,
        thumbnail: book.thumbnail,
        description: book.description,
        publishedYear: book.publishedYear,
        averageRating: book.averageRating,
        numPages: book.numPages,
        ratingsCount: book.ratingsCount,
        source: book.source,
      },
      postCount,
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
