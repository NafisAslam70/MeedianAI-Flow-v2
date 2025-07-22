import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { routineTasks, routineTaskDailyStatuses, users } from "@/lib/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const memberIds = searchParams.get("memberIds");
  const memberId = searchParams.get("memberId");
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const limit = parseInt(searchParams.get("limit") || 50);
  const offset = parseInt(searchParams.get("offset") || 0);

  try {
    if (memberIds) {
      const memberIdArray = memberIds.split(",").map((id) => parseInt(id)).filter((id) => !isNaN(id));
      if (memberIdArray.length === 0) {
        return NextResponse.json({ error: "Invalid memberIds" }, { status: 400 });
      }

      const routineTasksData = await db
        .select({
          id: routineTasks.id,
          description: routineTasks.description,
          memberId: routineTasks.memberId,
          createdAt: routineTasks.createdAt,
        })
        .from(routineTasks)
        .where(inArray(routineTasks.memberId, memberIdArray))
        .limit(limit)
        .offset(offset);

      const routineTaskStatuses = await db
        .select({
          id: routineTaskDailyStatuses.id,
          routineTaskId: routineTaskDailyStatuses.routineTaskId,
          status: routineTaskDailyStatuses.status,
          date: routineTaskDailyStatuses.date,
          updatedAt: routineTaskDailyStatuses.updatedAt,
          comment: routineTaskDailyStatuses.comment,
        })
        .from(routineTaskDailyStatuses)
        .innerJoin(routineTasks, eq(routineTaskDailyStatuses.routineTaskId, routineTasks.id))
        .where(
          and(
            eq(sql`DATE(${routineTaskDailyStatuses.date})`, date),
            inArray(routineTasks.memberId, memberIdArray)
          )
        )
        .limit(limit)
        .offset(offset);

      const result = {};
      memberIdArray.forEach((id) => {
        result[id] = {
          tasks: routineTasksData.filter((task) => task.memberId === id),
          statuses: routineTaskStatuses.filter((status) => status.memberId === id),
        };
      });

      return NextResponse.json(result);
    } else if (memberId && !isNaN(parseInt(memberId))) {
      const routineTasksData = await db
        .select({
          id: routineTasks.id,
          description: routineTasks.description,
          memberId: routineTasks.memberId,
          createdAt: routineTasks.createdAt,
        })
        .from(routineTasks)
        .where(eq(routineTasks.memberId, parseInt(memberId)))
        .limit(limit)
        .offset(offset);

      const routineTaskStatuses = await db
        .select({
          id: routineTaskDailyStatuses.id,
          routineTaskId: routineTaskDailyStatuses.routineTaskId,
          status: routineTaskDailyStatuses.status,
          date: routineTaskDailyStatuses.date,
          updatedAt: routineTaskDailyStatuses.updatedAt,
          comment: routineTaskDailyStatuses.comment,
        })
        .from(routineTaskDailyStatuses)
        .innerJoin(routineTasks, eq(routineTaskDailyStatuses.routineTaskId, routineTasks.id))
        .where(
          and(
            eq(sql`DATE(${routineTaskDailyStatuses.date})`, date),
            eq(routineTasks.memberId, parseInt(memberId))
          )
        )
        .limit(limit)
        .offset(offset);

      return NextResponse.json({
        tasks: routineTasksData,
        statuses: routineTaskStatuses,
      });
    } else {
      return NextResponse.json({ error: "Invalid memberId or memberIds" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error fetching routine tasks and statuses:", error);
    return NextResponse.json(
      { error: "Failed to fetch routine tasks and statuses" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { memberId, description, status } = await req.json();

    if (!memberId || !description || !status) {
      return NextResponse.json(
        { error: "Missing required fields: memberId, description, or status" },
        { status: 400 }
      );
    }

    const [newTask] = await db
      .insert(routineTasks)
      .values({
        memberId: parseInt(memberId),
        description,
        createdAt: new Date(),
      })
      .returning({ id: routineTasks.id });

    await db.insert(routineTaskDailyStatuses).values({
      routineTaskId: newTask.id,
      memberId: parseInt(memberId),
      status,
      date: new Date(),
      updatedAt: new Date(),
      comment: null,
    });

    return NextResponse.json({ taskId: newTask.id }, { status: 201 });
  } catch (error) {
    console.error("Error adding routine task:", error);
    return NextResponse.json(
      { error: "Failed to add routine task" },
      { status: 500 }
    );
  }
}

export async function PUT(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { taskId, description } = await req.json();

    if (!taskId || !description) {
      return NextResponse.json(
        { error: "Missing required fields: taskId or description" },
        { status: 400 }
      );
    }

    const [updatedTask] = await db
      .update(routineTasks)
      .set({ description, updatedAt: new Date() })
      .where(eq(routineTasks.id, parseInt(taskId)))
      .returning({ id: routineTasks.id });

    if (!updatedTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ taskId: updatedTask.id }, { status: 200 });
  } catch (error) {
    console.error("Error updating routine task:", error);
    return NextResponse.json(
      { error: "Failed to update routine task" },
      { status: 500 }
    );
  }
}

export async function DELETE(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { taskId } = await req.json();

    if (!taskId) {
      return NextResponse.json({ error: "Missing taskId" }, { status: 400 });
    }

    await db
      .delete(routineTaskDailyStatuses)
      .where(eq(routineTaskDailyStatuses.routineTaskId, parseInt(taskId)));

    const [deletedTask] = await db
      .delete(routineTasks)
      .where(eq(routineTasks.id, parseInt(taskId)))
      .returning({ id: routineTasks.id });

    if (!deletedTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ taskId: deletedTask.id }, { status: 200 });
  } catch (error) {
    console.error("Error deleting routine task:", error);
    return NextResponse.json(
      { error: "Failed to delete routine task" },
      { status: 500 }
    );
  }
}