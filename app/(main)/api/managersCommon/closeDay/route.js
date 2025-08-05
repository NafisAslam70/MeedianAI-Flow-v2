// app/api/managersCommon/closeDay/route.js (new combined route for all close day actions)
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { assignedTasks, notCompletedTasks, assignedTaskStatus, assignedTaskLogs, routineTaskDailyStatuses } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { action } = body;

  if (action === "updateDeadline") {
    const { taskId, newDeadline } = body;
    try {
      await db.update(assignedTasks)
        .set({ deadline: new Date(newDeadline) })
        .where(eq(assignedTasks.id, taskId));
      return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
      return NextResponse.json({ error: `Failed to update deadline: ${error.message}` }, { status: 500 });
    }
  } else if (action === "moveToUndone") {
    const { taskType, taskId, userId, date, details } = body;
    try {
      await db.insert(notCompletedTasks).values({
        taskType,
        taskId,
        userId,
        date: new Date(date),
        details,
      });
      return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
      return NextResponse.json({ error: `Failed to move to undone: ${error.message}` }, { status: 500 });
    }
  } else if (action === "pushLog") {
    const { taskId, details } = body;
    try {
      await db.insert(assignedTaskLogs).values({
        taskId,
        userId: session.user.id,
        action: "log_added",
        details,
        createdAt: new Date(),
      });
      return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
      return NextResponse.json({ error: `Failed to push log: ${error.message}` }, { status: 500 });
    }
  } else if (action === "updateRoutineStatus") {
    const { routineTaskId, date, status, comment } = body;
    try {
      const [existing] = await db
        .select()
        .from(routineTaskDailyStatuses)
        .where(and(
          eq(routineTaskDailyStatuses.routineTaskId, routineTaskId),
          eq(routineTaskDailyStatuses.date, new Date(date))
        ));
      if (existing) {
        await db.update(routineTaskDailyStatuses)
          .set({
            status,
            comment,
            updatedAt: new Date(),
            isLocked: true,
          })
          .where(eq(routineTaskDailyStatuses.id, existing.id));
      } else {
        await db.insert(routineTaskDailyStatuses).values({
          routineTaskId,
          date: new Date(date),
          status,
          comment,
          updatedAt: new Date(),
          isLocked: true,
        });
      }
      return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
      return NextResponse.json({ error: `Failed to update routine status: ${error.message}` }, { status: 500 });
    }
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
}