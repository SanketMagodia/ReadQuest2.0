import { Types } from "mongoose";
import connectDB from "@/lib/db";
import BookQuote from "@/models/BookQuote";
import { llmChat, isLlmConfigured } from "@/lib/llm";

export type BookQuoteResult = {
  text: string;
  /** True only when the line is genuinely from the book. */
  verbatim: boolean;
};

const MAX_WORDS = 24;

const SYSTEM = [
  "You surface ONE short, genuinely inspiring line to put above a reader's daily reading quest.",
  "",
  "You have two options, and you must be honest about which you used:",
  '1. If the book contains a widely quoted line that you can reproduce exactly, word for word, return it and set "verbatim" to true. Famous novels usually have one, and a real line is always the better answer.',
  '2. If you cannot reproduce any line exactly, do NOT approximate one. Instead distil the book\'s central insight into one original, uplifting sentence and set "verbatim" to false.',
  "",
  "Attribute nothing you had to reconstruct: a paraphrase, a line you are unsure of, or a line from a different book by the same author all count as option 2.",
  "",
  "The line must:",
  `- Be at most ${MAX_WORDS} words, a single sentence.`,
  "- Stand on its own to someone who has not read the book.",
  "- Lift or provoke the reader. No plot details, no spoilers, no summary of what the book is about.",
  "- Contain no quotation marks, no author name, no book title, no attribution.",
  "",
  'Respond with STRICT JSON only: {"text":"...","verbatim":true}',
].join("\n");

function parseJsonObject(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

/** Strip stray wrapping punctuation the model sometimes adds anyway. */
function clean(raw: string) {
  return raw
    .trim()
    .replace(/^[“"'`]+|[”"'`]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Returns the cached line for a book, generating and storing it on first use.
 * Always resolves — a missing quote just means the daily card renders without
 * one, so this can never break the quest.
 */
export async function getOrCreateBookQuote(book: {
  id: string;
  title: string;
  authors?: string;
  description?: string;
}): Promise<BookQuoteResult | null> {
  if (!Types.ObjectId.isValid(book.id)) return null;

  try {
    await connectDB();
    const bookId = new Types.ObjectId(book.id);

    const cached = await BookQuote.findOne({ book: bookId })
      .select("text verbatim")
      .lean<{ text: string; verbatim: boolean } | null>();
    if (cached?.text) {
      return { text: cached.text, verbatim: !!cached.verbatim };
    }

    if (!isLlmConfigured()) return null;

    const context = [
      `Book: ${book.title}`,
      book.authors ? `Author: ${book.authors}` : "",
      book.description
        ? `Publisher description (context only, do not quote from it): ${book.description.slice(0, 900)}`
        : "",
      "",
      "Give the line now.",
    ]
      .filter(Boolean)
      .join("\n");

    const completion = await llmChat(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: context },
      ],
      { temperature: 0.7, maxTokens: 500, json: true }
    );

    const data = parseJsonObject(completion) as {
      text?: unknown;
      verbatim?: unknown;
    } | null;

    const text = clean(typeof data?.text === "string" ? data.text : "");
    if (!text || text.split(/\s+/).length > MAX_WORDS + 6) return null;
    const verbatim = data?.verbatim === true;

    // Upsert so concurrent daily fetches for the same book can't collide.
    await BookQuote.updateOne(
      { book: bookId },
      { $setOnInsert: { book: bookId, text, verbatim } },
      { upsert: true }
    ).catch(() => {});

    return { text, verbatim };
  } catch (err) {
    console.warn(
      "[book-quote] could not produce a line:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}
