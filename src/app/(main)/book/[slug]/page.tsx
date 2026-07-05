import { notFound, redirect } from "next/navigation";
import { Types } from "mongoose";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import {
  ArrowLeft,
  Calendar,
  BookOpenText,
  Star,
  Sparkles,
  Newspaper,
  ExternalLink,
} from "lucide-react";
import connectDB from "@/lib/db";
import Book from "@/models/Book";
import Post from "@/models/Post";
import BookFollow from "@/models/BookFollow";
import ReadList from "@/models/ReadList";
import "@/models/User";
import { serializePosts } from "@/lib/serialize";
import { looksLikeObjectId, makeBookSlug, withUniqueSuffix } from "@/lib/slug";
import { getAppSession } from "@/lib/session";
import { getNytReviews } from "@/lib/nyt";
import { BRAND_NAME, BRAND_SHORT } from "@/lib/brand";
import { BookActions } from "./BookActions";

type BookLean = {
  _id: Types.ObjectId;
  slug?: string;
  title: string;
  subtitle?: string;
  authors?: string;
  categories?: string;
  thumbnail?: string;
  description?: string;
  publishedYear?: number;
  averageRating?: number;
  numPages?: number;
  isbn13?: string;
  isbn10?: string;
};

async function resolveBookBySlugOrId(input: string): Promise<BookLean | null> {
  await connectDB();
  if (looksLikeObjectId(input)) {
    const byId = (await Book.findById(input).lean()) as BookLean | null;
    return byId;
  }
  return (await Book.findOne({ slug: input }).lean()) as BookLean | null;
}

function siteUrl(): string {
  return process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}

function truncate(s: string, n: number): string {
  const t = (s || "").replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  return t.slice(0, n - 1).trimEnd() + "…";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const book = await resolveBookBySlugOrId(slug);
  if (!book) {
    return {
      title: "Book not found",
      robots: { index: false },
    };
  }

  const canonicalSlug = book.slug ?? slug;
  const authors = book.authors || "Unknown author";
  const title = `${book.title} by ${authors}`;
  const description = book.description
    ? truncate(book.description, 200)
    : `Quotes, threads, and readers' takes on ${book.title} by ${authors} — join the discussion on ${BRAND_NAME} (${BRAND_SHORT}).`;
  const url = `${siteUrl()}/book/${canonicalSlug}`;
  const cover = book.thumbnail
    ? book.thumbnail.replace(/^http:/, "https:")
    : undefined;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "book",
      title,
      description,
      url,
      siteName: BRAND_NAME,
      images: cover ? [{ url: cover, alt: book.title }] : undefined,
    },
    twitter: {
      card: cover ? "summary_large_image" : "summary",
      title,
      description,
      images: cover ? [cover] : undefined,
    },
    keywords: [
      book.title,
      authors,
      ...(book.categories?.split(",").map((c) => c.trim()).filter(Boolean) ?? []),
      "quotes",
      "book discussion",
      BRAND_SHORT,
    ],
  };
}

export default async function BookPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: param } = await params;
  const book = await resolveBookBySlugOrId(param);
  if (!book) notFound();

  // Backfill on demand: every visited book ends up with a slug.
  let canonicalSlug = book.slug ?? "";
  if (!canonicalSlug) {
    const base = makeBookSlug(book.title, book.authors ?? "");
    canonicalSlug = await withUniqueSuffix(base, async (cand) => {
      const exists = await Book.exists({ slug: cand, _id: { $ne: book._id } });
      return !!exists;
    });
    await Book.updateOne({ _id: book._id }, { $set: { slug: canonicalSlug } });
  }

  // If the user landed via the ObjectId or an old slug, send them to the canonical URL.
  if (param !== canonicalSlug) {
    redirect(`/book/${canonicalSlug}`);
  }

  const bookId = book._id.toString();
  const session = await getAppSession();
  const userId = session?.user?.id;

  const [postCount, postIdsRaw, isFollowing, readListEntry, nytReviews] =
    await Promise.all([
      Post.countDocuments({ book: bookId }),
      Post.find({ book: bookId })
        .sort({ _id: -1 })
        .limit(30)
        .select("_id")
        .lean(),
      userId
        ? BookFollow.exists({ user: userId, book: bookId }).then(Boolean)
        : Promise.resolve(false),
      userId
        ? ReadList.findOne({ user: userId, book: bookId })
            .select("status")
            .lean()
        : Promise.resolve(null),
      getNytReviews({
        isbn: book.isbn13 || book.isbn10 || undefined,
        title: book.isbn13 || book.isbn10 ? undefined : book.title,
        author:
          book.isbn13 || book.isbn10 || book.title
            ? undefined
            : book.authors,
      }),
    ]);
  const readStatus =
    (readListEntry as { status?: "want" | "read" } | null)?.status ?? null;

  const postIds = postIdsRaw.map((r) => (r._id as Types.ObjectId).toString());
  const posts = await serializePosts(postIds, { viewerId: userId });

  const cover = book.thumbnail?.replace(/^http:/, "https:");
  const categories =
    (book.categories || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  const canonicalUrl = `${siteUrl()}/book/${canonicalSlug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: book.title,
    author: book.authors?.split(/[,;]/).map((a) => ({
      "@type": "Person",
      name: a.trim(),
    })),
    description: book.description || undefined,
    image: cover,
    inLanguage: "en",
    url: canonicalUrl,
    datePublished: book.publishedYear ? String(book.publishedYear) : undefined,
    numberOfPages: book.numPages,
    genre: categories.length ? categories : undefined,
    aggregateRating: book.averageRating
      ? {
          "@type": "AggregateRating",
          ratingValue: book.averageRating,
          bestRating: 5,
          reviewCount: postCount || 1,
        }
      : undefined,
    discussionUrl: posts.length ? canonicalUrl : undefined,
  };

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-3 py-8 sm:px-6">
      {/* Structured data for Google */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="flex flex-wrap items-center gap-2">
        <Link
          href="/explore"
          aria-label="Back to Explore"
          className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-3 text-xs font-semibold text-foreground/80 transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
        >
          <ArrowLeft size={14} aria-hidden />
          Back
        </Link>
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted">
          {categories[0] ? `In ${categories[0]}` : "Book room"}
        </span>
      </nav>

      <header className="grid gap-8 border-b border-border pb-10 sm:grid-cols-[180px_1fr] sm:gap-10">
        <div className="relative mx-auto h-[260px] w-[180px] overflow-hidden rounded-3xl bg-pill shadow-[var(--shadow-soft)] ring-1 ring-border sm:mx-0">
          {cover ? (
            <Image
              src={cover}
              alt={`Cover of ${book.title}`}
              fill
              priority
              className="object-cover"
              sizes="180px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center p-4 text-center text-sm font-semibold text-muted">
              {book.title}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
            Book room
          </p>
          <h1 className="text-[30px] font-black leading-tight tracking-tight sm:text-[36px]">
            {book.title}
          </h1>
          {book.subtitle ? (
            <p className="-mt-2 text-lg text-muted">{book.subtitle}</p>
          ) : null}
          <p className="text-sm text-foreground/85">
            <span className="text-muted">by</span> {book.authors || "Unknown author"}
          </p>

          {categories.length ? (
            <div className="flex flex-wrap gap-2">
              {categories.slice(0, 5).map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-pill px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted"
                >
                  {c}
                </span>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-4 text-[13px] text-muted">
            {book.publishedYear ? (
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={14} aria-hidden /> {book.publishedYear}
              </span>
            ) : null}
            {book.numPages ? (
              <span className="inline-flex items-center gap-1.5">
                <BookOpenText size={14} aria-hidden /> {book.numPages} pages
              </span>
            ) : null}
            {book.averageRating ? (
              <span className="inline-flex items-center gap-1.5">
                <Star size={14} aria-hidden /> {book.averageRating.toFixed(2)}
              </span>
            ) : null}
            <span>·</span>
            <span>
              {postCount} thread{postCount === 1 ? "" : "s"}
            </span>
          </div>

          <BookActions
            bookId={bookId}
            initialFollowing={isFollowing}
            initialReadStatus={readStatus}
            authenticated={!!userId}
          />

          <Link
            href={`/book/${canonicalSlug}/summary`}
            className="group inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-pop)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
            style={{ background: "var(--gradient-brand)" }}
          >
            <Sparkles
              size={14}
              aria-hidden
              className="transition group-hover:rotate-12"
            />
            Read summary
            <span aria-hidden className="text-white/80">→</span>
          </Link>
        </div>
      </header>

      {book.description ? (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Synopsis</h2>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/85">
            {book.description}
          </p>
        </section>
      ) : null}

      {nytReviews.length ? (
        <section className="space-y-3">
          <h2 className="inline-flex items-center gap-2 text-lg font-bold">
            <Newspaper
              size={18}
              aria-hidden
              className="text-rose-500 dark:text-rose-300"
            />
            New York Times review
          </h2>
          <div className="flex flex-col gap-3">
            {nytReviews.slice(0, 3).map((r) => (
              <a
                key={r.url}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-2xl border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
              >
                <div className="flex items-center justify-between gap-3 text-xs text-muted">
                  <span className="font-semibold text-foreground/85">
                    {r.byline || "The New York Times"}
                  </span>
                  {r.publicationDate ? (
                    <time dateTime={r.publicationDate}>
                      {new Date(r.publicationDate).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </time>
                  ) : null}
                </div>
                {r.summary ? (
                  <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-foreground/85">
                    {r.summary}
                  </p>
                ) : null}
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-300">
                  Read on nytimes.com
                  <ExternalLink size={11} aria-hidden />
                </span>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-bold">
            Threads · {postCount}
          </h2>
          <Link
            href={`/compose?bookId=${bookId}`}
            className="text-xs font-semibold text-sky-600 underline-offset-4 hover:underline dark:text-sky-300"
          >
            New quote →
          </Link>
        </div>

        <div className="flex flex-col gap-3">
          {posts.map((p) => (
            <Link
              key={p.id}
              href={`/post/${p.id}`}
              className="rounded-xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
            >
              <div className="flex items-center justify-between gap-3 text-xs text-muted">
                <span className="font-semibold text-foreground/85">
                  @{p.author.username}
                </span>
                <time dateTime={p.createdAt}>
                  {new Date(p.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </time>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed">
                {p.content}
              </p>
              <p className="mt-3 text-xs text-muted">
                {p.commentCount} repl{p.commentCount === 1 ? "y" : "ies"}
              </p>
            </Link>
          ))}
          {!posts.length ? (
            <p className="rounded-3xl border border-dashed border-border bg-card/60 p-6 text-center text-sm text-muted">
              No threads yet — be the first to share a passage from this book.
            </p>
          ) : null}
        </div>
      </section>
    </article>
  );
}

// Revalidate periodically so server-rendered book pages stay fresh in cache.
export const revalidate = 300;
