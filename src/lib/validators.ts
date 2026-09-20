import { z } from "zod";
import { MOOD_IDS } from "@/lib/moods";

/** @handle — lowercase letters, numbers, underscores (spaces/symbols stripped). */
export function sanitizeUsername(raw: string) {
  return (
    raw
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 24) || "reader"
  );
}

const usernameSchema = z
  .string()
  .trim()
  .transform(sanitizeUsername)
  .pipe(
    z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(24)
      .regex(
        /^[a-z0-9_]+$/,
        "Use a handle like sameer_singh — not a display name with spaces"
      )
  );

export const registerSchema = z.object({
  username: usernameSchema,
  password: z.string().min(8).max(128),
  email: z.string().email().optional().or(z.literal("")),
  name: z.string().max(80).optional(),
}).transform((d) => ({
  ...d,
  email: d.email ? d.email : undefined,
}));

// ── Private memories (saved lines + notes) ──────────────────────────────────

export const memoryCreateSchema = z
  .object({
    /** Optional: a memory can be a loose thought with no book attached. */
    bookId: z
      .string()
      .regex(/^[a-f0-9]{24}$/i)
      .optional()
      .nullable(),
    quote: z.string().trim().max(2000).default(""),
    note: z.string().trim().max(2000).default(""),
    page: z.coerce.number().int().min(1).max(20000).optional().nullable(),
  })
  .refine((d) => d.quote.length > 0 || d.note.length > 0, {
    message: "Write a line or a note",
    path: ["quote"],
  });

export const memoryUpdateSchema = z
  .object({
    quote: z.string().trim().max(2000).optional(),
    note: z.string().trim().max(2000).optional(),
    page: z.coerce.number().int().min(1).max(20000).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Nothing to update" });

export const dmMessageSchema = z.object({
  content: z.string().trim().min(1).max(1500),
});

// ── Reading clubs ───────────────────────────────────────────────────────────

export const clubCreateSchema = z.object({
  name: z.string().trim().min(2).max(60),
  tagline: z.string().trim().max(160).optional().default(""),
  mood: z.string().trim().max(40).optional().default(""),
});

export const clubUpdateSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  tagline: z.string().trim().max(160).optional(),
  mood: z.string().trim().max(40).optional(),
  active: z.boolean().optional(),
  /** Book id for the top rack; null clears it. */
  currentBookId: z.string().trim().max(40).nullable().optional(),
});

export const clubMessageSchema = z.object({
  content: z.string().trim().min(1).max(1500),
});

export const clubProgressSchema = z.object({
  /** Quarter steps through the book on the club's rack. */
  progress: z.union([
    z.literal(0),
    z.literal(25),
    z.literal(50),
    z.literal(75),
    z.literal(100),
  ]),
});

export const bookSearchSchema = z.object({
  q: z.string().trim().optional(),
  category: z.string().trim().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(48).optional().default(24),
  /** recent = newest first (default), title = A→Z, rating = top rated. */
  sort: z.enum(["recent", "title", "rating"]).optional().default("recent"),
});

/** Allow http(s) URLs, data: URLs (uploaded avatars), or empty string to clear. */
const imageStringSchema = z
  .union([
    z
      .string()
      .max(2_000_000) // ~1.5MB of base64
      .regex(/^data:image\/(png|jpe?g|webp|gif);base64,/i),
    z.string().url(),
    z.literal(""),
  ])
  .optional();

export const profileUpdateSchema = z.object({
  name: z.string().trim().max(80).optional(),
  bio: z.string().trim().max(280).optional(),
  image: imageStringSchema,
  /** "" clears the mood; otherwise one of the known mood ids. */
  mood: z.union([z.enum(MOOD_IDS), z.literal("")]).optional(),
});

export const bookCreateSchema = z.object({
  title: z.string().trim().min(1).max(400),
  subtitle: z.string().trim().max(400).optional(),
  authors: z.string().trim().max(600).optional(),
  categories: z.string().trim().max(600).optional(),
  description: z.string().trim().max(8000).optional(),
  thumbnail: z
    .union([z.string().url(), z.literal("")])
    .optional(),
  publishedYear: z.coerce.number().int().min(0).max(3000).optional(),
});
