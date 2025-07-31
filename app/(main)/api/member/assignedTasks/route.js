import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  assignedTasks,
  assignedTaskStatus,
  sprints,
  assignedTaskLogs,
} from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq, and, lte, inArray } from "drizzle-orm";

/* ------------------------------------------------------------------ */
/*  Helper – JSON with no-cache                                        */
/* ------------------------------------------------------------------ */
const json = (data, init = {}) =>
  NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
    ...init,
  });

/* ------------------------------------------------------------------ */
/*  GET – tasks | sprints | assignees | logs | task                    */
/* ------------------------------------------------------------------ */
export async function GET(req) {
  try {
    const session = await auth();
    if (
      !session ||
      !session.user ||
      !["admin", "member"].includes(session.user.role)
    ) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number(session.user.id);
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (!action) return json({ error: "action param required" }, { status: 400 });

    /* 1️⃣  Daily task list ------------------------------------------ */
    if (action === "tasks") {
      const date = searchParams.get("date");
      if (!date) return json({ error: "date param required" }, { status: 400 });

      // keep end-of-day in local time to avoid TZ truncation
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

      /* single sprint query instead of Promise.all */
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

    /* 2️⃣  Sprints for a task --------------------------------------- */
    if (action === "sprints") {
      const taskId   = Number(searchParams.get("taskId"));
      const memberId = Number(searchParams.get("memberId"));
      if (!taskId || !memberId || memberId !== userId) {
        return json({ error: "invalid ids" }, { status: 400 });
      }

      const [statusRow] = await db
        .select({ id: assignedTaskStatus.id })
        .from(assignedTaskStatus)
        .where(
          and(eq(assignedTaskStatus.taskId, taskId),
              eq(assignedTaskStatus.memberId, userId))
        )
        .limit(1);

      if (!statusRow) return json({ error: "task not assigned" }, { status: 404 });

      const sprintsData = await db
        .select()
        .from(sprints)
        .where(eq(sprints.taskStatusId, statusRow.id));

      return json({ sprints: sprintsData });
    }

    /* 3️⃣  Assignee list -------------------------------------------- */
    if (action === "assignees") {
      const taskId = Number(searchParams.get("taskId"));
      if (!taskId) return json({ error: "taskId required" }, { status: 400 });

      const list = await db
        .select({ memberId: assignedTaskStatus.memberId })
        .from(assignedTaskStatus)
        .where(eq(assignedTaskStatus.taskId, taskId));

      return json({ assignees: list });
    }

    /* 4️⃣  Logs ------------------------------------------------------ */
    if (action === "logs") {
      const taskId = Number(searchParams.get("taskId"));
      if (!taskId) return json({ error: "taskId required" }, { status: 400 });

      const logs = await db
        .select()
        .from(assignedTaskLogs)
        .where(eq(assignedTaskLogs.taskId, taskId))
        .orderBy(assignedTaskLogs.createdAt);

      return json({ logs });
    }

    /* 5️⃣  Single task (for chat link) ------------------------------ */
    if (action === "task") {
      const taskId = Number(searchParams.get("taskId"));
      if (!taskId) return json({ error: "taskId required" }, { status: 400 });

      /* verify assignment & pull taskStatusId in one hit */
      const [row] = await db
        .select({
          tsid: assignedTaskStatus.id,
          ...assignedTasks,
        })
        .from(assignedTaskStatus)
        .innerJoin(assignedTasks, eq(assignedTasks.id, assignedTaskStatus.taskId))
        .where(
          and(eq(assignedTaskStatus.taskId, taskId),
              eq(assignedTaskStatus.memberId, userId))
        )
        .limit(1);

      if (!row) return json({ error: "task not assigned" }, { status: 404 });

      const spr = await db
        .select()
        .from(sprints)
        .where(eq(sprints.taskStatusId, row.tsid));

      return json({ task: { ...row, sprints: spr } });
    }

    return json({ error: "unknown action" }, { status: 400 });
  } catch (err) {
    console.error("assignedTasks GET error", err);
    return json({ error: err.message }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/*  POST – create task log                                            */
/* ------------------------------------------------------------------ */
export async function POST(req) {
  try {
    const session = await auth();
    if (!session || !session.user || session.user.role !== "member") {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number(session.user.id);
    const { taskId, action, details } = await req.json();
    if (!taskId || !action || !details) {
      return json({ error: "taskId, action, details required" }, { status: 400 });
    }

    const [statusRow] = await db
      .select({ id: assignedTaskStatus.id })
      .from(assignedTaskStatus)
      .where(
        and(eq(assignedTaskStatus.taskId, taskId),
            eq(assignedTaskStatus.memberId, userId))
      )
      .limit(1);

    if (!statusRow) return json({ error: "task not assigned" }, { status: 404 });

    const [log] = await db
      .insert(assignedTaskLogs)
      .values({ taskId, userId, action, details, createdAt: new Date() })
      .returning();

    return json({ log }, { status: 201 });
  } catch (err) {
    console.error("assignedTasks POST error", err);
    return json({ error: err.message }, { status: 500 });
  }
}
