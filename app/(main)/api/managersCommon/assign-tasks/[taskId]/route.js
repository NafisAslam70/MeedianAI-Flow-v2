import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignedTasks, assignedTaskStatus, users, sprints, assignedTaskLogs, messages } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import twilio from "twilio";

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function sendWhatsappMessage(toNumber, content) {
  if (!toNumber) {
    console.log(`Skipping WhatsApp message: no toNumber`);
    return;
  }
  try {
    const messageData = {
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:${toNumber}`,
      contentSid: "HX60cc1428638f310ed813993c89059169", // Use appropriate template SID
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
  }
}

export async function GET(req) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const taskId = parseInt(url.searchParams.get("taskId"));

  if (action === "task") {
    if (isNaN(taskId)) {
      return NextResponse.json({ error: "taskId required" }, { status: 400 });
    }

    try {
      const [taskData] = await db
        .select({
          id: assignedTasks.id,
          title: assignedTasks.title,
          description: assignedTasks.description,
          createdBy: assignedTasks.createdBy,
          createdAt: assignedTasks.createdAt,
          updatedAt: assignedTasks.updatedAt,
          deadline: assignedTasks.deadline,
          resources: assignedTasks.resources,
        })
        .from(assignedTasks)
        .where(eq(assignedTasks.id, taskId));

      if (!taskData) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }

      const statuses = await db
        .select({
          statusId: assignedTaskStatus.id,
          memberId: assignedTaskStatus.memberId,
          status: assignedTaskStatus.status,
          name: users.name,
        })
        .from(assignedTaskStatus)
        .leftJoin(users, eq(assignedTaskStatus.memberId, users.id))
        .where(eq(assignedTaskStatus.taskId, taskId));

      const assignees = [];
      for (const stat of statuses) {
        const sprintList = await db
          .select({
            id: sprints.id,
            title: sprints.title,
            description: sprints.description,
            status: sprints.status,
          })
          .from(sprints)
          .where(eq(sprints.taskStatusId, stat.statusId));

        let effectiveStatus = stat.status;
        if (sprintList.length > 0) {
          const sprintStatuses = sprintList.map((s) => s.status);
          if (sprintStatuses.every((s) => s === "done" || s === "verified")) {
            effectiveStatus = "done";
          } else if (sprintStatuses.some((s) => s === "pending_verification")) {
            effectiveStatus = "pending_verification";
          } else if (sprintStatuses.some((s) => s !== "not_started")) {
            effectiveStatus = "in_progress";
          } else {
            effectiveStatus = "not_started";
          }
        }

        assignees.push({
          id: stat.memberId,
          name: stat.name,
          status: effectiveStatus,
          sprints: sprintList,
        });
      }

      const allEffective = assignees.map((a) => a.status);
      let overallStatus = "not_started";
      if (allEffective.length > 0) {
        if (allEffective.every((s) => s === "done" || s === "verified")) {
          overallStatus = "done";
        } else if (allEffective.some((s) => s === "pending_verification")) {
          overallStatus = "pending_verification";
        } else if (allEffective.some((s) => s !== "not_started")) {
          overallStatus = "in_progress";
        }
      }

      const task = {
        ...taskData,
        assignees,
        status: overallStatus,
      };

      return NextResponse.json({ task });
    } catch (error) {
      console.error("Error fetching task:", error);
      return NextResponse.json({ error: "Failed to fetch task" }, { status: 500 });
    }
  } else if (action === "logs") {
    if (isNaN(taskId)) {
      return NextResponse.json({ error: "taskId required" }, { status: 400 });
    }

    try {
      const logs = await db
        .select({
          id: assignedTaskLogs.id,
          taskId: assignedTaskLogs.taskId,
          userId: assignedTaskLogs.userId,
          action: assignedTaskLogs.action,
          details: assignedTaskLogs.details,
          createdAt: assignedTaskLogs.createdAt,
          sprintId: assignedTaskLogs.sprintId,
          userName: users.name,
        })
        .from(assignedTaskLogs)
        .leftJoin(users, eq(assignedTaskLogs.userId, users.id))
        .where(eq(assignedTaskLogs.taskId, taskId))
        .orderBy(desc(assignedTaskLogs.createdAt));

      return NextResponse.json({ logs });
    } catch (error) {
      console.error("Error fetching logs:", error);
      return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
    }
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
}

export async function POST(req) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { taskId, action, details } = body;

  if (action === "log_added") {
    if (!taskId || !details) {
      return NextResponse.json({ error: "taskId and details required" }, { status: 400 });
    }

    try {
      const [log] = await db
        .insert(assignedTaskLogs)
        .values({
          taskId,
          userId: session.user.id,
          action,
          details,
          createdAt: new Date(),
        })
        .returning();

      return NextResponse.json({ log });
    } catch (error) {
      console.error("Error adding log:", error);
      return NextResponse.json({ error: "Failed to add log" }, { status: 500 });
    }
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
}

export async function PATCH(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { taskId, status, action, notifyAssignees, notifyWhatsapp, newLogComment, memberId } = body;

  if (action !== "update_task" || !status || !taskId) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const now = new Date();

    if (newLogComment) {
      await db.insert(assignedTaskLogs).values({
        taskId,
        userId: session.user.id,
        action: "status_update",
        details: newLogComment,
        createdAt: now,
      });
    }

    const taskStatuses = await db.select().from(assignedTaskStatus).where(eq(assignedTaskStatus.taskId, taskId));

    for (const ts of taskStatuses) {
      const sprintList = await db.select().from(sprints).where(eq(sprints.taskStatusId, ts.id));

      if (sprintList.length > 0) {
        await db.update(sprints).set({
          status,
          verifiedBy: memberId,
          verifiedAt: now,
        }).where(eq(sprints.taskStatusId, ts.id));
      } else {
        await db.update(assignedTaskStatus).set({
          status,
          updatedAt: now,
        }).where(eq(assignedTaskStatus.id, ts.id));
      }

      if (notifyAssignees && ts.memberId !== session.user.id) {
        const content = `Task updated to ${status} by ${session.user.name}: ${newLogComment || ""} [task:${taskId}]`;
        await db.insert(messages).values({
          senderId: session.user.id,
          recipientId: ts.memberId,
          content,
          createdAt: now,
          status: "sent",
        });
      }

      if (notifyWhatsapp) {
        const [user] = await db.select({
          name: users.name,
          whatsapp_number: users.whatsapp_number,
          whatsapp_enabled: users.whatsapp_enabled,
        }).from(users).where(eq(users.id, ts.memberId));

        if (user.whatsapp_enabled && user.whatsapp_number) {
          await sendWhatsappMessage(user.whatsapp_number, {
            recipientName: user.name,
            updaterName: session.user.name,
            taskTitle: "Task", // Fetch title if needed
            newStatus: status,
            logComment: newLogComment || "No comment",
            dateTime: now.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
          });
        }
      }
    }

    await db.update(assignedTasks).set({ updatedAt: now }).where(eq(assignedTasks.id, taskId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}