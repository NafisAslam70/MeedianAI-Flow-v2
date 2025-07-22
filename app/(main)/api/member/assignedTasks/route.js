import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignedTasks, assignedTaskStatus, sprints } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq, and, gte, lte } from "drizzle-orm";

export async function GET(req) {
  try {
    const session = await auth();
    if (!session || !session.user || !["admin", "member"].includes(session.user.role)) {
      console.error("Unauthorized access attempt:", { session });
      return NextResponse.json({ error: "Unauthorized: Admin or Member access required" }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const tasks = await db
      .select({
        id: assignedTaskStatus.id,
        title: assignedTasks.title,
        description: assignedTasks.description,
        status: assignedTaskStatus.status,
        assignedDate: assignedTaskStatus.assignedDate,
      })
      .from(assignedTaskStatus)
      .innerJoin(assignedTasks, eq(assignedTaskStatus.taskId, assignedTasks.id))
      .where(
        and(
          eq(assignedTaskStatus.memberId, userId),
          gte(assignedTaskStatus.assignedDate, startOfDay),
          lte(assignedTaskStatus.assignedDate, endOfDay)
        )
      );

    console.log("Assigned tasks fetched:", tasks.length, { userId, date });

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("Error fetching assigned tasks:", error);
    return NextResponse.json({ error: `Failed to fetch assigned tasks: ${error.message}` }, { status: 500 });
  }
}