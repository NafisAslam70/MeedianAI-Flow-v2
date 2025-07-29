import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignedTaskStatus, sprints, users, assignedTasks, messages } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function PATCH(req) {
  try {
    const session = await auth();
    if (!session || !session.user || session.user.role !== "member") {
      return NextResponse.json(
        { error: "Unauthorized: Member access required" },
        { status: 401 }
      );
    }

    const userId = parseInt(session.user.id);
    const body = await req.json();
    const { taskId, status, sprintId, memberId, action, notifyAssignees = false } = body;

    if (!taskId || !status || memberId !== userId || !action) {
      return NextResponse.json(
        { error: "Invalid task ID, status, member ID, or action" },
        { status: 400 }
      );
    }

    if (!["not_started", "in_progress", "pending_verification", "done"].includes(status)) {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
    }

    const [taskStatus] = await db
      .select({ id: assignedTaskStatus.id })
      .from(assignedTaskStatus)
      .where(
        and(
          eq(assignedTaskStatus.taskId, taskId),
          eq(assignedTaskStatus.memberId, userId)
        )
      )
      .limit(1);

    if (!taskStatus) {
      return NextResponse.json({ error: "Task not assigned to user" }, { status: 404 });
    }

    let title = '';
    let sprintTitle = '';
    let notificationContent = '';

    // Fetch task title for notifications
    const [taskData] = await db
      .select({ title: assignedTasks.title })
      .from(assignedTasks)
      .where(eq(assignedTasks.id, taskId))
      .limit(1);
    title = taskData.title;

    const [updaterData] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const updaterName = updaterData.name;

    // Fetch all assignees
    const assignees = await db
      .select({ memberId: assignedTaskStatus.memberId })
      .from(assignedTaskStatus)
      .where(eq(assignedTaskStatus.taskId, taskId));

    if (action === "update_task") {
      const [task] = await db
        .select({ status: assignedTaskStatus.status })
        .from(assignedTaskStatus)
        .where(
          and(
            eq(assignedTaskStatus.taskId, taskId),
            eq(assignedTaskStatus.memberId, userId)
          )
        )
        .limit(1);

      if (!task || ["verified", "done"].includes(task.status)) {
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

      console.log("Assigned task status updated", { taskId, status, userId });

      if (notifyAssignees) {
        notificationContent = `Task "${title}" status updated to ${status} by ${updaterName}.`;
        const now = new Date();
        for (const assignee of assignees) {
          if (assignee.memberId !== userId) {
            await db.insert(messages).values({
              senderId: userId,
              recipientId: assignee.memberId,
              content: notificationContent,
              createdAt: now,
              status: "sent",
            });
          }
        }
      }

      return NextResponse.json({ task: updatedTask }, { status: 200 });
    }

    if (action === "update_sprint") {
      if (!sprintId) {
        return NextResponse.json({ error: "Sprint ID is required for sprint update" }, { status: 400 });
      }

      const [sprint] = await db
        .select({ status: sprints.status })
        .from(sprints)
        .where(
          and(
            eq(sprints.id, sprintId),
            eq(sprints.taskStatusId, taskStatus.id)
          )
        )
        .limit(1);

      if (!sprint || ["verified", "done"].includes(sprint.status)) {
        return NextResponse.json({ error: "Cannot update verified or done sprints" }, { status: 400 });
      }

      const [updatedSprint] = await db
        .update(sprints)
        .set({
          status,
          verifiedAt: status === "done" ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(sprints.id, sprintId))
        .returning();

      // Fetch sprint title for notification
      const [sprintData] = await db
        .select({ title: sprints.title })
        .from(sprints)
        .where(eq(sprints.id, sprintId))
        .limit(1);
      sprintTitle = sprintData.title;

      // Determine task-level status from all sprint statuses
      const allSprints = await db
        .select({ status: sprints.status })
        .from(sprints)
        .where(eq(sprints.taskStatusId, taskStatus.id));

      let derivedTaskStatus = "not_started";
      if (allSprints.every(s => s.status === "done" || s.status === "verified")) {
        derivedTaskStatus = "done";
      } else if (allSprints.some(s => s.status === "in_progress" || s.status === "pending_verification")) {
        derivedTaskStatus = "in_progress";
      }

      await db
        .update(assignedTaskStatus)
        .set({ status: derivedTaskStatus, updatedAt: new Date() })
        .where(
          and(
            eq(assignedTaskStatus.taskId, taskId),
            eq(assignedTaskStatus.memberId, userId)
          )
        );

      console.log("Sprint status updated", { taskId, sprintId, status, derivedTaskStatus, userId });

      if (notifyAssignees) {
        notificationContent = `Sprint "${sprintTitle}" in task "${title}" status updated to ${status} by ${updaterName}.`;
        const now = new Date();
        for (const assignee of assignees) {
          if (assignee.memberId !== userId) {
            await db.insert(messages).values({
              senderId: userId,
              recipientId: assignee.memberId,
              content: notificationContent,
              createdAt: now,
              status: "sent",
            });
          }
        }
      }

      return NextResponse.json({ sprint: updatedSprint }, { status: 200 });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error updating status:", error, { body: await req.json().catch(() => ({})) });
    return NextResponse.json(
      { error: `Failed to update status: ${error.message}` },
      { status: 500 }
    );
  }
}