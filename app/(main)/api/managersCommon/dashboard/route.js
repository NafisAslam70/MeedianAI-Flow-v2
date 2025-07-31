// FILE: app/api/managersCommon/dashboard/route.js
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignedTasks, assignedTaskStatus, users, sprints, assignedTaskLogs } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq, inArray, sql, desc } from "drizzle-orm";

export async function GET(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    const user = url.searchParams.get("user") || "all";
    const status = url.searchParams.get("status") || "all";

    let statusSql;
    if (user === "all") {
      statusSql = sql`SUBSTRING(
        MIN(
          CASE ${assignedTaskStatus.status}
            WHEN 'not_started' THEN '0 not_started'
            WHEN 'in_progress' THEN '1 in_progress'
            WHEN 'pending_verification' THEN '2 pending_verification'
            WHEN 'done' THEN '3 done'
            WHEN 'verified' THEN '4 verified'
          END
        ) FROM 3
      )`.as("status");
    } else {
      statusSql = sql`MAX(
        CASE WHEN ${assignedTaskStatus.memberId} = ${parseInt(user)} THEN ${assignedTaskStatus.status} END
      )`.as("status");
    }

    let taskQuery = db
      .select({
        id: assignedTasks.id,
        title: assignedTasks.title,
        description: assignedTasks.description,
        createdBy: assignedTasks.createdBy,
        createdAt: assignedTasks.createdAt,
        updatedAt: assignedTasks.updatedAt,
        deadline: assignedTasks.deadline,
        resources: assignedTasks.resources,
        assignees: sql`ARRAY_AGG(CASE WHEN ${users.id} IS NOT NULL THEN JSONB_BUILD_OBJECT('id', ${users.id}, 'name', ${users.name}) END)`.as("assignees"),
        sprints: sql`ARRAY_AGG(CASE WHEN ${sprints.id} IS NOT NULL THEN JSONB_BUILD_OBJECT('id', ${sprints.id}, 'title', ${sprints.title}, 'description', ${sprints.description}, 'status', ${sprints.status}) END)`.as("sprints"),
        status: statusSql,
      })
      .from(assignedTasks)
      .leftJoin(assignedTaskStatus, eq(assignedTasks.id, assignedTaskStatus.taskId))
      .leftJoin(users, eq(assignedTaskStatus.memberId, users.id))
      .leftJoin(sprints, eq(assignedTaskStatus.id, sprints.taskStatusId))
      .groupBy(assignedTasks.id)
      .having(sql`COUNT(${assignedTaskStatus.id}) > 0`);

    if (date) {
      taskQuery = taskQuery.where(sql`DATE(${assignedTasks.createdAt}) = ${date}`);
    }

    if (user !== "all") {
      taskQuery = taskQuery.having(sql`COUNT(CASE WHEN ${assignedTaskStatus.memberId} = ${parseInt(user)} THEN 1 END) > 0`);
    }

    if (status !== "all") {
      const statusCond = status === "done" ? ["done", "verified"] : [status];
      taskQuery = taskQuery.having(inArray(statusSql, statusCond));
    }

    const tasks = await taskQuery;

    // Summaries
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === "done" || t.status === "verified").length;
    const inProgressTasks = tasks.filter(t => t.status === "in_progress").length;
    const notStartedTasks = tasks.filter(t => t.status === "not_started").length;
    const pendingVerificationTasks = tasks.filter(t => t.status === "pending_verification").length;

    // Latest Assigned
    const latestAssigned = tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);

    // Latest Updated
    const latestUpdated = tasks.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 5);

    // Recent Logs
    const logs = await db.select().from(assignedTaskLogs).orderBy(desc(assignedTaskLogs.createdAt)).limit(5);

    // Latest Touched (updated or logged)
    const touchedTasks = tasks.map(task => {
      const taskLogs = logs.filter(log => log.taskId === task.id);
      const lastLogTime = taskLogs.length > 0 ? new Date(taskLogs[0].createdAt) : new Date(task.createdAt);
      return { ...task, lastTouched: new Date(task.updatedAt) > lastLogTime ? new Date(task.updatedAt) : lastLogTime };
    }).sort((a, b) => b.lastTouched - a.lastTouched).slice(0, 5);

    return NextResponse.json({
      summaries: {
        totalTasks,
        completedTasks,
        inProgressTasks,
        notStartedTasks,
        pendingVerificationTasks,
      },
      assignedTasks: tasks,
      latestAssigned,
      latestUpdated,
      recentLogs: logs,
      latestTouched: touchedTasks,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}