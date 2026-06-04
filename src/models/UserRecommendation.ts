import mongoose, { Schema, model, models } from "mongoose";

const userRecommendationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    book: { type: Schema.Types.ObjectId, ref: "Book", required: true },
    rank: { type: Number, required: true, min: 1, max: 10 },
  },
  { timestamps: true }
);

userRecommendationSchema.index({ user: 1, book: 1 }, { unique: true });
userRecommendationSchema.index({ user: 1, rank: 1 });

const UserRecommendationModel =
  models.UserRecommendation ?? model("UserRecommendation", userRecommendationSchema);

export default UserRecommendationModel as mongoose.Model<
  mongoose.InferSchemaType<typeof userRecommendationSchema>
>;
