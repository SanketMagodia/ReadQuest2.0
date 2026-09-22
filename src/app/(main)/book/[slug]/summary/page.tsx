import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Types } from "mongoose";
import type { Metadata } from "next";
import { Source_Serif_4 } from "next/font/google";
import { ArrowLeft, Clock } from "lucide-react";
import connectDB from "@/lib/db";
import Book from "@/models/Book";
import { looksLikeObjectId } from "@/lib/slug";
import { BRAND_NAME } from "@/lib/brand";
import { buildBookCard } from "@/lib/reel";
import { BookReel } from "@/components/reel/BookReel";

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
  const description = `A long-form, reader-friendly summary of ${book.title} by ${authors} — read it a page at a time, then keep scrolling into the books next to it.`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: BRAND_NAME,
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

  const bookId = book._id.toString();
  const seed = await buildBookCard(bookId);

  // No summary means nothing to read. The book page hides the entry point for
  // these, so this only shows for a link that was already out in the wild.
  if (!seed) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-3 py-16 text-center">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full bg-pill text-muted"
          aria-hidden
        >
          <Clock size={20} />
        </span>
        <h1 className="text-xl font-bold">Summary coming soon</h1>
        <p className="text-sm text-muted">
          {book.title} doesn&apos;t have a gist written yet. It&apos;ll show up
          here once it does.
        </p>
        <Link
          href={`/book/${canonical}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-hover"
        >
          <ArrowLeft size={14} aria-hidden /> Back to {book.title.slice(0, 32)}
        </Link>
      </div>
    );
  }

  return (
    <div className={readingSerif.variable}>
      <BookReel
        seed={seed}
        relatedTo={bookId}
        backHref={`/book/${canonical}`}
      />
    </div>
  );
}

// The reel underneath is per-reader, so don't statically cache the shell.
export const revalidate = 0;
