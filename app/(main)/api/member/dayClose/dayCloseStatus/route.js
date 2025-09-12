// app/api/member/dayClose/dayCloseStatus/route.js
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { dayCloseRequests, users, escalationsMatters, escalationsMatterMembers, dayCloseOverrides } from "@/lib/schema";
import { eq, and, gte, lte, ne } from "drizzle-orm";
import { sql } from "drizzle-orm";
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

    // pause info
    const cntRows = await db
      .select({ value: sql`COUNT(*)::int` })
      .from(escalationsMatters)
      .innerJoin(
        escalationsMatterMembers,
        eq(escalationsMatterMembers.matterId, escalationsMatters.id)
      )
      .where(and(eq(escalationsMatterMembers.userId, userId), ne(escalationsMatters.status, 'CLOSED')));
    const count = Number(cntRows?.[0]?.value ?? 0);
    const overrides = await db
      .select()
      .from(dayCloseOverrides)
      .where(and(eq(dayCloseOverrides.userId, userId), eq(dayCloseOverrides.active, true)));
    const overrideActive = overrides.length > 0;
    const paused = count > 0 && !overrideActive;

    return NextResponse.json({ ...(request ?? { status: "none" }), paused, openEscalations: count, overrideActive }, { status: 200 });
  } catch (err) {
    console.error("[dayCloseStatus] GET error:", err);
    return NextResponse.json(
      { error: `Failed to fetch status: ${err.message}` },
      { status: 500 },
    );
  }
}
