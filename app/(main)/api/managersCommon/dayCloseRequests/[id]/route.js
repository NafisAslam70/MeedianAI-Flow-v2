import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { dayCloseRequests, users, assignedTaskStatus, assignedTasks, assignedTaskLogs, routineTaskDailyStatuses, routineTaskLogs, messages } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { format } from "date-fns";

export async function PATCH(req, { params }) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const awaitedParams = await params;
  const id = awaitedParams.id;
  const { status, ISRoutineLog, ISGeneralLog } = await req.json();
  const userId = Number(session.user.id);

  try {
    if (!["approved", "rejected"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const [request] = await db
      .select({
        userId: dayCloseRequests.userId,
        date: dayCloseRequests.date,
        assignedTasksUpdates: dayCloseRequests.assignedTasksUpdates,
        routineTasksUpdates: dayCloseRequests.routineTasksUpdates,
        routineLog: dayCloseRequests.routineLog,
        generalLog: dayCloseRequests.generalLog,
      })
      .from(dayCloseRequests)
      .where(eq(dayCloseRequests.id, id))
      .limit(1);

    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (status === "approved") {
      // Apply assigned task updates
      for (const update of request.assignedTasksUpdates || []) {
        const [taskStatus] = await db
          .select({ id: assignedTaskStatus.id })
          .from(assignedTaskStatus)
          .where(
            and(
              eq(assignedTaskStatus.taskId, update.id),
              eq(assignedTaskStatus.memberId, request.userId)
            )
          );
        if (taskStatus) {
          await db
            .update(assignedTaskStatus)
            .set({
              status: update.statusUpdate,
              updatedAt: new Date(),
              comment: update.comment,
              verifiedBy: update.statusUpdate === "verified" ? userId : null,
              verifiedAt: update.statusUpdate === "verified" ? new Date() : null,
            })
            .where(eq(assignedTaskStatus.id, taskStatus.id));

          if (update.comment) {
            await db.insert(assignedTaskLogs).values({
              taskId: update.id,
              userId,
              action: "status_update",
              details: update.comment,
              createdAt: new Date(),
            });
          }

          if (update.newDeadline) {
            await db
              .update(assignedTasks)
              .set({ deadline: new Date(update.newDeadline) })
              .where(eq(assignedTasks.id, update.id));
          }
        }
      }

      // Apply routine task updates
      for (const task of request.routineTasksUpdates || []) {
        const [statusRow] = await db
          .select({ id: routineTaskDailyStatuses.id })
          .from(routineTaskDailyStatuses)
          .where(
            and(
              eq(routineTaskDailyStatuses.routineTaskId, task.id),
              eq(routineTaskDailyStatuses.date, request.date)
            )
          );
        if (statusRow) {
          await db
            .update(routineTaskDailyStatuses)
            .set({
              status: task.done ? "done" : "not_started",
              updatedAt: new Date(),
              isLocked: true,
            })
            .where(eq(routineTaskDailyStatuses.id, statusRow.id));
        } else {
          await db.insert(routineTaskDailyStatuses).values({
            routineTaskId: task.id,
            date: request.date,
            status: task.done ? "done" : "not_started",
            updatedAt: new Date(),
            isLocked: true,
          });
        }
      }

      // Insert routine log if provided
      if (request.routineLog) {
        await db.insert(routineTaskLogs).values({
          routineTaskId: null,
          userId: request.userId,
          action: "close_day_comment",
          details: request.routineLog,
          createdAt: new Date(),
        });
      }

      // Insert IS routine comment if provided
      if (ISRoutineLog) {
        await db.insert(routineTaskLogs).values({
          routineTaskId: null,
          userId,
          action: "is_routine_comment",
          details: ISRoutineLog,
          createdAt: new Date(),
        });
      }
    }

    // Update request status and IS comments
    await db
      .update(dayCloseRequests)
      .set({
        status,
        approvedBy: status === "approved" ? userId : null,
        approvedAt: status === "approved" ? new Date() : null,
        ISRoutineLog: ISRoutineLog || null,
        ISGeneralLog: ISGeneralLog || null,
      })
      .where(eq(dayCloseRequests.id, id));

    // Notify user of approval/rejection with IS comments
    const message = status === "approved"
      ? `Your day close request for ${format(new Date(request.date), "yyyy-MM-dd")} has been approved.` +
        (ISRoutineLog ? `\nSupervisor Routine Comment: ${ISRoutineLog}` : "") +
        (ISGeneralLog ? `\nSupervisor General Comment: ${ISGeneralLog}` : "")
      : `Your day close request for ${format(new Date(request.date), "yyyy-MM-dd")} has been rejected.` +
        (ISRoutineLog ? `\nSupervisor Routine Comment: ${ISRoutineLog}` : "") +
        (ISGeneralLog ? `\nSupervisor General Comment: ${ISGeneralLog}` : "");
    await db.insert(messages).values({
      senderId: userId,
      recipientId: request.userId,
      content: message,
      createdAt: new Date(),
      status: "sent",
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error(`PATCH /api/managersCommon/dayCloseRequests/${id} error:`, error);
    return NextResponse.json({ error: `Failed to update request: ${error.message}` }, { status: 500 });
  }
}