import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

/**
 * A single friendship row covers both the pending request and the accepted
 * connection. We always store the relationship as a directed edge — the user
 * who clicked "Send request" is the requester — so we can drive the request
 * inbox without an extra join. On accept, status flips to "accepted" and the
 * pair (regardless of direction) is treated as a symmetric friendship by the
 * query helpers in `lib/friends.ts`.
 */
const friendshipSchema = new Schema(
  {
    requester: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted"],
      default: "pending",
      index: true,
    },
    /** When the request flipped from pending → accepted. */
    acceptedAt: { type: Date },
  },
  { timestamps: true }
);

// One request per directed pair. Two rows can exist briefly if both users send
// at the same time — the accept handler reconciles by deleting the duplicate.
friendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });
// Fast inbox queries: "give me my pending requests".
friendshipSchema.index({ recipient: 1, status: 1, createdAt: -1 });
// Fast friend list: "give me everyone I'm accepted with".
friendshipSchema.index({ requester: 1, status: 1 });

export type FriendshipDoc = InferSchemaType<typeof friendshipSchema> & {
  _id: mongoose.Types.ObjectId;
};

const FriendshipModel =
  models.Friendship ?? model("Friendship", friendshipSchema);

export default FriendshipModel;
