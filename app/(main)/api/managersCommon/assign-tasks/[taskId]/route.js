import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  assignedTasks,
  assignedTaskStatus,
  users,
  sprints as sprintTable,
  messages,
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
      .select({ id: assignedTasks.id, title: assignedTasks.title, createdBy: assignedTasks.createdBy })
      .from(assignedTasks)
      .where(eq(assignedTasks.id, taskId));

    if (!task || task.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Get assignees for notifications
    const assignees = await db
      .select({ memberId: assignedTaskStatus.memberId })
      .from(assignedTaskStatus)
      .where(eq(assignedTaskStatus.taskId, taskId));

    const assigneeIds = assignees.map((a) => a.memberId);

    // Get creator name for notifications
    const [creatorData] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    const creatorName = creatorData?.name || "Unknown";

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

    // Send notifications to assignees
    const now = new Date();
    for (const memberId of assigneeIds) {
      await db.insert(messages).values({
        senderId: session.user.id,
        recipientId: memberId,
        content: `Task "${task[0].title}" has been deleted by ${creatorName}.`,
        createdAt: now,
        status: "sent",
      });
    }

    console.log("Task deleted:", { taskId, title: task[0].title, deletedBy: session.user.id });

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
    const { title, description, assignees, sprints, deadline, resources } = await req.json();

    // Get current task data for comparison and notifications
    const [currentTask] = await db
      .select({
        title: assignedTasks.title,
        description: assignedTasks.description,
        deadline: assignedTasks.deadline,
        resources: assignedTasks.resources,
      })
      .from(assignedTasks)
      .where(eq(assignedTasks.id, taskId))
      .limit(1);

    if (!currentTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Get current assignees for comparison
    const currentAssignees = await db
      .select({ memberId: assignedTaskStatus.memberId })
      .from(assignedTaskStatus)
      .where(eq(assignedTaskStatus.taskId, taskId));

    const currentAssigneeIds = currentAssignees.map((a) => a.memberId);

    // Get creator name for notifications
    const [creatorData] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    const creatorName = creatorData?.name || "Unknown";

    let notificationContent = `Task "${title || currentTask.title}" updated by ${creatorName}: `;
    let sendNotification = false;

    // Update task details if provided
    if (title || description || deadline || resources) {
      await db.update(assignedTasks)
        .set({
          ...(title && { title }),
          ...(description && { description }),
          ...(deadline && { deadline: new Date(deadline) }),
          ...(resources && { resources }),
          updatedAt: new Date(),
        })
        .where(eq(assignedTasks.id, taskId));

      if (title && title !== currentTask.title) {
        notificationContent += `Title changed to "${title}". `;
        sendNotification = true;
      }
      if (description && description !== currentTask.description) {
        notificationContent += "Description updated. ";
        sendNotification = true;
      }
      if (deadline && deadline !== currentTask.deadline) {
        notificationContent += `Deadline changed to ${new Date(deadline).toLocaleString()}. `;
        sendNotification = true;
      }
      if (resources && resources !== currentTask.resources) {
        notificationContent += "Resources updated. ";
        sendNotification = true;
      }
    }

    // Update assignees if provided
    if (Array.isArray(assignees) && assignees.length > 0) {
      const parsedAssignees = assignees.map((id) => parseInt(id));

      let query = db
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.id, parsedAssignees));

      if (session.user.role === "team_manager" && session.user.team_manager_type) {
        query = query.where(eq(users.team_manager_type, session.user.team_manager_type));
      }

      const validAssignees = await query;

      if (validAssignees.length !== parsedAssignees.length) {
        return NextResponse.json({ error: "One or more assignees are invalid or not accessible" }, { status: 400 });
      }

      // Delete old assignments
      await db.delete(assignedTaskStatus).where(eq(assignedTaskStatus.taskId, taskId));

      // Insert new assignments
      const statusInserts = parsedAssignees.map((memberId) => ({
        taskId,
        memberId,
        status: "not_started",
        assignedDate: new Date(),
        updatedAt: new Date(),
      }));
      await db.insert(assignedTaskStatus).values(statusInserts);

      // Check if assignees changed
      const newAssigneeIds = parsedAssignees.sort();
      const oldAssigneeIds = currentAssigneeIds.sort();
      if (JSON.stringify(newAssigneeIds) !== JSON.stringify(oldAssigneeIds)) {
        notificationContent += "Assignees updated. ";
        sendNotification = true;
      }
    }

    // Update sprints if provided
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

        if (sprints.length > 0) {
          notificationContent += `${sprints.length} sprint(s) added/updated. `;
          sendNotification = true;
        }
      }
    }

    // Send notifications if changes were made
    if (sendNotification) {
      const now = new Date();
      const assigneeIds = assignees ? assignees.map((id) => parseInt(id)) : currentAssigneeIds;  // Use new or old assignees
      for (const memberId of assigneeIds) {
        await db.insert(messages).values({
          senderId: session.user.id,
          recipientId: memberId,
          content: notificationContent.trim(),
          createdAt: now,
          status: "sent",
        });
      }
    }

    console.log("Task updated:", { taskId, changes: { title, description, assignees, sprints, deadline, resources }, updatedBy: session.user.id });

    return NextResponse.json({ message: "Task updated successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error updating task:", error, { body: await req.json().catch(() => ({})) });
    return NextResponse.json({ error: `Failed to update task: ${error.message}` }, { status: 500 });
  }
}