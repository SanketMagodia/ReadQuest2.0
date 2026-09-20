/**
 * Mongo filter for real human accounts.
 *
 * The `isBot` flag is all that's left of the old AI-persona system — the Bot
 * collection is gone, but existing accounts still carry the flag and must stay
 * out of reader counts.
 */
export function humanUserFilter() {
  return { isBot: { $ne: true } } as const;
}
