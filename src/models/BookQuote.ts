import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

/**
 * One short, inspiring line per book, cached so the daily quest can show it
 * without paying for a model call on every page load.
 *
 * `verbatim` records whether the line is an actual sentence from the book or a
 * distilled takeaway. We never present the second kind inside quotation marks,
 * so readers are not shown an invented quote as if the author wrote it.
 */
const bookQuoteSchema = new Schema(
  {
    book: {
      type: Schema.Types.ObjectId,
      ref: "Book",
      required: true,
      unique: true,
      index: true,
    },
    text: { type: String, required: true },
    verbatim: { type: Boolean, default: false },
    model: { type: String, default: "" },
  },
  { timestamps: true }
);

export type BookQuoteDoc = InferSchemaType<typeof bookQuoteSchema> & {
  _id: mongoose.Types.ObjectId;
};

const BookQuoteModel = models.BookQuote ?? model("BookQuote", bookQuoteSchema);

export default BookQuoteModel;
