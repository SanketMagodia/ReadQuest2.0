import mongoose, { Schema, models, model, type InferSchemaType } from "mongoose";

const bookSchema = new Schema(
  {
    isbn13: { type: String, sparse: true, unique: true },
    isbn10: { type: String },
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, default: "" },
    authors: { type: String, default: "" },
    categories: { type: String, default: "" },
    thumbnail: { type: String, default: "" },
    description: { type: String, default: "" },
    publishedYear: { type: Number },
    averageRating: { type: Number },
    numPages: { type: Number },
    ratingsCount: { type: Number },
    /**
     * Where this book came from: `import`, `user`, `openlibrary`, …
     * Left as a free-form string so we can add new ingestion paths without
     * needing a Mongoose schema migration (the dev server caches the
     * registered model across hot reloads).
     */
    source: { type: String, default: "import" },
    addedBy: { type: Schema.Types.ObjectId, ref: "User" },
    /** SEO-friendly URL slug. Sparse so we can backfill in batches. */
    slug: { type: String, sparse: true, unique: true, index: true },
    /**
     * Open Library work key like `/works/OL45804W` when the book was adopted
     * from Open Library. Sparse-unique so future searches dedupe instantly.
     */
    olKey: { type: String, sparse: true, unique: true, index: true },
  },
  { timestamps: true }
);

bookSchema.index({ categories: 1 });
bookSchema.index({ title: 1 });

export type BookDoc = InferSchemaType<typeof bookSchema> & { _id: mongoose.Types.ObjectId };

const BookModel = models.Book ?? model("Book", bookSchema);

export default BookModel;
