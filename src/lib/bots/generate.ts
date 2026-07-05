import { Types } from "mongoose";
import connectDB from "@/lib/db";
import Bot, { type BotDoc } from "@/models/Bot";
import Book from "@/models/Book";
import Post from "@/models/Post";
import Comment from "@/models/Comment";
import PostReaction from "@/models/PostReaction";
import CommentReaction from "@/models/CommentReaction";
import BotTickLock from "@/models/BotTickLock";
import "@/models/User";
import { groqChat } from "@/lib/groq";

const MIN_GAP_MS = 60 * 1000;
// Pause between consecutive LLM calls to keep Groq TPM usage well under the limit.
// Override with BOT_LLM_SLEEP_MS env var (0 = no sleep).
const SLEEP_BETWEEN_LLM_MS = parseInt(
  process.env.BOT_LLM_SLEEP_MS ?? "30000",
  10
);
const sleep = (ms: number) =>
  ms > 0 ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve();
// Soft wall-clock budget per tick. Must stay BELOW the route's maxDuration
// (300 s on Vercel) or the platform kills the function mid-tick and the lock
// stays held until its TTL. Override with BOT_TICK_BUDGET_MS for local runs.
const TICK_BUDGET_MS = parseInt(
  process.env.BOT_TICK_BUDGET_MS ?? String(4 * 60 * 1000 + 30 * 1000),
  10
);
// Lock TTL: only a fallback for a crashed tick (the lock is normally released in
// `finally`). Always kept comfortably above TICK_BUDGET_MS so a slow tick never
// has its lock expire underneath it.
const TICK_LOCK_MS = Math.max(10 * 60 * 1000, TICK_BUDGET_MS + 5 * 60 * 1000);
// Cap how many posts a single bot may backfill in one tick. A bot that missed
// many slots only fills its most recent 2–3 scheduled times (see
// buildCatchUpSlots), never the whole backlog.
const MAX_BACKFILL_POSTS_PER_BOT = 3;
// Replies/auto-responses are never backdated further than this.
const MAX_CATCHUP_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_POSTS_PER_TICK = 40;
const MAX_REPLIES_PER_BOT_PER_TICK = 4;
// Cap how much we scale reply volume by elapsed time (in "virtual" 1-minute ticks).
const MAX_VIRTUAL_TICKS = 90;
// Fallback look-back window when we have no record of the previous tick.
const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000;
const REPLY_LOOKBACK_DAYS = 7;
const AUTO_RESPOND_LOOKBACK_MS = 48 * 60 * 60 * 1000;
const AUTO_RESPOND_BATCH = 50;

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Uniform random Date in [a, max(a, b)]. */
function randomTimeBetween(a: Date, b: Date) {
  const lo = a.getTime();
  const hi = Math.max(lo, b.getTime());
  return new Date(lo + Math.random() * (hi - lo));
}

function randomMinutes(min: number, max: number) {
  const lo = Math.max(1, Math.min(min, max));
  const hi = Math.max(min, max);
  return Math.floor(lo + Math.random() * (hi - lo + 1));
}

export function rollNextPostAt(bot: BotDoc, from = new Date()) {
  const min = bot.intervalMinMinutes || 1440;
  const max = bot.intervalMaxMinutes || 4320;
  const minutes = randomMinutes(min, max);
  return new Date(from.getTime() + minutes * 60 * 1000);
}

/**
 * The backdated moments a due bot should post at during this tick.
 *
 * - Barely behind (missed ≤ MAX_BACKFILL_POSTS_PER_BOT slots): honor the real
 *   schedule — walk forward from nextPostAt at the bot's cadence.
 * - Long idle gap: don't replay the backlog. Synthesize only the most recent
 *   2–3 slots by walking BACKWARD from a fresh moment near `now` at the bot's
 *   own cadence, so the feed shows a naturally scattered recent trail instead
 *   of a month-old blast.
 */
export function buildCatchUpSlots(bot: BotDoc, now = new Date()): Date[] {
  const scheduled = bot.nextPostAt ? new Date(bot.nextPostAt) : now;
  if (scheduled > now) return [];

  const forward: Date[] = [];
  let t = scheduled;
  while (t <= now && forward.length <= MAX_BACKFILL_POSTS_PER_BOT) {
    forward.push(new Date(t));
    t = rollNextPostAt(bot, t);
  }
  if (forward.length <= MAX_BACKFILL_POSTS_PER_BOT) return forward;

  const count = 2 + (Math.random() < 0.5 ? 1 : 0); // 2 or 3
  const minMinutes = Math.max(10, bot.intervalMinMinutes || 1440);
  const maxMinutes = Math.max(minMinutes, bot.intervalMaxMinutes || 4320);
  // Newest slot lands a random 5–50% of the min interval before `now` — recent,
  // but not suspiciously "the second the admin clicked".
  const recentOffsetMs = (0.05 + Math.random() * 0.45) * minMinutes * 60_000;
  const slots: Date[] = [];
  let anchor = new Date(now.getTime() - recentOffsetMs);
  for (let i = 0; i < count; i++) {
    slots.unshift(anchor);
    anchor = new Date(
      anchor.getTime() - randomMinutes(minMinutes, maxMinutes) * 60_000
    );
  }
  return slots;
}

type BookContext = {
  _id: Types.ObjectId;
  title: string;
  authors?: string;
  categories?: string;
  description?: string;
};

/** Builds an $or filter that matches any of the supplied (case-insensitive) categories
 *  against the comma-separated `categories` string on Book documents. */
function buildBookCategoryFilter(cats: string[]) {
  const clean = cats.map((c) => c.trim()).filter(Boolean);
  if (!clean.length) return {};
  return {
    $or: clean.map((c) => ({
      categories: { $regex: new RegExp(escapeRegex(c), "i") },
    })),
  };
}

async function pickBookForBot(bot: BotDoc): Promise<BookContext | null> {
  const cats = (bot.categories || []).filter((c) => c && c.trim());

  const baseFilter: Record<string, unknown> = cats.length
    ? buildBookCategoryFilter(cats)
    : {};

  const total = await Book.countDocuments(baseFilter);
  if (total === 0) {
    if (!cats.length) return null;
    const fallback = await Book.countDocuments({});
    if (fallback === 0) return null;
    const skip = Math.floor(Math.random() * fallback);
    const [doc] = await Book.find({}).skip(skip).limit(1).lean();
    return (doc as BookContext) || null;
  }

  const skip = Math.floor(Math.random() * total);
  const [doc] = await Book.find(baseFilter).skip(skip).limit(1).lean();
  return (doc as BookContext) || null;
}

function buildPrompt(bot: BotDoc, book: BookContext) {
  const desc = (book.description || "").slice(0, 700);
  const persona = (bot.persona || "").trim() || "A passionate reader.";

  const system = [
    "You write short, authentic social-media posts for a books community called The Gist Club (TGC).",
    "Voice: a real person sharing a thought about a book they have just read or are reading.",
    "Style rules:",
    "- 1 to 3 short sentences, max 280 characters total.",
    "- Casual, specific, and human. Avoid clichés like 'must read' or 'page turner'.",
    "- No hashtags. No emojis unless extremely subtle. No quotation marks wrapping the whole post.",
    "- Do not summarize the plot. React or reflect.",
    "- Do not mention the book title or author in the body (the post is already linked to the book).",
    "- Output only the post text, nothing else.",
  ].join("\n");

  const user = [
    `Persona: ${persona}`,
    "",
    "Book context (for your eyes only — do not name in the post):",
    `Title: ${book.title}`,
    book.authors ? `Authors: ${book.authors}` : "",
    book.categories ? `Categories: ${book.categories}` : "",
    desc ? `Description: ${desc}` : "",
    "",
    "Write the post now.",
  ]
    .filter(Boolean)
    .join("\n");

  return { system, user };
}

function cleanText(raw: string, max = 600) {
  let text = raw.trim();
  text = text.replace(/^["“'`]+|["”'`]+$/g, "").trim();
  text = text.replace(/^(post|reply|comment):\s*/i, "").trim();
  if (text.length > max) text = text.slice(0, max).trim() + "…";
  return text;
}

/** Reply prompts ask the model to end with `[LIKE]`, `[DISLIKE]`, or `[SKIP]`
 *  on its own line. We extract that tag and strip it from the user-visible
 *  text before saving the reply. */
function extractSentimentAndText(
  raw: string,
  max = 400
): { text: string; sentiment: "like" | "dislike" | null } {
  let body = raw.trim();
  let sentiment: "like" | "dislike" | null = null;
  const re = /\[(LIKE|DISLIKE|SKIP)\][.!?]*\s*$/i;
  const m = body.match(re);
  if (m && m.index !== undefined) {
    const tag = m[1].toUpperCase();
    if (tag === "LIKE") sentiment = "like";
    else if (tag === "DISLIKE") sentiment = "dislike";
    body = body.slice(0, m.index).trimEnd();
    // Drop a trailing newline or stray sentence-ending punctuation we just cut from.
    body = body.replace(/[\s\n]+$/g, "");
  }
  return { text: cleanText(body, max), sentiment };
}

const REPLY_TAG_INSTRUCTION = [
  "At the very END of your reply, on a NEW line, output exactly ONE of these",
  "sentiment tags: [LIKE] (you agree / appreciate it), [DISLIKE] (you push back",
  "or disagree), or [SKIP] (no strong feeling). The tag is removed before the",
  "reply is posted — it only tells the system whether to like/dislike the",
  "message you are responding to.",
].join(" ");

/** Apply a reaction by the bot on the given post. Idempotent / no-op when sentiment is null. */
async function applyBotPostReaction(
  botUserId: Types.ObjectId,
  postId: Types.ObjectId,
  sentiment: "like" | "dislike" | null
) {
  if (!sentiment) return;
  try {
    await PostReaction.updateOne(
      { user: botUserId, post: postId },
      { $set: { type: sentiment } },
      { upsert: true }
    );
  } catch (err) {
    console.error("[bots] applyBotPostReaction failed", err);
  }
}

/** Apply a reaction by the bot on the given comment. */
async function applyBotCommentReaction(
  botUserId: Types.ObjectId,
  commentId: Types.ObjectId,
  sentiment: "like" | "dislike" | null
) {
  if (!sentiment) return;
  try {
    await CommentReaction.updateOne(
      { user: botUserId, comment: commentId },
      { $set: { type: sentiment } },
      { upsert: true }
    );
  } catch (err) {
    console.error("[bots] applyBotCommentReaction failed", err);
  }
}

/**
 * Generate one post for a bot.
 *
 * When `opts.postedAt` is supplied, the post's `createdAt` is backdated to that
 * time and the bot's `nextPostAt` is rolled forward FROM that time. This lets a
 * single tick "catch up" by placing missed posts at their natural scheduled
 * moments instead of flooding the feed with everything at `now`.
 */
export async function generatePostForBot(
  botId: string,
  opts?: { postedAt?: Date }
) {
  await connectDB();
  const bot = await Bot.findById(botId);
  if (!bot) throw new Error("Bot not found");

  const book = await pickBookForBot(bot as unknown as BotDoc);
  if (!book) {
    throw new Error("No books available for this bot's categories");
  }

  const { system, user } = buildPrompt(bot as unknown as BotDoc, book);
  const raw = await groqChat(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { model: bot.model || undefined, temperature: 0.9, maxTokens: 220 }
  );

  const content = cleanText(raw, 600);
  if (!content) throw new Error("Empty post generated");

  const post = await Post.create({
    author: bot.user,
    book: book._id,
    content,
  });

  const postedAt = opts?.postedAt;
  if (postedAt) {
    // Use the native driver so the write isn't overridden by Mongoose's
    // timestamps plugin (which would otherwise stamp createdAt = now).
    await Post.collection.updateOne(
      { _id: post._id },
      { $set: { createdAt: postedAt, updatedAt: postedAt } }
    );
  }

  const baseTime = postedAt ?? new Date();
  bot.lastPostAt = baseTime;
  bot.postsCount = (bot.postsCount || 0) + 1;
  bot.nextPostAt = rollNextPostAt(bot as unknown as BotDoc, baseTime);
  bot.lastError = "";
  await bot.save();

  return { post, bot, book };
}

// ──────────────────────────────────────────────────────────────────────────────
//  Replies (top-level comments on other users' posts)
// ──────────────────────────────────────────────────────────────────────────────

type CandidatePost = {
  _id: Types.ObjectId;
  content: string;
  createdAt: Date;
  author: Types.ObjectId;
  book: Types.ObjectId;
};

/** Pick a recent post from a non-bot user in a matching category that this
 *  bot has not yet commented on. */
async function pickPostForReply(
  bot: BotDoc
): Promise<{ post: CandidatePost; book: BookContext } | null> {
  // Reply categories fall back to posting categories when empty.
  const cats = (
    bot.replyCategories && bot.replyCategories.length
      ? bot.replyCategories
      : bot.categories || []
  )
    .map((c) => c.trim())
    .filter(Boolean);

  const bookFilter = cats.length ? buildBookCategoryFilter(cats) : {};
  const books = (await Book.find(bookFilter)
    .select("_id title authors categories description")
    .lean()) as BookContext[];
  if (!books.length) return null;
  const bookMap = new Map<string, BookContext>(
    books.map((b) => [b._id.toString(), b])
  );

  const since = new Date(Date.now() - REPLY_LOOKBACK_DAYS * 24 * 3_600_000);
  const candidates = (await Post.find({
    book: { $in: books.map((b) => b._id) },
    author: { $ne: bot.user },
    createdAt: { $gte: since },
  })
    .sort({ createdAt: -1 })
    .limit(80)
    .lean()) as CandidatePost[];
  if (!candidates.length) return null;

  // Skip posts this bot has already replied to.
  const myComments = await Comment.find({
    post: { $in: candidates.map((p) => p._id) },
    author: bot.user,
  })
    .select("post")
    .lean();
  const replied = new Set(
    (myComments as { post: Types.ObjectId }[]).map((c) => c.post.toString())
  );
  const remaining = candidates.filter((p) => !replied.has(p._id.toString()));
  if (!remaining.length) return null;

  // Random within the most-recent window to keep responses fresh-feeling.
  const pool = remaining.slice(0, Math.min(remaining.length, 20));
  const pick = pool[Math.floor(Math.random() * pool.length)];
  const book = bookMap.get(pick.book.toString());
  if (!book) return null;
  return { post: pick, book };
}

function buildReplyPrompt(bot: BotDoc, book: BookContext, post: CandidatePost) {
  const desc = (book.description || "").slice(0, 600);
  const persona = (bot.persona || "").trim() || "A passionate reader.";
  const original = post.content.replace(/\s+/g, " ").trim().slice(0, 400);

  const system = [
    "You are replying to another reader's quick post on The Gist Club (TGC), a books community.",
    "Voice: a real person reacting to their take in 1–2 short, casual sentences.",
    "Style rules:",
    "- 1 to 2 short sentences, max 240 characters total.",
    "- Specific and human. Build on or gently push back against their point.",
    "- Reference what they said when natural; do not just talk about the book in general.",
    "- No hashtags. No emojis unless extremely subtle. No quotation marks wrapping the reply.",
    "- Do not mention the book title or author (the thread already shows it).",
    REPLY_TAG_INSTRUCTION,
  ].join("\n");

  const user = [
    `Persona: ${persona}`,
    "",
    "Book context (for your eyes only — do not name in the reply):",
    `Title: ${book.title}`,
    book.authors ? `Authors: ${book.authors}` : "",
    book.categories ? `Categories: ${book.categories}` : "",
    desc ? `Synopsis: ${desc}` : "",
    "",
    "Original post you are replying to:",
    `"${original}"`,
    "",
    "Write your reply now.",
  ]
    .filter(Boolean)
    .join("\n");

  return { system, user };
}

export async function generateReplyForBot(
  botId: string,
  opts?: { spreadSince?: Date }
) {
  await connectDB();
  const bot = await Bot.findById(botId);
  if (!bot) throw new Error("Bot not found");

  const pick = await pickPostForReply(bot as unknown as BotDoc);
  if (!pick) {
    bot.lastReplyError = "No matching posts to reply to";
    await bot.save();
    throw new Error("No matching posts to reply to");
  }

  const { post, book } = pick;
  const { system, user } = buildReplyPrompt(
    bot as unknown as BotDoc,
    book,
    post
  );
  const raw = await groqChat(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { model: bot.model || undefined, temperature: 0.9, maxTokens: 200 }
  );

  const { text: content, sentiment } = extractSentimentAndText(raw, 400);
  if (!content) throw new Error("Empty reply generated");

  const comment = await Comment.create({
    post: post._id,
    author: bot.user,
    parent: null,
    content,
  });

  // Backdate to a natural moment after the post (and after the previous tick)
  // so catch-up replies don't all cluster at `now`.
  const spreadSince = opts?.spreadSince;
  if (spreadSince) {
    const postAt = post.createdAt ? new Date(post.createdAt) : spreadSince;
    const after = postAt > spreadSince ? postAt : spreadSince;
    const when = randomTimeBetween(after, new Date());
    await Comment.collection.updateOne(
      { _id: comment._id },
      { $set: { createdAt: when, updatedAt: when } }
    );
  }

  // Bot also reacts on the post it just replied to.
  await applyBotPostReaction(
    bot.user as unknown as Types.ObjectId,
    post._id,
    sentiment
  );

  bot.lastReplyAt = new Date();
  bot.repliesCount = (bot.repliesCount || 0) + 1;
  bot.lastReplyError = "";
  await bot.save();

  return { comment, post, book, sentiment };
}

// ──────────────────────────────────────────────────────────────────────────────
//  Auto-responses (replying to comments on threads the bot is part of)
// ──────────────────────────────────────────────────────────────────────────────

type CommentLean = {
  _id: Types.ObjectId;
  post: Types.ObjectId;
  parent: Types.ObjectId | null;
  author:
    | Types.ObjectId
    | { _id: Types.ObjectId; username?: string; name?: string; isBot?: boolean };
  content: string;
  createdAt: Date;
};

type PostLean = {
  _id: Types.ObjectId;
  author: Types.ObjectId;
  book: Types.ObjectId;
  content: string;
  createdAt: Date;
};

function authorIdOf(c: CommentLean): string {
  if (c.author && typeof c.author === "object" && "_id" in c.author) {
    return (c.author as { _id: Types.ObjectId })._id.toString();
  }
  return (c.author as Types.ObjectId).toString();
}

/**
 * Find comments in threads where this bot is involved that:
 *   - were authored by NON-bot users,
 *   - the bot has not already replied to (no child with parent = comment._id, author = bot),
 *   - are reasonably recent (last 48h).
 * Returns the oldest unanswered comments first so we mimic FIFO conversation flow.
 */
async function pickCommentsToRespondTo(
  bot: BotDoc,
  limit: number
): Promise<CommentLean[]> {
  const since = new Date(Date.now() - AUTO_RESPOND_LOOKBACK_MS);
  const botUserId = bot.user as unknown as Types.ObjectId;

  // 1) Posts the bot is involved in: authored OR previously commented in.
  const [authoredPosts, myComments] = await Promise.all([
    Post.find({ author: botUserId }).select("_id").lean(),
    Comment.find({ author: botUserId }).select("post").lean(),
  ]);
  const postIdSet = new Set<string>([
    ...authoredPosts.map((p) => (p._id as Types.ObjectId).toString()),
    ...myComments.map((c) =>
      (c as { post: Types.ObjectId }).post.toString()
    ),
  ]);
  if (!postIdSet.size) return [];
  const postIds = Array.from(postIdSet).map((id) => new Types.ObjectId(id));

  // 2) Recent candidate comments by non-bot users, oldest first (FIFO).
  const candidates = (await Comment.find({
    post: { $in: postIds },
    author: { $ne: botUserId },
    createdAt: { $gte: since },
  })
    .sort({ createdAt: 1 })
    .limit(AUTO_RESPOND_BATCH)
    .populate("author", "_id username name isBot")
    .lean()) as unknown as CommentLean[];

  const fromUsers = candidates.filter((c) => {
    if (c.author && typeof c.author === "object" && "isBot" in c.author) {
      return !(c.author as { isBot?: boolean }).isBot;
    }
    return true;
  });
  if (!fromUsers.length) return [];

  // 3) Exclude comments the bot already replied to directly.
  const myReplies = await Comment.find({
    parent: { $in: fromUsers.map((c) => c._id) },
    author: botUserId,
  })
    .select("parent")
    .lean();
  const repliedSet = new Set(
    (myReplies as { parent: Types.ObjectId | null }[])
      .map((r) => r.parent?.toString())
      .filter((v): v is string => Boolean(v))
  );

  const pending = fromUsers.filter(
    (c) => !repliedSet.has(c._id.toString())
  );
  return pending.slice(0, limit);
}

/** Walk parent links to build the conversation chain for a comment. */
async function loadAncestorChain(
  comment: CommentLean,
  maxDepth = 6
): Promise<CommentLean[]> {
  const chain: CommentLean[] = [];
  let current: Types.ObjectId | null = comment.parent;
  while (current && chain.length < maxDepth) {
    const parent = (await Comment.findById(current)
      .populate("author", "_id username name isBot")
      .lean()) as unknown as CommentLean | null;
    if (!parent) break;
    chain.unshift(parent);
    current = parent.parent;
  }
  return chain;
}

function speakerLabel(
  c: CommentLean,
  botUserId: string
): string {
  const id = authorIdOf(c);
  if (id === botUserId) return "you";
  if (c.author && typeof c.author === "object" && "username" in c.author) {
    const u = c.author as { username?: string; name?: string };
    return `@${u.username ?? "reader"}`;
  }
  return "@reader";
}

function buildAutoResponsePrompt(
  bot: BotDoc,
  book: BookContext,
  rootPost: PostLean,
  ancestors: CommentLean[],
  target: CommentLean
) {
  const desc = (book.description || "").slice(0, 500);
  const persona = (bot.persona || "").trim() || "A passionate reader.";
  const botUserId = (bot.user as unknown as Types.ObjectId).toString();
  const targetLabel = speakerLabel(target, botUserId);

  const system = [
    "You are continuing a real conversation in a books community called The Gist Club (TGC).",
    "Voice: stay in character as the persona below. You are replying to one specific message.",
    "Style rules:",
    "- 1 to 2 short sentences, max 240 characters total.",
    "- Casual and human. Engage with what THIS person just said, not the book in general.",
    "- Ask a light follow-up question OR react with a specific opinion. Don't lecture.",
    "- No hashtags. No emojis unless extremely subtle. No quotation marks wrapping the reply.",
    "- Do not mention the book title or author (the thread already shows it).",
    REPLY_TAG_INSTRUCTION,
  ].join("\n");

  const conversation: string[] = [];
  const root = (rootPost.content || "").replace(/\s+/g, " ").trim().slice(0, 300);
  conversation.push(`(you, original post): "${root}"`);
  for (const c of ancestors) {
    const who = speakerLabel(c, botUserId);
    const text = (c.content || "").replace(/\s+/g, " ").trim().slice(0, 220);
    conversation.push(`${who}: "${text}"`);
  }
  const targetText = (target.content || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
  conversation.push(`${targetLabel} (REPLY TO THIS): "${targetText}"`);

  const user = [
    `Persona: ${persona}`,
    "",
    "Book context (for your eyes only — do not name in the reply):",
    `Title: ${book.title}`,
    book.authors ? `Authors: ${book.authors}` : "",
    book.categories ? `Categories: ${book.categories}` : "",
    desc ? `Synopsis: ${desc}` : "",
    "",
    "Conversation so far (oldest → newest):",
    ...conversation,
    "",
    `Write your reply to ${targetLabel} now.`,
  ]
    .filter(Boolean)
    .join("\n");

  return { system, user };
}

export async function generateAutoResponse(
  botId: string,
  commentId: string,
  opts?: { spreadSince?: Date }
) {
  await connectDB();
  const bot = await Bot.findById(botId);
  if (!bot) throw new Error("Bot not found");

  if (!Types.ObjectId.isValid(commentId)) {
    throw new Error("Invalid comment id");
  }
  const target = (await Comment.findById(commentId)
    .populate("author", "_id username name isBot")
    .lean()) as unknown as CommentLean | null;
  if (!target) throw new Error("Comment not found");

  // Skip if commenter is a bot (loop guard).
  if (
    target.author &&
    typeof target.author === "object" &&
    "isBot" in target.author &&
    (target.author as { isBot?: boolean }).isBot
  ) {
    throw new Error("Refusing to auto-respond to another bot");
  }

  const post = (await Post.findById(target.post).lean()) as PostLean | null;
  if (!post) throw new Error("Post not found");
  const book = (await Book.findById(post.book).lean()) as BookContext | null;
  if (!book) throw new Error("Book not found");

  const ancestors = await loadAncestorChain(target);

  const { system, user } = buildAutoResponsePrompt(
    bot as unknown as BotDoc,
    book,
    post,
    ancestors,
    target
  );

  const raw = await groqChat(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { model: bot.model || undefined, temperature: 0.9, maxTokens: 200 }
  );
  const { text: content, sentiment } = extractSentimentAndText(raw, 400);
  if (!content) throw new Error("Empty response generated");

  const reply = await Comment.create({
    post: target.post,
    author: bot.user,
    parent: target._id,
    content,
  });

  // Backdate to a natural moment after the comment it replies to (and after the
  // previous tick) so catch-up responses don't all land at `now`.
  const spreadSince = opts?.spreadSince;
  if (spreadSince) {
    const targetAt = target.createdAt
      ? new Date(target.createdAt)
      : spreadSince;
    const after = targetAt > spreadSince ? targetAt : spreadSince;
    const when = randomTimeBetween(after, new Date());
    await Comment.collection.updateOne(
      { _id: reply._id },
      { $set: { createdAt: when, updatedAt: when } }
    );
  }

  // Bot reacts to the COMMENT it just responded to (more specific than the
  // post in this thread). Skip if somehow the target is the bot itself.
  const botUserId = bot.user as unknown as Types.ObjectId;
  if (authorIdOf(target) !== botUserId.toString()) {
    await applyBotCommentReaction(botUserId, target._id, sentiment);
  }

  bot.lastReplyAt = new Date();
  bot.repliesCount = (bot.repliesCount || 0) + 1;
  bot.lastReplyError = "";
  await bot.save();

  return { reply, target, post, book, sentiment };
}

export async function dueBots(now = new Date()) {
  await connectDB();
  return Bot.find({
    enabled: true,
    $or: [{ nextPostAt: { $exists: false } }, { nextPostAt: { $lte: now } }],
  }).lean();
}

export async function runBotTick(): Promise<{
  processed: number;
  errors: { botId: string; message: string }[];
  replies: number;
  replyErrors: { botId: string; message: string }[];
  responses: number;
  responseErrors: { botId: string; message: string }[];
  /** Enabled bots still overdue after this tick (catch-up continues next tick). */
  stillDue?: number;
  skippedDueToLock?: boolean;
}> {
  await connectDB();
  const now = new Date();

  // Acquire a distributed lock so concurrent invocations (manual click + cron
  // + retries) don't process the same due bots in parallel.
  await BotTickLock.updateOne(
    { _id: "global" },
    { $setOnInsert: { lockedUntil: new Date(0) } },
    { upsert: true }
  );
  const lock = await BotTickLock.findOneAndUpdate(
    { _id: "global", lockedUntil: { $lte: now } },
    {
      $set: {
        lockedUntil: new Date(now.getTime() + TICK_LOCK_MS),
        lastStartedAt: now,
      },
    },
    { new: true }
  ).lean();
  if (!lock) {
    return {
      processed: 0,
      errors: [],
      replies: 0,
      replyErrors: [],
      responses: 0,
      responseErrors: [],
      skippedDueToLock: true,
    };
  }

  // How long since the previous completed tick — used to spread/scale reply
  // catch-up so an infrequent (e.g. once-a-day) tick looks like a natural day's
  // worth of activity rather than a burst at `now`. Clamped to the last 24 h.
  const windowStart = new Date(
    Math.max(
      lock.lastFinishedAt
        ? new Date(lock.lastFinishedAt).getTime()
        : now.getTime() - DEFAULT_WINDOW_MS,
      now.getTime() - MAX_CATCHUP_WINDOW_MS
    )
  );
  const virtualTicks = Math.min(
    MAX_VIRTUAL_TICKS,
    Math.max(1, Math.round((now.getTime() - windowStart.getTime()) / 60_000))
  );
  const tickStart = Date.now();
  const overBudget = () => Date.now() - tickStart > TICK_BUDGET_MS;
  // Rate-limit pause before the NEXT LLM call. Skipped once the budget is spent
  // (the loops exit anyway, so there is no next call to pace).
  const pace = async () => {
    if (!overBudget()) await sleep(SLEEP_BETWEEN_LLM_MS);
  };

  try {
    // 1) Posting pass — backfill each due bot's missed slots at their natural
    //    scheduled times (backdated) so posts don't all land at `now`.
    const due = await Bot.find({
      enabled: true,
      $or: [{ nextPostAt: { $exists: false } }, { nextPostAt: { $lte: now } }],
    })
      .sort({ nextPostAt: 1, _id: 1 })
      .limit(20)
      .lean();

    const errors: { botId: string; message: string }[] = [];
    let processed = 0;

    for (const doc of due) {
      if (overBudget() || processed >= MAX_POSTS_PER_TICK) break;
      const id = (doc._id as Types.ObjectId).toString();
      const slots = buildCatchUpSlots(doc as unknown as BotDoc, now);
      try {
        for (const slot of slots) {
          if (processed >= MAX_POSTS_PER_TICK || overBudget()) break;
          await generatePostForBot(id, { postedAt: slot });
          processed += 1;
          await pace();
        }
        // generatePostForBot rolls nextPostAt forward from each slot; if the
        // final roll (or an early exit on budget) left the schedule in the
        // past, jump to a fresh future slot so the next tick starts clean.
        const fresh = await Bot.findById(id).select("nextPostAt").lean();
        if (!fresh?.nextPostAt || new Date(fresh.nextPostAt) <= now) {
          await Bot.findByIdAndUpdate(id, {
            nextPostAt: rollNextPostAt(doc as unknown as BotDoc, now),
          });
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        errors.push({ botId: id, message });
        await Bot.findByIdAndUpdate(id, {
          lastError: message.slice(0, 500),
          nextPostAt: new Date(Date.now() + 15 * 60 * 1000),
        });
      }
    }

    // 2) Replying pass — scale expected volume to the elapsed window and backdate
    //    each reply to a natural moment within it.
    const replyErrors: { botId: string; message: string }[] = [];
    let replies = 0;
    const replyBots = (await Bot.find({
      enabled: true,
      replyEnabled: true,
    }).lean()) as unknown as BotDoc[];

    for (const doc of replyBots) {
      if (overBudget()) break;
      const chance = doc.replyChancePerTick ?? 20;
      if (chance <= 0) continue;

      // Expected replies across the window ≈ per-tick probability × virtual ticks.
      const expected =
        (chance / 100) * virtualTicks * Math.max(1, doc.repliesPerTick ?? 1);
      let target = Math.min(MAX_REPLIES_PER_BOT_PER_TICK, Math.floor(expected));
      const frac = expected - Math.floor(expected);
      if (target < MAX_REPLIES_PER_BOT_PER_TICK && Math.random() < frac) {
        target += 1;
      }
      if (target < 1) continue;

      if ((doc.replyDailyLimit ?? 0) > 0) {
        const since = new Date(Date.now() - 24 * 3_600_000);
        const todayCount = await Comment.countDocuments({
          author: doc.user,
          createdAt: { $gte: since },
        });
        const remaining = (doc.replyDailyLimit ?? 0) - todayCount;
        if (remaining <= 0) continue;
        target = Math.min(target, remaining);
      }

      for (let i = 0; i < target; i++) {
        if (overBudget()) break;
        try {
          await generateReplyForBot((doc._id as Types.ObjectId).toString(), {
            spreadSince: windowStart,
          });
          replies += 1;
          await pace();
        } catch (e) {
          const message = e instanceof Error ? e.message : "Unknown error";
          replyErrors.push({
            botId: (doc._id as Types.ObjectId).toString(),
            message,
          });
          await Bot.findByIdAndUpdate(doc._id, {
            lastReplyError: message.slice(0, 500),
          });
          // Stop hammering this bot if it failed; try again next tick.
          break;
        }
      }
    }

    // 3) Auto-response pass — bots respond to NEW comments in threads they're in.
    const responseErrors: { botId: string; message: string }[] = [];
    let responses = 0;
    const respondingBots = (await Bot.find({
      enabled: true,
      autoRespondToComments: true,
    }).lean()) as unknown as BotDoc[];

    for (const doc of respondingBots) {
      if (overBudget()) break;
      const max = Math.max(0, Math.min(10, doc.autoRespondPerTick ?? 3));
      if (max === 0) continue;
      const botId = (doc._id as Types.ObjectId).toString();

      try {
        const pending = await pickCommentsToRespondTo(doc, max);
        for (const c of pending) {
          if (overBudget()) break;
          try {
            await generateAutoResponse(botId, c._id.toString(), {
              spreadSince: windowStart,
            });
            responses += 1;
            await pace();
          } catch (e) {
            const message = e instanceof Error ? e.message : "Unknown error";
            responseErrors.push({ botId, message });
            await Bot.findByIdAndUpdate(doc._id, {
              lastReplyError: message.slice(0, 500),
            });
            break;
          }
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        responseErrors.push({ botId, message });
      }
    }

    const stillDue = await Bot.countDocuments({
      enabled: true,
      $or: [
        { nextPostAt: { $exists: false } },
        { nextPostAt: { $lte: new Date() } },
      ],
    });

    return {
      processed,
      errors,
      replies,
      replyErrors,
      responses,
      responseErrors,
      stillDue,
    };
  } finally {
    await BotTickLock.updateOne(
      { _id: "global" },
      { $set: { lockedUntil: new Date(0), lastFinishedAt: new Date() } }
    );
  }
}

export const MIN_TICK_GAP_MS = MIN_GAP_MS;
