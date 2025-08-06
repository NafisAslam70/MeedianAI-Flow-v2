// // app/(main)/api/managersCommon/dayCloseRequests/route.js
// import { NextResponse } from "next/server";
// import { db } from "@/lib/db";
// import { auth } from "@/lib/auth";
// import { dayCloseRequests, users } from "@/lib/schema";
// import { eq } from "drizzle-orm";

// export async function GET(req) {
//   const session = await auth();
//   if (!session || !["admin", "team_manager"].includes(session.user.role)) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }

//   try {
//     const requests = await db
//       .select({
//         id: dayCloseRequests.id,
//         userId: dayCloseRequests.userId,
//         userName: users.name,
//         date: dayCloseRequests.date,
//         status: dayCloseRequests.status,
//         // mriCleared: dayCloseRequests.mriCleared,
//         assignedTasksUpdates: dayCloseRequests.assignedTasksUpdates,
//         routineTasksUpdates: dayCloseRequests.routineTasksUpdates,
//         routineLog: dayCloseRequests.routineLog,
//         createdAt: dayCloseRequests.createdAt,
//       })
//       .from(dayCloseRequests)
//       .leftJoin(users, eq(dayCloseRequests.userId, users.id))
//       .where(eq(dayCloseRequests.status, "pending"));

//     // Sanitize null jsonb fields to empty arrays
//     const sanitizedRequests = requests.map((request) => ({
//       ...request,
//       assignedTasksUpdates: request.assignedTasksUpdates ? (Array.isArray(request.assignedTasksUpdates) ? request.assignedTasksUpdates : []) : [],
//       routineTasksUpdates: request.routineTasksUpdates ? (Array.isArray(request.routineTasksUpdates) ? request.routineTasksUpdates : []) : [],
//       routineLog: request.routineLog || null,
//     }));

//     return NextResponse.json({ requests: sanitizedRequests }, { status: 200 });
//   } catch (error) {
//     console.error("GET /api/managersCommon/dayCloseRequests error:", error);
//     return NextResponse.json({ error: `Failed to fetch requests: ${error.message}` }, { status: 500 });
//   }
// }

// app/(main)/api/managersCommon/dayCloseRequests/route.js
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { dayCloseRequests, users } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const requests = await db
      .select({
        id: dayCloseRequests.id,
        userId: dayCloseRequests.userId,
        userName: users.name,
        date: dayCloseRequests.date,
        status: dayCloseRequests.status,
        // mriCleared: dayCloseRequests.mriCleared,
        assignedTasksUpdates: dayCloseRequests.assignedTasksUpdates,
        routineTasksUpdates: dayCloseRequests.routineTasksUpdates,
        routineLog: dayCloseRequests.routineLog,
        generalLog: dayCloseRequests.generalLog,
        createdAt: dayCloseRequests.createdAt,
      })
      .from(dayCloseRequests)
      .leftJoin(users, eq(dayCloseRequests.userId, users.id))
      .where(eq(dayCloseRequests.status, "pending"));

    // Sanitize null jsonb fields to empty arrays
    const sanitizedRequests = requests.map((request) => ({
      ...request,
      assignedTasksUpdates: request.assignedTasksUpdates ? (Array.isArray(request.assignedTasksUpdates) ? request.assignedTasksUpdates : []) : [],
      routineTasksUpdates: request.routineTasksUpdates ? (Array.isArray(request.routineTasksUpdates) ? request.routineTasksUpdates : []) : [],
      routineLog: request.routineLog || null,
      generalLog: request.generalLog || null,
    }));

    return NextResponse.json({ requests: sanitizedRequests }, { status: 200 });
  } catch (error) {
    console.error("GET /api/managersCommon/dayCloseRequests error:", error);
    return NextResponse.json({ error: `Failed to fetch requests: ${error.message}` }, { status: 500 });
  }
}