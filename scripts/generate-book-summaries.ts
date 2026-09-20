/**
 * Batch-generate the shared AI summary for every book that doesn't have one.
 *
 * Run with:  npm run summarize-books -- [flags]
 *
 *   --limit=N          stop after N books this run
 *   --force            regenerate even when a summary already exists
 *   --dry-run          list what would be generated; no LLM calls, no writes
 *   --book=<id|slug>   just this one book
 *
 * Never run this from a web request — a full pass is hours of LLM calls. The
 * run is resumable: books that already have a summary are skipped, so Ctrl-C
 * and restart picks up where it left off (a second Ctrl-C exits immediately).
 * SUMMARY_SLEEP_MS overrides the pause between calls (0 = no sleep).
 */
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

import mongoose, { type PipelineStage } from "mongoose";
import connectDB from "../src/lib/db";
import Book from "../src/models/Book";
import BookSummary from "../src/models/BookSummary";
import { isLlmConfigured, LlmError } from "../src/lib/llm";
import {
  generateSharedSummary,
  upsertSharedSummary,
  type SummaryBook,
} from "../src/lib/book-summary";
import { looksLikeObjectId } from "../src/lib/slug";

// Pause between consecutive LLM calls to stay under OpenRouter's free-tier
// rate limit. Override with SUMMARY_SLEEP_MS (0 = no sleep).
const SLEEP_BETWEEN_LLM_MS = parseInt(process.env.SUMMARY_SLEEP_MS ?? "1500", 10);
// `llmChat` already retries a rejected request three times within a second;
// these attempts are the slower outer loop for a provider that stays busy.
const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 5000;
const BOOK_FIELDS = "_id slug title authors categories description publishedYear";

const sleep = (ms: number) =>
  ms > 0 ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve();

type Flags = {
  limit: number;
  force: boolean;
  dryRun: boolean;
  book: string;
};

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { limit: 0, force: false, dryRun: false, book: "" };
  for (const arg of argv) {
    if (arg === "--force") flags.force = true;
    else if (arg === "--dry-run") flags.dryRun = true;
    else if (arg.startsWith("--limit=")) {
      const n = parseInt(arg.slice("--limit=".length), 10);
      if (!Number.isFinite(n) || n <= 0) {
        throw new Error(`--limit needs a positive number, got "${arg}"`);
      }
      flags.limit = n;
    } else if (arg.startsWith("--book=")) {
      flags.book = arg.slice("--book=".length).trim();
      if (!flags.book) throw new Error("--book needs an id or slug");
    } else {
      throw new Error(`Unknown argument "${arg}"`);
    }
  }
  return flags;
}

/** Progress lines are written in two halves, so notices must close them. */
let lineOpen = false;

function startLine(text: string) {
  process.stdout.write(text);
  lineOpen = true;
}

function endLine(text: string) {
  process.stdout.write(lineOpen ? ` ${text}\n` : `    ${text}\n`);
  lineOpen = false;
}

function note(text: string) {
  if (lineOpen) {
    process.stdout.write("\n");
    lineOpen = false;
  }
  console.log(text);
}

const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

async function resolveOneBook(input: string): Promise<SummaryBook | null> {
  const query = looksLikeObjectId(input)
    ? Book.findById(input)
    : Book.findOne({ slug: input });
  return (await query.select(BOOK_FIELDS).lean()) as SummaryBook | null;
}

/**
 * Books with a usable blurb (without one the model would invent a book from
 * the title alone), most-reviewed first so the books people actually open get
 * a summary on the earliest run. Unless `--force`, the ones that already have
 * a summary are filtered out — that's what makes this resumable.
 */
async function findCandidates(flags: Flags): Promise<SummaryBook[]> {
  const pipeline: PipelineStage[] = [
    { $match: { description: { $type: "string", $ne: "" } } },
  ];

  if (!flags.force) {
    pipeline.push(
      {
        $lookup: {
          from: BookSummary.collection.name,
          localField: "_id",
          foreignField: "book",
          as: "summaries",
        },
      },
      { $match: { summaries: { $size: 0 } } }
    );
  }

  pipeline.push({ $sort: { ratingsCount: -1, _id: 1 } });
  if (flags.limit) pipeline.push({ $limit: flags.limit });
  pipeline.push({
    $project: {
      slug: 1,
      title: 1,
      authors: 1,
      categories: 1,
      description: 1,
      publishedYear: 1,
    },
  });

  const rows = await Book.aggregate(pipeline);
  return rows as SummaryBook[];
}

/** Retries a busy provider with a widening gap; gives up on real failures. */
async function generateWithRetries(book: SummaryBook) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await generateSharedSummary(book);
    } catch (err) {
      const retryable = err instanceof LlmError && err.retryable;
      if (!retryable || attempt === MAX_ATTEMPTS) throw err;
      const wait = RETRY_BACKOFF_MS * 2 ** (attempt - 1);
      const message = err instanceof Error ? err.message : String(err);
      endLine(`retry ${attempt}/${MAX_ATTEMPTS - 1} in ${secs(wait)} — ${message}`);
      await sleep(wait);
    }
  }
  // Unreachable: the final attempt above either returns or throws.
  throw new LlmError("summary generation exhausted its attempts", 502);
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));

  if (!flags.dryRun && !isLlmConfigured()) {
    console.error(
      "OPENROUTER_API_KEY is not set — add it to .env.local before running this script.\n" +
        "(`--dry-run` works without a key.)"
    );
    process.exit(1);
  }

  await connectDB();

  const candidates = flags.book
    ? await oneBookCandidate(flags)
    : await findCandidates(flags);

  const total = candidates.length;
  if (!total) {
    console.log("Nothing to do — every book already has a summary.");
    await shutdown(0);
  }

  console.log(
    `Books to summarize: ${total}` +
      (flags.force ? " (--force: existing summaries will be replaced)" : "") +
      (flags.dryRun ? " (--dry-run: no LLM calls, no writes)" : "") +
      (flags.limit ? ` (--limit=${flags.limit})` : "")
  );
  if (!flags.dryRun) {
    console.log(`Sleeping ${SLEEP_BETWEEN_LLM_MS}ms between calls.\n`);
  }

  let generated = 0;
  let skipped = 0;
  let failed = 0;
  let stopRequested = false;
  const startedAt = Date.now();

  process.on("SIGINT", () => {
    if (stopRequested) process.exit(130);
    stopRequested = true;
    note("\nCtrl-C — finishing the current book, then stopping (again to force).");
  });

  for (let i = 0; i < total; i++) {
    const book = candidates[i];
    const label = `[${i + 1}/${total}] ${book.title}${
      book.authors ? ` by ${book.authors}` : ""
    }`;

    if (flags.dryRun) {
      console.log(`${label} … would generate`);
      generated += 1;
      continue;
    }

    startLine(`${label} …`);

    // Re-checked per book so a run started alongside another (or alongside a
    // user clicking "generate") doesn't pay for a duplicate.
    if (!flags.force && (await BookSummary.exists({ book: book._id }))) {
      endLine("skip (already summarized)");
      skipped += 1;
      continue;
    }

    const bookStartedAt = Date.now();
    try {
      const summary = await generateWithRetries(book);
      await upsertSharedSummary({
        book: book._id,
        content: summary.content,
        model: summary.model,
        wordCount: summary.wordCount,
      });
      endLine(
        `ok (${summary.wordCount} words, ${secs(Date.now() - bookStartedAt)})`
      );
      generated += 1;
    } catch (err) {
      // One bad book never ends the run — it's logged and left for a re-run.
      const message = err instanceof Error ? err.message : String(err);
      endLine(`FAILED (${secs(Date.now() - bookStartedAt)}) — ${message}`);
      failed += 1;
    }

    if (stopRequested) {
      note(`Stopped early at ${i + 1}/${total}.`);
      break;
    }
    if (i < total - 1) await sleep(SLEEP_BETWEEN_LLM_MS);
  }

  note(
    `Done. generated=${generated} skipped=${skipped} failed=${failed} ` +
      `elapsed=${secs(Date.now() - startedAt)}`
  );
  await shutdown(failed > 0 && generated === 0 ? 1 : 0);
}

/** `--book=` bypasses the candidate query so a bad id reports clearly. */
async function oneBookCandidate(flags: Flags): Promise<SummaryBook[]> {
  const book = await resolveOneBook(flags.book);
  if (!book) throw new Error(`No book found for "${flags.book}"`);
  if (!(book.description || "").trim()) {
    throw new Error(`Book "${book.title}" has no description to summarize.`);
  }
  if (!flags.force && (await BookSummary.exists({ book: book._id }))) {
    console.log(
      `"${book.title}" already has a summary — pass --force to regenerate.`
    );
    return [];
  }
  return [book];
}

/** Mongoose keeps the process alive, so close the pool before exiting. */
async function shutdown(code: number): Promise<never> {
  await mongoose.disconnect().catch(() => {});
  process.exit(code);
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await shutdown(1);
});
