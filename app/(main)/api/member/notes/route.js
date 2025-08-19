import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userNotes, users } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";

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
    const notes = await db
      .select({
        id: userNotes.id,
        userId: userNotes.userId,
        content: userNotes.content,
        category: userNotes.category,
        createdAt: userNotes.createdAt,
        updatedAt: userNotes.updatedAt,
      })
      .from(userNotes)
      .where(eq(userNotes.userId, parseInt(session.user.id)));

    return NextResponse.json({ notes });
  } catch (err) {
    console.error("GET /api/member/notes error:", err.message);
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

    // Validate input
    if (!noteId || !content || !category) {
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
      .where(eq(userNotes.id, parseInt(noteId)))
      .limit(1);

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    if (note.userId !== parseInt(session.user.id)) {
      return NextResponse.json(
        { error: "Unauthorized to update this note" },
        { status: 403 }
      );
    }

    const [updatedNote] = await db
      .update(userNotes)
      .set({ content, category, updatedAt: new Date() })
      .where(eq(userNotes.id, parseInt(noteId)))
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