import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userNotes, users, userNoteShares, userNoteTaskLinks, assignedTasks, assignedTaskStatus } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq, inArray, or, and, desc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

// Helper to check authentication
async function checkAuth() {
  const session = await auth();
  if (!session || !session.user) {
    console.error("Unauthorized access attempt:", { session });
    return { error: "Unauthorized: Please log in", status: 401, session: null };
  }
  return { session };
}

// GET: Fetch all notes for the authenticated user
export async function GET(req) {
  const { error, status, session } = await checkAuth();
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const userId = parseInt(session.user.id);

    const accessRows = await db
      .select({ noteId: userNoteShares.noteId, canEdit: userNoteShares.canEdit })
      .from(userNoteShares)
      .where(eq(userNoteShares.sharedWithUserId, userId));

    const sharedAccessMap = new Map(accessRows.map((row) => [row.noteId, row]));
    const sharedNoteIds = accessRows.map((row) => row.noteId);

    const ownerAlias = alias(users, "note_owner");
    let condition = eq(userNotes.userId, userId);
    if (sharedNoteIds.length) {
      condition = or(condition, inArray(userNotes.id, sharedNoteIds));
    }

    const noteRows = await db
      .select({
        id: userNotes.id,
        userId: userNotes.userId,
        content: userNotes.content,
        category: userNotes.category,
        createdAt: userNotes.createdAt,
        updatedAt: userNotes.updatedAt,
        ownerName: ownerAlias.name,
        ownerRole: ownerAlias.role,
      })
      .from(userNotes)
      .innerJoin(ownerAlias, eq(ownerAlias.id, userNotes.userId))
      .where(condition)
      .orderBy(desc(userNotes.createdAt));

    console.log("/api/member/notes GET", {
      viewerId: userId,
      ownNotes: noteRows.filter((row) => row.userId === userId).length,
      sharedNotes: noteRows.filter((row) => row.userId !== userId).length,
      total: noteRows.length,
    });

    const noteIds = noteRows.map((note) => note.id);
    let shareRows = [];
    let taskRows = [];

    if (noteIds.length) {
      const sharedWithAlias = alias(users, "note_shared_with");
      const sharedByAlias = alias(users, "note_shared_by");
      shareRows = await db
        .select({
          noteId: userNoteShares.noteId,
          sharedWithUserId: userNoteShares.sharedWithUserId,
          sharedByUserId: userNoteShares.sharedByUserId,
          canEdit: userNoteShares.canEdit,
          createdAt: userNoteShares.createdAt,
          sharedWithName: sharedWithAlias.name,
          sharedWithRole: sharedWithAlias.role,
          sharedByName: sharedByAlias.name,
        })
        .from(userNoteShares)
        .innerJoin(sharedWithAlias, eq(sharedWithAlias.id, userNoteShares.sharedWithUserId))
        .leftJoin(sharedByAlias, eq(sharedByAlias.id, userNoteShares.sharedByUserId))
        .where(inArray(userNoteShares.noteId, noteIds));

      const taskCreatorAlias = alias(users, "note_task_creator");
      taskRows = await db
        .select({
          noteId: userNoteTaskLinks.noteId,
          taskId: userNoteTaskLinks.taskId,
          sourceText: userNoteTaskLinks.sourceText,
          linkCreatedAt: userNoteTaskLinks.createdAt,
          title: assignedTasks.title,
          description: assignedTasks.description,
          taskType: assignedTasks.taskType,
          deadline: assignedTasks.deadline,
          createdBy: assignedTasks.createdBy,
          createdAt: assignedTasks.createdAt,
          updatedAt: assignedTasks.updatedAt,
          creatorName: taskCreatorAlias.name,
        })
        .from(userNoteTaskLinks)
        .innerJoin(assignedTasks, eq(assignedTasks.id, userNoteTaskLinks.taskId))
        .leftJoin(taskCreatorAlias, eq(taskCreatorAlias.id, assignedTasks.createdBy))
        .where(inArray(userNoteTaskLinks.noteId, noteIds));

    }

    const assigneesByTask = new Map();
    if (taskRows.length) {
      const taskIds = [...new Set(taskRows.map((row) => row.taskId))];
      if (taskIds.length) {
        const assigneeAlias = alias(users, "note_task_assignee");
        const rows = await db
          .select({
            taskId: assignedTaskStatus.taskId,
            memberId: assignedTaskStatus.memberId,
            status: assignedTaskStatus.status,
            name: assigneeAlias.name,
            role: assigneeAlias.role,
          })
          .from(assignedTaskStatus)
          .innerJoin(assigneeAlias, eq(assigneeAlias.id, assignedTaskStatus.memberId))
          .where(inArray(assignedTaskStatus.taskId, taskIds));
        for (const row of rows) {
          if (!assigneesByTask.has(row.taskId)) {
            assigneesByTask.set(row.taskId, []);
          }
          assigneesByTask.get(row.taskId).push({
            memberId: row.memberId,
            name: row.name,
            role: row.role,
            status: row.status,
          });
        }
      }
    }

    const shareMap = new Map();
    for (const row of shareRows) {
      if (!shareMap.has(row.noteId)) {
        shareMap.set(row.noteId, []);
      }
      shareMap.get(row.noteId).push({
        userId: row.sharedWithUserId,
        name: row.sharedWithName,
        role: row.sharedWithRole,
        canEdit: row.canEdit,
        sharedById: row.sharedByUserId,
        sharedByName: row.sharedByName || null,
        sharedAt: row.createdAt,
      });
    }

    const taskMap = new Map();
    for (const row of taskRows) {
      if (!taskMap.has(row.noteId)) {
        taskMap.set(row.noteId, []);
      }
      taskMap.get(row.noteId).push({
        taskId: row.taskId,
        title: row.title,
        description: row.description,
        taskType: row.taskType,
        deadline: row.deadline,
        createdBy: row.createdBy,
        creatorName: row.creatorName || null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        linkCreatedAt: row.linkCreatedAt,
        sourceText: row.sourceText,
        assignees: assigneesByTask.get(row.taskId) || [],
      });
    }

    const notes = noteRows.map((note) => {
      const isOwner = note.userId === userId;
      const myShare = sharedAccessMap.get(note.id);
      return {
        id: note.id,
        userId: note.userId,
        content: note.content,
        category: note.category,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        owner: {
          id: note.userId,
          name: note.ownerName,
          role: note.ownerRole,
        },
        isOwner,
        canEdit: isOwner || Boolean(myShare?.canEdit),
        sharedWith: shareMap.get(note.id) || [],
        linkedTasks: taskMap.get(note.id) || [],
      };
    });

    console.log("/api/member/notes formatted", {
      total: notes.length,
      ids: notes.map((n) => n.id),
    });

    return NextResponse.json({ notes });
  } catch (err) {
    console.error("GET /api/member/notes error:", err);
    return NextResponse.json(
      { error: "Failed to fetch notes" },
      { status: 500 }
    );
  }
}

// POST: Create a new note
export async function POST(req) {
  const { error, status, session } = await checkAuth();
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const { userId, content, category } = await req.json();

    // Validate input
    if (!userId || !content || !category || userId !== parseInt(session.user.id)) {
      return NextResponse.json(
        { error: "Invalid input or unauthorized user" },
        { status: 400 }
      );
    }

    if (!content.trim()) {
      return NextResponse.json(
        { error: "Note content cannot be empty" },
        { status: 400 }
      );
    }

    const validCategories = ["MSP", "MHCP", "MHP", "MOP", "Other", "Building Home"];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: "Invalid category" },
        { status: 400 }
      );
    }

    // Verify user exists
    const user = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user.length) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const [newNote] = await db
      .insert(userNotes)
      .values({
        userId,
        content,
        category,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return NextResponse.json({ note: newNote });
  } catch (err) {
    console.error("POST /api/member/notes error:", err.message);
    return NextResponse.json(
      { error: "Failed to create note" },
      { status: 500 }
    );
  }
}

// PATCH: Update an existing note
export async function PATCH(req) {
  const { error, status, session } = await checkAuth();
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const { noteId, content, category } = await req.json();
    const requesterId = parseInt(session.user.id);
    const noteIdNumber = parseInt(noteId);

    // Validate input
    if (!noteIdNumber || !content || !category) {
      return NextResponse.json(
        { error: "Note ID, content, and category are required" },
        { status: 400 }
      );
    }

    if (!content.trim()) {
      return NextResponse.json(
        { error: "Note content cannot be empty" },
        { status: 400 }
      );
    }

    const validCategories = ["MSP", "MHCP", "MHP", "MOP", "Other", "Building Home"];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: "Invalid category" },
        { status: 400 }
      );
    }

    // Check if note exists and belongs to the user
    const [note] = await db
      .select({ id: userNotes.id, userId: userNotes.userId })
      .from(userNotes)
      .where(eq(userNotes.id, noteIdNumber))
      .limit(1);

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    let canEdit = note.userId === requesterId;
    if (!canEdit) {
      const [share] = await db
        .select({ canEdit: userNoteShares.canEdit })
        .from(userNoteShares)
        .where(
          and(
            eq(userNoteShares.noteId, noteIdNumber),
            eq(userNoteShares.sharedWithUserId, requesterId)
          )
        )
        .limit(1);
      canEdit = Boolean(share?.canEdit);
    }

    if (!canEdit) {
      return NextResponse.json(
        { error: "Unauthorized to update this note" },
        { status: 403 }
      );
    }

    const [updatedNote] = await db
      .update(userNotes)
      .set({ content, category, updatedAt: new Date() })
      .where(eq(userNotes.id, noteIdNumber))
      .returning();

    return NextResponse.json({ note: updatedNote });
  } catch (err) {
    console.error("PATCH /api/member/notes error:", err.message);
    return NextResponse.json(
      { error: "Failed to update note" },
      { status: 500 }
    );
  }
}

// DELETE: Delete a note
export async function DELETE(req) {
  const { error, status, session } = await checkAuth();
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const noteId = searchParams.get("noteId");

    if (!noteId) {
      return NextResponse.json(
        { error: "Note ID is required" },
        { status: 400 }
      );
    }

    // Check if note exists and belongs to the user
    const [note] = await db
      .select({ id: userNotes.id, userId: userNotes.userId })
      .from(userNotes)
      .where(eq(userNotes.id, parseInt(noteId)))
      .limit(1);

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    if (note.userId !== parseInt(session.user.id)) {
      return NextResponse.json(
        { error: "Unauthorized to delete this note" },
        { status: 403 }
      );
    }

    await db.delete(userNotes).where(eq(userNotes.id, parseInt(noteId)));

    return NextResponse.json({ message: "Note deleted successfully" });
  } catch (err) {
    console.error("DELETE /api/member/notes error:", err.message);
    return NextResponse.json(
      { error: "Failed to delete note" },
      { status: 500 }
    );
  }
}
