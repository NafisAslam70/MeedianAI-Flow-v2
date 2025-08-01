import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignedTasks, assignedTaskStatus, sprints, assignedTaskLogs, users } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq, and, lte, inArray, desc } from "drizzle-orm";

const json = (data, init = {}) =>
  NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
    ...init,
  });

// Updated /api/member/assignedTasks route (GET part)
export async function GET(req) {
  try {
    const session = await auth();
    if (!session || !session.user || !["admin", "member", "team_manager"].includes(session.user.role)) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number(session.user.id);
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (!action) return json({ error: "action param required" }, { status: 400 });

    if (action === "tasks") {
      const date = searchParams.get("date");
      if (!date) return json({ error: "date param required" }, { status: 400 });

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
        })
        .from(assignedTaskStatus)
        .innerJoin(assignedTasks, eq(assignedTaskStatus.taskId, assignedTasks.id))
        .where(
          and(
            eq(assignedTaskStatus.memberId, userId),
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

      return json({ tasks });
    }

    if (action === "sprints") {
      const taskId = Number(searchParams.get("taskId"));
      const memberId = Number(searchParams.get("memberId"));
      if (!taskId || !memberId || (memberId !== userId && session.user.role === "member")) {
        return json({ error: "invalid ids" }, { status: 400 });
      }

      const [statusRow] = await db
        .select({ id: assignedTaskStatus.id })
        .from(assignedTaskStatus)
        .where(
          and(eq(assignedTaskStatus.taskId, taskId), eq(assignedTaskStatus.memberId, userId))
        )
        .limit(1);

      if (!statusRow && session.user.role === "member") {
        return json({ error: "task not assigned" }, { status: 404 });
      }

      const sprintsData = await db
        .select()
        .from(sprints)
        .where(eq(sprints.taskStatusId, statusRow.id));

      return json({ sprints: sprintsData });
    }

    if (action === "assignees") {
      const taskId = Number(searchParams.get("taskId"));
      if (!taskId) return json({ error: "taskId required" }, { status: 400 });

      const list = await db
        .select({ memberId: assignedTaskStatus.memberId })
        .from(assignedTaskStatus)
        .where(eq(assignedTaskStatus.taskId, taskId));

      return json({ assignees: list });
    }

    if (action === "logs") {
      const taskId = Number(searchParams.get("taskId"));
      if (!taskId) return json({ error: "taskId required" }, { status: 400 });

      const logs = await db
        .select({
          id: assignedTaskLogs.id,
          taskId: assignedTaskLogs.taskId,
          userId: assignedTaskLogs.userId,
          action: assignedTaskLogs.action,
          details: assignedTaskLogs.details,
          createdAt: assignedTaskLogs.createdAt,
          userName: users.name,
        })
        .from(assignedTaskLogs)
        .leftJoin(users, eq(assignedTaskLogs.userId, users.id))
        .where(eq(assignedTaskLogs.taskId, taskId))
        .orderBy(desc(assignedTaskLogs.createdAt));

      console.log("Fetched logs:", logs);
      return json({ logs });
    }

    if (action === "task") {
      const taskId = Number(searchParams.get("taskId"));
      if (!taskId) return json({ error: "taskId required" }, { status: 400 });

      const taskRows = await db
        .select()
        .from(assignedTasks)
        .where(eq(assignedTasks.id, taskId));

      if (!taskRows.length) {
        return json({ error: "Task not found" }, { status: 404 });
      }

      const task = taskRows[0];

      let statusWhere = eq(assignedTaskStatus.taskId, taskId);
      if (session.user.role === "member") {
        statusWhere = and(statusWhere, eq(assignedTaskStatus.memberId, userId));
      }

      const statusRows = await db
        .select({
          statusId: assignedTaskStatus.id,
          memberId: assignedTaskStatus.memberId,
          status: assignedTaskStatus.status,
          name: users.name,
        })
        .from(assignedTaskStatus)
        .innerJoin(users, eq(assignedTaskStatus.memberId, users.id))
        .where(statusWhere);

      if (!statusRows.length) {
        return json({ error: session.user.role === "member" ? "task not assigned" : "No assignees found" }, { status: 404 });
      }

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

      return json({ task: { ...task, assignees } });
    }

    return json({ error: "unknown action" }, { status: 400 });
  } catch (err) {
    console.error("assignedTasks GET error", err.message, err.stack);
    return json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session || !session.user || !["member", "team_manager", "admin"].includes(session.user.role)) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number(session.user.id);
    const { taskId, action, details, sprintId } = await req.json();
    if (!taskId || !action || !details) {
      return json({ error: "taskId, action, details required" }, { status: 400 });
    }

    if (session.user.role === "member") {
      const [statusRow] = await db
        .select({ id: assignedTaskStatus.id })
        .from(assignedTaskStatus)
        .where(
          and(eq(assignedTaskStatus.taskId, taskId), eq(assignedTaskStatus.memberId, userId))
        )
        .limit(1);

      if (!statusRow) {
        return json({ error: "task not assigned" }, { status: 404 });
      }
    }

    const [log] = await db
      .insert(assignedTaskLogs)
      .values({ taskId, userId, action, details, createdAt: new Date() })
      .returning();

    return json({ log }, { status: 201 });
  } catch (err) {
    console.error("assignedTasks POST error", err.message, err.stack);
    return json({ error: err.message }, { status: 500 });
  }
}