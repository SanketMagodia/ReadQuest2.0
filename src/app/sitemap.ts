import type { MetadataRoute } from "next";
import { Types } from "mongoose";
import connectDB from "@/lib/db";
import Book from "@/models/Book";

function siteUrl(): string {
  return process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}

// Google's per-sitemap-file limit is 50,000. Stay under it.
const BOOKS_LIMIT = 45000;

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${base}/explore`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/register`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  try {
    await connectDB();
    const books = (await Book.find({
      slug: { $exists: true, $ne: "" },
    })
      .select("slug updatedAt")
      .sort({ updatedAt: -1 })
      .limit(BOOKS_LIMIT)
      .lean()) as unknown as Array<{
      _id: Types.ObjectId;
      slug?: string;
      updatedAt?: Date;
    }>;

    const bookEntries: MetadataRoute.Sitemap = books
      .filter((b) => b.slug)
      .map((b) => ({
        url: `${base}/book/${b.slug}`,
        lastModified: b.updatedAt ?? now,
        changeFrequency: "weekly",
        priority: 0.7,
      }));

    return [...staticEntries, ...bookEntries];
  } catch (e) {
    console.warn("[sitemap] failed to load books from DB:", e);
    return staticEntries;
  }
}
