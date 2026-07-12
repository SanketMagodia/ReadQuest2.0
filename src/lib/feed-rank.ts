export type RankedCandidate = {
  id: string;
  authorId: string;
  score: number;
};

/**
 * Pick up to `limit` posts while keeping the same author from appearing back-to-
 * back (and within `minGap` slots). Higher-scored items are preferred; when every
 * remaining candidate would cluster, we take the best one anyway so the feed
 * doesn't stall.
 */
export function spreadByAuthor(
  candidates: RankedCandidate[],
  limit: number,
  minGap = 2
): RankedCandidate[] {
  if (!candidates.length || limit <= 0) return [];

  const pool = [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.id < b.id ? 1 : -1;
  });

  const picked: RankedCandidate[] = [];
  const gap = Math.max(1, minGap);

  while (picked.length < limit && pool.length) {
    const blocked = new Set(
      picked.slice(Math.max(0, picked.length - gap)).map((p) => p.authorId)
    );

    const idx = pool.findIndex((item) => !blocked.has(item.authorId));
    if (idx >= 0) {
      picked.push(pool.splice(idx, 1)[0]!);
    } else {
      picked.push(pool.shift()!);
    }
  }

  return picked;
}
