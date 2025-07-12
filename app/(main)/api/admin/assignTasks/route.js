import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, sprints, taskAssignments } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function POST(req) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    console.error("Unauthorized access attempt:", { session });
    return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 401 });
  }

  try {
    const { title, description, taskType, createdBy, assignees, sprints: sprintInput } = await req.json();

    // Validate input
    if (!title || !Array.isArray(assignees) || assignees.length === 0) {
      return NextResponse.json({ error: "Task title and at least one assignee are required" }, { status: 400 });
    }
    if (taskType !== "assigned" && taskType !== "routine") {
      return NextResponse.json({ error: "Invalid task type" }, { status: 400 });
    }

    // Insert task
    const [newTask] = await db
      .insert(tasks)
      .values({
        title,
        description: description || null,
        taskType,
        createdBy,
        createdAt: new Date(),
      })
      .returning();

    // Insert assignees
    const assigneeInserts = assignees.map((memberId) => ({
      taskId: newTask.id,
      memberId,
    }));
    await db.insert(taskAssignments).values(assigneeInserts);

    // Insert sprints (if provided)
    if (Array.isArray(sprintInput) && sprintInput.length > 0) {
      const sprintInserts = sprintInput
        .filter((sprint) => sprint.title)
        .map((sprint) => ({
          taskAssignmentId: null, // link later if needed
          title: sprint.title,
          description: sprint.description || null,
          createdAt: new Date(),
        }));
      if (sprintInserts.length > 0) {
        await db.insert(sprints).values(sprintInserts);
      }
    }

    console.log("Task created:", { taskId: newTask.id, assignees, sprints: sprintInput?.length || 0 });
    return NextResponse.json({ message: "Task assigned successfully", taskId: newTask.id });
  } catch (error) {
    console.error("Error creating task:", error);
    return NextResponse.json({ error: `Failed to assign task: ${error.message}` }, { status: 500 });
  }
}

export async function GET(req) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    console.error("Unauthorized access attempt:", { session });
    return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 401 });
  }

  try {
    const taskList = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        taskType: tasks.taskType,
        createdBy: tasks.createdBy,
        createdAt: tasks.createdAt,
      })
      .from(tasks);

    const tasksWithDetails = await Promise.all(
      taskList.map(async (task) => {
        const assignees = await db
          .select({
            memberId: taskAssignments.memberId,
          })
          .from(taskAssignments)
          .where(eq(taskAssignments.taskId, task.id));

        const sprintList = await db
          .select({
            id: sprints.id,
            title: sprints.title,
          })
          .from(sprints)
          .where(eq(sprints.taskAssignmentId, task.id)); // adjust if sprint links via taskAssignmentId

        return {
          ...task,
          assignees: assignees.map((a) => a.memberId),
          sprints: sprintList,
        };
      })
    );

    console.log("Tasks fetched:", tasksWithDetails.length);
    return NextResponse.json({ tasks: tasksWithDetails });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json({ error: `Failed to fetch tasks: ${error.message}` }, { status: 500 });
  }
}
