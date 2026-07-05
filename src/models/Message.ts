import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

const messageSchema = new Schema(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true, maxlength: 1500, trim: true },
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: -1 });

export type MessageDoc = InferSchemaType<typeof messageSchema> & {
  _id: mongoose.Types.ObjectId;
};

const MessageModel = models.Message ?? model("Message", messageSchema);

export default MessageModel;
