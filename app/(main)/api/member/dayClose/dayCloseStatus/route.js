// app/api/member/dayClose/dayCloseStatus/route.js
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  dayCloseRequests,
  users,
  escalationsMatters,
  escalationsMatterMembers,
  dayCloseOverrides,
  systemFlags,
} from "@/lib/schema";
import { eq, and, gte, lte, ne, desc, inArray } from "drizzle-orm";
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
      .orderBy(desc(dayCloseRequests.createdAt))
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

    const FLAG_KEYS = {
      bypass: "show_day_close_bypass",
      ipr: "show_day_close_ipr",
      wait: "day_close_wait_compulsory",
      waitFullscreen: "day_close_wait_fullscreen",
      mobileBlock: "block_mobile_day_close",
    };

    const flagRows = await db
      .select({ key: systemFlags.key, value: systemFlags.value })
      .from(systemFlags)
      .where(inArray(systemFlags.key, Object.values(FLAG_KEYS)));

    const flagMap = new Map(flagRows.map((row) => [row.key, row.value]));
    const showBypass = !!flagMap.get(FLAG_KEYS.bypass);
    const showIprJourney = flagMap.has(FLAG_KEYS.ipr) ? !!flagMap.get(FLAG_KEYS.ipr) : true;
    const dayCloseWaitCompulsory = flagMap.has(FLAG_KEYS.wait) ? !!flagMap.get(FLAG_KEYS.wait) : false;
    const dayCloseWaitFullscreen = flagMap.has(FLAG_KEYS.waitFullscreen) ? !!flagMap.get(FLAG_KEYS.waitFullscreen) : false;
    const blockMobileDayClose = flagMap.has(FLAG_KEYS.mobileBlock) ? !!flagMap.get(FLAG_KEYS.mobileBlock) : false;

    return NextResponse.json(
      {
        ...(request ?? { status: "none" }),
        paused,
        openEscalations: count,
        overrideActive,
        showBypass,
        showIprJourney,
        dayCloseWaitCompulsory,
        dayCloseWaitFullscreen,
        blockMobileDayClose,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[dayCloseStatus] GET error:", err);
    return NextResponse.json(
      { error: `Failed to fetch status: ${err.message}` },
      { status: 500 },
    );
  }
}
