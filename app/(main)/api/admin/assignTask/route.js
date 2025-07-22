// import { NextResponse } from "next/server";
// import { db } from "@/lib/db";
// import { assignedTasks, assignedTaskStatus, users, sprints } from "@/lib/schema";
// import { eq, sql } from "drizzle-orm";
// import { auth } from "@/lib/auth";

// export async function GET(req) {
//   const session = await auth();
//   if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }

//   try {
//     let query = db
//       .select({
//         id: assignedTasks.id,
//         title: assignedTasks.title,
//         description: assignedTasks.description,
//         taskType: assignedTasks.taskType,
//         createdBy: assignedTasks.createdBy,
//         createdAt: assignedTasks.createdAt,
//         assignees: sql`json_agg(
//           json_build_object(
//             'id', ${users.id},
//             'name', ${users.name},
//             'email', ${users.email},
//             'status', ${assignedTaskStatus.status}
//           )
//         )`.as("assignees"),
//         sprints: sql`json_agg(
//           json_build_object(
//             'id', ${sprints.id},
//             'title', ${sprints.title},
//             'description', ${sprints.description},
//             'status', ${sprints.status}
//           )
//         ) FILTER (WHERE ${sprints.id} IS NOT NULL)`.as("sprints"),
//       })
//       .from(assignedTasks)
//       .leftJoin(assignedTaskStatus, eq(assignedTaskStatus.taskId, assignedTasks.id))
//       .leftJoin(users, eq(assignedTaskStatus.memberId, users.id))
//       .leftJoin(sprints, eq(sprints.taskStatusId, assignedTaskStatus.id))
//       .groupBy(assignedTasks.id);

//     if (session.user.role === "team_manager") {
//       query = query.where(eq(users.team_manager_type, session.user.team_manager_type));
//     }

//     const tasks = await query;

//     const formattedTasks = tasks
//       .map((task) => {
//         const assignees = Array.isArray(task.assignees) ? task.assignees.filter((a) => a.id !== null) : [];
//         const sprints = Array.isArray(task.sprints) ? task.sprints : [];
//         let status = "not_started";
//         if (sprints.length > 0) {
//           const sprintStatuses = sprints.map((s) => s.status);
//           if (sprintStatuses.every((s) => s === "verified" || s === "done")) {
//             status = "done";
//           } else if (sprintStatuses.some((s) => s === "in_progress" || s === "pending_verification")) {
//             status = "in_progress";
//           }
//         } else {
//           const assigneeStatuses = assignees.map((a) => a.status).filter(Boolean);
//           if (assigneeStatuses.length > 0) {
//             if (assigneeStatuses.every((s) => s === "done" || s === "verified")) {
//               status = "done";
//             } else if (assigneeStatuses.some((s) => s === "in_progress" || s === "pending_verification")) {
//               status = "in_progress";
//             }
//           }
//         }
//         return {
//           ...task,
//           status,
//           assignees: assignees.map(({ status, ...rest }) => rest),
//           sprints,
//         };
//       })
//       .filter((task) => task.assignees.length > 0);

//     return NextResponse.json({ assignedTasks: formattedTasks });
//   } catch (error) {
//     console.error("Error fetching assigned tasks:", error);
//     return NextResponse.json({ error: "Failed to fetch assigned tasks" }, { status: 500 });
//   }
// }

// export async function POST(req) {
//   const session = await auth();
//   if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }

//   try {
//     const { title, description, taskType, createdBy, assignees } = await req.json();

//     if (!title || !assignees || assignees.length === 0) {
//       return NextResponse.json({ error: "Title and at least one assignee are required" }, { status: 400 });
//     }

//     // Verify assignees exist and are accessible
//     let query = db
//       .select({ id: users.id })
//       .from(users)
//       .where(sql`${users.id} IN (${assignees.join(",")})`);

//     if (session.user.role === "team_manager") {
//       query = query.where(eq(users.team_manager_type, session.user.team_manager_type));
//     }

//     const validAssignees = await query;
//     if (validAssignees.length !== assignees.length) {
//       return NextResponse.json({ error: "One or more assignees are invalid or not accessible" }, { status: 400 });
//     }

//     // Insert task
//     const [task] = await db
//       .insert(assignedTasks)
//       .values({
//         title,
//         description: description || null,
//         taskType: taskType || "assigned",
//         createdBy: parseInt(createdBy),
//         createdAt: new Date(),
//       })
//       .returning({ id: assignedTasks.id });

//     // Insert task status for each assignee
//     const statusInserts = assignees.map((memberId) => ({
//       taskId: task.id,
//       memberId,
//       status: "not_started",
//       assignedDate: new Date(),
//       updatedAt: new Date(),
//     }));

//     await db.insert(assignedTaskStatus).values(statusInserts);

//     return NextResponse.json({ taskId: task.id });
//   } catch (error) {
//     console.error("Error creating task:", error);
//     return NextResponse.json({ error: `Failed to create task: ${error.message}` }, { status: 500 });
//   }
// }

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignedTasks, assignedTaskStatus, users, sprints } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let query = db
      .select({
        id: assignedTasks.id,
        title: assignedTasks.title,
        description: assignedTasks.description,
        taskType: assignedTasks.taskType,
        createdBy: assignedTasks.createdBy,
        createdAt: assignedTasks.createdAt,
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

    if (session.user.role === "team_manager") {
      query = query.where(eq(users.team_manager_type, session.user.team_manager_type));
    }

    const tasks = await query;

    const formattedTasks = tasks
      .map((task) => {
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
      })
      .filter((task) => task.assignees.length > 0);

    return NextResponse.json({ assignedTasks: formattedTasks });
  } catch (error) {
    console.error("Error fetching assigned tasks:", error);
    return NextResponse.json({ error: "Failed to fetch assigned tasks" }, { status: 500 });
  }
}

export async function POST(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { title, description, taskType, createdBy, assignees } = await req.json();

    if (!title || !assignees || assignees.length === 0) {
      return NextResponse.json({ error: "Title and at least one assignee are required" }, { status: 400 });
    }

    // Verify assignees exist and are accessible
    let query = db
      .select({ id: users.id })
      .from(users)
      .where(sql`${users.id} IN (${assignees.join(",")})`);

    if (session.user.role === "team_manager") {
      query = query.where(eq(users.team_manager_type, session.user.team_manager_type));
    }

    const validAssignees = await query;
    if (validAssignees.length !== assignees.length) {
      return NextResponse.json({ error: "One or more assignees are invalid or not accessible" }, { status: 400 });
    }

    // Insert task
    const [task] = await db
      .insert(assignedTasks)
      .values({
        title,
        description: description || null,
        taskType: taskType || "assigned",
        createdBy: parseInt(createdBy),
        createdAt: new Date(),
      })
      .returning({ id: assignedTasks.id });

    // Insert task status for each assignee
    const statusInserts = assignees.map((memberId) => ({
      taskId: task.id,
      memberId,
      status: "not_started",
      assignedDate: new Date(),
      updatedAt: new Date(),
    }));

    await db.insert(assignedTaskStatus).values(statusInserts);

    return NextResponse.json({ taskId: task.id });
  } catch (error) {
    console.error("Error creating task:", error);
    return NextResponse.json({ error: `Failed to create task: ${error.message}` }, { status: 500 });
  }
}