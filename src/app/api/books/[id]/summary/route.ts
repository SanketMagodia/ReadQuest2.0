import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { z } from "zod";
import connectDB from "@/lib/db";
import Book from "@/models/Book";
import BookSummary from "@/models/BookSummary";
import UserBookSummary from "@/models/UserBookSummary";
import { getAppSession } from "@/lib/session";
import { groqChat, isGroqConfigured, GroqError } from "@/lib/groq";
import { looksLikeObjectId } from "@/lib/slug";

type BookLean = {
  _id: Types.ObjectId;
  slug?: string;
  title: string;
  authors?: string;
  categories?: string;
  description?: string;
  publishedYear?: number;
};

async function resolveBook(input: string): Promise<BookLean | null> {
  await connectDB();
  if (looksLikeObjectId(input)) {
    return (await Book.findById(input).lean()) as BookLean | null;
  }
  return (await Book.findOne({ slug: input }).lean()) as BookLean | null;
}

function wordCount(s: string) {
  return (s.match(/\S+/g) || []).length;
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

const DEFAULT_SHARED_BRIEF =
  "Write a tight, distilled retelling of the book in the book's own voice — like a miniature edition of the book itself.";

function buildSummaryPrompts(book: BookLean, scope: "shared" | "personal", userPrompt: string) {
  const desc = (book.description || "").slice(0, 1800);
  const isFiction =
    /(fiction|novel|stories|fantasy|sci.?fi|mystery|romance|thriller|literature|poetry)/i.test(
      book.categories || ""
    );

  const system = [
    "You are condensing a book into a MINI-BOOK for a reading community called Readquest.",
    "The output should READ LIKE THE BOOK, not like a summary.",
    "",
    "VOICE",
    "- Mirror the book's prose style, tense, and tone. If the book is lyrical, be lyrical. If it's hard-boiled, be terse. If it's academic, be measured.",
    "- Use the book's vocabulary and sentence rhythm. Quote it sparingly when a line really matters.",
    isFiction
      ? "- Tell the story as a story — characters acting, scenes turning, time moving forward."
      : "- Carry the argument as the author carries it — ideas unfolding, examples landing, conclusions earned.",
    "- Spoilers are expected — the reader opted in to the full experience.",
    "",
    "FORBIDDEN",
    "- Do NOT use meta-summary section labels like 'Snapshot', 'Plot', 'Characters', 'Themes', 'Style', 'Setup', 'Overview', 'Conclusion', 'Analysis', 'Takeaways', 'Synopsis'.",
    "- Do NOT write analytical commentary about the book ('this novel explores…', 'the author argues…').",
    "- Do NOT write a preamble. Start in-scene or in-idea, like the book itself opens.",
    "- Do NOT echo the book's title or author as a heading.",
    "- Do NOT wrap the answer in code fences.",
    "",
    "FORMAT",
    "- Markdown. ~900–1400 words.",
    "- 4–7 chapter-like sections. Each is given a SHORT, ATMOSPHERIC heading drawn from the book's content (e.g. `## The Island`, `## What She Knew`, `## Free Will Is a Useful Fiction`). Never use generic labels.",
    "- Inside each section: flowing prose, short paragraphs. The pace should feel like reading the book at 5× speed — beats and turning points kept, connective tissue cut.",
    "- A `> short line` blockquote is OK once or twice when a single phrase carries the chapter's weight. Skip it if forced.",
    "- A `---` line on its own creates an ornamental pause. Use at most one between major movements.",
    "- `**bold**` only for a name first introduced or a single phrase that hits — sparingly.",
    "",
    "GOAL",
    "The reader closes this and feels like they've actually read the book — emotionally, intellectually — only faster.",
  ].join("\n");

  const customLine =
    scope === "personal"
      ? userPrompt ||
        "Reshape it through a personal angle of your choosing — a character's first-person POV, a thematic lens, a different tone — while keeping it readable as a mini-book."
      : userPrompt || DEFAULT_SHARED_BRIEF;

  const user = [
    "Book metadata (your context — never echo as a heading):",
    `Title: ${book.title}`,
    book.authors ? `Author: ${book.authors}` : "",
    book.publishedYear ? `Published: ${book.publishedYear}` : "",
    book.categories ? `Categories: ${book.categories}` : "",
    desc ? `Publisher blurb (reference only — expand far beyond this): ${desc}` : "",
    "",
    scope === "personal"
      ? `Reader's request for THIS personal version: ${customLine}`
      : `Voice direction: ${customLine}`,
    "",
    "Write the mini-book now. Open on the first chapter heading.",
  ]
    .filter(Boolean)
    .join("\n");

  return { system, user };
}

function cleanSummary(raw: string) {
  let s = raw.trim();
  // Strip accidental code-fence wrappers.
  s = s.replace(/^```(?:markdown|md)?\s*\n/i, "").replace(/\n```\s*$/i, "");
  // Strip leading "Summary:" labels.
  s = s.replace(/^(summary|overview)\s*[:\-—]\s*/i, "");
  return s.trim();
}

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
  if (!isGroqConfigured()) {
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

  const { system, user } = buildSummaryPrompts(book, scope, prompt);

  try {
    const completion = await groqChat(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { temperature: 0.85, maxTokens: 2400 }
    );
    const content = cleanSummary(completion);
    if (!content) {
      return NextResponse.json(
        { error: "AI returned an empty summary — try again." },
        { status: 502 }
      );
    }

    const wc = wordCount(content);

    if (scope === "shared") {
      const upserted = await BookSummary.findOneAndUpdate(
        { book: book._id },
        {
          $set: {
            content,
            prompt: prompt || DEFAULT_SHARED_BRIEF,
            model: process.env.GROQ_MODEL || "",
            generatedBy: new Types.ObjectId(session.user.id),
            wordCount: wc,
          },
          $inc: { version: 1 },
        },
        { upsert: true, new: true }
      );

      return NextResponse.json({
        summary: {
          id: upserted!._id.toString(),
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
          model: process.env.GROQ_MODEL || "",
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
      err instanceof GroqError
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
