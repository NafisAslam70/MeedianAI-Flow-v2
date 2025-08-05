// app/(main)/api/member/routine-tasks/route.js
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { routineTasks, routineTaskDailyStatuses, users, openCloseTimes } from "@/lib/schema";
import { eq, and, sql } from "drizzle-orm";

export async function GET(req) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

  // GET /api/member/routine-tasks?action=routineTasks (for MemberDashboard, RoutineTasks)
  if (action === "routineTasks") {
    try {
      const tasks = await db
        .select({
          id: routineTasks.id,
          description: routineTasks.description,
          memberId: routineTasks.memberId,
          createdAt: routineTasks.createdAt,
          status: routineTaskDailyStatuses.status,
          comment: routineTaskDailyStatuses.comment,
          isLocked: routineTaskDailyStatuses.isLocked,
        })
        .from(routineTasks)
        .leftJoin(
          routineTaskDailyStatuses,
          and(
            eq(routineTasks.id, routineTaskDailyStatuses.routineTaskId),
            eq(sql`DATE(${routineTaskDailyStatuses.date})`, date)
          )
        )
        .where(eq(routineTasks.memberId, parseInt(session.user.id)));

      return NextResponse.json({ tasks }, { status: 200 });
    } catch (error) {
      console.error("GET /api/member/routine-tasks error:", error);
      return NextResponse.json({ error: `Failed to fetch routine tasks: ${error.message}` }, { status: 500 });
    }
  }

  // GET /api/member/routine-tasks?action=routineTasksAdmin (for RoutineTaskStatus)
  if (action === "routineTasksAdmin") {
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const memberId = searchParams.get("memberId");
    if (!memberId || isNaN(parseInt(memberId))) {
      return NextResponse.json({ error: "Invalid memberId" }, { status: 400 });
    }

    try {
      const tasks = await db
        .select({
          id: routineTasks.id,
          description: routineTasks.description,
          memberId: routineTasks.memberId,
          memberName: users.name,
          createdAt: routineTasks.createdAt,
        })
        .from(routineTasks)
        .innerJoin(users, eq(routineTasks.memberId, users.id))
        .where(eq(routineTasks.memberId, parseInt(memberId)));

      const statuses = await db
        .select({
          id: routineTaskDailyStatuses.id,
          routineTaskId: routineTaskDailyStatuses.routineTaskId,
          description: routineTasks.description,
          memberName: users.name,
          status: routineTaskDailyStatuses.status,
          date: routineTaskDailyStatuses.date,
          updatedAt: routineTaskDailyStatuses.updatedAt,
          comment: routineTaskDailyStatuses.comment,
          isLocked: routineTaskDailyStatuses.isLocked,
        })
        .from(routineTaskDailyStatuses)
        .innerJoin(routineTasks, eq(routineTaskDailyStatuses.routineTaskId, routineTasks.id))
        .innerJoin(users, eq(routineTasks.memberId, users.id))
        .where(
          and(
            eq(sql`DATE(${routineTaskDailyStatuses.date})`, date),
            eq(routineTasks.memberId, parseInt(memberId))
          )
        );

      return NextResponse.json({ tasks, statuses }, { status: 200 });
    } catch (error) {
      console.error("GET /api/member/routine-tasks error:", error);
      return NextResponse.json({ error: `Failed to fetch routine tasks: ${error.message}` }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function POST(req) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  // POST /api/member/routine-tasks?action=routineTasksAdmin (for RoutineTaskStatus)
  if (action === "routineTasksAdmin") {
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { memberId, description, status } = await req.json();
    if (!memberId || !description) {
      return NextResponse.json({ error: "Member ID and description are required" }, { status: 400 });
    }

    try {
      const [task] = await db
        .insert(routineTasks)
        .values({
          memberId: parseInt(memberId),
          description,
          createdAt: new Date(),
        })
        .returning({ id: routineTasks.id });

      await db.insert(routineTaskDailyStatuses).values({
        routineTaskId: task.id,
        date: new Date(),
        status: status || "not_started",
        updatedAt: new Date(),
        isLocked: false,
      });

      return NextResponse.json({ taskId: task.id }, { status: 201 });
    } catch (error) {
      console.error("POST /api/member/routine-tasks error:", error);
      return NextResponse.json({ error: `Failed to create routine task: ${error.message}` }, { status: 500 });
    }
  }

  // POST /api/member/routine-tasks?action=closeDay (for MemberDashboard)
  if (action === "closeDay") {
    const { userId, date, tasks, comment } = await req.json();
    if (!userId || !date || !tasks) {
      return NextResponse.json({ error: "User ID, date, and tasks are required" }, { status: 400 });
    }

    try {
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, parseInt(userId)))
        .then((res) => res[0]);
      if (!user || user.id !== parseInt(session.user.id)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const times = await db
        .select()
        .from(openCloseTimes)
        .where(eq(openCloseTimes.userType, user.type))
        .then((res) => res[0]);
      if (!times) {
        return NextResponse.json({ error: "Open/close times not found" }, { status: 404 });
      }

      const now = new Date();
      const closingStart = new Date();
      const [startH, startM] = times.closingWindowStart.split(":").map(Number);
      closingStart.setHours(startH, startM, 0, 0);
      const closingEnd = new Date();
      const [endH, endM] = times.closingWindowEnd.split(":").map(Number);
      closingEnd.setHours(endH, endM, 0, 0);
      if (now < closingStart || now > closingEnd) {
        return NextResponse.json({ error: "Not within closing window" }, { status: 400 });
      }

      // Validate tasks
      for (const task of tasks) {
        if (!Number.isInteger(task.id) || typeof task.markAsCompleted !== "boolean") {
          return NextResponse.json({ error: "Invalid task data" }, { status: 400 });
        }
      }

      // Defer updates to dayCloseRequests (handled in /api/member/dayCloseRequest)
      return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
      console.error("POST /api/member/routine-tasks error:", error);
      return NextResponse.json({ error: `Failed to close day: ${error.message}` }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function PATCH(req) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  // PATCH /api/member/routine-tasks?action=routineTasksStatus (for MemberDashboard, RoutineTasks)
  if (action === "routineTasksStatus") {
    const { taskId, status, date, comment } = await req.json();
    if (!taskId || !status) {
      return NextResponse.json({ error: "Task ID and status are required" }, { status: 400 });
    }

    try {
      const [taskStatus] = await db
        .select()
        .from(routineTaskDailyStatuses)
        .where(
          and(
            eq(routineTaskDailyStatuses.routineTaskId, taskId),
            eq(sql`DATE(${routineTaskDailyStatuses.date})`, date || new Date().toISOString().split("T")[0])
          )
        );
      if (!taskStatus) {
        return NextResponse.json({ error: "Task status not found" }, { status: 404 });
      }
      if (taskStatus.isLocked || taskStatus.status === "verified" || taskStatus.status === "done") {
        return NextResponse.json({ error: "Cannot update locked, verified, or done task" }, { status: 400 });
      }

      await db
        .update(routineTaskDailyStatuses)
        .set({ status, updatedAt: new Date(), comment })
        .where(
          and(
            eq(routineTaskDailyStatuses.routineTaskId, taskId),
            eq(sql`DATE(${routineTaskDailyStatuses.date})`, date || new Date().toISOString().split("T")[0])
          )
        );

      return NextResponse.json({ message: "Task status updated" }, { status: 200 });
    } catch (error) {
      console.error("PATCH /api/member/routine-tasks error:", error);
      return NextResponse.json({ error: `Failed to update task status: ${error.message}` }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}