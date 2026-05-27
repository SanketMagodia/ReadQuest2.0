import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

const userStreakSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    /** Current consecutive-day streak length (alive). */
    current: { type: Number, default: 0 },
    /** Longest streak ever achieved. */
    longest: { type: Number, default: 0 },
    /** UTC YYYY-MM-DD of the most recent completed day. */
    lastDay: { type: String, default: "" },
    /** Total daily reads ever completed. */
    totalCompleted: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export type UserStreakDoc = InferSchemaType<typeof userStreakSchema> & {
  _id: mongoose.Types.ObjectId;
};

const UserStreakModel =
  models.UserStreak ?? model("UserStreak", userStreakSchema);

export default UserStreakModel;
