import mongoose, { Schema, models, model } from "mongoose";

export type ReadStatus = "want" | "read";
export type ReadListDoc = {
  user: mongoose.Types.ObjectId;
  book: mongoose.Types.ObjectId;
  status: ReadStatus;
  completedAt?: Date | null;
};

const readListSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    book: { type: Schema.Types.ObjectId, ref: "Book", required: true },
    status: {
      type: String,
      enum: ["want", "read"],
      default: "want",
      required: true,
      index: true,
    },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

readListSchema.index({ user: 1, book: 1 }, { unique: true });

const existingReadListModel = models.ReadList as
  | mongoose.Model<ReadListDoc>
  | undefined;
if (existingReadListModel) {
  if (!existingReadListModel.schema.path("status")) {
    existingReadListModel.schema.add({
      status: {
        type: String,
        enum: ["want", "read"],
        default: "want",
        required: true,
        index: true,
      },
    });
  }
  if (!existingReadListModel.schema.path("completedAt")) {
    existingReadListModel.schema.add({ completedAt: { type: Date, default: null } });
  }
}

const ReadListModel =
  existingReadListModel ?? model<ReadListDoc>("ReadList", readListSchema);

export default ReadListModel as mongoose.Model<ReadListDoc>;
