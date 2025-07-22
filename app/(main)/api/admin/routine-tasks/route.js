import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { routineTasks, routineTaskDailyStatuses, users } from "@/lib/schema";
import { eq, and, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(req) {
  const session = await auth();
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get("memberId");
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

  if (!memberId || isNaN(parseInt(memberId))) {
    return NextResponse.json({ error: "Invalid memberId" }, { status: 400 });
  }

  try {
    // Fetch routine tasks
    const routineTasksData = await db
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

    // Fetch routine task statuses
    const routineTaskStatuses = await db
      .select({
        id: routineTaskDailyStatuses.id,
        routineTaskId: routineTaskDailyStatuses.routineTaskId,
        description: routineTasks.description,
        memberName: users.name,
        status: routineTaskDailyStatuses.status,
        date: routineTaskDailyStatuses.date,
        updatedAt: routineTaskDailyStatuses.updatedAt,
        comment: routineTaskDailyStatuses.comment,
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

    return NextResponse.json({
      tasks: routineTasksData,
      statuses: routineTaskStatuses,
    });
  } catch (error) {
    console.error("Error fetching routine tasks and statuses:", error);
    return NextResponse.json({ error: "Failed to fetch routine tasks and statuses" }, { status: 500 });
  }
}