import mongoose, { Schema, models, model } from "mongoose";

const readListSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    book: { type: Schema.Types.ObjectId, ref: "Book", required: true },
  },
  { timestamps: true }
);

readListSchema.index({ user: 1, book: 1 }, { unique: true });

const ReadListModel = models.ReadList ?? model("ReadList", readListSchema);

export default ReadListModel;
