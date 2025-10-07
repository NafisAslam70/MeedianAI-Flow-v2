// Full updated code for /api/managersCommon/assign-tasks.js
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignedTasks, assignedTaskStatus, assignedTaskObservers, users, sprints, messages } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq, inArray, or, sql, and } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
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
      contentSid: "HXe39dfecbcc4453ae05ae2a7f7f1da414",
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

// =================== GET ===================
export async function GET(req) {
  const session = await auth();
  const user = session?.user;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = user.role;
  const isManager = ["admin", "team_manager"].includes(role);
  const userId = user.id ? parseInt(user.id) : null;

  if (!isManager && (userId === null || Number.isNaN(userId))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const taskIdParam = url.searchParams.get("taskId");

    // Managers often need to hydrate a single task with full detail
    if (taskIdParam) {
      const taskId = parseInt(taskIdParam, 10);
      if (Number.isNaN(taskId)) {
        return NextResponse.json({ error: "Invalid taskId" }, { status: 400 });
      }

      const [task] = await db
        .select({
          id: assignedTasks.id,
          title: assignedTasks.title,
          description: assignedTasks.description,
          taskType: assignedTasks.taskType,
          createdBy: assignedTasks.createdBy,
          createdAt: assignedTasks.createdAt,
          updatedAt: assignedTasks.updatedAt,
          deadline: assignedTasks.deadline,
          resources: assignedTasks.resources,
          observerId: assignedTasks.observerId,
        })
        .from(assignedTasks)
        .where(eq(assignedTasks.id, taskId));

      if (!task) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }

      const statusRows = await db
        .select({
          statusId: assignedTaskStatus.id,
          memberId: assignedTaskStatus.memberId,
          status: assignedTaskStatus.status,
          memberName: users.name,
          memberEmail: users.email,
        })
        .from(assignedTaskStatus)
        .leftJoin(users, eq(assignedTaskStatus.memberId, users.id))
        .where(eq(assignedTaskStatus.taskId, taskId));

      const statusIds = statusRows.map((row) => row.statusId).filter(Boolean);

      const sprintRows = statusIds.length
        ? await db
            .select()
            .from(sprints)
            .where(inArray(sprints.taskStatusId, statusIds))
        : [];

      const assignees = statusRows.map((row) => ({
        id: row.memberId,
        name: row.memberName,
        email: row.memberEmail,
        status: row.status,
        sprints: sprintRows.filter((sprint) => sprint.taskStatusId === row.statusId),
      }));

      const observerRows = await db
        .select({
          userId: assignedTaskObservers.userId,
          name: users.name,
          email: users.email,
        })
        .from(assignedTaskObservers)
        .leftJoin(users, eq(users.id, assignedTaskObservers.userId))
        .where(eq(assignedTaskObservers.taskId, taskId));

      const observers = observerRows
        .filter((row) => row.userId != null)
        .map((row) => ({ id: row.userId, name: row.name, email: row.email }));

      const primaryObserverId = observers.length ? observers[0].id : task.observerId ?? null;

      return NextResponse.json({
        task: {
          ...task,
          assignees,
          observers,
          observerId: primaryObserverId != null ? Number(primaryObserverId) : null,
          observerIds: observers.map((observer) => observer.id),
        },
      });
    }

    let taskQuery = db
      .select({
        id: assignedTasks.id,
        title: assignedTasks.title,
        description: assignedTasks.description,
        taskType: assignedTasks.taskType,
        createdBy: assignedTasks.createdBy,
        primaryObserverId: assignedTasks.observerId,
        createdAt: assignedTasks.createdAt,
        updatedAt: assignedTasks.updatedAt,
        deadline: assignedTasks.deadline,
        resources: assignedTasks.resources,
        assignees: sql`json_agg(
          json_build_object(
            'id', ${users.id},
            'name', ${users.name},
            'email', ${users.email},
            'status', ${assignedTaskStatus.status}
          )
        )`.as("assignees"),
        sprints: sql`json_agg(
          json_build_object(
            'id', ${sprints.id},
            'title', ${sprints.title},
            'description', ${sprints.description},
            'status', ${sprints.status}
          )
        ) FILTER (WHERE ${sprints.id} IS NOT NULL)`.as("sprints"),
      })
      .from(assignedTasks)
      .leftJoin(assignedTaskStatus, eq(assignedTaskStatus.taskId, assignedTasks.id))
      .leftJoin(users, eq(assignedTaskStatus.memberId, users.id))
      .leftJoin(sprints, eq(sprints.taskStatusId, assignedTaskStatus.id));

    if (!isManager) {
      taskQuery = taskQuery.where(
        or(eq(assignedTasks.createdBy, userId), eq(assignedTaskStatus.memberId, userId))
      );
    }

    const tasks = await taskQuery.groupBy(assignedTasks.id);

    const taskIds = tasks.map((task) => task.id);
    const observerUserAlias = alias(users, "observer_user");
    const observersByTask = new Map();
    if (taskIds.length) {
      const observerRows = await db
        .select({
          taskId: assignedTaskObservers.taskId,
          userId: assignedTaskObservers.userId,
          name: observerUserAlias.name,
          email: observerUserAlias.email,
        })
        .from(assignedTaskObservers)
        .leftJoin(observerUserAlias, eq(observerUserAlias.id, assignedTaskObservers.userId))
        .where(inArray(assignedTaskObservers.taskId, taskIds));

      observerRows.forEach((row) => {
        if (!row.taskId || !row.userId) return;
        const list = observersByTask.get(row.taskId) || [];
        list.push({ id: row.userId, name: row.name, email: row.email });
        observersByTask.set(row.taskId, list);
      });
    }

    const formattedTasks = tasks.map((task) => {
      const { primaryObserverId, ...rest } = task;
      const assignees = Array.isArray(task.assignees) ? task.assignees.filter((a) => a.id !== null) : [];
      const sprints = Array.isArray(task.sprints) ? task.sprints : [];
      let status = "not_started";
      if (sprints.length > 0) {
        const sprintStatuses = sprints.map((s) => s.status);
        if (sprintStatuses.every((s) => s === "verified" || s === "done")) {
          status = "done";
        } else if (sprintStatuses.some((s) => s === "in_progress" || s === "pending_verification")) {
          status = "in_progress";
        }
      } else {
        const assigneeStatuses = assignees.map((a) => a.status).filter(Boolean);
        if (assigneeStatuses.length > 0) {
          if (assigneeStatuses.every((s) => s === "done" || s === "verified")) {
            status = "done";
          } else if (assigneeStatuses.some((s) => s === "in_progress" || s === "pending_verification")) {
            status = "in_progress";
          }
        }
      }
      const observers = observersByTask.get(task.id) || [];
      const observerId = observers.length ? Number(observers[0].id) : primaryObserverId;
      const observerName = observers.length ? observers[0].name : null;

      return {
        ...rest,
        observerId: observerId != null ? Number(observerId) : null,
        observerName: observerName || null,
        observer: observerId != null
          ? { id: Number(observerId), name: observerName || null }
          : null,
        observers,
        status,
        assignees: assignees.map(({ status, ...rest }) => rest),
        sprints,
      };
    });

    console.log("Assigned tasks fetched:", formattedTasks.length, { userId: user.id, role });

    return NextResponse.json(
      { assignedTasks: formattedTasks },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json({ error: `Failed to fetch tasks: ${error.message}` }, { status: 500 });
  }
}

// =================== POST ===================
export async function POST(req) {
  const session = await auth();
  const user = session?.user;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload;
  try {
    payload = await req.json();
  } catch (err) {
    console.error("Invalid JSON payload for assign-task POST", err);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const {
    title,
    description,
    taskType,
    createdBy,
    assignees,
    deadline,
    resources,
    observerId: observerInput,
    distributionMode = "shared",
  } = payload || {};

  const role = user.role;
  const isManager = ["admin", "team_manager"].includes(role);
  const sessionUserId = user.id ? parseInt(user.id) : null;
  const requestedCreatorId = createdBy ? parseInt(createdBy) : null;
  const creatorId = isManager && !Number.isNaN(requestedCreatorId)
    ? requestedCreatorId
    : sessionUserId;

  const normalizedDistribution = distributionMode === "individual" ? "individual" : "shared";

  const normalizedAssignees = Array.isArray(assignees)
    ? assignees
        .map((id) => {
          const parsed = parseInt(id);
          return Number.isNaN(parsed) ? null : parsed;
        })
        .filter((id) => id !== null)
    : [];

  const assignedMemberIds = isManager
    ? normalizedAssignees
    : creatorId !== null && !Number.isNaN(creatorId)
      ? [creatorId]
      : [];

  const observerInputs = Array.isArray(payload?.observers)
    ? payload.observers
    : Array.isArray(payload?.observerIds)
      ? payload.observerIds
      : observerInput !== undefined && observerInput !== null && observerInput !== ""
        ? [observerInput]
        : [];

  let normalizedObservers = observerInputs
    .map((id) => {
      const parsed = parseInt(id);
      return Number.isNaN(parsed) ? null : parsed;
    })
    .filter((id) => id !== null);

  if (!normalizedObservers.length && creatorId !== null && !Number.isNaN(creatorId)) {
    normalizedObservers = [creatorId];
  }

  const uniqueObserverIds = Array.from(new Set(normalizedObservers));

  if (!uniqueObserverIds.length) {
    return NextResponse.json({ error: "At least one observer is required" }, { status: 400 });
  }

  if (!title || assignedMemberIds.length === 0 || creatorId === null || Number.isNaN(creatorId)) {
    console.error("Validation failed for assign-task POST", {
      title,
      creatorId,
      assignedMemberIds,
      rawAssignees: assignees,
    });
    return NextResponse.json({ error: "Task title and at least one assignee are required" }, { status: 400 });
  }

  if (!isManager && normalizedAssignees.some((id) => id !== creatorId)) {
    console.warn("Non-manager attempted to assign task to others", {
      sessionUserId,
      submittedAssignees: normalizedAssignees,
    });
  }

  const uniqueAssigneeIds = Array.from(new Set(assignedMemberIds));

  if (
    uniqueAssigneeIds.length === 1 &&
    uniqueObserverIds.length > 0 &&
    uniqueObserverIds.every((id) => Number(id) === Number(uniqueAssigneeIds[0]))
  ) {
    return NextResponse.json(
      { error: "At least one observer must be different from the sole assignee" },
      { status: 400 }
    );
  }

  if (!["shared", "individual"].includes(normalizedDistribution)) {
    return NextResponse.json({ error: "Invalid distribution mode" }, { status: 400 });
  }

  const validAssignees = await db
    .select({
      id: users.id,
      name: users.name,
      whatsapp_number: users.whatsapp_number,
      whatsapp_enabled: users.whatsapp_enabled,
    })
    .from(users)
    .where(inArray(users.id, uniqueAssigneeIds));

  if (validAssignees.length !== uniqueAssigneeIds.length) {
    console.error("Invalid assignees detected", {
      requested: uniqueAssigneeIds,
      valid: validAssignees.map((a) => a.id),
    });
    return NextResponse.json({ error: "One or more assignees are invalid or not accessible" }, { status: 400 });
  }

  const validObservers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      whatsapp_number: users.whatsapp_number,
      whatsapp_enabled: users.whatsapp_enabled,
    })
    .from(users)
    .where(inArray(users.id, uniqueObserverIds));

  if (validObservers.length !== uniqueObserverIds.length) {
    console.error("Invalid observers detected", {
      requested: uniqueObserverIds,
      valid: validObservers.map((o) => o.id),
    });
    return NextResponse.json({ error: "One or more observers are invalid or not accessible" }, { status: 400 });
  }

  try {
    const observerMap = new Map(
      validObservers.map((observer) => [Number(observer.id), observer])
    );
    const observerIdsList = uniqueObserverIds.map((id) => Number(id));

    const [creatorData] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, creatorId))
      .limit(1);
    const creatorName = creatorData?.name || "Unknown";

    const assigneeMap = new Map(
      validAssignees.map((assignee) => [Number(assignee.id), assignee])
    );

    const createTaskForMembers = async (memberIds) => {
      const timestamp = new Date();
      const deadlineDate = deadline ? new Date(deadline) : null;
      const primaryObserverId = observerIdsList[0] ?? null;
      const primaryObserver = primaryObserverId != null ? observerMap.get(primaryObserverId) : null;
      const observerNames = observerIdsList
        .map((observerId) => observerMap.get(observerId)?.name || `ID ${observerId}`)
        .join(", ");

      const [newTask] = await db
        .insert(assignedTasks)
        .values({
          title,
          description: description || null,
          taskType: taskType || "assigned",
          createdBy: creatorId,
          observerId: primaryObserverId,
          createdAt: timestamp,
          updatedAt: timestamp,
          deadline: deadlineDate,
          resources: resources || null,
        })
        .returning({ id: assignedTasks.id });

      const statusInserts = memberIds.map((memberId) => ({
        taskId: newTask.id,
        memberId,
        status: "not_started",
        assignedDate: timestamp,
        updatedAt: timestamp,
      }));

      if (statusInserts.length) {
        await db.insert(assignedTaskStatus).values(statusInserts);
      }

      if (observerIdsList.length) {
        const observerInserts = observerIdsList.map((observerId) => ({
          taskId: newTask.id,
          userId: observerId,
          createdAt: timestamp,
        }));
        await db
          .insert(assignedTaskObservers)
          .values(observerInserts)
          .onConflictDoNothing();
      }

      const dateTime = timestamp.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      for (const memberId of memberIds) {
        await db.insert(messages).values({
          senderId: creatorId,
          recipientId: memberId,
          content: `New task "${title}" assigned to you by ${creatorName}. [task:${newTask.id}]`,
          createdAt: timestamp,
          status: "sent",
        });

        const assignee = assigneeMap.get(Number(memberId));
        if (assignee?.whatsapp_enabled && assignee?.whatsapp_number) {
          await sendWhatsappMessage(assignee.whatsapp_number, {
            recipientName: assignee.name || "User",
            updaterName: creatorName,
            taskTitle: title,
            newStatus: "Assigned",
            logComment: observerNames ? `Observers: ${observerNames}` : "New task assigned",
            dateTime,
          });
        }
      }

      for (const observerId of observerIdsList) {
        await db.insert(messages).values({
          senderId: creatorId,
          recipientId: observerId,
          content: `You are observing the task "${title}" assigned to ${memberIds.length} doer(s). [task:${newTask.id}]`,
          createdAt: timestamp,
          status: "sent",
        });

        const observer = observerMap.get(Number(observerId));
        if (observer?.whatsapp_enabled && observer?.whatsapp_number) {
          await sendWhatsappMessage(observer.whatsapp_number, {
            recipientName: observer.name || "Observer",
            updaterName: creatorName,
            taskTitle: title,
            newStatus: "Observer",
            logComment: `Tracking ${memberIds.length} doer(s)`,
            dateTime,
          });
        }
      }

      await db.insert(assignedTaskLogs).values({
        taskId: newTask.id,
        userId: creatorId,
        action: "created",
        details: observerIdsList.length
          ? `Task created with observer(s) ${observerNames} for ${memberIds.length} doer(s)`
          : `Task created for ${memberIds.length} doer(s)` ,
        createdAt: timestamp,
      });

      console.log("Task created", {
        taskId: newTask.id,
        title,
        assignees: memberIds,
        creatorId,
        observers: observerIdsList,
        observerNames,
        mode: normalizedDistribution,
      });

      return newTask.id;
    };

    if (normalizedDistribution === "individual" && uniqueAssigneeIds.length > 1) {
      const taskIds = [];
      for (const memberId of uniqueAssigneeIds) {
        const taskId = await createTaskForMembers([memberId]);
        taskIds.push(taskId);
      }
      return NextResponse.json({ taskIds }, { status: 201 });
    }

    const taskId = await createTaskForMembers(uniqueAssigneeIds);
    return NextResponse.json({ taskId }, { status: 201 });
  } catch (error) {
    console.error("Error creating task:", error, { payload });
    return NextResponse.json({ error: `Failed to create task: ${error.message}` }, { status: 500 });
  }
}

// =================== PATCH ===================
export async function PATCH(req) {
  const session = await auth();
  const user = session?.user;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload;
  try {
    payload = await req.json();
  } catch (err) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const action = payload?.action;
  if (action !== "transfer") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const taskId = parseInt(payload.taskId);
  const fromMemberId = parseInt(payload.fromMemberId);
  const toMemberId = parseInt(payload.toMemberId);

  if (
    Number.isNaN(taskId) ||
    Number.isNaN(fromMemberId) ||
    Number.isNaN(toMemberId)
  ) {
    return NextResponse.json({ error: "taskId, fromMemberId and toMemberId are required" }, { status: 400 });
  }

  if (fromMemberId === toMemberId) {
    return NextResponse.json({ error: "fromMemberId and toMemberId must differ" }, { status: 400 });
  }

  const userId = Number(session.user.id);
  const role = session.user.role;
  const isManager = ["admin", "team_manager"].includes(role);

  try {
    const [taskRow] = await db
      .select({
        observerId: assignedTasks.observerId,
        createdBy: assignedTasks.createdBy,
        title: assignedTasks.title,
      })
      .from(assignedTasks)
      .where(eq(assignedTasks.id, taskId))
      .limit(1);

    if (!taskRow) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const canManage =
      isManager ||
      Number(userId) === Number(taskRow.observerId) ||
      Number(userId) === Number(taskRow.createdBy);

    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [statusRow] = await db
      .select({
        id: assignedTaskStatus.id,
      })
      .from(assignedTaskStatus)
      .where(
        and(
          eq(assignedTaskStatus.taskId, taskId),
          eq(assignedTaskStatus.memberId, fromMemberId)
        )
      )
      .limit(1);

    if (!statusRow) {
      return NextResponse.json({ error: "Original assignee not found" }, { status: 404 });
    }

    const [existingTarget] = await db
      .select({ id: assignedTaskStatus.id })
      .from(assignedTaskStatus)
      .where(
        and(
          eq(assignedTaskStatus.taskId, taskId),
          eq(assignedTaskStatus.memberId, toMemberId)
        )
      )
      .limit(1);

    if (existingTarget) {
      return NextResponse.json({ error: "Task already assigned to target member" }, { status: 409 });
    }

    const [fromUser] = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.id, fromMemberId))
      .limit(1);

    const [toUser] = await db
      .select({
        id: users.id,
        name: users.name,
        whatsapp_number: users.whatsapp_number,
        whatsapp_enabled: users.whatsapp_enabled,
      })
      .from(users)
      .where(eq(users.id, toMemberId))
      .limit(1);

    if (!toUser) {
      return NextResponse.json({ error: "Target member not found" }, { status: 400 });
    }

    const timestamp = new Date();

    await db
      .update(assignedTaskStatus)
      .set({
        memberId: toMemberId,
        status: "not_started",
        assignedDate: timestamp,
        updatedAt: timestamp,
        verifiedBy: null,
        verifiedAt: null,
      })
      .where(eq(assignedTaskStatus.id, statusRow.id));

    await db.insert(assignedTaskLogs).values({
      taskId,
      userId,
      action: "transfer",
      details: `Task transferred from ${fromUser?.name || fromMemberId} to ${toUser.name}`,
      createdAt: timestamp,
    });

    const actorName = session.user.name || "Task Observer";

    await db.insert(messages).values({
      senderId: userId,
      recipientId: toMemberId,
      content: `Task "${taskRow.title}" has been transferred to you by ${actorName}. [task:${taskId}]`,
      createdAt: timestamp,
      status: "sent",
    });

    await db.insert(messages).values({
      senderId: userId,
      recipientId: fromMemberId,
      content: `Task "${taskRow.title}" has been transferred from you to ${toUser.name}. [task:${taskId}]`,
      createdAt: timestamp,
      status: "sent",
    });

    if (toUser.whatsapp_enabled && toUser.whatsapp_number) {
      await sendWhatsappMessage(toUser.whatsapp_number, {
        recipientName: toUser.name || "User",
        updaterName: actorName,
        taskTitle: taskRow.title,
        newStatus: "Assigned",
        logComment: "Task transferred to you",
        dateTime: timestamp.toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("Error transferring task:", error, { payload });
    return NextResponse.json({ error: `Failed to transfer task: ${error.message}` }, { status: 500 });
  }
}
