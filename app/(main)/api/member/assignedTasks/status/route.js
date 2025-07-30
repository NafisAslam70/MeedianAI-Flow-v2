// FILE: app/(main)/api/member/assignedTasks/status/route.js
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  assignedTaskStatus,
  sprints,
  users,
  assignedTasks,
  messages,
} from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq, and, inArray } from "drizzle-orm";
import twilio from "twilio";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/* ---------- WhatsApp helper --------------------------------------- */
async function sendWhatsappMessage(toNumber, content, recipientRow) {
  if (!toNumber || !recipientRow?.whatsapp_enabled) {
    console.log(`Skipping WhatsApp message: toNumber=${toNumber}, whatsapp_enabled=${recipientRow?.whatsapp_enabled}`);
    return;
  }
  try {
    const messageData = {
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`, // e.g., +15558125765
      to: `whatsapp:${toNumber}`,
      contentSid: "HXd9ecc991d4de6a17b67aa4c45c083f84", // Current approved SID
      contentVariables: JSON.stringify({
        1: content.type || "Task", // e.g., "Task"
        2: content.detail || `Task '${content.taskTitle || "Untitled"}' to ${content.status.replace("_", " ")}`, // e.g., "Task 'email banana mere bhai22' to in progress"
        3: content.date || new Date().toLocaleDateString("en-US", { dateStyle: "medium" }), // e.g., "Jul 30, 2025"
        4: content.time || new Date().toLocaleTimeString("en-US", { timeStyle: "short", timeZone: "Asia/Singapore" }), // e.g., "3:28 AM"
        5: content.action || "Reply if action needed", // e.g., "Reply if action needed"
      }),
    };
    console.log("Sending WhatsApp message:", messageData);
    const message = await twilioClient.messages.create(messageData);
    console.log("WhatsApp message sent, SID:", message.sid);
  } catch (err) {
    console.error("Twilio send error:", err.message, err.stack);
    throw err; // Propagate error to handle in PATCH
  }
}

/* ------------------------------------------------------------------ */
export async function PATCH(req) {
  try {
    /* 1 auth */
    const session = await auth();
    if (!session || session.user?.role !== "member") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = Number(session.user.id);
    if (!Number.isInteger(userId)) {
      return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
    }

    /* 2 body */
    const {
      taskId,
      status,
      sprintId,
      memberId,
      action,
      notifyAssignees = false,
      notifyWhatsapp = false,
    } = await req.json();

    if (
      !Number.isInteger(taskId) ||
      !status ||
      memberId !== userId ||
      !["update_task", "update_sprint"].includes(action) ||
      !["not_started", "in_progress", "pending_verification", "done"].includes(status)
    ) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    /* 3 confirm assignment */
    console.log(`Fetching task status for taskId=${taskId}, userId=${userId}`);
    const taskStatusRows = await db
      .select({ id: assignedTaskStatus.id })
      .from(assignedTaskStatus)
      .where(and(eq(assignedTaskStatus.taskId, taskId), eq(assignedTaskStatus.memberId, userId)))
      .limit(1);

    const taskStatusRow = taskStatusRows[0];
    if (!taskStatusRow) {
      return NextResponse.json({ error: "Task not assigned" }, { status: 404 });
    }

    /* 4 fetch common rows */
    console.log(`Fetching task, updater, assignees, and sender for taskId=${taskId}, userId=${userId}`);
    const [taskResult, updaterResult, assigneesResult, senderResult] = await Promise.all([
      db
        .select({ title: assignedTasks.title, createdBy: assignedTasks.createdBy })
        .from(assignedTasks)
        .where(eq(assignedTasks.id, taskId))
        .limit(1),
      db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1),
      db
        .select({ memberId: assignedTaskStatus.memberId })
        .from(assignedTaskStatus)
        .where(eq(assignedTaskStatus.taskId, taskId)),
      db
        .select({ whatsapp_number: users.whatsapp_number })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1),
    ]);

    const task = taskResult[0];
    const updater = updaterResult[0];
    const assignees = assigneesResult || [];
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
    const updaterName = updater?.name || "Unknown";
    const senderWhatsapp = sender?.whatsapp_number;

    /* 5 run update */
    let notification = "";

    if (action === "update_task") {
      console.log(`Updating task status for taskId=${taskId} to ${status}`);
      await db
        .update(assignedTaskStatus)
        .set({ status, updatedAt: now })
        .where(eq(assignedTaskStatus.id, taskStatusRow.id));

      notification = `Task "${task.title}" status updated to ${status.replace("_", " ")} by ${updaterName}.`;
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

      notification = `Sprint "${sprint.title}" in task "${task.title}" updated to ${status.replace("_", " ")} by ${updaterName}.`;
    }

    /* 6 prepare recipients */
    const toIds = [
      ...new Set(
        assignees
          .map((a) => a.memberId)
          .filter((id) => id && id !== userId && Number.isInteger(id))
          .concat(task.createdBy)
      ),
    ];
    console.log(`Prepared recipient IDs: ${toIds}`);

    /* 7 CHAT notifications */
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

    /* 8 WhatsApp */
    if (notifyWhatsapp && senderWhatsapp && toIds.length) {
      console.log(`Fetching WhatsApp recipients for IDs: ${toIds}`);
      const recipients = await db
        .select({
          id: users.id,
          whatsapp_number: users.whatsapp_number,
          whatsapp_enabled: users.whatsapp_enabled,
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
              type: action === "update_task" ? "Task" : "Sprint",
              detail: notification,
              date: new Date().toLocaleDateString("en-US", { dateStyle: "medium" }),
              time: new Date().toLocaleTimeString("en-US", { timeStyle: "short", timeZone: "Asia/Singapore" }),
              action: "Reply if action needed",
            }, r)
          )
        );
      } catch (err) {
        console.error("WhatsApp notification failed:", err.message);
        return NextResponse.json({ ok: true, warning: "WhatsApp notification failed" }, { status: 202 });
      }
    }

    /* 9 done */
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("PATCH /assignedTasks/status error:", err.message, err.stack);
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}