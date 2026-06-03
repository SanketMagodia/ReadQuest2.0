import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

const postReportSchema = new Schema(
  {
    post: { type: Schema.Types.ObjectId, ref: "Post", required: true, index: true },
    reporter: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reason: { type: String, default: "general", maxlength: 120 },
  },
  { timestamps: true }
);

// One report per user per post; repeated clicks are idempotent.
postReportSchema.index({ post: 1, reporter: 1 }, { unique: true });
postReportSchema.index({ post: 1, createdAt: -1 });

export type PostReportDoc = InferSchemaType<typeof postReportSchema> & {
  _id: mongoose.Types.ObjectId;
};

const PostReportModel = models.PostReport ?? model("PostReport", postReportSchema);

export default PostReportModel;
