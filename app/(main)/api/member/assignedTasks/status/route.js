import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignedTaskStatus } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function PATCH(req) {
  try {
    const session = await auth();
    if (!session || !session.user || !["admin", "member"].includes(session.user.role)) {
      console.error("Unauthorized access attempt:", { session });
      return NextResponse.json({ error: "Unauthorized: Admin or Member access required" }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const { taskId, status } = await req.json();

    if (!taskId || !status) {
      return NextResponse.json({ error: "Task ID and status are required" }, { status: 400 });
    }

    if (!["not_started", "in_progress", "pending_verification"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const [task] = await db
      .select()
      .from(assignedTaskStatus)
      .where(and(eq(assignedTaskStatus.id, taskId), eq(assignedTaskStatus.memberId, userId)));

    if (!task) {
      return NextResponse.json({ error: "Task not found or not assigned to user" }, { status: 404 });
    }

    if (task.status === "verified" || task.status === "done") {
      return NextResponse.json({ error: "Cannot update verified or done tasks" }, { status: 400 });
    }

    const [updatedTask] = await db
      .update(assignedTaskStatus)
      .set({ status, updatedAt: new Date() })
      .where(eq(assignedTaskStatus.id, taskId))
      .returning();

    console.log("Assigned task status updated:", { taskId, status, userId });

    return NextResponse.json({ task: updatedTask });
  } catch (error) {
    console.error("Error updating assigned task status:", error);
    return NextResponse.json({ error: `Failed to update task status: ${error.message}` }, { status: 500 });
  }
}