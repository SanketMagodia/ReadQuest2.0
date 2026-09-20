/**
 * Shared book-summary generation: the mini-book prompt, the LLM call, and the
 * shared-summary upsert.
 *
 * Lives outside the API route so the batch script
 * (`scripts/generate-book-summaries.ts`) and the on-demand request path use
 * exactly the same prompt — a second copy would quietly drift.
 */
import { Types } from "mongoose";
import BookSummary from "@/models/BookSummary";
import { llmChat, llmModel, LlmError } from "@/lib/llm";

/** The book fields the prompt reads. */
export type SummaryBook = {
  _id: Types.ObjectId;
  slug?: string;
  title: string;
  authors?: string;
  categories?: string;
  description?: string;
  publishedYear?: number;
};

export type SummaryScope = "shared" | "personal";

export const DEFAULT_SHARED_BRIEF =
  "Write a tight, distilled retelling of the book in the book's own voice — like a miniature edition of the book itself.";

export function wordCount(s: string) {
  return (s.match(/\S+/g) || []).length;
}

export function buildSummaryPrompts(
  book: SummaryBook,
  scope: SummaryScope,
  userPrompt: string
) {
  const desc = (book.description || "").slice(0, 1800);
  const isFiction =
    /(fiction|novel|stories|fantasy|sci.?fi|mystery|romance|thriller|literature|poetry)/i.test(
      book.categories || ""
    );

  const system = [
    "You are condensing a book into a MINI-BOOK for a reading community called The Gist Club (TGC).",
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

export function cleanSummary(raw: string) {
  let s = raw.trim();
  // Strip accidental code-fence wrappers.
  s = s.replace(/^```(?:markdown|md)?\s*\n/i, "").replace(/\n```\s*$/i, "");
  // Strip leading "Summary:" labels.
  s = s.replace(/^(summary|overview)\s*[:\-—]\s*/i, "");
  return s.trim();
}

export type GeneratedSummary = {
  content: string;
  model: string;
  wordCount: number;
};

/**
 * Run the mini-book prompt and return the cleaned completion.
 *
 * Throws `LlmError` on failure — including a non-retryable one when the model
 * hands back nothing usable, so callers can surface it like any other LLM
 * problem instead of special-casing an empty string.
 */
export async function generateSummary(
  book: SummaryBook,
  scope: SummaryScope,
  userPrompt = ""
): Promise<GeneratedSummary> {
  const { system, user } = buildSummaryPrompts(book, scope, userPrompt);

  const completion = await llmChat(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { temperature: 0.85, maxTokens: 2400 }
  );

  const content = cleanSummary(completion);
  if (!content) {
    throw new LlmError("AI returned an empty summary — try again.", 502);
  }

  return { content, model: llmModel(), wordCount: wordCount(content) };
}

/** Convenience wrapper for the community-wide summary. */
export function generateSharedSummary(book: SummaryBook, userPrompt = "") {
  return generateSummary(book, "shared", userPrompt);
}

/**
 * Create or replace the one shared summary for a book, bumping `version`.
 * `generatedBy` is omitted for machine-driven runs (the batch script).
 */
export async function upsertSharedSummary(input: {
  book: Types.ObjectId;
  content: string;
  model: string;
  wordCount: number;
  prompt?: string;
  generatedBy?: Types.ObjectId;
}): Promise<{ _id: Types.ObjectId }> {
  return BookSummary.findOneAndUpdate(
    { book: input.book },
    {
      $set: {
        content: input.content,
        prompt: input.prompt || DEFAULT_SHARED_BRIEF,
        model: input.model,
        wordCount: input.wordCount,
        ...(input.generatedBy ? { generatedBy: input.generatedBy } : {}),
      },
      $inc: { version: 1 },
    },
    { upsert: true, new: true }
  );
}
