import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignedTasks, assignedTaskStatus, sprints, assignedTaskLogs } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq, and, lte } from "drizzle-orm";

export async function GET(req) {
  try {
    const session = await auth();
    if (!session || !session.user || !["admin", "member"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized: Admin or Member access required" }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (!action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    if (action === "tasks") {
      const date = searchParams.get("date");
      if (!date) return NextResponse.json({ error: "Date is required for tasks" }, { status: 400 });

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const tasks = await db
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

      const tasksWithSprints = await Promise.all(
        tasks.map(async (task) => {
          const taskSprints = await db
            .select({
              id: sprints.id,
              title: sprints.title,
              description: sprints.description,
              status: sprints.status,
            })
            .from(sprints)
            .where(eq(sprints.taskStatusId, task.taskStatusId));

          return { ...task, sprints: taskSprints };
        })
      );

      console.log("Assigned tasks fetched:", tasksWithSprints.length, { userId, date });

      return NextResponse.json({ tasks: tasksWithSprints }, {
        headers: { "Cache-Control": "no-store, max-age=0" }
      });
    }

    if (action === "sprints") {
      const taskId = parseInt(searchParams.get("taskId"));
      const memberId = parseInt(searchParams.get("memberId"));

      if (!taskId || !memberId || memberId !== userId) {
        return NextResponse.json({ error: "Invalid task ID or member ID" }, { status: 400 });
      }

      const taskStatus = await db
        .select({ id: assignedTaskStatus.id })
        .from(assignedTaskStatus)
        .where(and(eq(assignedTaskStatus.taskId, taskId), eq(assignedTaskStatus.memberId, userId)))
        .limit(1);

      if (!taskStatus.length) {
        return NextResponse.json({ error: "Task not assigned to user" }, { status: 404 });
      }

      const sprintsData = await db
        .select({
          id: sprints.id,
          title: sprints.title,
          description: sprints.description,
          status: sprints.status,
        })
        .from(sprints)
        .where(eq(sprints.taskStatusId, taskStatus[0].id));

      console.log("Sprints fetched:", sprintsData.length, { taskId, userId });

      return NextResponse.json({ sprints: sprintsData }, {
        headers: { "Cache-Control": "no-store, max-age=0" }
      });
    }

    if (action === "assignees") {
      const taskId = parseInt(searchParams.get("taskId"));
      if (!taskId) return NextResponse.json({ error: "Task ID is required" }, { status: 400 });

      const userTask = await db
        .select()
        .from(assignedTaskStatus)
        .where(and(eq(assignedTaskStatus.taskId, taskId), eq(assignedTaskStatus.memberId, userId)))
        .limit(1);

      if (!userTask.length) {
        return NextResponse.json({ error: "User not assigned to task" }, { status: 403 });
      }

      const assignees = await db
        .select({ memberId: assignedTaskStatus.memberId })
        .from(assignedTaskStatus)
        .where(eq(assignedTaskStatus.taskId, taskId));

      console.log("Assignees fetched:", assignees.length, { taskId, userId });

      return NextResponse.json({ assignees }, {
        headers: { "Cache-Control": "no-store, max-age=0" }
      });
    }

    if (action === "logs") {
      const taskId = parseInt(searchParams.get("taskId"));
      if (!taskId) return NextResponse.json({ error: "Task ID is required" }, { status: 400 });

      const userTask = await db
        .select()
        .from(assignedTaskStatus)
        .where(and(eq(assignedTaskStatus.taskId, taskId), eq(assignedTaskStatus.memberId, userId)))
        .limit(1);

      if (!userTask.length) {
        return NextResponse.json({ error: "User not assigned to task" }, { status: 403 });
      }

      const logs = await db
        .select({
          id: assignedTaskLogs.id,
          taskId: assignedTaskLogs.taskId,
          userId: assignedTaskLogs.userId,
          action: assignedTaskLogs.action,
          details: assignedTaskLogs.details,
          createdAt: assignedTaskLogs.createdAt,
        })
        .from(assignedTaskLogs)
        .where(eq(assignedTaskLogs.taskId, taskId))
        .orderBy(assignedTaskLogs.createdAt);

      console.log("Task logs fetched:", logs.length, { taskId, userId });

      return NextResponse.json({ logs }, {
        headers: { "Cache-Control": "no-store, max-age=0" }
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error processing GET request:", error, { url: req.url });
    return NextResponse.json({ error: `Failed to process request: ${error.message}` }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session || !session.user || session.user.role !== "member") {
      return NextResponse.json({ error: "Unauthorized: Member access required" }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const { taskId, action, details, notifyAssignees = false, notifyWhatsapp = false } = await req.json();

    if (!taskId || !action || !details) {
      return NextResponse.json({ error: "Task ID, action, and details are required" }, { status: 400 });
    }

    const taskStatus = await db
      .select()
      .from(assignedTaskStatus)
      .where(and(eq(assignedTaskStatus.taskId, taskId), eq(assignedTaskStatus.memberId, userId)))
      .limit(1);

    if (!taskStatus.length) {
      return NextResponse.json({ error: "Task not assigned to user" }, { status: 404 });
    }

    const [log] = await db
      .insert(assignedTaskLogs)
      .values({
        taskId,
        userId,
        action,
        details,
        createdAt: new Date(),
      })
      .returning();

    console.log("Task log created:", { taskId, action, userId, details });

    if (notifyAssignees || notifyWhatsapp) {
      const [taskData] = await db
        .select({ 
          title: assignedTasks.title,
          createdBy: assignedTasks.createdBy 
        })
        .from(assignedTasks)
        .where(eq(assignedTasks.id, taskId))
        .limit(1);

      if (!taskData) {
        console.error("Task not found for notification");
      } else {
        const [updaterData] = await db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        const updaterName = updaterData?.name || "Unknown";

        const assignees = await db
          .select({ memberId: assignedTaskStatus.memberId })
          .from(assignedTaskStatus)
          .where(eq(assignedTaskStatus.taskId, taskId));

        const notificationContent = `New log added to task "${taskData.title}" by ${updaterName}: ${details}`;

        const [sender] = await db
          .select({ whatsappNumber: users.whatsappNumber })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        const senderWhatsapp = sender?.whatsappNumber;

        let assigneeIds = assignees.map(a => a.memberId);
        if (taskData.createdBy !== userId && !assigneeIds.includes(taskData.createdBy)) {
          assigneeIds.push(taskData.createdBy);
        }

        let recipientUsers = [];
        if (assigneeIds.length > 0) {
          recipientUsers = await db
            .select({ id: users.id, whatsappNumber: users.whatsappNumber })
            .from(users)
            .where(inArray(users.id, assigneeIds));
        }

        const now = new Date();
        for (const assignee of assignees) {
          if (assignee.memberId !== userId && notifyAssignees) {
            await db.insert(messages).values({
              senderId: userId,
              recipientId: assignee.memberId,
              content: notificationContent,
              createdAt: now,
              status: "sent",
            });
          }
          if (notifyWhatsapp) {
            const recipient = recipientUsers.find(u => u.id === assignee.memberId);
            if (recipient && recipient.whatsappNumber && senderWhatsapp) {
              await sendWhatsappMessage(senderWhatsapp, recipient.whatsappNumber, notificationContent);
            }
          }
        }

        // Send to creator if not the updater and not already sent as assignee
        if (taskData.createdBy !== userId && !assignees.some(a => a.memberId === taskData.createdBy)) {
          if (notifyAssignees) {
            await db.insert(messages).values({
              senderId: userId,
              recipientId: taskData.createdBy,
              content: notificationContent,
              createdAt: now,
              status: "sent",
            });
          }
          if (notifyWhatsapp) {
            const recipient = recipientUsers.find(u => u.id === taskData.createdBy);
            if (recipient && recipient.whatsappNumber && senderWhatsapp) {
              await sendWhatsappMessage(senderWhatsapp, recipient.whatsappNumber, notificationContent);
            }
          }
        }
      }
    }

    return NextResponse.json({ log }, { status: 201 });
  } catch (error) {
    console.error("Error creating task log:", error, {
      body: await req.json().catch(() => ({}))
    });
    return NextResponse.json({ error: `Failed to create task log: ${error.message}` }, { status: 500 });
  }
}