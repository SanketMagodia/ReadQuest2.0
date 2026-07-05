import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

const botSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    enabled: { type: Boolean, default: false, index: true },
    persona: { type: String, default: "", maxlength: 1200 },
    categories: { type: [String], default: [] },
    // Posting cadence, stored in minutes (admin UI presents it in days).
    // Max 30 days between posts.
    intervalMinMinutes: { type: Number, default: 1440, min: 10, max: 30 * 24 * 60 },
    intervalMaxMinutes: { type: Number, default: 4320, min: 10, max: 30 * 24 * 60 },
    model: { type: String, default: "" },
    postsCount: { type: Number, default: 0 },
    lastPostAt: { type: Date },
    nextPostAt: { type: Date },
    lastError: { type: String, default: "" },

    // ---- Replying (commenting) configuration ----
    // When true, the scheduler may proactively reply to OTHER users' posts.
    replyEnabled: { type: Boolean, default: false, index: true },
    // If empty, falls back to `categories` for "which posts to reply on".
    replyCategories: { type: [String], default: [] },
    // Probability (0-100) per scheduler tick that this bot tries to reply.
    replyChancePerTick: { type: Number, default: 20, min: 0, max: 100 },
    // Max replies generated within one successful tick (1-3).
    repliesPerTick: { type: Number, default: 1, min: 1, max: 3 },
    // Soft cap on replies in the last rolling 24h. 0 disables the cap.
    replyDailyLimit: { type: Number, default: 12, min: 0, max: 200 },

    // When true, the bot also responds to NEW comments on threads it is part
    // of (its own posts, or threads it has already commented in). Independent
    // of the proactive `replyEnabled` flag above.
    autoRespondToComments: { type: Boolean, default: true, index: true },
    // Max auto-responses per tick (to avoid runaway threads).
    autoRespondPerTick: { type: Number, default: 3, min: 0, max: 10 },

    repliesCount: { type: Number, default: 0 },
    lastReplyAt: { type: Date },
    lastReplyError: { type: String, default: "" },
  },
  { timestamps: true }
);

export type BotDoc = InferSchemaType<typeof botSchema> & {
  _id: mongoose.Types.ObjectId;
};

const BotModel = models.Bot ?? model("Bot", botSchema);

export default BotModel;
