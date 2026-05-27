import { notFound, redirect } from "next/navigation";
import { Types } from "mongoose";
import type { Metadata } from "next";
import { Source_Serif_4 } from "next/font/google";
import connectDB from "@/lib/db";
import Book from "@/models/Book";
import { looksLikeObjectId } from "@/lib/slug";
import { SummaryReader } from "./SummaryReader";

// Medium-style reading serif. Scoped to this route so we don't pay the cost
// on pages that don't need it.
const readingSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-reading-serif",
  display: "swap",
});

type BookLean = {
  _id: Types.ObjectId;
  slug?: string;
  title: string;
  authors?: string;
  thumbnail?: string;
};

async function resolveBook(input: string): Promise<BookLean | null> {
  await connectDB();
  if (looksLikeObjectId(input)) {
    return (await Book.findById(input).lean()) as BookLean | null;
  }
  return (await Book.findOne({ slug: input }).lean()) as BookLean | null;
}

function siteUrl(): string {
  return process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const book = await resolveBook(slug);
  if (!book) return { title: "Summary not found", robots: { index: false } };

  const canonicalSlug = book.slug ?? slug;
  const url = `${siteUrl()}/book/${canonicalSlug}/summary`;
  const authors = book.authors || "Unknown author";
  const title = `Summary · ${book.title}`;
  const description = `A long-form, reader-friendly summary of ${book.title} by ${authors} — plot, themes, characters, and your own personalizable version.`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Readquest",
      type: "article",
    },
    twitter: { card: "summary", title, description },
  };
}

export default async function BookSummaryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const book = await resolveBook(slug);
  if (!book) notFound();

  const canonical = book.slug ?? slug;
  if (slug !== canonical) {
    redirect(`/book/${canonical}/summary`);
  }

  return (
    <div className={readingSerif.variable}>
      <SummaryReader
        bookId={book._id.toString()}
        slug={canonical}
        title={book.title}
        authors={book.authors ?? ""}
        thumbnail={book.thumbnail ?? ""}
      />
    </div>
  );
}

// Reading view depends on per-user state, so don't statically cache.
export const revalidate = 0;
