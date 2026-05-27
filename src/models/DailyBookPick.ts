import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

const dailyBookPickSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    book: { type: Schema.Types.ObjectId, ref: "Book", required: true, index: true },
    /** UTC day string `YYYY-MM-DD`. */
    day: { type: String, required: true, index: true },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date },
    /** Furthest page index the reader has flipped to (for resume + progress). */
    farthestPage: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// One pick per user per day. Look-ups are always `(user, day)`.
dailyBookPickSchema.index({ user: 1, day: 1 }, { unique: true });

export type DailyBookPickDoc = InferSchemaType<typeof dailyBookPickSchema> & {
  _id: mongoose.Types.ObjectId;
};

const DailyBookPickModel =
  models.DailyBookPick ?? model("DailyBookPick", dailyBookPickSchema);

export default DailyBookPickModel;
