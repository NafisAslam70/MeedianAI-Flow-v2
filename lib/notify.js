import { db } from "@/lib/db";
import { notifications } from "@/lib/schema";

export async function createNotifications({ recipients = [], type, title = null, body = null, entityKind = null, entityId = null, meta = {} }) {
  try {
    const rows = (recipients || []).filter(Boolean).map((uid) => ({
      userId: Number(uid),
      type,
      title,
      body,
      entityKind,
      entityId: entityId ? Number(entityId) : null,
      meta: meta || {},
      createdAt: new Date(),
    }));
    if (!rows.length) return { inserted: 0 };
    await db.insert(notifications).values(rows);
    return { inserted: rows.length };
  } catch (e) {
    console.error("createNotifications failed", e);
    return { inserted: 0, error: e.message };
  }
}

