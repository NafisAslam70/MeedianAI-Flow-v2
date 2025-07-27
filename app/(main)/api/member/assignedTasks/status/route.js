import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignedTaskStatus, sprints } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function PATCH(req) {
  try {
    const session = await auth();
    if (!session || !session.user || session.user.role !== "member") {
      console.error("Unauthorized access attempt:", { session });
      return NextResponse.json({ error: "Unauthorized: Member access required" }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const { taskId, status, sprintId, memberId, action } = await req.json();

    if (!taskId || !status || !memberId || memberId !== userId || !action) {
      return NextResponse.json({ error: "Invalid task ID, status, member ID, or action" }, { status: 400 });
    }

    if (!["not_started", "in_progress", "pending_verification", "done"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const taskStatus = await db
      .select({ id: assignedTaskStatus.id })
      .from(assignedTaskStatus)
      .where(
        and(
          eq(assignedTaskStatus.taskId, taskId),
          eq(assignedTaskStatus.memberId, userId)
        )
      )
      .limit(1);

    if (!taskStatus.length) {
      return NextResponse.json({ error: "Task not assigned to user" }, { status: 404 });
    }

    if (action === "update_task") {
      const [task] = await db
        .select()
        .from(assignedTaskStatus)
        .where(
          and(
            eq(assignedTaskStatus.taskId, taskId),
            eq(assignedTaskStatus.memberId, userId)
          )
        );

      if (!task) {
        return NextResponse.json({ error: "Task not found or not assigned to user" }, { status: 404 });
      }

      if (task.status === "verified" || task.status === "done") {
        return NextResponse.json({ error: "Cannot update verified or done tasks" }, { status: 400 });
      }

      const [updatedTask] = await db
        .update(assignedTaskStatus)
        .set({ status, updatedAt: new Date() })
        .where(
          and(
            eq(assignedTaskStatus.taskId, taskId),
            eq(assignedTaskStatus.memberId, userId)
          )
        )
        .returning();

      console.log("Assigned task status updated:", { taskId, status, userId });

      return NextResponse.json({ task: updatedTask });
    }

    if (action === "update_sprint") {
      if (!sprintId) {
        return NextResponse.json({ error: "Sprint ID is required for sprint update" }, { status: 400 });
      }

      const [sprint] = await db
        .select()
        .from(sprints)
        .where(
          and(
            eq(sprints.id, sprintId),
            eq(sprints.taskStatusId, taskStatus[0].id)
          )
        );

      if (!sprint) {
        return NextResponse.json({ error: "Sprint not found or not linked to task" }, { status: 404 });
      }

      if (sprint.status === "verified" || sprint.status === "done") {
        return NextResponse.json({ error: "Cannot update verified or done sprints" }, { status: 400 });
      }

      const [updatedSprint] = await db
        .update(sprints)
        .set({ status, verifiedAt: status === "done" ? new Date() : null })
        .where(eq(sprints.id, sprintId))
        .returning();

      console.log("Sprint status updated:", { sprintId, status, userId });

      return NextResponse.json({ sprint: updatedSprint });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error updating status:", error);
    return NextResponse.json({ error: `Failed to update status: ${error.message}` }, { status: 500 });
  }
}