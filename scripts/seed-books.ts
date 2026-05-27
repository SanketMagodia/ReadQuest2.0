/**
 * Seed books from repo root `data.csv`, ensure super admin exists.
 * Usage: from `web/`: `npm run seed` or `npm run seed-books`
 * Requires MONGODB_URI (and optional SUPERADMIN_* in .env.local)
 */
import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

import connectDB from "../src/lib/db";
import Book from "../src/models/Book";
import User from "../src/models/User";

type Row = Record<string, string>;

async function main() {
  const conn = await connectDB();
  const dbName = conn.connection.db?.databaseName ?? "unknown";
  console.log(`Connected to MongoDB database: ${dbName}`);

  const csvPath = path.join(process.cwd(), "..", "data.csv");
  if (!fs.existsSync(csvPath)) {
    throw new Error(`Missing data.csv at ${csvPath}`);
  }
  const text = fs.readFileSync(csvPath, "utf-8");

  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Row[];

  console.log(`Importing ${rows.length} books from ${csvPath}…`);

  const batchSize = 400;
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize).map((r) => ({
      isbn13: r.isbn13?.trim() || undefined,
      isbn10: r.isbn10?.trim() || undefined,
      title: (r.title || "").trim() || "Untitled",
      subtitle: r.subtitle?.trim() || "",
      authors: r.authors?.trim() || "",
      categories: r.categories?.trim() || "",
      thumbnail: r.thumbnail?.trim() || "",
      description: r.description?.trim() || "",
      publishedYear: num(r.published_year),
      averageRating: num(r.average_rating),
      numPages: num(r.num_pages),
      ratingsCount: num(r.ratings_count),
      source: "import" as const,
    }));

    try {
      const res = await Book.insertMany(chunk, { ordered: false });
      inserted += res.length;
    } catch (e: unknown) {
      const err = e as { insertedDocs?: unknown[]; writeErrors?: unknown[] };
      if (Array.isArray(err.insertedDocs)) {
        inserted += err.insertedDocs.length;
      }
      const we = err.writeErrors;
      if (Array.isArray(we)) skipped += we.length;
    }

    const done = Math.min(i + batchSize, rows.length);
    if (done % 2000 === 0 || done === rows.length) {
      console.log(`  progress: ${done}/${rows.length} rows (~${inserted} inserted)`);
    }
  }

  const adminUser = process.env.SUPERADMIN_USERNAME?.trim() || "readquest_admin";
  const adminPass = process.env.SUPERADMIN_PASSWORD?.trim() || "ChangeThisPassword!";

  const existing = await User.findOne({ username: adminUser.toLowerCase() });
  if (!existing) {
    const passwordHash = await bcrypt.hash(adminPass, 12);
    await User.create({
      username: adminUser.toLowerCase(),
      passwordHash,
      name: "Readquest Admin",
      role: "admin",
    });
    console.log("Created super admin:", adminUser);
  } else {
    existing.role = "admin";
    if (!existing.passwordHash) {
      existing.passwordHash = await bcrypt.hash(adminPass, 12);
    }
    await existing.save();
    console.log("Ensured super admin role:", adminUser);
  }

  console.log(
    `Books import finished. Inserted ~${inserted}, duplicate skips ~${skipped}, rows ${rows.length}.`
  );
  process.exit(0);
}

function num(s: string | undefined) {
  if (s == null || s === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
