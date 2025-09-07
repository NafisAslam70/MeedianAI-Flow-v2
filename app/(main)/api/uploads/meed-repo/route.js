import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
export const dynamic = "force-dynamic";

// Upload handler for Meed Repo attachments
// Tries Vercel Blob (requires BLOB_READ_WRITE_TOKEN). Falls back to returning a data URL if provided.
export async function POST(req) {
  try {
    const form = await req.formData();
    const file = form.get("file"); // Blob
    const title = form.get("title") || (file && file.name) || "file";
    const mimeType = file?.type || "application/octet-stream";

    if (!file || typeof file?.arrayBuffer !== "function") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Preferred: use @vercel/blob put (same as profile endpoint)
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const blob = await put(title, file, {
          access: "public",
          token: process.env.BLOB_READ_WRITE_TOKEN,
          addRandomSuffix: true,
          contentType: mimeType,
        });
        return NextResponse.json({ url: blob.url, mimeType, title, size: file.size || 0 });
      } catch (err) {
        console.error("Vercel Blob put() failed:", err?.message || err);
        // fall through to data URL
      }
    }

    // Fallback: data URL (dev only)
    const ab = await file.arrayBuffer();
    const b64 = Buffer.from(ab).toString("base64");
    const dataUrl = `data:${mimeType};base64,${b64}`;
    return NextResponse.json({ url: dataUrl, mimeType, title, size: (file.size || b64.length) });
  } catch (e) {
    console.error("upload error", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
