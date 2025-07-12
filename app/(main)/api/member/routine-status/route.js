import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { routineTasks, routineTaskDailyStatuses, appState, users } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function GET(req) {
  try {
    const session = await auth();
    if (!session || !session.user || session.user.role !== "member") {
      console.error("Unauthorized access attempt:", { session });
      return NextResponse.json({ error: "Unauthorized: Member access required" }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [appStateData] = await db.select().from(appState).limit(1);
    if (!appStateData) {
      console.error("App state not found");
      return NextResponse.json({ error: "App state not configured" }, { status: 500 });
    }

    const [user] = await db
      .select({ type: users.type })
      .from(users)
      .where(eq(users.id, userId));
    if (!user) {
      console.error("User not found:", { userId });
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userType = user.type || "residential";

    const closingWindows = {
      residential: { start: "19:30", end: "20:00" },
      non_residential: { start: "12:00", end: "12:30" },
      semi_residential: { start: "17:30", end: "18:00" },
    };

    const { start: closingStart, end: closingEnd } = closingWindows[userType];
    const todayStr = today.toISOString().split("T")[0];
    const startTime = new Date(`${todayStr}T${closingStart}:00`);
    const endTime = new Date(`${todayStr}T${closingEnd}:00`);
    const now = new Date();

    const isDayClosed = appStateData.dayClosedAt && new Date(appStateData.dayClosedAt) >= today;
    const isLocked = isDayClosed || now < startTime || now > endTime;

    const tasks = await db
      .select({
        id: routineTaskDailyStatuses.id,
        routineTaskId: routineTasks.id,
        title: routineTasks.description,
        description: routineTasks.description,
        status: routineTaskDailyStatuses.status,
        isLocked: routineTaskDailyStatuses.isLocked,
        date: routineTaskDailyStatuses.date,
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

    const formattedTasks = tasks.map((task) => ({
      id: task.id || task.routineTaskId,
      routineTaskId: task.routineTaskId,
      title: task.title || "Untitled Task",
      description: task.description || "",
      status: task.status || "not_started",
      isLocked: task.isLocked || isLocked,
    }));

    console.log("Routine tasks fetched:", formattedTasks.length, { userId, userType });

    return NextResponse.json({
      tasks: formattedTasks,
      locked: isLocked,
      type: userType,
      isDayClosed,
    });
  } catch (error) {
    console.error("Error fetching routine tasks:", error);
    return NextResponse.json({ error: `Failed to fetch routine tasks: ${error.message}` }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const session = await auth();
    if (!session || !session.user || session.user.role !== "member") {
      console.error("Unauthorized access attempt:", { session });
      return NextResponse.json({ error: "Unauthorized: Member access required" }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const { id, status } = await req.json();
    if (!id || !["not_started", "in_progress", "done"].includes(status)) {
      return NextResponse.json({ error: "Invalid task ID or status" }, { status: 400 });
    }

    const [appStateData] = await db.select().from(appState).limit(1);
    if (!appStateData) {
      console.error("App state not found");
      return NextResponse.json({ error: "App state not configured" }, { status: 500 });
    }

    const [user] = await db
      .select({ type: users.type })
      .from(users)
      .where(eq(users.id, userId));
    if (!user) {
      console.error("User not found:", { userId });
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userType = user.type || "residential";

    const closingWindows = {
      residential: { start: "19:30", end: "20:00" },
      non_residential: { start: "12:00", end: "12:30" },
      semi_residential: { start: "17:30", end: "18:00" },
    };

    const { start: closingStart, end: closingEnd } = closingWindows[userType];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];
    const startTime = new Date(`${todayStr}T${closingStart}:00`);
    const endTime = new Date(`${todayStr}T${closingEnd}:00`);
    const now = new Date();

    const isDayClosed = appStateData.dayClosedAt && new Date(appStateData.dayClosedAt) >= today;
    if (isDayClosed || now < startTime || now > endTime) {
      return NextResponse.json({ error: "Task updates are locked" }, { status: 403 });
    }

    const [task] = await db
      .select({ routineTaskId: routineTaskDailyStatuses.routineTaskId })
      .from(routineTaskDailyStatuses)
      .leftJoin(routineTasks, eq(routineTasks.id, routineTaskDailyStatuses.routineTaskId))
      .where(
        and(
          eq(routineTaskDailyStatuses.id, id),
          eq(routineTasks.memberId, userId),
          eq(routineTaskDailyStatuses.date, today)
        )
      );

    if (!task) {
      const [routineTask] = await db
        .select({ id: routineTasks.id })
        .from(routineTasks)
        .where(and(eq(routineTasks.id, id), eq(routineTasks.memberId, userId)));
      if (!routineTask) {
        return NextResponse.json({ error: "Task not found or not assigned to user" }, { status: 404 });
      }

      await db.insert(routineTaskDailyStatuses).values({
        routineTaskId: routineTask.id,
        date: today,
        status,
        updatedAt: new Date(),
      });
    } else {
      await db
        .update(routineTaskDailyStatuses)
        .set({ status, updatedAt: new Date() })
        .where(eq(routineTaskDailyStatuses.id, id));
    }

    console.log("Task status updated:", { taskId: id, status, userId });

    return NextResponse.json({ message: "Task status updated successfully" });
  } catch (error) {
    console.error("Error updating task status:", error);
    return NextResponse.json({ error: `Failed to update task status: ${error.message}` }, { status: 500 });
  }
}