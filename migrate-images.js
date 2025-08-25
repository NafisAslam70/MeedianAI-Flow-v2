import { put } from "@vercel/blob";
import { readdir, readFile } from "fs/promises";
import path from "path";
import { db } from "./lib/db.js";
import { users } from "./lib/schema.js";
import { eq } from "drizzle-orm";

async function migrateImages() {
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  try {
    const files = await readdir(uploadsDir);
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
        .where(eq(users.image, `/uploads/${file}`));
    }
    console.log("Image migration completed");
  } catch (err) {
    console.error("Image migration error:", err);
  }
}

migrateImages().catch(console.error);