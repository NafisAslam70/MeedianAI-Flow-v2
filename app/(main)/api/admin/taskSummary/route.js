import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignedTaskStatus, routineTaskDailyStatuses, users } from "@/lib/schema";
import { eq, and, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const memberType = searchParams.get("memberType") || "all";
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

  try {
    let query = db
      .select({
        totalTasks: sql`COUNT(DISTINCT ${assignedTaskStatus.taskId}) + COUNT(DISTINCT ${routineTaskDailyStatuses.id})`.as("totalTasks"),
        completedTasks: sql`
          COUNT(DISTINCT CASE WHEN ${assignedTaskStatus.status} IN ('verified', 'done') THEN ${assignedTaskStatus.taskId} END) +
          COUNT(DISTINCT CASE WHEN ${routineTaskDailyStatuses.status} IN ('verified', 'done', 'completed') THEN ${routineTaskDailyStatuses.id} END)
        `.as("completedTasks"),
        inProgressTasks: sql`
          COUNT(DISTINCT CASE WHEN ${assignedTaskStatus.status} IN ('in_progress', 'pending_verification') THEN ${assignedTaskStatus.taskId} END) +
          COUNT(DISTINCT CASE WHEN ${routineTaskDailyStatuses.status} IN ('in_progress', 'pending_verification') THEN ${routineTaskDailyStatuses.id} END)
        `.as("inProgressTasks"),
        notStartedTasks: sql`
          COUNT(DISTINCT CASE WHEN ${assignedTaskStatus.status} = 'not_started' THEN ${assignedTaskStatus.taskId} END) +
          COUNT(DISTINCT CASE WHEN ${routineTaskDailyStatuses.status} = 'not_started' THEN ${routineTaskDailyStatuses.id} END)
        `.as("notStartedTasks"),
      })
      .from(assignedTaskStatus)
      .leftJoin(routineTaskDailyStatuses, sql`DATE(${routineTaskDailyStatuses.date}) = ${date}`)
      .leftJoin(users, eq(assignedTaskStatus.memberId, users.id));

    if (session.user.role === "team_manager") {
      query = query.where(
        and(
          eq(users.team_manager_type, session.user.team_manager_type),
          sql`DATE(${assignedTaskStatus.assignedDate}) = ${date}`
        )
      );
    } else if (memberType !== "all") {
      if (memberType === "admins") {
        query = query.where(eq(users.role, "admin"));
      } else if (memberType === "members") {
        query = query.where(eq(users.role, "member"));
      } else if (!isNaN(parseInt(memberType))) {
        query = query.where(eq(users.id, parseInt(memberType)));
      }
    }

    const [result] = await query;

    return NextResponse.json({
      totalTasks: Number(result.totalTasks) || 0,
      completedTasks: Number(result.completedTasks) || 0,
      inProgressTasks: Number(result.inProgressTasks) || 0,
      notStartedTasks: Number(result.notStartedTasks) || 0,
    });
  } catch (error) {
    console.error("Error fetching task summary:", error);
    return NextResponse.json({ error: "Failed to fetch task summary" }, { status: 500 });
  }
}