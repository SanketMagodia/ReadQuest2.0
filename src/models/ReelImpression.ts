import mongoose, { Schema, models, model } from "mongoose";

/**
 * What the reader did with a card:
 * - `served` — it reached the top of their reel
 * - `skipped` — they swiped past it
 * - `read`   — they opened the summary and got through it
 * - `saved`  — it went onto a shelf from the reel
 */
export type ReelAction = "served" | "skipped" | "read" | "saved";

export type ReelImpressionDoc = {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  book: mongoose.Types.ObjectId;
  action: ReelAction;
  /** Seconds spent on the card, when the client reports it. */
  dwellSeconds: number;
  createdAt: Date;
  updatedAt: Date;
};

const reelImpressionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    book: { type: Schema.Types.ObjectId, ref: "Book", required: true, index: true },
    action: {
      type: String,
      enum: ["served", "skipped", "read", "saved"],
      default: "served",
    },
    dwellSeconds: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// One row per reader/book: a card is never served twice, and a later `read`
// simply overwrites the earlier `served`.
reelImpressionSchema.index({ user: 1, book: 1 }, { unique: true });
reelImpressionSchema.index({ user: 1, updatedAt: -1 });

const ReelImpressionModel =
  (models.ReelImpression as mongoose.Model<ReelImpressionDoc> | undefined) ??
  model<ReelImpressionDoc>("ReelImpression", reelImpressionSchema);

export default ReelImpressionModel as mongoose.Model<ReelImpressionDoc>;
