import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

/** One line in a club's chat room. Mirrors `Message`, but keyed to a club. */
const clubMessageSchema = new Schema(
  {
    club: {
      type: Schema.Types.ObjectId,
      ref: "Club",
      required: true,
      index: true,
    },
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true, maxlength: 1500, trim: true },
  },
  { timestamps: true }
);

clubMessageSchema.index({ club: 1, _id: -1 });

export type ClubMessageDoc = InferSchemaType<typeof clubMessageSchema> & {
  _id: mongoose.Types.ObjectId;
};

const ClubMessageModel =
  models.ClubMessage ?? model("ClubMessage", clubMessageSchema);

export default ClubMessageModel;
