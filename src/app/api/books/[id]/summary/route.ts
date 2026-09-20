import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { z } from "zod";
import connectDB from "@/lib/db";
import Book from "@/models/Book";
import BookSummary from "@/models/BookSummary";
import UserBookSummary from "@/models/UserBookSummary";
import { getAppSession } from "@/lib/session";
import { isLlmConfigured, LlmError } from "@/lib/llm";
import { looksLikeObjectId } from "@/lib/slug";
import {
  DEFAULT_SHARED_BRIEF,
  generateSummary,
  upsertSharedSummary,
  wordCount,
  type SummaryBook,
} from "@/lib/book-summary";

async function resolveBook(input: string): Promise<SummaryBook | null> {
  await connectDB();
  if (looksLikeObjectId(input)) {
    return (await Book.findById(input).lean()) as SummaryBook | null;
  }
  return (await Book.findOne({ slug: input }).lean()) as SummaryBook | null;
}

type SummaryDTO = {
  id: string;
  content: string;
  prompt: string;
  scope: "shared" | "personal";
  wordCount: number;
  updatedAt: string;
};

/**
 * GET: returns the most-relevant summary for the caller.
 *   - If signed in AND a personal summary exists → returns it.
 *   - Else if a shared summary exists → returns it.
 *   - Else null. Also returns whether a shared summary exists separately.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const book = await resolveBook(id);
  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = await getAppSession();
  const userId = session?.user?.id;

  const [personal, shared] = await Promise.all([
    userId
      ? UserBookSummary.findOne({ user: userId, book: book._id }).lean()
      : Promise.resolve(null),
    BookSummary.findOne({ book: book._id }).lean(),
  ]);

  const toDTO = (
    doc:
      | {
          _id: Types.ObjectId;
          content: string;
          prompt?: string;
          wordCount?: number;
          updatedAt?: Date;
        }
      | null,
    scope: "shared" | "personal"
  ): SummaryDTO | null =>
    doc
      ? {
          id: doc._id.toString(),
          content: doc.content,
          prompt: doc.prompt ?? "",
          scope,
          wordCount: doc.wordCount ?? wordCount(doc.content),
          updatedAt:
            doc.updatedAt?.toISOString() ?? new Date().toISOString(),
        }
      : null;

  return NextResponse.json({
    book: {
      id: book._id.toString(),
      slug: book.slug ?? book._id.toString(),
      title: book.title,
      authors: book.authors ?? "",
    },
    personal: toDTO(
      personal as Parameters<typeof toDTO>[0],
      "personal"
    ),
    shared: toDTO(shared as Parameters<typeof toDTO>[0], "shared"),
    hasShared: Boolean(shared),
    hasPersonal: Boolean(personal),
    canCustomize: Boolean(userId),
  });
}

const generateSchema = z.object({
  scope: z.union([z.literal("shared"), z.literal("personal")]),
  prompt: z.string().trim().max(800).optional().default(""),
  /** When true, regenerate even if the shared summary already exists. */
  force: z.boolean().optional().default(false),
});

/**
 * POST: generate (or regenerate) a summary.
 *  - `scope: "shared"` requires auth (any signed-in user kicks off the first
 *    community summary). If one already exists and `force` is false, returns
 *    the existing one. Admins may force-regenerate.
 *  - `scope: "personal"` requires auth and upserts a per-user summary.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isLlmConfigured()) {
    return NextResponse.json(
      { error: "AI is not configured on the server." },
      { status: 503 }
    );
  }

  const { id } = await ctx.params;
  const book = await resolveBook(id);
  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = generateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(parsed.error.flatten().fieldErrors, { status: 400 });
  }
  const { scope, prompt, force } = parsed.data;

  // Reuse existing shared summary when not forcing.
  if (scope === "shared" && !force) {
    const existing = await BookSummary.findOne({ book: book._id }).lean();
    if (existing) {
      return NextResponse.json({
        summary: {
          id: (existing as { _id: Types.ObjectId })._id.toString(),
          content: (existing as { content: string }).content,
          prompt: (existing as { prompt?: string }).prompt ?? "",
          scope: "shared" as const,
          wordCount:
            (existing as { wordCount?: number }).wordCount ??
            wordCount((existing as { content: string }).content),
          updatedAt:
            ((existing as { updatedAt?: Date }).updatedAt ?? new Date()).toISOString(),
        },
        reused: true,
      });
    }
  }

  // Force regenerate of shared is admin-only.
  if (scope === "shared" && force && session.user.role !== "admin") {
    return NextResponse.json(
      { error: "Only admins can regenerate the shared summary." },
      { status: 403 }
    );
  }

  try {
    const { content, wordCount: wc, model } = await generateSummary(
      book,
      scope,
      prompt
    );

    if (scope === "shared") {
      const upserted = await upsertSharedSummary({
        book: book._id,
        content,
        prompt,
        model,
        wordCount: wc,
        generatedBy: new Types.ObjectId(session.user.id),
      });

      return NextResponse.json({
        summary: {
          id: upserted._id.toString(),
          content,
          prompt: prompt || DEFAULT_SHARED_BRIEF,
          scope: "shared" as const,
          wordCount: wc,
          updatedAt: new Date().toISOString(),
        },
        reused: false,
      });
    }

    // Personal
    const upserted = await UserBookSummary.findOneAndUpdate(
      { user: session.user.id, book: book._id },
      {
        $set: {
          content,
          prompt,
          model,
          wordCount: wc,
        },
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({
      summary: {
        id: upserted!._id.toString(),
        content,
        prompt,
        scope: "personal" as const,
        wordCount: wc,
        updatedAt: new Date().toISOString(),
      },
      reused: false,
    });
  } catch (err) {
    const message =
      err instanceof LlmError
        ? err.message
        : err instanceof Error
          ? err.message
          : "AI request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/** Delete the caller's personal summary (revert to shared view). */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const book = await resolveBook(id);
  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await UserBookSummary.deleteOne({
    user: session.user.id,
    book: book._id,
  });

  return NextResponse.json({ ok: true });
}
