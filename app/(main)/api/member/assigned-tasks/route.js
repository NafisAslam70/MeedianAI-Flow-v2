import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taskAssignments, tasks, users } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function GET(req) {
  try {
    const session = await auth();
    if (!session || !session.user || session.user.role !== "member") {
      console.error("Unauthorized access attempt:", { session });
      return NextResponse.json({ error: "Unauthorized: Member access required" }, { status: 401 });
    }

    const userId = parseInt(session.user.id);

    const assignedTasks = await db
      .select({
        id: taskAssignments.id,
        title: tasks.title,
        description: tasks.description,
        status: taskAssignments.status,
      })
      .from(taskAssignments)
      .leftJoin(tasks, eq(tasks.id, taskAssignments.taskId))
      .where(eq(taskAssignments.memberId, userId));

    console.log("Assigned tasks fetched:", assignedTasks.length, { userId });

    return NextResponse.json({ tasks: assignedTasks });
  } catch (error) {
    console.error("Error fetching assigned tasks:", error);
    return NextResponse.json({ error: `Failed to fetch assigned tasks: ${error.message}` }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const session = await auth();
    if (!session || !session.user || session.user.role !== "member") {
      console.error("Unauthorized access attempt:", { session });
      return NextResponse.json({ error: "Unauthorized: Member access required" }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const { id, status } = await req.json();
    if (!id || !["not_started", "in_progress", "done"].includes(status)) {
      return NextResponse.json({ error: "Invalid task ID or status" }, { status: 400 });
    }

    const [task] = await db
      .select()
      .from(taskAssignments)
      .where(and(eq(taskAssignments.id, id), eq(taskAssignments.memberId, userId)));
    if (!task) {
      return NextResponse.json({ error: "Task not found or not assigned to user" }, { status: 404 });
    }

    await db
      .update(taskAssignments)
      .set({ status, updatedAt: new Date() })
      .where(eq(taskAssignments.id, id));

    console.log("Assigned task status updated:", { taskId: id, status, userId });

    return NextResponse.json({ message: "Task status updated successfully" });
  } catch (error) {
    console.error("Error updating task status:", error);
    return NextResponse.json({ error: `Failed to update task status: ${error.message}` }, { status: 500 });
  }
}