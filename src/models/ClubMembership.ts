import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

/**
 * Who is in which club.
 *
 * `user` is unique across the whole collection — that single index is what
 * enforces "one club at a time" for every reader, owners included. Any attempt
 * to join a second club fails with a duplicate-key error rather than relying on
 * a read-then-write check that could race.
 */
const clubMembershipSchema = new Schema(
  {
    club: {
      type: Schema.Types.ObjectId,
      ref: "Club",
      required: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    role: { type: String, enum: ["owner", "member"], default: "member" },
    /** Drives the unread dot on the club chat. */
    lastReadAt: { type: Date, default: () => new Date() },
    /** How far this member is through the book on the rack, in steps of 25. */
    progress: { type: Number, default: 0, min: 0, max: 100 },
    /**
     * Which book the progress refers to. Stored so a rack swap can reset
     * everyone rather than carrying stale percentages onto a new read.
     */
    progressBook: { type: Schema.Types.ObjectId, ref: "Book", default: null },
    progressAt: { type: Date },
  },
  { timestamps: true }
);

clubMembershipSchema.index({ club: 1, createdAt: 1 });

export type ClubMembershipDoc = InferSchemaType<typeof clubMembershipSchema> & {
  _id: mongoose.Types.ObjectId;
};

const ClubMembershipModel =
  models.ClubMembership ?? model("ClubMembership", clubMembershipSchema);

export default ClubMembershipModel;
