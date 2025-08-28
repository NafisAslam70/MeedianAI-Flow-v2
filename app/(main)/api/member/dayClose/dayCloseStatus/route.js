// app/api/member/dayClose/dayCloseStatus/route.js
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { dayCloseRequests, users } from "@/lib/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { startOfDay, endOfDay } from "date-fns";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);
  const dayStartUTC = startOfDay(new Date());
  const dayEndUTC = endOfDay(new Date());

  try {
    const [request] = await db
      .select({
        status: dayCloseRequests.status,
        date: dayCloseRequests.date,
        approvedBy: dayCloseRequests.approvedBy,
        approvedByName: users.name,
        ISRoutineLog: dayCloseRequests.ISRoutineLog,
        ISGeneralLog: dayCloseRequests.ISGeneralLog,
        routineLog: dayCloseRequests.routineLog, // Added
        generalLog: dayCloseRequests.generalLog, // Added
      })
      .from(dayCloseRequests)
      .leftJoin(users, eq(dayCloseRequests.approvedBy, users.id))
      .where(
        and(
          eq(dayCloseRequests.userId, userId),
          gte(dayCloseRequests.date, dayStartUTC),
          lte(dayCloseRequests.date, dayEndUTC),
        ),
      )
      .limit(1);

    return NextResponse.json(request ?? { status: "none" }, { status: 200 });
  } catch (err) {
    console.error("[dayCloseStatus] GET error:", err);
    return NextResponse.json(
      { error: `Failed to fetch status: ${err.message}` },
      { status: 500 },
    );
  }
}