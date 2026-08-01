import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

/**
 * A book the club has finished — its shelf, below the top rack. Written when
 * the owner moves the current book on, so the shelf is a history of what the
 * club has read together.
 */
const clubShelfEntrySchema = new Schema(
  {
    club: {
      type: Schema.Types.ObjectId,
      ref: "Club",
      required: true,
      index: true,
    },
    book: { type: Schema.Types.ObjectId, ref: "Book", required: true },
    finishedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

clubShelfEntrySchema.index({ club: 1, book: 1 }, { unique: true });
clubShelfEntrySchema.index({ club: 1, finishedAt: -1 });

export type ClubShelfEntryDoc = InferSchemaType<typeof clubShelfEntrySchema> & {
  _id: mongoose.Types.ObjectId;
};

const ClubShelfEntryModel =
  models.ClubShelfEntry ?? model("ClubShelfEntry", clubShelfEntrySchema);

export default ClubShelfEntryModel;
