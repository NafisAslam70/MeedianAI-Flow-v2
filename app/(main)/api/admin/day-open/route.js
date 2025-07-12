import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eq, gte } from "drizzle-orm";
import { users, routineTasks, routineTaskDailyStatuses, appState } from "@/lib/schema";

export async function POST() {
  const now = new Date();
  const today = new Date(now.toISOString().split("T")[0]);

  const existing = await db
    .select()
    .from(appState)
    .where(gte(appState.dayOpenedAt, today));

  if (existing.length > 0) {
    return NextResponse.json({ message: "Day already opened." }, { status: 400 });
  }

  // Pick default closing window (residential: 19:30–20:00)
  const closingWindowStart = new Date(`${today.toISOString().split("T")[0]}T19:30:00`);
  const closingWindowEnd = new Date(`${today.toISOString().split("T")[0]}T20:00:00`);

  // Insert app state with closing window
  await db.insert(appState).values({
    dayOpenedAt: now,
    closingWindowStart,
    closingWindowEnd,
  });

  const members = await db.select().from(users).where(eq(users.role, "member"));

  for (const member of members) {
    const routines = await db
      .select()
      .from(routineTasks)
      .where(eq(routineTasks.memberId, member.id));

    for (const routine of routines) {
      const existingStatus = await db
        .select()
        .from(routineTaskDailyStatuses)
        .where(
          eq(routineTaskDailyStatuses.routineTaskId, routine.id)
        )
        .where(gte(routineTaskDailyStatuses.date, today));

      if (existingStatus.length === 0) {
        await db.insert(routineTaskDailyStatuses).values({
          routineTaskId: routine.id,
          date: now,
          status: "not_started",
        });
      }
    }
  }

  return NextResponse.json({ message: "Day opened and tasks created." });
}
