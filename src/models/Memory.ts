import mongoose, { Schema, models, model } from "mongoose";

export type MemoryKind = "quote" | "note";

export type MemoryDoc = {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  book?: mongoose.Types.ObjectId | null;
  kind: MemoryKind;
  /** The line the reader wanted to keep. */
  quote: string;
  /** Why it stuck — the reader's own words. */
  note: string;
  page?: number | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * A private keepsake: a line, a passage, or a thought a reader wants to hold
 * onto. Never exposed to anyone but its owner — every query must be scoped by
 * `user`, and there is no public read path.
 */
const memorySchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    book: { type: Schema.Types.ObjectId, ref: "Book", default: null },
    kind: { type: String, enum: ["quote", "note"], default: "quote" },
    quote: { type: String, default: "", maxlength: 2000, trim: true },
    note: { type: String, default: "", maxlength: 2000, trim: true },
    page: { type: Number, default: null },
  },
  { timestamps: true }
);

memorySchema.index({ user: 1, createdAt: -1 });
memorySchema.index({ user: 1, book: 1 });

const MemoryModel =
  (models.Memory as mongoose.Model<MemoryDoc> | undefined) ??
  model<MemoryDoc>("Memory", memorySchema);

export default MemoryModel as mongoose.Model<MemoryDoc>;
