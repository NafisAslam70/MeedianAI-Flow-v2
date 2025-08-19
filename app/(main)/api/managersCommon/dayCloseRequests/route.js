import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { dayCloseRequests, users, routineTaskDailyStatuses, routineTaskLogs } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

export async function GET(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const userId = searchParams.get("userId");

  try {
    let query = db
      .select({
        id: dayCloseRequests.id,
        userId: dayCloseRequests.userId,
        date: dayCloseRequests.date,
        status: dayCloseRequests.status,
        mriCleared: dayCloseRequests.mriCleared,
        assignedTasksUpdates: dayCloseRequests.assignedTasksUpdates,
        routineTasksUpdates: dayCloseRequests.routineTasksUpdates,
        routineLog: dayCloseRequests.routineLog,
        generalLog: dayCloseRequests.generalLog,
        createdAt: dayCloseRequests.createdAt,
        approvedBy: dayCloseRequests.approvedBy,
        approvedAt: dayCloseRequests.approvedAt,
        userName: users.name,
      })
      .from(dayCloseRequests)
      .innerJoin(users, eq(dayCloseRequests.userId, users.id))
      .where(eq(dayCloseRequests.date, new Date(date)));

    if (userId) {
      query = query.and(eq(dayCloseRequests.userId, Number(userId)));
    }

    const requests = await query;

    return NextResponse.json({ requests }, { status: 200 });
  } catch (error) {
    console.error("GET /api/managersCommon/dayCloseRequests error:", error);
    return NextResponse.json({ error: `Failed to fetch day close requests: ${error.message}` }, { status: 500 });
  }
}

export async function POST(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { requestId, action } = await req.json(); // action: "approve" or "reject"

  if (!requestId || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Missing or invalid requestId/action" }, { status: 400 });
  }

  try {
    const [request] = await db
      .select()
      .from(dayCloseRequests)
      .where(eq(dayCloseRequests.id, requestId));

    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (request.status !== "pending") {
      return NextResponse.json({ error: "Request is not pending" }, { status: 400 });
    }

    const newStatus = action === "approve" ? "approved" : "rejected";

    await db
      .update(dayCloseRequests)
      .set({
        status: newStatus,
        approvedBy: session.user.id,
        approvedAt: new Date(),
      })
      .where(eq(dayCloseRequests.id, requestId));

    if (action === "approve") {
      // Update routine task daily statuses
      if (request.routineTasksUpdates) {
        for (const update of request.routineTasksUpdates) {
          await db
            .insert(routineTaskDailyStatuses)
            .values({
              routineTaskId: update.id,
              date: request.date,
              status: update.done ? "done" : "not_done",
              updatedAt: new Date(),
              comment: null, // Individual comments not supported; use common log
              isLocked: true,
            })
            .onConflictDoUpdate({
              target: [routineTaskDailyStatuses.routineTaskId, routineTaskDailyStatuses.date],
              set: {
                status: update.done ? "done" : "not_done",
                updatedAt: new Date(),
                isLocked: true,
              },
            });
        }
      }

      // Log common routine log if provided
      if (request.routineLog) {
        await db.insert(routineTaskLogs).values({
          userId: request.userId,
          action: "day_close_routine_log",
          details: request.routineLog,
          createdAt: new Date(),
        });
      }
    }

    // Notify user (optional: send chat message or WhatsApp)

    return NextResponse.json({ success: true, newStatus }, { status: 200 });
  } catch (error) {
    console.error("POST /api/managersCommon/dayCloseRequests error:", error);
    return NextResponse.json({ error: `Failed to process request: ${error.message}` }, { status: 500 });
  }
}