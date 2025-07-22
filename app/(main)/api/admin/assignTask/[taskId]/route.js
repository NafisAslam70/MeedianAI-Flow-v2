// import { NextResponse } from "next/server";
// import { db } from "@/lib/db";
// import { assignedTaskStatus, sprints, users } from "@/lib/schema";
// import { auth } from "@/lib/auth";
// import { eq } from "drizzle-orm";

// export async function PATCH(req, { params }) {
//   const session = await auth();
//   if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }

//   const taskId = parseInt(params.taskId);
//   if (isNaN(taskId)) {
//     return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
//   }

//   try {
//     // Verify task assignees are accessible
//     let query = db
//       .select({ id: assignedTaskStatus.id, memberId: assignedTaskStatus.memberId })
//       .from(assignedTaskStatus)
//       .leftJoin(users, eq(assignedTaskStatus.memberId, users.id))
//       .where(eq(assignedTaskStatus.taskId, taskId));

//     if (session.user.role === "team_manager") {
//       query = query.where(eq(users.team_manager_type, session.user.team_manager_type));
//     }

//     const assignments = await query;

//     if (assignments.length === 0) {
//       return NextResponse.json({ error: "No assignments found for this task or not accessible" }, { status: 404 });
//     }

//     const { sprints: sprintData } = await req.json();

//     // Insert new sprints if provided
//     if (Array.isArray(sprintData) && sprintData.length > 0) {
//       if (sprintData.some((sprint) => !sprint.title)) {
//         return NextResponse.json({ error: "All sprints must have a title" }, { status: 400 });
//       }

//       const sprintInserts = sprintData.flatMap((sprint) =>
//         assignments.map((assignment) => ({
//           taskStatusId: assignment.id,
//           title: sprint.title,
//           description: sprint.description || null,
//           status: "not_started",
//           verifiedBy: null,
//           verifiedAt: null,
//           createdAt: new Date(),
//         }))
//       );

//       await db.insert(sprints).values(sprintInserts);

//       // Fetch sprint statuses to determine task status
//       const sprintStatuses = await db
//         .select({ status: sprints.status })
//         .from(sprints)
//         .where(eq(sprints.taskStatusId, assignments[0].id));

//       let newStatus;
//       if (sprintStatuses.length > 0) {
//         const statuses = sprintStatuses.map((s) => s.status);
//         if (statuses.every((s) => s === "verified" || s === "done")) {
//           newStatus = "done";
//         } else if (statuses.some((s) => s === "in_progress" || s === "pending_verification")) {
//           newStatus = "in_progress";
//         } else {
//           newStatus = "not_started";
//         }
//       } else {
//         newStatus = "not_started";
//       }

//       await db
//         .update(assignedTaskStatus)
//         .set({
//           status: newStatus,
//           updatedAt: new Date(),
//           comment: sprintStatuses.length > 0 ? "Status updated based on sprints" : "No sprints assigned, status reset",
//         })
//         .where(eq(assignedTaskStatus.taskId, taskId));
//     } else {
//       // If no sprints, set status to not_started
//       await db
//         .update(assignedTaskStatus)
//         .set({
//           status: "not_started",
//           updatedAt: new Date(),
//           comment: "No sprints assigned, status reset",
//         })
//         .where(eq(assignedTaskStatus.taskId, taskId));
//     }

//     return NextResponse.json({ message: "Task updated successfully" });
//   } catch (error) {
//     console.error("Error updating task:", error);
//     return NextResponse.json({ error: `Failed to update task: ${error.message}` }, { status: 500 });
//   }
// }

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignedTaskStatus, sprints, users } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function PATCH(req, { params }) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const taskId = parseInt(params.taskId);
  if (isNaN(taskId)) {
    return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
  }

  try {
    // Verify task assignees are accessible
    let query = db
      .select({ id: assignedTaskStatus.id, memberId: assignedTaskStatus.memberId })
      .from(assignedTaskStatus)
      .leftJoin(users, eq(assignedTaskStatus.memberId, users.id))
      .where(eq(assignedTaskStatus.taskId, taskId));

    if (session.user.role === "team_manager") {
      query = query.where(eq(users.team_manager_type, session.user.team_manager_type));
    }

    const assignments = await query;

    if (assignments.length === 0) {
      return NextResponse.json({ error: "No assignments found for this task or not accessible" }, { status: 404 });
    }

    const { sprints: sprintData } = await req.json();

    // Insert new sprints if provided
    if (Array.isArray(sprintData) && sprintData.length > 0) {
      if (sprintData.some((sprint) => !sprint.title)) {
        return NextResponse.json({ error: "All sprints must have a title" }, { status: 400 });
      }

      const sprintInserts = sprintData.flatMap((sprint) =>
        assignments.map((assignment) => ({
          taskStatusId: assignment.id,
          title: sprint.title,
          description: sprint.description || null,
          status: "not_started",
          verifiedBy: null,
          verifiedAt: null,
          createdAt: new Date(),
        }))
      );

      await db.insert(sprints).values(sprintInserts);

      // Fetch sprint statuses to determine task status
      const sprintStatuses = await db
        .select({ status: sprints.status })
        .from(sprints)
        .where(eq(sprints.taskStatusId, assignments[0].id));

      let newStatus;
      if (sprintStatuses.length > 0) {
        const statuses = sprintStatuses.map((s) => s.status);
        if (statuses.every((s) => s === "verified" || s === "done")) {
          newStatus = "done";
        } else if (statuses.some((s) => s === "in_progress" || s === "pending_verification")) {
          newStatus = "in_progress";
        } else {
          newStatus = "not_started";
        }
      } else {
        newStatus = "not_started";
      }

      await db
        .update(assignedTaskStatus)
        .set({
          status: newStatus,
          updatedAt: new Date(),
          comment: sprintStatuses.length > 0 ? "Status updated based on sprints" : "No sprints assigned, status reset",
        })
        .where(eq(assignedTaskStatus.taskId, taskId));
    } else {
      // If no sprints, set status to not_started
      await db
        .update(assignedTaskStatus)
        .set({
          status: "not_started",
          updatedAt: new Date(),
          comment: "No sprints assigned, status reset",
        })
        .where(eq(assignedTaskStatus.taskId, taskId));
    }

    return NextResponse.json({ message: "Task updated successfully" });
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json({ error: `Failed to update task: ${error.message}` }, { status: 500 });
  }
}