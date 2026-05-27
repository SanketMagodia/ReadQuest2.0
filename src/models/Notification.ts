import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

/**
 * One notification row per discrete event. We keep the link, message, and
 * preview pre-computed at write time so the read path is a single index hit
 * with no joins required (we only populate the actor for their avatar).
 */
const notificationSchema = new Schema(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    actor: { type: Schema.Types.ObjectId, ref: "User" },
    type: { type: String, required: true },
    /** Where clicking the notification should navigate. */
    link: { type: String, required: true },
    /**
     * Short human-readable message. Pre-computed so the list endpoint
     * doesn't have to join the actor for text — just for the avatar.
     */
    message: { type: String, required: true },
    /** Optional short preview of the post/comment content. */
    preview: { type: String, default: "" },
    /** Optional reference to the book this notification relates to. */
    book: { type: Schema.Types.ObjectId, ref: "Book" },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

export type NotificationDoc = InferSchemaType<typeof notificationSchema> & {
  _id: mongoose.Types.ObjectId;
};

const NotificationModel =
  models.Notification ?? model("Notification", notificationSchema);

export default NotificationModel;
