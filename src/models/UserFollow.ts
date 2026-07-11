import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

/**
 * A one-directional follow edge: `follower` follows `following`. Unlike a
 * friendship, this needs no acceptance — anyone can follow anyone to keep an
 * eye on their updates, and it drives the follower/following counts shown on a
 * profile. Friendships auto-create follow edges in both directions.
 */
const userFollowSchema = new Schema(
  {
    follower: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    following: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// One follow edge per (follower → following) pair.
userFollowSchema.index({ follower: 1, following: 1 }, { unique: true });
// Fast "who follows this user" lookups for the follower list + count.
userFollowSchema.index({ following: 1, createdAt: -1 });

export type UserFollowDoc = InferSchemaType<typeof userFollowSchema> & {
  _id: mongoose.Types.ObjectId;
};

const UserFollowModel =
  models.UserFollow ?? model("UserFollow", userFollowSchema);

export default UserFollowModel;
