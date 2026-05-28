import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

/** Admin-authored broadcast shown in the wide-layout right rail or the
 *  compact-layout feed — not mixed into the personal notification inbox. */
const announcementSchema = new Schema(
  {
    title: { type: String, required: true, maxlength: 120, trim: true },
    body: { type: String, required: true, maxlength: 600, trim: true },
    link: { type: String, default: "", maxlength: 500, trim: true },
    linkLabel: { type: String, default: "", maxlength: 40, trim: true },
    active: { type: Boolean, default: true, index: true },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

announcementSchema.index({ active: 1, createdAt: -1 });

export type AnnouncementDoc = InferSchemaType<typeof announcementSchema> & {
  _id: mongoose.Types.ObjectId;
};

const AnnouncementModel =
  models.Announcement ?? model("Announcement", announcementSchema);

export default AnnouncementModel;
