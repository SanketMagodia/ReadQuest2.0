import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

const commentReactionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    comment: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
      required: true,
      index: true,
    },
    type: { type: String, enum: ["like", "dislike"], required: true },
  },
  { timestamps: true }
);

// A given user has at most ONE reaction per comment (like OR dislike).
commentReactionSchema.index({ user: 1, comment: 1 }, { unique: true });
commentReactionSchema.index({ comment: 1, type: 1 });

export type CommentReactionDoc = InferSchemaType<typeof commentReactionSchema> & {
  _id: mongoose.Types.ObjectId;
};

const CommentReactionModel =
  models.CommentReaction ?? model("CommentReaction", commentReactionSchema);

export default CommentReactionModel;
