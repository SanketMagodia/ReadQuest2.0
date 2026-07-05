import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppSession } from "@/lib/session";
import connectDB from "@/lib/db";
import Book from "@/models/Book";
import { groqChat, isGroqConfigured, GroqError } from "@/lib/groq";

const schema = z.object({
  bookId: z.string().regex(/^[a-f0-9]{24}$/i),
  hint: z.string().trim().max(280).optional(),
});

function cleanContent(raw: string, max = 600) {
  let text = raw.trim();
  text = text.replace(/^["“'`]+|["”'`]+$/g, "").trim();
  text = text.replace(/^(post|reply|comment):\s*/i, "").trim();
  if (text.length > max) text = text.slice(0, max).trim() + "…";
  return text;
}

type BookLean = {
  _id: unknown;
  title: string;
  authors?: string;
  categories?: string;
  description?: string;
};

/** Compose helper: generate a short, in-voice post about the selected book.
 *  Auth required so we don't burn Groq quota for anonymous traffic. */
export async function POST(req: Request) {
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

  const raw = await req.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(parsed.error.flatten().fieldErrors, { status: 400 });
  }

  await connectDB();
  const book = (await Book.findById(parsed.data.bookId)
    .select("title authors categories description")
    .lean()) as BookLean | null;
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  const hint = parsed.data.hint?.trim() ?? "";
  const desc = (book.description || "").slice(0, 700);

  const system = [
    "You write short, authentic social-media posts for a books community called The Gist Club (TGC).",
    "Voice: a real reader sharing a thought about a book they have just read or are reading.",
    "Style rules:",
    "- 1 to 3 short sentences, max 280 characters total.",
    "- Casual, specific, and human. Avoid clichés like 'must read' or 'page turner'.",
    "- No hashtags. No emojis unless extremely subtle. No quotation marks wrapping the whole post.",
    "- Do not summarize the plot. React or reflect.",
    "- Do not mention the book title or author in the body (the post is already linked to the book).",
    "- Output only the post text, nothing else.",
  ].join("\n");

  const user = [
    "Book context (for your eyes only — do not name in the post):",
    `Title: ${book.title}`,
    book.authors ? `Authors: ${book.authors}` : "",
    book.categories ? `Categories: ${book.categories}` : "",
    desc ? `Synopsis: ${desc}` : "",
    "",
    hint ? `Angle the reader wants: ${hint}` : "",
    "Write the post now.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const completion = await groqChat(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { temperature: 0.95, maxTokens: 220 }
    );
    const content = cleanContent(completion, 600);
    if (!content) {
      return NextResponse.json(
        { error: "AI returned an empty post — try again." },
        { status: 502 }
      );
    }
    return NextResponse.json({ content });
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
