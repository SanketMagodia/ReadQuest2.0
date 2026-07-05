import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

/**
 * One row per friend pair. `pairKey` is the sorted ObjectId tuple from
 * `lib/friends.pairKey` so lookups are deterministic regardless of who
 * opened the thread first.
 */
const conversationSchema = new Schema(
  {
    pairKey: { type: String, required: true, unique: true, index: true },
    participants: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      required: true,
      validate: {
        validator: (v: unknown[]) => Array.isArray(v) && v.length === 2,
        message: "Conversation must have exactly two participants",
      },
    },
    lastMessageAt: { type: Date, index: true },
    lastPreview: { type: String, default: "", maxlength: 220, trim: true },
    lastSender: { type: Schema.Types.ObjectId, ref: "User" },
    /** Per-user unread counts — keys are user ObjectId strings. */
    unread: {
      type: Map,
      of: Number,
      default: () => new Map(),
    },
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1, lastMessageAt: -1 });

export type ConversationDoc = InferSchemaType<typeof conversationSchema> & {
  _id: mongoose.Types.ObjectId;
};

const ConversationModel =
  models.Conversation ?? model("Conversation", conversationSchema);

export default ConversationModel;
