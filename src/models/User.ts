import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    email: { type: String, sparse: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, select: false },
    name: { type: String, default: "" },
    image: { type: String },
    bio: { type: String, default: "", maxlength: 280 },
    /** Reading mood that re-themes the profile/app. "" = none. */
    mood: { type: String, default: "" },
    googleId: { type: String, sparse: true, unique: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    isBot: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };

const UserModel = models.User ?? model("User", userSchema);

export default UserModel;
