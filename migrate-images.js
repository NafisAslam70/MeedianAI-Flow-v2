// migrate-images.js
import { put } from "@vercel/blob";
import { readdir, readFile } from "fs/promises";
import path from "path";
import { db } from "./lib/db.js"; // Adjust if lib/db.js is elsewhere
import { users } from "./lib/schema.js"; // Adjust if lib/schema.js is elsewhere
import { eq } from "drizzle-orm";
import dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function migrateImages() {
  // Verify environment variables
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
    for (const file of files) {
      const filePath = path.join(uploadsDir, file);
      const buffer = await readFile(filePath);
      const blob = await put(file, buffer, {
        access: "public",
        token: process.env.BLOB_READ_WRITE_TOKEN,
        addRandomSuffix: true,
      });
      console.log(`Uploaded ${file} to ${blob.url}`);
      await db
        .update(users)
        .set({ image: blob.url })
        .where(eq(users.image, `/Uploads/${file}`));
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