// /api/managersCommon/assign-tasks/[taskId]/route.js
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  assignedTasks,
  assignedTaskStatus,
  users,
  sprints as sprintTable
} from "@/lib/schema";
import { eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";

// =================== DELETE ===================
export async function DELETE(req, { params }) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const taskId = parseInt(params.taskId);
  if (isNaN(taskId)) {
    return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
  }

  try {
    const task = await db
      .select({ id: assignedTasks.id })
      .from(assignedTasks)
      .where(eq(assignedTasks.id, taskId));

    if (!task || task.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const taskStatusIds = await db
      .select({ id: assignedTaskStatus.id })
      .from(assignedTaskStatus)
      .where(eq(assignedTaskStatus.taskId, taskId));

    const statusIdArray = taskStatusIds.map((ts) => ts.id);

    if (statusIdArray.length > 0) {
      await db.delete(sprintTable).where(inArray(sprintTable.taskStatusId, statusIdArray));
    }

    await db.delete(assignedTaskStatus).where(eq(assignedTaskStatus.taskId, taskId));
    await db.delete(assignedTasks).where(eq(assignedTasks.id, taskId));

    return NextResponse.json({ message: "Task deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json({ error: `Failed to delete task: ${error.message}` }, { status: 500 });
  }
}

// =================== PATCH ===================
export async function PATCH(req, { params }) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const taskId = parseInt(params.taskId);
  if (isNaN(taskId)) {
    return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
  }

  try {
    const { title, description, assignees, sprints } = await req.json();

    if (title || description) {
      await db.update(assignedTasks)
        .set({
          ...(title && { title }),
          ...(description && { description }),
          updatedAt: new Date(),
        })
        .where(eq(assignedTasks.id, taskId));
    }

    if (Array.isArray(assignees) && assignees.length > 0) {
      const parsedAssignees = assignees.map((id) => parseInt(id));

      const validAssignees = await db
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.id, parsedAssignees));

      if (validAssignees.length !== parsedAssignees.length) {
        return NextResponse.json({ error: "One or more assignees are invalid" }, { status: 400 });
      }

      await db.delete(assignedTaskStatus).where(eq(assignedTaskStatus.taskId, taskId));
      const statusInserts = parsedAssignees.map((memberId) => ({
        taskId,
        memberId,
        status: "not_started",
        assignedDate: new Date(),
        updatedAt: new Date(),
      }));
      await db.insert(assignedTaskStatus).values(statusInserts);
    }

    if (Array.isArray(sprints)) {
      const currentAssignments = await db
        .select({ id: assignedTaskStatus.id })
        .from(assignedTaskStatus)
        .where(eq(assignedTaskStatus.taskId, taskId));

      if (currentAssignments.length > 0) {
        await db.delete(sprintTable).where(inArray(sprintTable.taskStatusId, currentAssignments.map((a) => a.id)));

        const sprintInserts = sprints.flatMap((sprint) =>
          currentAssignments.map((assignment) => ({
            taskStatusId: assignment.id,
            title: sprint.title,
            description: sprint.description || null,
            status: sprint.status || "not_started",
            verifiedBy: null,
            verifiedAt: null,
            createdAt: new Date(),
          }))
        );

        await db.insert(sprintTable).values(sprintInserts);
      }
    }

    return NextResponse.json({ message: "Task updated successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json({ error: `Failed to update task: ${error.message}` }, { status: 500 });
  }
}
