import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db }   from "@/lib/db";
import {
  users,
  dailySlotLogs,
  assignedTasks,
  assignedTaskStatus,
  routineTasks,
  routineTaskDailyStatuses,
} from "@/lib/schema";
import { eq, and } from "drizzle-orm";

/**
 * Returns the data the wizard needs:
 * {
 *   mriCleared: boolean,
 *   assignedTasks: [ { id, title } ],
 *   routineTasks : [ { id, description } ]
 * }
 */
export async function GET() {
  /* 1️⃣  make sure caller is member or team-manager */
  const session = await auth();
  if (!session || !["member", "team_manager"].includes(session.user.role))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = +session.user.id;
  const today  = new Date().toISOString().substring(0, 10);   // YYYY-MM-DD

  /* 2️⃣  MRI cleared?  -> are there any slot logs today with status ≠ 'done' */
  const notDone = await db
    .select({ id: dailySlotLogs.id })
    .from(dailySlotLogs)
    .where(and(
      eq(dailySlotLogs.date, today),
      eq(dailySlotLogs.createdBy, userId),
      eq(dailySlotLogs.status, "not_started")          // tweak if you use another status
    ));

  const mriCleared = notDone.length === 0;

  /* 3️⃣  Assigned-tasks that still need attention (status ≠ done/verified) */
  const rows = await db
    .select({ id: assignedTasks.id, title: assignedTasks.title })
    .from(assignedTasks)
    .leftJoin(assignedTaskStatus, eq(assignedTasks.id, assignedTaskStatus.taskId))
    .where(and(
      eq(assignedTaskStatus.memberId, userId),
      assignedTaskStatus.status.notIn(["done","verified"])
    ));

  /* 4️⃣  Routine-tasks for today (status) */
  const rts = await db
    .select({
      id: routineTasks.id,
      description: routineTasks.description,
    })
    .from(routineTasks)
    .leftJoin(
      routineTaskDailyStatuses,
      and(
        eq(routineTasks.id, routineTaskDailyStatuses.routineTaskId),
        eq(routineTaskDailyStatuses.date, today)
      )
    )
    .where(eq(routineTasks.memberId, userId));

  return NextResponse.json({
    mriCleared,
    assignedTasks: rows,
    routineTasks : rts,
  });
}
