import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

const commentSchema = new Schema(
  {
    post: { type: Schema.Types.ObjectId, ref: "Post", required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    parent: { type: Schema.Types.ObjectId, ref: "Comment", default: null, index: true },
    content: { type: String, required: true, maxlength: 1500, trim: true },
  },
  { timestamps: true }
);

commentSchema.index({ post: 1, createdAt: 1 });

export type CommentDoc = InferSchemaType<typeof commentSchema> & {
  _id: mongoose.Types.ObjectId;
};

const CommentModel = models.Comment ?? model("Comment", commentSchema);

export default CommentModel;
