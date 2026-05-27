import mongoose, { Schema, models, model } from "mongoose";

const bookFollowSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    book: { type: Schema.Types.ObjectId, ref: "Book", required: true },
  },
  { timestamps: true }
);

bookFollowSchema.index({ user: 1, book: 1 }, { unique: true });

const BookFollowModel = models.BookFollow ?? model("BookFollow", bookFollowSchema);

export default BookFollowModel;
