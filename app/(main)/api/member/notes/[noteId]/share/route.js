import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userNotes, userNoteShares, users } from "@/lib/schema";
import { eq, inArray, and } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

export async function POST(req, context) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { params } = context || {};
    const resolvedParams = typeof params?.then === "function" ? await params : params;
    const noteIdRaw = resolvedParams?.noteId;
    const noteId = parseInt(noteIdRaw, 10);
    if (!noteId) {
      return NextResponse.json({ error: "Invalid note id" }, { status: 400 });
    }

    const requesterId = parseInt(session.user.id, 10);

    const [note] = await db
      .select({ id: userNotes.id, ownerId: userNotes.userId })
      .from(userNotes)
      .where(eq(userNotes.id, noteId))
      .limit(1);

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    if (note.ownerId !== requesterId) {
      return NextResponse.json({ error: "Only the note owner can update sharing" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const rawShare = Array.isArray(body?.shareWith) ? body.shareWith : [];

    const normalized = new Map();
    for (const entry of rawShare) {
      let userId;
      let canEdit = false;
      if (typeof entry === "number" || typeof entry === "string") {
        userId = parseInt(entry, 10);
      } else if (entry && typeof entry === "object") {
        userId = parseInt(entry.userId ?? entry.id, 10);
        canEdit = Boolean(entry.canEdit);
      }
      if (!userId || userId === note.ownerId || Number.isNaN(userId)) continue;
      normalized.set(userId, canEdit);
    }

    const shareList = Array.from(normalized.entries()).map(([userId, canEdit]) => ({ userId, canEdit }));

    if (shareList.length) {
      const validUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.id, shareList.map((item) => item.userId)));

      if (validUsers.length !== shareList.length) {
        return NextResponse.json({ error: "One or more users are invalid" }, { status: 400 });
      }
    }

    const existingRows = await db
      .select({ userId: userNoteShares.sharedWithUserId })
      .from(userNoteShares)
      .where(eq(userNoteShares.noteId, noteId));

    const currentSet = new Set(existingRows.map((row) => row.userId));
    const targetSet = new Set(shareList.map((item) => item.userId));
    const toRemove = [...currentSet].filter((id) => !targetSet.has(id));

    const now = new Date();

    if (toRemove.length) {
      await db
        .delete(userNoteShares)
        .where(
          and(
            eq(userNoteShares.noteId, noteId),
            inArray(userNoteShares.sharedWithUserId, toRemove)
          )
        );
    }

    for (const entry of shareList) {
      await db
        .insert(userNoteShares)
        .values({
          noteId,
          sharedWithUserId: entry.userId,
          sharedByUserId: requesterId,
          canEdit: entry.canEdit,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: [userNoteShares.noteId, userNoteShares.sharedWithUserId],
          set: {
            canEdit: entry.canEdit,
            sharedByUserId: requesterId,
            createdAt: now,
          },
        });
    }

    const sharedWithAlias = alias(users, "note_shared_with");
    const sharedByAlias = alias(users, "note_shared_by");
    const shareRows = await db
      .select({
        userId: userNoteShares.sharedWithUserId,
        canEdit: userNoteShares.canEdit,
        sharedAt: userNoteShares.createdAt,
        sharedById: userNoteShares.sharedByUserId,
        sharedWithName: sharedWithAlias.name,
        sharedWithRole: sharedWithAlias.role,
        sharedByName: sharedByAlias.name,
      })
      .from(userNoteShares)
      .innerJoin(sharedWithAlias, eq(sharedWithAlias.id, userNoteShares.sharedWithUserId))
      .leftJoin(sharedByAlias, eq(sharedByAlias.id, userNoteShares.sharedByUserId))
      .where(eq(userNoteShares.noteId, noteId));

    const sharedWith = shareRows.map((row) => ({
      userId: row.userId,
      name: row.sharedWithName,
      role: row.sharedWithRole,
      canEdit: row.canEdit,
      sharedById: row.sharedById,
      sharedByName: row.sharedByName || null,
      sharedAt: row.sharedAt,
    }));

    return NextResponse.json({ sharedWith });
  } catch (error) {
    console.error("POST /api/member/notes/[noteId]/share error", error);
    return NextResponse.json({ error: "Failed to update sharing" }, { status: 500 });
  }
}
