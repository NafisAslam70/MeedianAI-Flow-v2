import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  assignedTaskStatus,
  assignedTasks,
  messages,
  userNoteShares,
  userNoteTaskLinks,
  userNotes,
  users,
} from "@/lib/schema";
import { and, eq, inArray } from "drizzle-orm";
import twilio from "twilio";

const twilioSid = process.env.TWILIO_ACCOUNT_SID;
const twilioToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_WHATSAPP_NUMBER;
const twilioClient = twilioSid && twilioToken ? twilio(twilioSid, twilioToken) : null;

async function sendWhatsappMessage(toNumber, content) {
  if (!twilioClient || !twilioNumber) return;
  if (!toNumber) return;
  try {
    await twilioClient.messages.create({
      from: `whatsapp:${twilioNumber}`,
      to: `whatsapp:${toNumber}`,
      contentSid: "HXe39dfecbcc4453ae05ae2a7f7f1da414",
      contentVariables: JSON.stringify({
        1: content.recipientName || "User",
        2: content.updaterName || "System",
        3: content.taskTitle || "Untitled Task",
        4: content.newStatus || "Assigned",
        5: content.logComment || "New task assigned",
        6: content.dateTime || new Date().toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      }),
    });
  } catch (error) {
    console.error("notes→tasks whatsapp send failed", error?.message || error);
  }
}

const ALLOWED_TASK_TYPES = new Set(["assigned", "routine"]);

export async function POST(req, context) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { params } = context || {};
    const resolvedParams = typeof params?.then === "function" ? await params : params;
    const noteId = parseInt(resolvedParams?.noteId ?? "", 10);
    if (!noteId) {
      return NextResponse.json({ error: "Invalid note id" }, { status: 400 });
    }

    const requesterId = parseInt(session.user.id, 10);
    const role = session.user.role || "";
    const isManager = ["admin", "team_manager"].includes(role);

    const [note] = await db
      .select({ id: userNotes.id, ownerId: userNotes.userId })
      .from(userNotes)
      .where(eq(userNotes.id, noteId))
      .limit(1);

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    let canManage = note.ownerId === requesterId;
    if (!canManage) {
      const [share] = await db
        .select({ canEdit: userNoteShares.canEdit })
        .from(userNoteShares)
        .where(
          and(
            eq(userNoteShares.noteId, noteId),
            eq(userNoteShares.sharedWithUserId, requesterId)
          )
        )
        .limit(1);
      canManage = Boolean(share?.canEdit);
    }

    if (!canManage) {
      return NextResponse.json({ error: "You do not have permission to create tasks from this note" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const tasksInput = Array.isArray(body?.tasks) ? body.tasks : [];

    if (!tasksInput.length) {
      return NextResponse.json({ error: "At least one task is required" }, { status: 400 });
    }

    const normalizedTasks = [];
    for (let i = 0; i < tasksInput.length; i += 1) {
      const raw = tasksInput[i] ?? {};
      const title = String(raw.title ?? "").trim();
      if (!title) {
        return NextResponse.json({ error: `Task #${i + 1} is missing a title` }, { status: 400 });
      }

      const description = raw.description !== undefined && raw.description !== null
        ? String(raw.description).trim() || null
        : null;

      const rawAssignees = Array.isArray(raw.assigneeIds)
        ? raw.assigneeIds
        : Array.isArray(raw.assignees)
          ? raw.assignees
          : [];

      const assigneeSet = new Set();
      for (const entry of rawAssignees) {
        const parsed = typeof entry === "number" ? entry : parseInt(entry?.id ?? entry, 10);
        if (parsed && Number.isFinite(parsed)) assigneeSet.add(parsed);
      }
      if (!isManager) {
        assigneeSet.clear();
        assigneeSet.add(requesterId);
      }
      const assigneeIds = [...assigneeSet];
      if (!assigneeIds.length) {
        return NextResponse.json({ error: `Task "${title}" needs at least one assignee` }, { status: 400 });
      }

      let deadline = null;
      if (raw.deadline) {
        const d = new Date(raw.deadline);
        if (Number.isNaN(d.getTime())) {
          return NextResponse.json({ error: `Task "${title}" has an invalid deadline` }, { status: 400 });
        }
        deadline = d;
      }

      let taskType = typeof raw.taskType === "string" ? raw.taskType.trim() : "assigned";
      if (!ALLOWED_TASK_TYPES.has(taskType)) taskType = "assigned";

      const resources = raw.resources !== undefined && raw.resources !== null
        ? String(raw.resources).trim() || null
        : null;

      const sourceText = raw.sourceText !== undefined && raw.sourceText !== null
        ? String(raw.sourceText).trim() || null
        : null;

      normalizedTasks.push({
        title,
        description,
        assigneeIds,
        deadline,
        taskType,
        resources,
        sourceText,
      });
    }

    const [creatorRow] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, requesterId))
      .limit(1);
    const creatorName = creatorRow?.name || "Unknown";

    const createdTasks = [];
    const now = new Date();

    for (const task of normalizedTasks) {
      const validAssignees = await db
        .select({
          id: users.id,
          name: users.name,
          role: users.role,
          whatsapp_number: users.whatsapp_number,
          whatsapp_enabled: users.whatsapp_enabled,
        })
        .from(users)
        .where(inArray(users.id, task.assigneeIds));

      if (validAssignees.length !== task.assigneeIds.length) {
        throw new Error("Invalid assignee provided");
      }

      const [newTask] = await db
        .insert(assignedTasks)
        .values({
          title: task.title,
          description: task.description,
          taskType: task.taskType,
          createdBy: requesterId,
          createdAt: now,
          updatedAt: now,
          deadline: task.deadline,
          resources: task.resources,
        })
        .returning({
          id: assignedTasks.id,
          deadline: assignedTasks.deadline,
          taskType: assignedTasks.taskType,
          createdAt: assignedTasks.createdAt,
        });

      await db.insert(assignedTaskStatus).values(
        task.assigneeIds.map((memberId) => ({
          taskId: newTask.id,
          memberId,
          status: "not_started",
          assignedDate: now,
          updatedAt: now,
        }))
      );

      await db
        .insert(userNoteTaskLinks)
        .values({
          noteId,
          taskId: newTask.id,
          sourceText: task.sourceText,
          createdAt: now,
        })
        .onConflictDoNothing();

      const messageRows = task.assigneeIds.map((memberId) => ({
        senderId: requesterId,
        recipientId: memberId,
        content: `New task "${task.title}" assigned to you by ${creatorName}. [task:${newTask.id}]`,
        createdAt: now,
        status: "sent",
        messageType: "task_update",
      }));
      if (messageRows.length) {
        await db.insert(messages).values(messageRows);
      }

      createdTasks.push({
        taskId: newTask.id,
        title: task.title,
        description: task.description,
        taskType: newTask.taskType,
        deadline: newTask.deadline,
        createdAt: newTask.createdAt,
        linkCreatedAt: now,
        sourceText: task.sourceText,
        assignees: validAssignees,
      });
    }

    const timestamp = new Date().toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    for (const created of createdTasks) {
      for (const assignee of created.assignees) {
        if (assignee.whatsapp_enabled && assignee.whatsapp_number) {
          await sendWhatsappMessage(assignee.whatsapp_number, {
            recipientName: assignee.name || "User",
            updaterName: creatorName,
            taskTitle: created.title,
            newStatus: "Assigned",
            logComment: created.sourceText || "New task generated from note",
            dateTime: timestamp,
          });
        }
      }
    }

    return NextResponse.json({
      createdTasks: createdTasks.map((task) => ({
        taskId: task.taskId,
        title: task.title,
        description: task.description,
        taskType: task.taskType,
        deadline: task.deadline,
        createdAt: task.createdAt,
        linkCreatedAt: task.linkCreatedAt,
        sourceText: task.sourceText,
        assignees: task.assignees.map((a) => ({
          id: a.id,
          name: a.name,
          role: a.role,
        })),
      })),
    });
  } catch (error) {
    console.error("POST /api/member/notes/[noteId]/tasks error", error);
    const message = error instanceof Error ? error.message : "Failed to create tasks";
    if (message === "Invalid assignee provided") {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create tasks" }, { status: 500 });
  }
}
