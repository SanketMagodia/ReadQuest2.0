import { Types } from "mongoose";
import connectDB from "@/lib/db";
import Book, { type BookDoc } from "@/models/Book";
import BookFollow from "@/models/BookFollow";
import ReadList from "@/models/ReadList";
import BookSummary from "@/models/BookSummary";
import DailyBookPick from "@/models/DailyBookPick";
import UserStreak from "@/models/UserStreak";

// ─── time helpers (UTC) ──────────────────────────────────────────────────────

export function utcDay(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function dayDiff(a: string, b: string): number {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.round(
    (Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000
  );
}

// ─── book picker ─────────────────────────────────────────────────────────────

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function topCategoriesFromBooks(books: { categories?: string }[]): string[] {
  const freq: Record<string, number> = {};
  for (const b of books) {
    for (const c of (b.categories || "")
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean)) {
      freq[c] = (freq[c] || 0) + 1;
    }
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([c]) => c);
}

async function pickBookForUser(userId: string): Promise<BookDoc | null> {
  await connectDB();

  const [follows, readlist, pastPicks, summaries] = await Promise.all([
    BookFollow.find({ user: userId }).select("book").lean(),
    ReadList.find({ user: userId }).select("book").lean(),
    DailyBookPick.find({ user: userId }).select("book").lean(),
    BookSummary.find().select("book").lean(),
  ]);

  const followedIds = follows.map((f) => f.book.toString());
  const readlistIds = readlist.map((r) => r.book.toString());
  const pastIds = pastPicks.map((p) => p.book.toString());
  const summarizedIds = new Set(summaries.map((s) => s.book.toString()));

  const excluded = new Set<string>([
    ...followedIds,
    ...readlistIds,
    ...pastIds,
  ]);
  const excludedObjectIds = Array.from(excluded).map(
    (id) => new Types.ObjectId(id)
  );

  // Build affinity from books the user already engages with.
  const affinityIds = Array.from(new Set([...followedIds, ...readlistIds])).map(
    (id) => new Types.ObjectId(id)
  );

  let topCategories: string[] = [];
  if (affinityIds.length) {
    const affinityBooks = await Book.find({ _id: { $in: affinityIds } })
      .select("categories")
      .lean();
    topCategories = topCategoriesFromBooks(affinityBooks);
  }

  /**
   * Try a pool of candidates, prefer those that already have a summary cached
   * so the daily read loads instantly.
   */
  const pickFromQuery = async (filter: Record<string, unknown>) => {
    const pool = (await Book.find({
      ...filter,
      _id: { $nin: excludedObjectIds },
      description: { $exists: true, $ne: "" },
    })
      .sort({ ratingsCount: -1, averageRating: -1 })
      .limit(60)
      .lean()) as BookDoc[];

    if (!pool.length) return null;

    const withSummary = pool.filter((b) =>
      summarizedIds.has(b._id.toString())
    );
    const choices = withSummary.length ? withSummary : pool;

    // Shuffle the top slice so each day feels fresh — but stable within the
    // same call.
    const top = choices.slice(0, 20);
    return top[Math.floor(Math.random() * top.length)] ?? null;
  };

  // Tier 1: category-aligned candidate.
  if (topCategories.length) {
    const catRegex = new RegExp(
      topCategories.map(escapeRegex).join("|"),
      "i"
    );
    const found = await pickFromQuery({ categories: { $regex: catRegex } });
    if (found) return found;
  }

  // Tier 2: popular fallback.
  return pickFromQuery({});
}

// ─── pick assignment ─────────────────────────────────────────────────────────

export type DailyPickWithBook = {
  id: string;
  day: string;
  completed: boolean;
  farthestPage: number;
  book: {
    id: string;
    slug: string;
    title: string;
    authors: string;
    thumbnail: string;
    description: string;
    categories: string;
  };
};

export async function getOrCreateTodayPick(
  userId: string
): Promise<DailyPickWithBook | null> {
  await connectDB();
  const today = utcDay();

  // Existing first.
  const existing = await DailyBookPick.findOne({ user: userId, day: today })
    .populate("book", "title authors thumbnail description categories slug")
    .lean();
  if (existing) return serializePick(existing);

  // Otherwise pick + insert (handles race via unique index).
  const book = await pickBookForUser(userId);
  if (!book) return null;

  try {
    await DailyBookPick.create({ user: userId, day: today, book: book._id });
  } catch (err: unknown) {
    // Duplicate key — another request beat us; just refetch.
    const code = (err as { code?: number }).code;
    if (code !== 11000) throw err;
  }

  const created = await DailyBookPick.findOne({ user: userId, day: today })
    .populate("book", "title authors thumbnail description categories slug")
    .lean();
  return created ? serializePick(created) : null;
}

type PopulatedBook = {
  _id: Types.ObjectId;
  slug?: string;
  title: string;
  authors?: string;
  thumbnail?: string;
  description?: string;
  categories?: string;
};

type LeanPick = {
  _id: Types.ObjectId;
  day: string;
  completed: boolean;
  farthestPage?: number;
  book: PopulatedBook;
};

function serializePick(p: LeanPick): DailyPickWithBook {
  return {
    id: p._id.toString(),
    day: p.day,
    completed: !!p.completed,
    farthestPage: p.farthestPage ?? 0,
    book: {
      id: p.book._id.toString(),
      slug: p.book.slug ?? p.book._id.toString(),
      title: p.book.title,
      authors: p.book.authors ?? "",
      thumbnail: p.book.thumbnail ?? "",
      description: p.book.description ?? "",
      categories: p.book.categories ?? "",
    },
  };
}

// ─── streak ──────────────────────────────────────────────────────────────────

export type StreakState = {
  current: number;
  longest: number;
  lastDay: string;
  totalCompleted: number;
  /** Today (UTC) for convenience to the client. */
  today: string;
  /** True if a completion today has already been recorded. */
  completedToday: boolean;
};

/** Read-only streak snapshot for displaying another user's profile — never
 *  mutates (no upsert / reset writes). */
export async function peekStreak(
  userId: string
): Promise<{ current: number; longest: number }> {
  await connectDB();
  const s = await UserStreak.findOne({ user: userId }).lean<{
    current?: number;
    longest?: number;
    lastDay?: string;
  } | null>();
  if (!s) return { current: 0, longest: 0 };
  const today = utcDay();
  const live = s.lastDay && dayDiff(today, s.lastDay) <= 1 ? s.current ?? 0 : 0;
  return { current: live, longest: s.longest ?? 0 };
}

export async function getStreakState(userId: string): Promise<StreakState> {
  await connectDB();
  const today = utcDay();

  // Upsert empty streak doc if first-time user.
  let streak = await UserStreak.findOne({ user: userId });
  if (!streak) {
    streak = await UserStreak.create({
      user: userId,
      current: 0,
      longest: 0,
      lastDay: "",
      totalCompleted: 0,
    });
  }

  // Lazy reset — if more than one day has passed since lastDay, the chain is
  // broken. Persist so future writes start from zero.
  if (streak.lastDay && dayDiff(today, streak.lastDay) > 1) {
    streak.current = 0;
    await streak.save();
  }

  // Display value: streak only counts if last completion is today or yesterday.
  const liveCurrent =
    streak.lastDay && dayDiff(today, streak.lastDay) <= 1 ? streak.current : 0;

  return {
    current: liveCurrent,
    longest: streak.longest,
    lastDay: streak.lastDay,
    totalCompleted: streak.totalCompleted,
    today,
    completedToday: streak.lastDay === today,
  };
}

export async function markTodayComplete(
  userId: string
): Promise<StreakState> {
  await connectDB();
  const today = utcDay();

  // Make sure stale streaks are reset before we mutate.
  await getStreakState(userId);

  const streak = await UserStreak.findOne({ user: userId });
  if (!streak) {
    // Shouldn't happen because getStreakState creates it, but be safe.
    return getStreakState(userId);
  }

  let alreadyCounted = false;
  if (streak.lastDay === today) {
    alreadyCounted = true;
  } else if (streak.lastDay && dayDiff(today, streak.lastDay) === 1) {
    streak.current += 1;
  } else {
    streak.current = 1;
  }

  if (!alreadyCounted) {
    streak.lastDay = today;
    streak.longest = Math.max(streak.longest, streak.current);
    streak.totalCompleted += 1;
    await streak.save();
  }

  // Mark the actual pick as completed too.
  await DailyBookPick.updateOne(
    { user: userId, day: today },
    { $set: { completed: true, completedAt: new Date() } }
  );

  return {
    current: streak.current,
    longest: streak.longest,
    lastDay: streak.lastDay,
    totalCompleted: streak.totalCompleted,
    today,
    completedToday: true,
  };
}
