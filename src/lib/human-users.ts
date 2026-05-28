import type { Types } from "mongoose";
import Bot from "@/models/Bot";

/** User ids that own a row in the Bot collection (source of truth). */
export async function getBotUserIds(): Promise<Types.ObjectId[]> {
  return Bot.distinct("user");
}

/**
 * Mongo filter for real human accounts. Excludes both `isBot: true` and any
 * user linked from the Bot collection — some legacy bot rows predate the
 * isBot flag and would otherwise slip into "new readers" counts.
 */
export function humanUserFilter(botUserIds: Types.ObjectId[]) {
  return {
    isBot: { $ne: true },
    _id: { $nin: botUserIds },
  } as const;
}
