import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

/**
 * A reading club: one owner, many members, one book on the top rack at a time.
 *
 * `active` controls discoverability, not access — an inactive club still has a
 * room and still accepts joins from a direct link. Deactivating is how an owner
 * frees themselves to join somebody else's club (see `src/lib/clubs.ts`).
 */
const clubSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    slug: { type: String, required: true, unique: true, index: true },
    tagline: { type: String, default: "", trim: true, maxlength: 160 },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    active: { type: Boolean, default: true, index: true },
    /** A mood id from `src/lib/moods.ts`; re-themes the room for visitors. */
    mood: { type: String, default: "" },
    /** The top rack — the single book the club is reading right now. */
    currentBook: { type: Schema.Types.ObjectId, ref: "Book", default: null },
    currentBookSince: { type: Date },
    /** Denormalised so club listings don't need a per-row count query. */
    memberCount: { type: Number, default: 1 },
    lastMessageAt: { type: Date },
  },
  { timestamps: true }
);

clubSchema.index({ active: 1, lastMessageAt: -1 });
clubSchema.index({ name: 1 });

export type ClubDoc = InferSchemaType<typeof clubSchema> & {
  _id: mongoose.Types.ObjectId;
};

const ClubModel = models.Club ?? model("Club", clubSchema);

export default ClubModel;
