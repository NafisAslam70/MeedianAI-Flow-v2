// Full updated code for /api/managersCommon/assign-tasks/[taskId].js
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignedTasks, assignedTaskStatus, users, sprints as sprintTable, messages } from "@/lib/schema";
import { eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import twilio from "twilio";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/* ---------- WhatsApp helper --------------------------------------- */
async function sendWhatsappMessage(toNumber, content) {
  if (!toNumber) {
    console.log(`Skipping WhatsApp message: no toNumber`);
    return;
  }
  try {
    const messageData = {
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:${toNumber}`,
      contentSid: "HX60cc1428638f310ed813993c89059169",
      contentVariables: JSON.stringify({
        1: content.recipientName || "User", // {{1}}
        2: content.updaterName || "System", // {{2}}
        3: content.taskTitle || "Untitled Task", // {{3}}
        4: content.newStatus || "Unknown", // {{4}}
        5: content.logComment || "No log provided", // {{5}}
        6: content.dateTime || new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }), // {{6}}
      }),
    };
    console.log("Sending WhatsApp message:", messageData);
    const message = await twilioClient.messages.create(messageData);
    console.log("WhatsApp message sent, SID:", message.sid);
  } catch (err) {
    console.error("Twilio send error:", err.message, err.stack);
  }
}

/* -------------------------------------------------------------------------- */
/* DELETE /api/managersCommon/assign-tasks/[taskId]                           */
/* -------------------------------------------------------------------------- */
export async function DELETE(req, { params }) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const taskId = Number(params.taskId);
  if (Number.isNaN(taskId)) {
    return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
  }

  try {
    const task = await db
      .select({
        id: assignedTasks.id,
        title: assignedTasks.title,
        createdBy: assignedTasks.createdBy,
      })
      .from(assignedTasks)
      .where(eq(assignedTasks.id, taskId));

    if (!task.length) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    /* -------- gather assignees for notification -------------------------------- */
    const assignees = await db
      .select({ memberId: assignedTaskStatus.memberId, name: users.name, whatsapp_number: users.whatsapp_number, whatsapp_enabled: users.whatsapp_enabled })
      .from(assignedTaskStatus)
      .leftJoin(users, eq(assignedTaskStatus.memberId, users.id))
      .where(eq(assignedTaskStatus.taskId, taskId));
    const assigneeIds = assignees.map((a) => a.memberId);

    const [creator] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    const creatorName = creator?.name ?? "Unknown";

    /*---------------- delete cascades ------------------------------------------ */
    const taskStatusIds = await db
      .select({ id: assignedTaskStatus.id })
      .from(assignedTaskStatus)
      .where(eq(assignedTaskStatus.taskId, taskId));
    const statusIdArray = taskStatusIds.map((ts) => ts.id);

    if (statusIdArray.length) {
      await db.delete(sprintTable).where(
        inArray(sprintTable.taskStatusId, statusIdArray),
      );
    }
    await db.delete(assignedTaskStatus).where(
      eq(assignedTaskStatus.taskId, taskId),
    );
    await db.delete(assignedTasks).where(eq(assignedTasks.id, taskId));

    /* ---------------- send notifications --------------------------------------- */
    const now = new Date();
    const dateTime = new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

    for (const assignee of assignees) {
      if (assignee.memberId !== session.user.id) {
        await db.insert(messages).values({
          senderId: session.user.id,
          recipientId: assignee.memberId,
          content: `Task "${task[0].title}" has been deleted by ${creatorName}. [task:${taskId}]`,
          createdAt: now,
          status: "sent",
        });

        if (assignee.whatsapp_enabled && assignee.whatsapp_number) {
          await sendWhatsappMessage(assignee.whatsapp_number, {
            recipientName: assignee.name || "User",
            updaterName: creatorName,
            taskTitle: task[0].title,
            newStatus: "Deleted",
            logComment: "Task deleted",
            dateTime: dateTime,
          });
        }
      }
    }

    console.log("Task deleted", { taskId, deletedBy: session.user.id });
    return NextResponse.json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json(
      { error: `Failed to delete task: ${error.message}` },
      { status: 500 },
    );
  }
}

/* -------------------------------------------------------------------------- */
/* PATCH /api/managersCommon/assign-tasks/[taskId]                            */
/* -------------------------------------------------------------------------- */
export async function PATCH(req, { params }) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const taskId = Number(params.taskId);
  if (Number.isNaN(taskId)) {
    return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
  }

  try {
    const {
      title,
      description,
      assignees,
      sprints,      // may be [], meaning “clear all”
      deadline,
      resources,
    } = await req.json();

    /* -------- current data ----------------------------------------------------- */
    const [currentTask] = await db
      .select({
        title: assignedTasks.title,
        description: assignedTasks.description,
        deadline: assignedTasks.deadline,
        resources: assignedTasks.resources,
      })
      .from(assignedTasks)
      .where(eq(assignedTasks.id, taskId))
      .limit(1);
    if (!currentTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const currentAssignees = await db
      .select({ memberId: assignedTaskStatus.memberId })
      .from(assignedTaskStatus)
      .where(eq(assignedTaskStatus.taskId, taskId));
    const currentAssigneeIds = currentAssignees.map((a) => a.memberId);

    const [creator] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    const creatorName = creator?.name ?? "Unknown";

    let notification = `Task "${title || currentTask.title}" updated by ${creatorName}: `;
    let sendNotification = false;

    /* -------- update core fields ---------------------------------------------- */
    if (title !== undefined || description !== undefined || deadline !== undefined || resources !== undefined) {
      await db.update(assignedTasks)
        .set({
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(deadline !== undefined && { deadline: deadline ? new Date(deadline) : null }),
          ...(resources !== undefined && { resources }),
          updatedAt: new Date(),
        })
        .where(eq(assignedTasks.id, taskId));

      if (title !== undefined && title !== currentTask.title) { notification += `Title → "${title}". `; sendNotification = true; }
      if (description !== undefined && description !== currentTask.description) { notification += "Description changed. "; sendNotification = true; }
      if (deadline !== undefined && (deadline ? new Date(deadline).toISOString() : null) !== (currentTask.deadline?.toISOString() ?? null)) {
        notification += `Deadline → ${deadline ? new Date(deadline).toLocaleString() : "cleared"}. `;
        sendNotification = true;
      }
      if (resources !== undefined && resources !== currentTask.resources) { notification += "Resources updated. "; sendNotification = true; }
    }

    /* -------- update assignees ------------------------------------------------- */
    if (Array.isArray(assignees) && assignees.length) {
      const parsed = assignees.map(Number).filter((id) => !Number.isNaN(id));
      if (!parsed.length) {
        return NextResponse.json({ error: "No valid assignees" }, { status: 400 });
      }

      let q = db.select({ id: users.id }).from(users).where(inArray(users.id, parsed));
      if (session.user.role === "team_manager" && session.user.team_manager_type) {
        q = q.where(eq(users.team_manager_type, session.user.team_manager_type));
      }
      const valid = await q;
      if (valid.length !== parsed.length) {
        return NextResponse.json({ error: "Some assignees invalid / inaccessible" }, { status: 400 });
      }

      await db.delete(assignedTaskStatus).where(eq(assignedTaskStatus.taskId, taskId));
      await db.insert(assignedTaskStatus).values(
        parsed.map((memberId) => ({
          taskId,
          memberId,
          status: "not_started",
          assignedDate: new Date(),
          updatedAt: new Date(),
        })),
      );

      if (JSON.stringify(parsed.sort()) !== JSON.stringify([...currentAssigneeIds].sort())) {
        notification += "Assignees updated. ";
        sendNotification = true;
      }
    }

    /* -------- update sprints (CLEAR‑SAFE) ------------------------------------- */
    if (Array.isArray(sprints)) {
      const currentAssignments = await db
        .select({ id: assignedTaskStatus.id })
        .from(assignedTaskStatus)
        .where(eq(assignedTaskStatus.taskId, taskId));

      if (!currentAssignments.length) {
        return NextResponse.json(
          { error: "Cannot update sprints: task has no assignees" },
          { status: 400 },
        );
      }

      /* always wipe old sprints first */
      await db.delete(sprintTable).where(
        inArray(sprintTable.taskStatusId, currentAssignments.map((a) => a.id)),
      );

      const sprintRows = (sprints || [])
        .filter((s) => s.title)   // ignore untitled rows
        .flatMap((s) =>
          currentAssignments.map((a) => ({
            taskStatusId: a.id,
            title: s.title,
            description: s.description || null,
            status: s.status || "not_started",
            verifiedBy: null,
            verifiedAt: null,
            createdAt: new Date(),
          })),
        );

      if (sprintRows.length) {
        await db.insert(sprintTable).values(sprintRows);
        notification += `${sprintRows.length} sprint row(s) added. `;
      } else {
        notification += "All sprints cleared. ";
      }
      sendNotification = true;
    }

    /* -------- notifications ---------------------------------------------------- */
    const recipients =
      Array.isArray(assignees) && assignees.length
        ? assignees.map(Number).filter((id) => !Number.isNaN(id))
        : currentAssigneeIds;

    if (sendNotification) {
      notification += ` [task:${taskId}]`;
      const now = new Date();
      for (const memberId of recipients) {
        if (memberId !== session.user.id) {
          await db.insert(messages).values({
            senderId: session.user.id,
            recipientId: memberId,
            content: notification.trim(),
            createdAt: now,
            status: "sent",
          });
        }
      }
    }

    /* -------- WhatsApp notifications for update -------------------------------- */
    const dateTime = new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const logComment = "Task updated";

    if (recipients && recipients.length) {
      const assigneeDetails = await db
        .select({
          memberId: users.id,
          name: users.name,
          whatsapp_number: users.whatsapp_number,
          whatsapp_enabled: users.whatsapp_enabled,
        })
        .from(users)
        .where(inArray(users.id, recipients));

      for (const assignee of assigneeDetails) {
        if (assignee.whatsapp_enabled && assignee.whatsapp_number) {
          await sendWhatsappMessage(assignee.whatsapp_number, {
            recipientName: assignee.name || "User",
            updaterName: creatorName,
            taskTitle: title || currentTask.title,
            newStatus: "Updated",
            logComment: logComment,
            dateTime: dateTime,
          });
        }
      }
    }

    console.log("Task updated", { taskId, updatedBy: session.user.id });
    return NextResponse.json({ message: "Task updated successfully" });
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json(
      { error: `Failed to update task: ${error.message}` },
      { status: 500 },
    );
  }
}