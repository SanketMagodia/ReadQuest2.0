import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

const userBookSummarySchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    book: {
      type: Schema.Types.ObjectId,
      ref: "Book",
      required: true,
      index: true,
    },
    content: { type: String, required: true },
    prompt: { type: String, default: "" },
    model: { type: String, default: "" },
    wordCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// A user has at most ONE personal summary per book — regenerating overwrites it.
userBookSummarySchema.index({ user: 1, book: 1 }, { unique: true });

export type UserBookSummaryDoc = InferSchemaType<typeof userBookSummarySchema> & {
  _id: mongoose.Types.ObjectId;
};

const UserBookSummaryModel =
  models.UserBookSummary ?? model("UserBookSummary", userBookSummarySchema);

export default UserBookSummaryModel;
