import { Types } from "mongoose";

type PopulatedUser = {
  _id: Types.ObjectId;
  username: string;
  name: string;
  bio?: string;
  image?: string;
};

type RawBot = {
  _id: Types.ObjectId;
  user: PopulatedUser | Types.ObjectId | null;
  enabled: boolean;
  persona: string;
  categories: string[];
  intervalMinMinutes: number;
  intervalMaxMinutes: number;
  model?: string;
  postsCount?: number;
  lastPostAt?: Date;
  nextPostAt?: Date;
  lastError?: string;
  createdAt?: Date;
  updatedAt?: Date;

  replyEnabled?: boolean;
  replyCategories?: string[];
  replyChancePerTick?: number;
  repliesPerTick?: number;
  replyDailyLimit?: number;
  autoRespondToComments?: boolean;
  autoRespondPerTick?: number;
  repliesCount?: number;
  lastReplyAt?: Date;
  lastReplyError?: string;
};

export type BotDTO = {
  id: string;
  enabled: boolean;
  persona: string;
  categories: string[];
  intervalMinMinutes: number;
  intervalMaxMinutes: number;
  model: string;
  postsCount: number;
  lastPostAt: string | null;
  nextPostAt: string | null;
  lastError: string;
  createdAt: string | null;

  replyEnabled: boolean;
  replyCategories: string[];
  replyChancePerTick: number;
  repliesPerTick: number;
  replyDailyLimit: number;
  autoRespondToComments: boolean;
  autoRespondPerTick: number;
  repliesCount: number;
  lastReplyAt: string | null;
  lastReplyError: string;

  user: {
    id: string;
    username: string;
    name: string;
    bio: string;
    image: string;
  };
};

function isPopulatedUser(value: unknown): value is PopulatedUser {
  return (
    typeof value === "object" &&
    value !== null &&
    "username" in (value as Record<string, unknown>)
  );
}

export function serializeBot(b: RawBot): BotDTO {
  const userObj = isPopulatedUser(b.user) ? b.user : null;
  return {
    id: b._id.toString(),
    enabled: Boolean(b.enabled),
    persona: b.persona ?? "",
    categories: Array.isArray(b.categories) ? b.categories : [],
    intervalMinMinutes: b.intervalMinMinutes ?? 180,
    intervalMaxMinutes: b.intervalMaxMinutes ?? 360,
    model: b.model ?? "",
    postsCount: b.postsCount ?? 0,
    lastPostAt: b.lastPostAt ? new Date(b.lastPostAt).toISOString() : null,
    nextPostAt: b.nextPostAt ? new Date(b.nextPostAt).toISOString() : null,
    lastError: b.lastError ?? "",
    createdAt: b.createdAt ? new Date(b.createdAt).toISOString() : null,

    replyEnabled: Boolean(b.replyEnabled),
    replyCategories: Array.isArray(b.replyCategories) ? b.replyCategories : [],
    replyChancePerTick: b.replyChancePerTick ?? 20,
    repliesPerTick: b.repliesPerTick ?? 1,
    replyDailyLimit: b.replyDailyLimit ?? 12,
    autoRespondToComments: b.autoRespondToComments ?? true,
    autoRespondPerTick: b.autoRespondPerTick ?? 3,
    repliesCount: b.repliesCount ?? 0,
    lastReplyAt: b.lastReplyAt ? new Date(b.lastReplyAt).toISOString() : null,
    lastReplyError: b.lastReplyError ?? "",

    user: {
      id: userObj?._id.toString() ?? "",
      username: userObj?.username ?? "",
      name: userObj?.name ?? "",
      bio: userObj?.bio ?? "",
      image: userObj?.image ?? "",
    },
  };
}
