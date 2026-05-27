import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

const bookSummarySchema = new Schema(
  {
    book: {
      type: Schema.Types.ObjectId,
      ref: "Book",
      required: true,
      unique: true,
      index: true,
    },
    content: { type: String, required: true },
    prompt: { type: String, default: "" },
    model: { type: String, default: "" },
    generatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    wordCount: { type: Number, default: 0 },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export type BookSummaryDoc = InferSchemaType<typeof bookSummarySchema> & {
  _id: mongoose.Types.ObjectId;
};

const BookSummaryModel =
  models.BookSummary ?? model("BookSummary", bookSummarySchema);

export default BookSummaryModel;
