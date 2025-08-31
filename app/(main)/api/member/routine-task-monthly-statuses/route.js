import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { routineTasks, routineTaskDailyStatuses } from "@/lib/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { startOfMonth, endOfMonth } from "date-fns";

export async function GET(req) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const monthParam = searchParams.get("month");
  const memberIdParam = searchParams.get("memberId"); // optional override (for admins/managers)

  const requesterRole = session.user?.role;
  const requesterId = Number(session.user?.id || 0);

  // RBAC: only admin / team_manager can view other members' data
  let targetUserId = requesterId;
  if (memberIdParam) {
    const asNumber = Number(memberIdParam);
    if (!Number.isFinite(asNumber)) {
      return NextResponse.json({ error: "Invalid memberId" }, { status: 400 });
    }
    if (["admin", "team_manager"].includes(requesterRole) || asNumber === requesterId) {
      targetUserId = asNumber;
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const monthDate = monthParam ? new Date(monthParam) : new Date();
  if (isNaN(monthDate.getTime())) {
    return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  }

  const start = startOfMonth(monthDate);
  const end = endOfMonth(monthDate);

  try {
    // All routine tasks of the target user
    const tasks = await db
      .select({
        id: routineTasks.id,
        description: routineTasks.description,
      })
      .from(routineTasks)
      .where(eq(routineTasks.memberId, targetUserId));

    // All daily statuses for those tasks within the month
    const statuses = await db
      .select({
        routineTaskId: routineTaskDailyStatuses.routineTaskId,
        date: routineTaskDailyStatuses.date,
        status: routineTaskDailyStatuses.status,
        isLocked: routineTaskDailyStatuses.isLocked,
        updatedAt: routineTaskDailyStatuses.updatedAt,
      })
      .from(routineTaskDailyStatuses)
      .innerJoin(
        routineTasks,
        eq(routineTaskDailyStatuses.routineTaskId, routineTasks.id)
      )
      .where(
        and(
          eq(routineTasks.memberId, targetUserId),
          gte(routineTaskDailyStatuses.date, start),
          lte(routineTaskDailyStatuses.date, end)
        )
      );

    return NextResponse.json({ tasks, statuses }, { status: 200 });
  } catch (error) {
    console.error("[routine-task-monthly-statuses] GET error:", error);
    return NextResponse.json(
      { error: `Failed to fetch monthly statuses: ${error.message}` },
      { status: 500 }
    );
  }
}
