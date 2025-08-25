import { put } from "@vercel/blob";
import { readdir, readFile } from "fs/promises";
import path from "path";
import { db } from "./lib/db.js";
import { users } from "./lib/schema.js";
import { eq } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function migrateImages() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set in .env.local");
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not set in .env.local");
  }

  const uploadsDir = path.join(process.cwd(), "public", "Uploads");
  try {
    const files = await readdir(uploadsDir);
    console.log(`Found ${files.length} files in ${uploadsDir}`);
    if (files.length === 0) {
      console.log("No files to migrate in public/Uploads");
      return;
    }
    for (const file of files) {
      const filePath = path.join(UploadsDir, file);
      const buffer = await readFile(filePath);
      const blob = await put(file, buffer, {
        access: "public",
        token: process.env.BLOB_READ_WRITE_TOKEN,
        addRandomSuffix: true,
      });
      console.log(`Uploaded ${file} to ${blob.url}`);
      const updated = await db
        .update(users)
        .set({ image: blob.url })
        .where(eq(users.image, `/Uploads/${file}`))
        .returning({ id: users.id, image: users.image });
      console.log(`Updated users:`, updated);
    }
    console.log("Image migration completed");
  } catch (err) {
    console.error("Image migration error:", err);
    throw err;
  }
}

migrateImages().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});