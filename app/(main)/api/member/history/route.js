import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { routineTaskDailyStatuses, routineTasks, memberHistory } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function POST(req) {
  try {
    const session = await auth();
    if (!session || !session.user || session.user.role !== "member") {
      console.error("Unauthorized access attempt:", { session });
      return NextResponse.json({ error: "Unauthorized: Member access required" }, { status: 401 });
    }

    const memberId = parseInt(session.user.id);
    const { routineTaskId, comment, date } = await req.json();

    // Update routine task daily status
    const [updatedStatus] = await db
      .update(routineTaskDailyStatuses)
      .set({ status: "done", comment, updatedAt: new Date() })
      .where(eq(routineTaskDailyStatuses.routineTaskId, routineTaskId))
      .where(eq(routineTaskDailyStatuses.date, new Date(date)))
      .returning();

    if (!updatedStatus) {
      return NextResponse.json({ error: "Routine task status not found" }, { status: 404 });
    }

    // Fetch routine task details for history
    const [task] = await db
      .select({
        description: routineTasks.description,
      })
      .from(routineTasks)
      .where(eq(routineTasks.id, routineTaskId));

    // Insert into memberHistory
    await db.insert(memberHistory).values({
      memberId,
      taskType: "routine",
      taskId: routineTaskId,
      title: task.description.substring(0, 255), // Use description as title, truncated
      description: task.description,
      status: "done",
      completedAt: new Date(),
      comment,
      createdAt: new Date(),
    });

    console.log("Routine task completed and added to history:", { memberId, routineTaskId });

    return NextResponse.json({ message: "Routine task completed successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error completing routine task:", error);
    return NextResponse.json({ error: `Failed to complete routine task: ${error.message}` }, { status: 500 });
  }
}