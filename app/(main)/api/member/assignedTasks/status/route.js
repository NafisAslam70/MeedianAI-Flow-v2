import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignedTaskStatus, sprints, users, assignedTasks, messages, assignedTaskLogs } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq, and, inArray } from "drizzle-orm";
import twilio from "twilio";

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function sendWhatsappMessage(toNumber, content, recipientRow) {
  if (!toNumber || !recipientRow?.whatsapp_enabled) {
    console.log(`Skipping WhatsApp message: toNumber=${toNumber}, whatsapp_enabled=${recipientRow?.whatsapp_enabled}`);
    return;
  }
  try {
    const messageData = {
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:${toNumber}`,
      contentSid: "HX60cc1428638f310ed813993c89059169",
      contentVariables: JSON.stringify({
        1: content.recipientName || "User",
        2: content.updaterName || "System",
        3: content.taskTitle || "Untitled Task",
        4: content.newStatus || "Unknown",
        5: content.logComment || "No log provided",
        6: content.dateTime || new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      }),
    };
    console.log("Sending WhatsApp message:", messageData);
    const message = await twilioClient.messages.create(messageData);
    console.log("WhatsApp message sent, SID:", message.sid);
  } catch (err) {
    console.error("Twilio send error:", err.message, err.stack);
    throw err;
  }
}

export async function PATCH(req) {
  try {
    const session = await auth();
    if (!session || !["member", "team_manager", "admin"].includes(session.user?.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number(session.user.id);
    if (!Number.isInteger(userId)) {
      return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
    }

    const {
      taskId,
      status,
      sprintId,
      memberId,
      action,
      notifyAssignees = false,
      notifyWhatsapp = false,
      newLogComment = "No log provided",
    } = await req.json();

    if (
      !Number.isInteger(taskId) ||
      !status ||
      (action === "update_task" && memberId !== userId && session.user.role === "member") ||
      !["update_task", "update_sprint"].includes(action) ||
      !["not_started", "in_progress", "pending_verification", "done", "verified"].includes(status)
    ) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const taskStatusRows = await db
      .select({ id: assignedTaskStatus.id })
      .from(assignedTaskStatus)
      .where(and(eq(assignedTaskStatus.taskId, taskId), eq(assignedTaskStatus.memberId, userId)));
    const taskStatusRow = taskStatusRows[0];
    if (!taskStatusRow && session.user.role === "member") {
      return NextResponse.json({ error: "Task not assigned" }, { status: 404 });
    }

    const taskResult = await db
      .select({ title: assignedTasks.title, createdBy: assignedTasks.createdBy })
      .from(assignedTasks)
      .where(eq(assignedTasks.id, taskId));
    const task = taskResult[0];

    const updaterResult = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId));
    const updater = updaterResult[0];

    const assigneesResult = await db
      .select({ memberId: assignedTaskStatus.memberId })
      .from(assignedTaskStatus)
      .where(eq(assignedTaskStatus.taskId, taskId));
    const assignees = assigneesResult || [];

    const senderResult = await db
      .select({ whatsapp_number: users.whatsapp_number })
      .from(users)
      .where(eq(users.id, userId));
    const sender = senderResult[0];

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    if (!updater) {
      console.warn(`No user found for userId=${userId}`);
    }
    if (!sender) {
      console.warn(`No sender data found for userId=${userId}`);
    }

    const now = new Date();
    const updaterName = updater?.name || session?.user?.name || "Unknown";
    const senderWhatsapp = sender?.whatsapp_number;

    let notification = "";

    if (action === "update_task") {
      console.log(`Updating task status for taskId=${taskId} to ${status}`);
      await db
        .update(assignedTaskStatus)
        .set({ status, updatedAt: now })
        .where(eq(assignedTaskStatus.id, taskStatusRow.id));

      await db
        .insert(assignedTaskLogs)
        .values({
          taskId,
          userId,
          action: "status_update",
          details: newLogComment,
          createdAt: now,
        });

      notification = `Task "${task.title}" status updated to ${status.replace("_", " ")} by ${updaterName}`;
      if (newLogComment !== "No log provided") {
        notification += `. Comment: ${newLogComment}`;
      }
      notification += `. [task:${taskId}]`;
    }

    if (action === "update_sprint") {
      if (!Number.isInteger(sprintId)) {
        return NextResponse.json({ error: "sprintId required and must be an integer" }, { status: 400 });
      }

      console.log(`Updating sprint status for sprintId=${sprintId} to ${status}`);
      const sprintResult = await db
        .update(sprints)
        .set({
          status,
          verifiedAt: status === "done" ? now : null,
          updatedAt: now,
        })
        .where(eq(sprints.id, sprintId))
        .returning({ id: sprints.id, title: sprints.title });
      const sprint = sprintResult[0];
      if (!sprint) {
        return NextResponse.json({ error: "Sprint not found" }, { status: 404 });
      }

      await db
        .insert(assignedTaskLogs)
        .values({
          taskId,
          userId,
          action: "sprint_status_update",
          details: newLogComment,
          createdAt: now,
        });

      const statuses = await db
        .select({ status: sprints.status })
        .from(sprints)
        .where(eq(sprints.taskStatusId, taskStatusRow.id));

      const derived = statuses.every((s) => ["done", "verified"].includes(s.status))
        ? "done"
        : statuses.some((s) => ["in_progress", "pending_verification"].includes(s.status))
        ? "in_progress"
        : "not_started";

      await db
        .update(assignedTaskStatus)
        .set({ status: derived, updatedAt: now })
        .where(eq(assignedTaskStatus.id, taskStatusRow.id));

      notification = `Sprint "${sprint.title}" in task "${task.title}" updated to ${status.replace("_", " ")} by ${updaterName}`;
      if (newLogComment !== "No log provided") {
        notification += `. Comment: ${newLogComment}`;
      }
      notification += `. [task:${taskId} sprint:${sprintId}]`;
    }

    const toIds = [
      ...new Set(
        assignees
          .map((a) => a.memberId)
          .filter((id) => id && id !== userId && Number.isInteger(id))
          .concat(task.createdBy)
      ),
    ];
    console.log(`Prepared recipient IDs: ${toIds}`);

    if (notifyAssignees && toIds.length) {
      console.log(`Inserting chat notifications for recipients: ${toIds}`);
      await db.insert(messages).values(
        toIds.map((rid) => ({
          senderId: userId,
          recipientId: rid,
          content: notification,
          createdAt: now,
          status: "sent",
        }))
      );
    }

    if (notifyWhatsapp && senderWhatsapp && toIds.length) {
      console.log(`Fetching WhatsApp recipients for IDs: ${toIds}`);
      const recipients = await db
        .select({
          id: users.id,
          whatsapp_number: users.whatsapp_number,
          whatsapp_enabled: users.whatsapp_enabled,
          name: users.name,
        })
        .from(users)
        .where(inArray(users.id, toIds));

      const validRecipients = recipients.filter(
        (r) => r && r.id && r.whatsapp_number && r.whatsapp_enabled !== undefined
      );
      console.log("Valid WhatsApp recipients:", validRecipients);

      try {
        await Promise.all(
          validRecipients.map((r) =>
            sendWhatsappMessage(r.whatsapp_number, {
              recipientName: r.name || "User",
              updaterName: updaterName,
              taskTitle: task.title || "Untitled Task",
              newStatus: status.replace("_", " "),
              logComment: newLogComment,
              dateTime: new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
            }, r)
          )
        );
      } catch (err) {
        console.error("WhatsApp notification failed:", err.message, err.stack);
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("PATCH /assignedTasks/status error:", err.message, err.stack);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}