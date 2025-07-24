import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignedTasks, assignedTaskStatus, users, sprints } from "@/lib/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";

// =================== GET ===================
export async function GET(req, { params }) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const taskId = parseInt(params.taskId);
  if (isNaN(taskId)) {
    return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
  }

  try {
    const tasks = await db
      .select({
        id: assignedTasks.id,
        title: assignedTasks.title,
        description: assignedTasks.description,
        taskType: assignedTasks.taskType,
        createdBy: assignedTasks.createdBy,
        createdAt: assignedTasks.createdAt,
        deadline: assignedTasks.deadline,
        resources: assignedTasks.resources,
        assignees: sql`json_agg(
          json_build_object(
            'id', ${users.id},
            'name', ${users.name},
            'email', ${users.email},
            'status', ${assignedTaskStatus.status}
          )
        )`.as("assignees"),
        sprints: sql`json_agg(
          json_build_object(
            'id', ${sprints.id},
            'title', ${sprints.title},
            'description', ${sprints.description},
            'status', ${sprints.status}
          )
        ) FILTER (WHERE ${sprints.id} IS NOT NULL)`.as("sprints"),
      })
      .from(assignedTasks)
      .leftJoin(assignedTaskStatus, eq(assignedTaskStatus.taskId, assignedTasks.id))
      .leftJoin(users, eq(assignedTaskStatus.memberId, users.id))
      .leftJoin(sprints, eq(sprints.taskStatusId, assignedTaskStatus.id))
      .where(eq(assignedTasks.id, taskId))
      .groupBy(assignedTasks.id);

    if (!tasks || tasks.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const formattedTask = tasks[0];
    const assignees = Array.isArray(formattedTask.assignees)
      ? formattedTask.assignees.filter((a) => a.id !== null)
      : [];
    const sprints = Array.isArray(formattedTask.sprints) ? formattedTask.sprints : [];
    let status = "not_started";
    if (sprints.length > 0) {
      const sprintStatuses = sprints.map((s) => s.status);
      if (sprintStatuses.every((s) => s === "verified" || s === "done")) {
        status = "done";
      } else if (sprintStatuses.some((s) => s === "in_progress" || s === "pending_verification")) {
        status = "in_progress";
      }
    } else {
      const assigneeStatuses = assignees.map((a) => a.status).filter(Boolean);
      if (assigneeStatuses.length > 0) {
        if (assigneeStatuses.every((s) => s === "done" || s === "verified")) {
          status = "done";
        } else if (assigneeStatuses.some((s) => s === "in_progress" || s === "pending_verification")) {
          status = "in_progress";
        }
      }
    }

    return NextResponse.json(
      {
        ...formattedTask,
        status,
        assignees: assignees.map(({ status, ...rest }) => rest),
        sprints,
      },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } }
    );
  } catch (error) {
    console.error("Error fetching task:", error);
    return NextResponse.json({ error: "Failed to fetch task" }, { status: 500 });
  }
}

// =================== POST ===================
export async function POST(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { title, description, taskType, createdBy, assignees, deadline, resources } = await req.json();

    if (!title || !assignees || assignees.length === 0) {
      return NextResponse.json({ error: "Title and at least one assignee are required" }, { status: 400 });
    }

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

    // Insert new task
    const [newTask] = await db
      .insert(assignedTasks)
      .values({
        title,
        description: description || null,
        taskType: taskType || "assigned",
        createdBy: parseInt(createdBy),
        createdAt: new Date(),
        deadline: deadline ? new Date(deadline) : null,
        resources: resources || null,
      })
      .returning({ id: assignedTasks.id });

    // Insert assigned statuses
    const statusInserts = parsedAssignees.map((memberId) => ({
      taskId: newTask.id,
      memberId,
      status: "not_started",
      assignedDate: new Date(),
      updatedAt: new Date(),
    }));

    await db.insert(assignedTaskStatus).values(statusInserts);

    return NextResponse.json({ taskId: newTask.id }, { status: 201 });
  } catch (error) {
    console.error("Error creating task:", error);
    return NextResponse.json({ error: `Failed to create task: ${error.message}` }, { status: 500 });
  }
}

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
      await db.delete(sprints).where(inArray(sprints.taskStatusId, statusIdArray));
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

  const taskId = parseInt(await params.taskId);
  if (isNaN(taskId)) {
    return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
  }

  try {
    const { title, description, assignees, sprints: sprintData, deadline, resources } = await req.json();

    // Validate task existence
    const taskExists = await db
      .select({ id: assignedTasks.id })
      .from(assignedTasks)
      .where(eq(assignedTasks.id, taskId));

    if (!taskExists || taskExists.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Update task details if provided
    if (title || description || deadline !== undefined || resources !== undefined) {
      await db
        .update(assignedTasks)
        .set({
          ...(title && { title }),
          ...(description !== undefined && { description: description || null }),
          ...(deadline !== undefined && { deadline: deadline ? new Date(deadline) : null }),
          ...(resources !== undefined && { resources: resources || null }),
          updatedAt: new Date(),
        })
        .where(eq(assignedTasks.id, taskId));
    }

    // Update assignees if provided
    if (Array.isArray(assignees) && assignees.length > 0) {
      const parsedAssignees = assignees.map((id) => parseInt(id)).filter((id) => !isNaN(id));

      if (parsedAssignees.length === 0) {
        return NextResponse.json({ error: "No valid assignees provided" }, { status: 400 });
      }

      const validAssignees = await db
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.id, parsedAssignees));

      if (validAssignees.length !== parsedAssignees.length) {
        return NextResponse.json({ error: "One or more assignees are invalid" }, { status: 400 });
      }

      // Fetch current assignedTaskStatus IDs
      const currentAssignments = await db
        .select({ id: assignedTaskStatus.id })
        .from(assignedTaskStatus)
        .where(eq(assignedTaskStatus.taskId, taskId));

      const statusIdArray = currentAssignments.map((a) => a.id).filter(Boolean);

      // Delete related sprints first
      if (statusIdArray.length > 0) {
        await db.delete(sprints).where(inArray(sprints.taskStatusId, statusIdArray));
      }

      // Delete existing assignedTaskStatus entries
      await db.delete(assignedTaskStatus).where(eq(assignedTaskStatus.taskId, taskId));

      // Insert new assignedTaskStatus entries
      const statusInserts = parsedAssignees.map((memberId) => ({
        taskId,
        memberId,
        status: "not_started",
        assignedDate: new Date(),
        updatedAt: new Date(),
      }));
      await db.insert(assignedTaskStatus).values(statusInserts);
    }

    // Update sprints if provided
    if (Array.isArray(sprintData) && sprintData.length > 0) {
      const currentAssignments = await db
        .select({ id: assignedTaskStatus.id })
        .from(assignedTaskStatus)
        .where(eq(assignedTaskStatus.taskId, taskId));

      const statusIdArray = currentAssignments.map((a) => a.id).filter(Boolean);

      if (statusIdArray.length > 0) {
        await db.delete(sprints).where(inArray(sprints.taskStatusId, statusIdArray));

        const sprintInserts = sprintData
          .filter((sprint) => sprint.title)
          .flatMap((sprint) =>
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

        if (sprintInserts.length > 0) {
          await db.insert(sprints).values(sprintInserts);
        }
      }
    }

    return NextResponse.json({ message: "Task updated successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json({ error: `Failed to update task: ${error.message}` }, { status: 500 });
  }
}