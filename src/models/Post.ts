import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

const postSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    book: { type: Schema.Types.ObjectId, ref: "Book", required: true, index: true },
    content: { type: String, default: "", maxlength: 2000, trim: true },
    /** Optional base64 data URL (png/jpeg/webp/gif). */
    image: { type: String, maxlength: 3_000_000, required: false },
  },
  { timestamps: true }
);

postSchema.index({ createdAt: -1 });
postSchema.index({ book: 1, createdAt: -1 });

export type PostDoc = InferSchemaType<typeof postSchema> & { _id: mongoose.Types.ObjectId };

const existingPostModel = models.Post as mongoose.Model<any> | undefined;
if (existingPostModel && !existingPostModel.schema.path("image")) {
  // In dev, Mongoose may reuse an older cached model without the new field.
  // Ensure `image` is present so base64 payloads are not stripped by strict mode.
  existingPostModel.schema.add({
    image: { type: String, maxlength: 3_000_000, required: false },
  });
}

const PostModel = existingPostModel ?? model("Post", postSchema);

export default PostModel as mongoose.Model<PostDoc>;
