import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  assignedTaskStatus,
  sprints,
  users,
  assignedTasks,
  messages,
  assignedTaskLogs,
} from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq, and, inArray, desc, lte } from "drizzle-orm";
import twilio from "twilio";

/* ------------------------------------------------------------------ */
/*  Twilio helper                                                     */
/* ------------------------------------------------------------------ */
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function sendWhatsappMessage(toNumber, content, recipientRow) {
  if (!toNumber || !recipientRow?.whatsapp_enabled) return;

  return twilioClient.messages.create({
    from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
    to: `whatsapp:${toNumber}`,
    contentSid: "HX60cc1428638f310ed813993c89059169",
    contentVariables: JSON.stringify({
      1: content.recipientName || "User",
      2: content.updaterName || "System",
      3: content.taskTitle || "Untitled Task",
      4: content.newStatus || "Unknown",
      5: content.logComment || "No log",
      6:
        content.dateTime ||
        new Date().toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
    }),
  });
}

/* ================================================================== */
/*  GET – dashboard data / logs / sprints / assignees / single task   */
/* ================================================================== */
export async function GET(req) {
  try {
    const session = await auth();
    if (
      !session ||
      !["member", "team_manager", "admin"].includes(session.user?.role)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action")?.trim();
    if (!action)
      return NextResponse.json({ error: "action param required" }, { status: 400 });

    const taskId = parseInt(searchParams.get("taskId"));
    const requestedId = parseInt(
      searchParams.get("memberId") || searchParams.get("userId")
    );
    const selfId = Number(session.user.id);
    const targetId =
      requestedId && ["admin", "team_manager"].includes(session.user.role)
        ? requestedId
        : selfId;

    /* ---------------------------------------------- */
    /* 1. All tasks for a user on a date              */
    /* ---------------------------------------------- */
    if (action === "tasks") {
      const date = searchParams.get("date");
      if (!date)
        return NextResponse.json({ error: "date param required" }, { status: 400 });

      const endOfDay = new Date(`${date}T23:59:59.999`);

const rows = await db
  .select({
    id: assignedTaskStatus.taskId,
    title: assignedTasks.title,
    description: assignedTasks.description,
    status: assignedTaskStatus.status,
    assignedDate: assignedTaskStatus.assignedDate,
    taskStatusId: assignedTaskStatus.id,
    createdBy: assignedTasks.createdBy,
    deadline: assignedTasks.deadline,
    resources: assignedTasks.resources,
    pinned: assignedTaskStatus.pinned,                // ✅
    savedForLater: assignedTaskStatus.savedForLater,  // ✅
  })
        .from(assignedTaskStatus)
        .innerJoin(assignedTasks, eq(assignedTaskStatus.taskId, assignedTasks.id))
        .where(
          and(
            eq(assignedTaskStatus.memberId, targetId),
            lte(assignedTaskStatus.assignedDate, endOfDay)
          )
        );

      const statusIds = rows.map((r) => r.taskStatusId);
      const allSprints = await db
        .select()
        .from(sprints)
        .where(inArray(sprints.taskStatusId, statusIds));

      const tasks = rows.map((t) => ({
        ...t,
        sprints: allSprints.filter((s) => s.taskStatusId === t.taskStatusId),
      }));

      return NextResponse.json({ tasks });
    }

    /* ---------------------------------------------- */
    /* 2. Logs for a task                             */
    /* ---------------------------------------------- */
    if (action === "logs") {
      if (!taskId)
        return NextResponse.json({ error: "taskId required" }, { status: 400 });

      const logs = await db
        .select({
          id: assignedTaskLogs.id,
          taskId: assignedTaskLogs.taskId,
          userId: assignedTaskLogs.userId,
          userName: users.name,
          action: assignedTaskLogs.action,
          details: assignedTaskLogs.details,
          createdAt: assignedTaskLogs.createdAt,
          sprintId: assignedTaskLogs.sprintId,
        })
        .from(assignedTaskLogs)
        .leftJoin(users, eq(assignedTaskLogs.userId, users.id))
        .where(eq(assignedTaskLogs.taskId, taskId))
        .orderBy(desc(assignedTaskLogs.createdAt));

      return NextResponse.json({ logs });
    }

    /* ---------------------------------------------- */
    /* 3. Single task meta + assignees                */
    /* ---------------------------------------------- */
    if (action === "task") {
      if (!taskId)
        return NextResponse.json({ error: "taskId required" }, { status: 400 });

      const [task] = await db
        .select()
        .from(assignedTasks)
        .where(eq(assignedTasks.id, taskId));

      if (!task)
        return NextResponse.json({ error: "Task not found" }, { status: 404 });

      const statusRows = await db
        .select({
          statusId: assignedTaskStatus.id,
          memberId: assignedTaskStatus.memberId,
          status: assignedTaskStatus.status,
          name: users.name,
        })
        .from(assignedTaskStatus)
        .innerJoin(users, eq(assignedTaskStatus.memberId, users.id))
        .where(eq(assignedTaskStatus.taskId, taskId));

      const statusIds = statusRows.map((s) => s.statusId);
      const allSprints = await db
        .select()
        .from(sprints)
        .where(inArray(sprints.taskStatusId, statusIds));

      const assignees = statusRows.map((s) => ({
        id: s.memberId,
        name: s.name,
        status: s.status,
        sprints: allSprints.filter((sp) => sp.taskStatusId === s.statusId),
      }));

      return NextResponse.json({ task: { ...task, assignees } });
    }

    /* ---------------------------------------------- */
    /* 4. Sprints for one assignee                    */
    /* ---------------------------------------------- */
    if (action === "sprints") {
      if (!taskId)
        return NextResponse.json({ error: "taskId required" }, { status: 400 });

      if (session.user.role === "member" && targetId !== selfId)
        return NextResponse.json({ error: "invalid ids" }, { status: 400 });

      const [statusRow] = await db
        .select({ id: assignedTaskStatus.id })
        .from(assignedTaskStatus)
        .where(
          and(
            eq(assignedTaskStatus.taskId, taskId),
            eq(assignedTaskStatus.memberId, targetId)
          )
        )
        .limit(1);

      if (!statusRow)
        return NextResponse.json({ error: "task not assigned" }, { status: 404 });

      const sprintsData = await db
        .select()
        .from(sprints)
        .where(eq(sprints.taskStatusId, statusRow.id));

      return NextResponse.json({ sprints: sprintsData });
    }

    /* ---------------------------------------------- */
    /* 5. List of assignee IDs                        */
    /* ---------------------------------------------- */
    if (action === "assignees") {
      if (!taskId)
        return NextResponse.json({ error: "taskId required" }, { status: 400 });

      const list = await db
        .select({ memberId: assignedTaskStatus.memberId })
        .from(assignedTaskStatus)
        .where(eq(assignedTaskStatus.taskId, taskId));

      return NextResponse.json({ assignees: list });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("GET /member/assignedTasks error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

/* ================================================================== */
/*  POST – add a new log                                              */
/* ================================================================== */
export async function POST(req) {
  try {
    const session = await auth();
    if (!session || !["member", "team_manager", "admin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number(session.user.id);
    const { taskId, action, details, sprintId } = await req.json();

    if (action !== "log_added" || !Number.isInteger(taskId) || !details) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    /* members: ensure task is assigned to self */
    if (session.user.role === "member") {
      const assigned = await db
        .select()
        .from(assignedTaskStatus)
        .where(
          and(
            eq(assignedTaskStatus.taskId, taskId),
            eq(assignedTaskStatus.memberId, userId)
          )
        );
      if (!assigned.length) {
        return NextResponse.json({ error: "Task not assigned to you" }, { status: 403 });
      }
    }

    /* Sprint-ID validation (if provided) */
if (sprintId) {
  // 1️⃣  make sure the sprint exists
  const [sp] = await db
    .select({ taskStatusId: sprints.taskStatusId })
    .from(sprints)
    .where(eq(sprints.id, sprintId));

  if (!sp) {
    return NextResponse.json({ error: "Invalid sprintId" }, { status: 400 });
  }

  // 2️⃣  check that the taskStatus row behind that sprint points to the same task
  const [statusRow] = await db
    .select({ taskId: assignedTaskStatus.taskId })
    .from(assignedTaskStatus)
    .where(eq(assignedTaskStatus.id, sp.taskStatusId));

  if (!statusRow || statusRow.taskId !== taskId) {
    return NextResponse.json({ error: "Invalid sprintId" }, { status: 400 });
  }
}

    const now = new Date();
    const [log] = await db
      .insert(assignedTaskLogs)
      .values({
        taskId,
        userId,
        action,
        details,
        createdAt: now,
        sprintId: sprintId || null,
      })
      .returning();

    return NextResponse.json({ log }, { status: 200 });
  } catch (err) {
    console.error("POST /member/assignedTasks error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

/* ================================================================== */
/*  PATCH – update task or sprint status + optional notifications     */
/* ================================================================== */
export async function PATCH(req) {
  try {
    const session = await auth();
    if (!session || !["member", "team_manager", "admin"].includes(session.user?.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Destructure ALL possible fields:
    const {
      taskId,
      status,
      sprintId,
      memberId,
      action,
      notifyAssignees = false,
      notifyWhatsapp = false,
      newLogComment = "",
      statusId, // For update_flags only
      pinned,   // For update_flags only
      savedForLater, // For update_flags only
    } = await req.json();

    // 🟢 1. Branch: update_flags (pin/saveForLater)
    if (action === "update_flags") {
      if (!Number.isInteger(statusId)) {
        return NextResponse.json({ error: "statusId required" }, { status: 400 });
      }
      // Only update pins and savedForLater fields
      await db.update(assignedTaskStatus)
        .set({
          pinned: !!pinned,
          savedForLater: !!savedForLater,
        })
        .where(eq(assignedTaskStatus.id, statusId));
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // 🟡 2. Branch: Normal status updates (update_task/update_sprint)
    if (
      !Number.isInteger(taskId) ||
      !status ||
      !["update_task", "update_sprint"].includes(action) ||
      !["not_started", "in_progress", "pending_verification", "done", "verified"].includes(status)
    ) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    if (!Number.isInteger(memberId)) {
      return NextResponse.json({ error: "memberId required" }, { status: 400 });
    }
    const userId = Number(session.user.id);
    if (session.user.role === "member" && memberId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    let derived = null;

    // Validate taskStatus row
    const [taskStatusRow] = await db
      .select({ id: assignedTaskStatus.id })
      .from(assignedTaskStatus)
      .where(
        and(
          eq(assignedTaskStatus.taskId, taskId),
          eq(assignedTaskStatus.memberId, memberId)
        )
      );
    if (!taskStatusRow)
      return NextResponse.json({ error: "Task not assigned" }, { status: 404 });

    // Member transitions
    if (session.user.role === "member") {
      const allowedTaskTransitions = {
        not_started: ["in_progress"],
        in_progress: ["in_progress", "pending_verification"],
        pending_verification: ["in_progress"],
        done: [],
        verified: [],
      };

      if (
        action === "update_task" &&
        !allowedTaskTransitions[await currentStatus(taskStatusRow.id)].includes(
          status
        )
      ) {
        return NextResponse.json({ error: "Invalid task transition" }, { status: 403 });
      }

      if (action === "update_sprint") {
        const currentSprintStatus = await getSprintStatus(sprintId);
        const allowedSprintTransitions = {
          not_started: ["in_progress"],
          in_progress: ["in_progress", "done"],
          done: ["in_progress"],
          verified: [],
        };
        if (
          !allowedSprintTransitions[currentSprintStatus].includes(status)
        ) {
          return NextResponse.json(
            { error: "Invalid sprint transition" },
            { status: 403 }
          );
        }
      }
    }

    // Get task meta
    const [task] = await db
      .select({ title: assignedTasks.title, createdBy: assignedTasks.createdBy })
      .from(assignedTasks)
      .where(eq(assignedTasks.id, taskId));
    if (!task)
      return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const [updaterRow] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId));
    const updaterName = updaterRow?.name || session?.user?.name || "Unknown";

    const assignees = await db
      .select({ memberId: assignedTaskStatus.memberId })
      .from(assignedTaskStatus)
      .where(eq(assignedTaskStatus.taskId, taskId));

    const [senderRow] = await db
      .select({ whatsapp_number: users.whatsapp_number })
      .from(users)
      .where(eq(users.id, userId));
    const senderWhatsapp = senderRow?.whatsapp_number;
    const now = new Date();
    let notification = "";

    // ----- TASK-LEVEL UPDATE -----
    if (action === "update_task") {
      await db
        .update(assignedTaskStatus)
        .set({
          status,
          updatedAt: now,
          verifiedBy: status === "verified" ? userId : null,
          verifiedAt: status === "verified" ? now : null,
        })
        .where(eq(assignedTaskStatus.id, taskStatusRow.id));

      if (newLogComment) {
        await db.insert(assignedTaskLogs).values({
          taskId,
          userId,
          action: "status_update",
          details: newLogComment,
          createdAt: now,
        });
      }

      notification = `Task "${task.title}" status updated to ${status.replace(
        "_",
        " "
      )} by ${updaterName}`;
    }

    // ----- SPRINT-LEVEL UPDATE -----
    if (action === "update_sprint") {
      if (!Number.isInteger(sprintId))
        return NextResponse.json({ error: "sprintId required" }, { status: 400 });

      const [sprint] = await db
        .update(sprints)
        .set({
          status,
          updatedAt: now,
          verifiedBy: status === "verified" ? userId : null,
          verifiedAt: status === "verified" ? now : null,
        })
        .where(eq(sprints.id, sprintId))
        .returning({ id: sprints.id, title: sprints.title });

      if (!sprint)
        return NextResponse.json({ error: "Sprint not found" }, { status: 404 });

      if (newLogComment) {
        await db.insert(assignedTaskLogs).values({
          taskId,
          userId,
          action: "sprint_status_update",
          details: newLogComment,
          createdAt: now,
          sprintId,
        });
      }

      // derive task status from all sprints
      const sprintStatuses = await db
        .select({ status: sprints.status })
        .from(sprints)
        .where(eq(sprints.taskStatusId, taskStatusRow.id));

      const statuses = sprintStatuses.map(s => s.status);
      derived = deriveTaskStatus(statuses);

      await db
        .update(assignedTaskStatus)
        .set({ status: derived, updatedAt: now })
        .where(eq(assignedTaskStatus.id, taskStatusRow.id));

      notification = `Sprint "${sprint.title}" in task "${task.title}" updated to ${status.replace(
        "_",
        " "
      )} by ${updaterName}`;
    }

    await db
      .update(assignedTasks)
      .set({ updatedAt: now })
      .where(eq(assignedTasks.id, taskId));

    if (newLogComment) notification += `. Comment: ${newLogComment}`;
    notification += `. [task:${taskId}${sprintId ? ` sprint:${sprintId}` : ""}]`;

    // Special notifications
    let specialNotification = null;
    let specialTargets = [];

    const derivedOrStatus = action === "update_sprint" ? derived : status;

    if (derivedOrStatus === "pending_verification" || derivedOrStatus === "done") {
      specialNotification = `Task "${task.title}" is ready for verification. Last update by ${updaterName}${newLogComment ? `: ${newLogComment}` : ""} [task:${taskId}${sprintId ? ` sprint:${sprintId}` : ""}]`;
      specialTargets = [task.createdBy].filter(id => id !== userId);
    } else if (derivedOrStatus === "verified") {
      specialNotification = `Task "${task.title}" has been verified by ${updaterName}${newLogComment ? `. Comment: ${newLogComment}` : ""} [task:${taskId}${sprintId ? ` sprint:${sprintId}` : ""}]`;
      specialTargets = assignees.map(a => a.memberId).filter(id => id !== userId);
    }

    // General notifications
    const generalTargets = [
      ...new Set(
        assignees
          .map((a) => a.memberId)
          .filter((id) => id && id !== userId)
          .concat(task.createdBy !== userId ? task.createdBy : [])
      ),
    ];

    if (notifyAssignees && generalTargets.length) {
      await db.insert(messages).values(
        generalTargets.map((rid) => ({
          senderId: userId,
          recipientId: rid,
          content: notification,
          createdAt: now,
          status: "sent",
        }))
      );
      try {
        const { createNotifications } = await import("@/lib/notify");
        await createNotifications({
          recipients: generalTargets,
          type: "task_update",
          title: "Task update",
          body: notification,
          entityKind: "task",
          entityId: taskId,
          meta: { sprintId: sprintId || null },
        });
      } catch {}
    }

    if (specialNotification && specialTargets.length) {
      await db.insert(messages).values(
        specialTargets.map((rid) => ({
          senderId: userId,
          recipientId: rid,
          content: specialNotification,
          createdAt: now,
          status: "sent",
        }))
      );
      try {
        const { createNotifications } = await import("@/lib/notify");
        await createNotifications({
          recipients: specialTargets,
          type: derivedOrStatus === "verified" ? "task_verified" : "task_ready_for_verification",
          title: derivedOrStatus === "verified" ? "Task verified" : "Task ready for verification",
          body: specialNotification,
          entityKind: "task",
          entityId: taskId,
          meta: { sprintId: sprintId || null },
        });
      } catch {}
    }

    if (notifyWhatsapp && senderWhatsapp) {
      const recipients = await db
        .select({
          id: users.id,
          whatsapp_number: users.whatsapp_number,
          whatsapp_enabled: users.whatsapp_enabled,
          name: users.name,
        })
        .from(users)
        .where(inArray(users.id, [...generalTargets, ...specialTargets]));

      const valid = recipients.filter((r) => r.whatsapp_number && r.whatsapp_enabled);
      await Promise.all(
        valid.map((r) =>
          sendWhatsappMessage(
            r.whatsapp_number,
            {
              recipientName: r.name,
              updaterName,
              taskTitle: task.title,
              newStatus: status.replace("_", " "),
              logComment: newLogComment,
            },
            r
          )
        )
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("PATCH /member/assignedTasks error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}



function deriveTaskStatus(statuses) {
  const allVerified = statuses.every((s) => s === "verified");
  const allDone = statuses.every((s) => s === "done");
  const allCompleted = statuses.every((s) => ["done", "verified"].includes(s));
  const someInProgress = statuses.some((s) => s === "in_progress");
  if (allVerified) return "verified";
  if (allDone) return "done";
  if (allCompleted) return "pending_verification";
  if (someInProgress) return "in_progress";
  return "not_started";
}

async function currentStatus(statusId) {
  const [row] = await db
    .select({ status: assignedTaskStatus.status })
    .from(assignedTaskStatus)
    .where(eq(assignedTaskStatus.id, statusId));
  return row?.status || "not_started";
}

async function getSprintStatus(id) {
  const [row] = await db.select({ status: sprints.status }).from(sprints).where(eq(sprints.id, id));
  return row?.status || "not_started";
}
