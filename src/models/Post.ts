import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

const postSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    book: { type: Schema.Types.ObjectId, ref: "Book", required: true, index: true },
    content: { type: String, required: true, maxlength: 2000, trim: true },
  },
  { timestamps: true }
);

postSchema.index({ createdAt: -1 });
postSchema.index({ book: 1, createdAt: -1 });

export type PostDoc = InferSchemaType<typeof postSchema> & { _id: mongoose.Types.ObjectId };

const PostModel = models.Post ?? model("Post", postSchema);

export default PostModel;
