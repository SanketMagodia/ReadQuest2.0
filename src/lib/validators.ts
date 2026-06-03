import { z } from "zod";

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

/** Base64 data URL stored on posts (not remote URLs). */
export const postImageSchema = z
  .string()
  .max(3_000_000)
  .regex(/^data:image\/(png|jpe?g|webp|gif);base64,/i);

export const postCreateSchema = z
  .object({
    bookId: z.string().regex(/^[a-f0-9]{24}$/i),
    content: z.string().trim().max(2000).default(""),
    image: postImageSchema.optional(),
  })
  .refine((d) => d.content.length > 0 || d.image, {
    message: "Add text or an image",
    path: ["content"],
  });

export const commentCreateSchema = z.object({
  content: z.string().trim().min(1).max(1500),
  parentId: z
    .string()
    .regex(/^[a-f0-9]{24}$/i)
    .optional()
    .nullable(),
});

export const bookSearchSchema = z.object({
  q: z.string().trim().optional(),
  category: z.string().trim().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(48).optional().default(24),
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
});

const categoryListSchema = z.array(z.string().trim().min(1).max(60)).max(10);

export const botCreateSchema = z.object({
  username: usernameSchema,
  name: z.string().trim().min(1).max(80),
  bio: z.string().trim().max(280).optional().default(""),
  image: z.union([z.string().url(), z.literal("")]).optional(),
  persona: z.string().trim().min(10).max(1200),
  categories: categoryListSchema.min(1),
  intervalMinMinutes: z.coerce.number().int().min(10).max(24 * 60).default(180),
  intervalMaxMinutes: z.coerce.number().int().min(10).max(24 * 60).default(360),
  enabled: z.boolean().optional().default(false),
  model: z.string().trim().max(80).optional().default(""),

  // Reply configuration (all optional with sane defaults on the server side).
  replyEnabled: z.boolean().optional().default(false),
  replyCategories: categoryListSchema.optional().default([]),
  replyChancePerTick: z.coerce.number().int().min(0).max(100).optional().default(20),
  repliesPerTick: z.coerce.number().int().min(1).max(3).optional().default(1),
  replyDailyLimit: z.coerce.number().int().min(0).max(200).optional().default(12),

  autoRespondToComments: z.boolean().optional().default(true),
  autoRespondPerTick: z.coerce.number().int().min(0).max(10).optional().default(3),
});

export const botUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  bio: z.string().trim().max(280).optional(),
  image: z.union([z.string().url(), z.literal("")]).optional(),
  persona: z.string().trim().min(10).max(1200).optional(),
  categories: categoryListSchema.min(1).optional(),
  intervalMinMinutes: z.coerce.number().int().min(10).max(24 * 60).optional(),
  intervalMaxMinutes: z.coerce.number().int().min(10).max(24 * 60).optional(),
  enabled: z.boolean().optional(),
  model: z.string().trim().max(80).optional(),

  replyEnabled: z.boolean().optional(),
  replyCategories: categoryListSchema.optional(),
  replyChancePerTick: z.coerce.number().int().min(0).max(100).optional(),
  repliesPerTick: z.coerce.number().int().min(1).max(3).optional(),
  replyDailyLimit: z.coerce.number().int().min(0).max(200).optional(),

  autoRespondToComments: z.boolean().optional(),
  autoRespondPerTick: z.coerce.number().int().min(0).max(10).optional(),
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
