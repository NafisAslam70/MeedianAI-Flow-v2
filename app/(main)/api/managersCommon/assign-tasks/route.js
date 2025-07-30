import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignedTasks, assignedTaskStatus, users, sprints, messages } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq, inArray, sql } from "drizzle-orm";
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
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tasks = await db
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
      .leftJoin(sprints, eq(sprints.taskStatusId, assignedTaskStatus.id))
      .groupBy(assignedTasks.id);

    const formattedTasks = tasks.map((task) => {
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
      return {
        ...task,
        status,
        assignees: assignees.map(({ status, ...rest }) => rest),
        sprints,
      };
    });

    console.log("Assigned tasks fetched for admin:", formattedTasks.length, { userId: session.user.id });

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
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { title, description, taskType, createdBy, assignees, deadline, resources } = await req.json();

    if (!title || !assignees || assignees.length === 0) {
      console.error("Validation failed: Missing title or assignees", { title, assignees });
      return NextResponse.json({ error: "Title and at least one assignee are required" }, { status: 400 });
    }

    const parsedAssignees = assignees.map((id) => parseInt(id));
    let query = db
      .select({ id: users.id, name: users.name, whatsapp_number: users.whatsapp_number, whatsapp_enabled: users.whatsapp_enabled })
      .from(users)
      .where(inArray(users.id, parsedAssignees));

    if (session.user.role === "team_manager" && session.user.team_manager_type) {
      query = query.where(eq(users.team_manager_type, session.user.team_manager_type));
    }

    const validAssignees = await query;

    if (validAssignees.length !== parsedAssignees.length) {
      console.error("Invalid assignees:", { provided: parsedAssignees, valid: validAssignees.map(a => a.id) });
      return NextResponse.json({ error: "One or more assignees are invalid or not accessible" }, { status: 400 });
    }

    // Insert new task
    const [newTask] = await db
      .insert(assignedTasks)
      .values({
        title,
        description: description || null,
        taskType: taskType || "assigned",
        createdBy: parseInt(createdBy),
        createdAt: new Date(),
        updatedAt: new Date(),
        deadline: deadline ? new Date(deadline) : null,
        resources: resources || null,
      })
      .returning({ id: assignedTasks.id });

    // Insert assigned statuses
    const statusInserts = parsedAssignees.map((memberId) => ({
      taskId: newTask.id,
      memberId,
      status: "not_started",
      assignedDate: new Date(),
      updatedAt: new Date(),
    }));

    await db.insert(assignedTaskStatus).values(statusInserts);

    // Send notifications to assignees
    const [creatorData] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, createdBy))
      .limit(1);
    const creatorName = creatorData?.name || "Unknown";

    const now = new Date();
    for (const memberId of parsedAssignees) {
      await db.insert(messages).values({
        senderId: createdBy,
        recipientId: memberId,
        content: `New task "${title}" assigned to you by ${creatorName}.`,
        createdAt: now,
        status: "sent",
      });
    }

    // Send WhatsApp notifications if enabled
    const dateTime = new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    for (const assignee of validAssignees) {
      if (assignee.whatsapp_enabled && assignee.whatsapp_number) {
        await sendWhatsappMessage(assignee.whatsapp_number, {
          recipientName: assignee.name || "User",
          updaterName: creatorName,
          taskTitle: title,
          newStatus: "Assigned",
          logComment: "New task assigned",
          dateTime: dateTime,
        });
      }
    }

    console.log("Task created:", { taskId: newTask.id, title, assignees: parsedAssignees });

    return NextResponse.json({ taskId: newTask.id }, { status: 201 });
  } catch (error) {
    console.error("Error creating task:", error, { body: await req.json().catch(() => ({})) });
    return NextResponse.json({ error: `Failed to create task: ${error.message}` }, { status: 500 });
  }
}