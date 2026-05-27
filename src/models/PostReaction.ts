import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

const postReactionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    post: { type: Schema.Types.ObjectId, ref: "Post", required: true, index: true },
    type: { type: String, enum: ["like", "dislike"], required: true },
  },
  { timestamps: true }
);

// A given user has at most ONE reaction per post (like OR dislike).
postReactionSchema.index({ user: 1, post: 1 }, { unique: true });
postReactionSchema.index({ post: 1, type: 1 });

export type PostReactionDoc = InferSchemaType<typeof postReactionSchema> & {
  _id: mongoose.Types.ObjectId;
};

const PostReactionModel = models.PostReaction ?? model("PostReaction", postReactionSchema);

export default PostReactionModel;
