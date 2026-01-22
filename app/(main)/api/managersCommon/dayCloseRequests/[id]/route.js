// app/api/managersCommon/dayCloseRequests/[id]/route.js
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth"; 
import {
  dayCloseRequests,
  users,
  assignedTaskStatus,
  assignedTasks,
  assignedTaskLogs,
  routineTaskDailyStatuses,
  routineTaskLogs,
  messages,
  directWhatsappMessages,
} from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { format } from "date-fns";
import { sendWhatsappMessage, sendWhatsappTemplate } from "@/lib/whatsapp";

export async function PATCH(req, { params }) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const awaitedParams = await params;
  const id = awaitedParams.id;
  const { status, ISRoutineLog, ISGeneralLog } = await req.json();
  const supervisorId = Number(session.user.id);

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
        currentStatus: dayCloseRequests.status,
      })
      .from(dayCloseRequests)
      .where(eq(dayCloseRequests.id, id))
      .limit(1);

    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    if (request.currentStatus !== "pending") {
      return NextResponse.json({ error: "Request is not pending" }, { status: 400 });
    }

    if (status === "approved") {
      // 1) Assigned tasks updates
      for (const update of request.assignedTasksUpdates || []) {
        const [row] = await db
          .select({ id: assignedTaskStatus.id })
          .from(assignedTaskStatus)
          .where(and(eq(assignedTaskStatus.taskId, update.id), eq(assignedTaskStatus.memberId, request.userId)));

        if (row) {
          await db
            .update(assignedTaskStatus)
            .set({
              status: update.statusUpdate,
              updatedAt: new Date(),
              comment: update.comment || null,
              verifiedBy: update.statusUpdate === "verified" ? supervisorId : null,
              verifiedAt: update.statusUpdate === "verified" ? new Date() : null,
            })
            .where(eq(assignedTaskStatus.id, row.id));

          if (update.comment) {
            await db.insert(assignedTaskLogs).values({
              taskId: update.id,
              userId: supervisorId,
              action: "status_update",
              details: update.comment,
              createdAt: new Date(),
            });
          }
          if (update.newDeadline) {
            await db.update(assignedTasks).set({ deadline: new Date(update.newDeadline) }).where(eq(assignedTasks.id, update.id));
          }
        }
      }

      // 2) Routine tasks daily statuses
      for (const upd of request.routineTasksUpdates || []) {
        const [daily] = await db
          .select({ id: routineTaskDailyStatuses.id })
          .from(routineTaskDailyStatuses)
          .where(and(eq(routineTaskDailyStatuses.routineTaskId, upd.id), eq(routineTaskDailyStatuses.date, request.date)));

        const newStatus = upd.done ? "done" : "not_done"; // ✅ consistent

        if (daily) {
          await db
            .update(routineTaskDailyStatuses)
            .set({ status: newStatus, updatedAt: new Date(), isLocked: true })
            .where(eq(routineTaskDailyStatuses.id, daily.id));
        } else {
          await db.insert(routineTaskDailyStatuses).values({
            routineTaskId: upd.id,
            date: request.date,
            status: newStatus,
            updatedAt: new Date(),
            isLocked: true,
          });
        }
      }

      // 3) Member routine comment (optional)
      if (request.routineLog) {
        await db.insert(routineTaskLogs).values({
          routineTaskId: null,
          userId: request.userId,
          action: "close_day_comment",
          details: request.routineLog,
          createdAt: new Date(),
        });
      }

      // 4) Supervisor routine comment (optional)
      if (ISRoutineLog) {
        await db.insert(routineTaskLogs).values({
          routineTaskId: null,
          userId: supervisorId,
          action: "is_routine_comment",
          details: ISRoutineLog,
          createdAt: new Date(),
        });
      }
    }

    const decisionTimestamp = new Date();

    // Update request + IS comments
    await db
      .update(dayCloseRequests)
      .set({
        status,
        approvedBy: supervisorId,
        approvedAt: decisionTimestamp,
        ISRoutineLog: ISRoutineLog || null,
        ISGeneralLog: ISGeneralLog || null,
      })
      .where(eq(dayCloseRequests.id, id));

    // Notify member
    const msg =
      status === "approved"
        ? `Your day close request for ${format(new Date(request.date), "yyyy-MM-dd")} has been approved.` +
          (ISRoutineLog ? `\nSupervisor Routine Comment: ${ISRoutineLog}` : "") +
          (ISGeneralLog ? `\nSupervisor General Comment: ${ISGeneralLog}` : "")
        : `Your day close request for ${format(new Date(request.date), "yyyy-MM-dd")} has been rejected.` +
          (ISRoutineLog ? `\nSupervisor Routine Comment: ${ISRoutineLog}` : "") +
          (ISGeneralLog ? `\nSupervisor General Comment: ${ISGeneralLog}` : "");

    await db.insert(messages).values({
      senderId: supervisorId,
      recipientId: request.userId,
      content: msg,
      createdAt: new Date(),
      status: "sent",
    });

    // WhatsApp notify (best-effort)
    try {
      const [recipient] = await db
        .select({
          id: users.id,
          name: users.name,
          whatsapp_number: users.whatsapp_number,
          whatsapp_enabled: users.whatsapp_enabled,
        })
        .from(users)
        .where(eq(users.id, request.userId))
        .limit(1);
      const [supervisor] = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.id, supervisorId))
        .limit(1);

      if (recipient?.whatsapp_number && recipient.whatsapp_enabled !== false) {
        const dateLabel = format(new Date(request.date), "dd MMM yyyy");
        const subject = status === "approved" ? "Day Close Approved" : "Day Close Rejected";
        const messageBody =
          status === "approved"
            ? `Hi ${recipient.name || "there"}, your day close request for ${dateLabel} has been approved.`
            : `Hi ${recipient.name || "there"}, your day close request for ${dateLabel} has been rejected. Please review and resubmit.`;
        const noteParts = [];
        if (ISRoutineLog) noteParts.push(`Supervisor Routine Comment: ${ISRoutineLog}`);
        if (ISGeneralLog) noteParts.push(`Supervisor General Comment: ${ISGeneralLog}`);
        const note = noteParts.join(" ");
        const contact = supervisor?.name || "IS/COD";
        const senderDisplay = supervisor?.name
          ? `${supervisor.name} (from Meed Leadership Group)`
          : "Meed Leadership Group";
        const dateTime = new Date().toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        const templateSid =
          process.env.TWILIO_DAY_CLOSE_TEMPLATE_SID ||
          process.env.TWILIO_DIRECT_MESSAGE_TEMPLATE_SID ||
          "";

        const [log] = await db
          .insert(directWhatsappMessages)
          .values({
            senderId: supervisorId,
            recipientType: "existing",
            recipientUserId: recipient.id,
            recipientName: recipient.name || null,
            recipientWhatsappNumber: recipient.whatsapp_number,
            subject,
            message: messageBody,
            note: note || null,
            contact,
            createdAt: new Date(),
          })
          .returning({ id: directWhatsappMessages.id });

        try {
          const tw = templateSid
            ? await sendWhatsappTemplate(
                recipient.whatsapp_number,
                templateSid,
                {
                  1: recipient.name || "there",
                  2: senderDisplay,
                  3: subject,
                  4: messageBody,
                  5: note || "",
                  6: contact,
                  7: dateTime,
                },
                { whatsapp_enabled: recipient.whatsapp_enabled }
              )
            : await sendWhatsappMessage(
                recipient.whatsapp_number,
                {
                  recipientName: recipient.name || "there",
                  senderName: senderDisplay,
                  subject,
                  message: messageBody,
                  note,
                  contact,
                  dateTime,
                },
                { whatsapp_enabled: recipient.whatsapp_enabled }
              );

          if (tw?.sid && log?.id) {
            await db
              .update(directWhatsappMessages)
              .set({ twilioSid: tw.sid })
              .where(eq(directWhatsappMessages.id, log.id));
          }
        } catch (err) {
          if (log?.id) {
            await db
              .update(directWhatsappMessages)
              .set({ status: "failed", error: err?.message || String(err) })
              .where(eq(directWhatsappMessages.id, log.id));
          }
        }
      }
    } catch (err) {
      console.error("Day close WhatsApp notify failed:", err?.message || err);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error(`PATCH /api/managersCommon/dayCloseRequests/${id} error:`, error);
    return NextResponse.json({ error: `Failed to update request: ${error.message}` }, { status: 500 });
  }
}
