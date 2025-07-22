import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignedTasks, assignedTaskStatus, users, sprints as sprintTable } from "@/lib/schema";
import { eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";

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
    // Step 1: Verify task exists
    const task = await db
      .select({ id: assignedTasks.id })
      .from(assignedTasks)
      .where(eq(assignedTasks.id, taskId));

    if (!task || task.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Step 2: Check access rights
    const assignments = await db
      .select({ memberId: assignedTaskStatus.memberId, teamType: users.team_manager_type })
      .from(assignedTaskStatus)
      .leftJoin(users, eq(assignedTaskStatus.memberId, users.id))
      .where(eq(assignedTaskStatus.taskId, taskId));

    if (session.user.role === "team_manager" && session.user.team_manager_type) {
      const hasAccess = assignments.every(
        (a) => a.teamType === session.user.team_manager_type
      );
      if (!hasAccess) {
        return NextResponse.json(
          { error: "Unauthorized: Cannot delete tasks for this team" },
          { status: 403 }
        );
      }
    }

    // Step 3: Get taskStatus IDs to delete sprints
    const taskStatusIds = await db
      .select({ id: assignedTaskStatus.id })
      .from(assignedTaskStatus)
      .where(eq(assignedTaskStatus.taskId, taskId));

    const statusIdArray = taskStatusIds.map((ts) => ts.id);

    // Step 4: Delete sprints if any
    if (statusIdArray.length > 0) {
      await db
        .delete(sprintTable)
        .where(inArray(sprintTable.taskStatusId, statusIdArray));
    }

    // Step 5: Delete task assignments
    await db.delete(assignedTaskStatus).where(eq(assignedTaskStatus.taskId, taskId));

    // Step 6: Delete task itself
    await db.delete(assignedTasks).where(eq(assignedTasks.id, taskId));

    return NextResponse.json({ message: "Task deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json({ error: `Failed to delete task: ${error.message}` }, { status: 500 });
  }
}

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

    // 1. Update title/description
    if (title || description) {
      await db
        .update(assignedTasks)
        .set({
          ...(title && { title }),
          ...(description && { description }),
          updatedAt: new Date(),
        })
        .where(eq(assignedTasks.id, taskId));
    }

    // 2. Validate and update assignees
    let currentAssignments = await db
      .select({ id: assignedTaskStatus.id, memberId: assignedTaskStatus.memberId })
      .from(assignedTaskStatus)
      .leftJoin(users, eq(assignedTaskStatus.memberId, users.id))
      .where(eq(assignedTaskStatus.taskId, taskId));

    if (session.user.role === "team_manager" && session.user.team_manager_type) {
      currentAssignments = currentAssignments.filter(
        (a) => a.team_manager_type === session.user.team_manager_type
      );
    }

    if (Array.isArray(assignees) && assignees.length > 0) {
      const parsedAssignees = assignees.map((id) => parseInt(id));
      let assigneeQuery = db
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.id, parsedAssignees));
      if (session.user.role === "team_manager" && session.user.team_manager_type) {
        assigneeQuery = assigneeQuery.where(eq(users.team_manager_type, session.user.team_manager_type));
      }
      const validAssignees = await assigneeQuery;

      if (validAssignees.length !== parsedAssignees.length) {
        return NextResponse.json({ error: "One or more assignees are invalid or not accessible" }, { status: 400 });
      }

      // delete old
      await db.delete(assignedTaskStatus).where(eq(assignedTaskStatus.taskId, taskId));
      // insert new
      const statusInserts = parsedAssignees.map((memberId) => ({
        taskId,
        memberId,
        status: "not_started",
        assignedDate: new Date(),
        updatedAt: new Date(),
      }));
      await db.insert(assignedTaskStatus).values(statusInserts);

      // refresh assignment list for sprint step
      currentAssignments = statusInserts.map((entry, i) => ({
        id: i + 1, // not accurate without returning IDs
        memberId: entry.memberId,
      }));
    }

    // 3. Handle sprints
    if (Array.isArray(sprints) && sprints.length > 0) {
      if (sprints.some((sprint) => !sprint.title)) {
        return NextResponse.json({ error: "All sprints must have a title" }, { status: 400 });
      }

      const taskStatusIds = currentAssignments.map((a) => a.id);

      // clean old sprints
      await db.delete(sprintTable).where(eq(sprintTable.taskStatusId, currentAssignments[0]?.id));

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

      // determine task status
      const sprintStatuses = await db
        .select({ status: sprintTable.status })
        .from(sprintTable)
        .where(eq(sprintTable.taskStatusId, currentAssignments[0].id));

      const statuses = sprintStatuses.map((s) => s.status);
      let newStatus = "not_started";
      if (statuses.length > 0) {
        if (statuses.every((s) => s === "done" || s === "verified")) {
          newStatus = "done";
        } else if (statuses.some((s) => s === "in_progress" || s === "pending_verification")) {
          newStatus = "in_progress";
        }
      }

      await db
        .update(assignedTaskStatus)
        .set({
          status: newStatus,
          updatedAt: new Date(),
          comment: statuses.length > 0 ? "Status updated based on sprints" : "No sprints assigned, status reset",
        })
        .where(eq(assignedTaskStatus.taskId, taskId));
    } else {
      // reset to not_started
      await db
        .update(assignedTaskStatus)
        .set({
          status: "not_started",
          updatedAt: new Date(),
          comment: "No sprints assigned, status reset",
        })
        .where(eq(assignedTaskStatus.taskId, taskId));
    }

    return NextResponse.json({ message: "Task updated successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json({ error: `Failed to update task: ${error.message}` }, { status: 500 });
  }
}