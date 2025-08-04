import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db }   from "@/lib/db";
import {
  assignedTaskStatus,
  routineTaskDailyStatuses,
  generalLogs,
} from "@/lib/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req) {
  const session = await auth();
  if (!session || !["member","team_manager"].includes(session.user.role))
    return NextResponse.json({ error:"Unauthorized" }, { status:401 });

  const userId = +session.user.id;
  const body   = await req.json();          // { assigned, routine, comment }

  /* 1️⃣  Assigned tasks updates */
  for (const [taskId, cfg] of Object.entries(body.assigned || {})) {
    if (cfg.action === "done") {
      await db.update(assignedTaskStatus)
        .set({ status: "done" })
        .where(and(
          eq(assignedTaskStatus.taskId, +taskId),
          eq(assignedTaskStatus.memberId, userId)
        ));
    }
    if (cfg.action === "move" && cfg.moveTo) {
      await db.update(assignedTaskStatus)
        .set({ status: "not_started", deadline: new Date(cfg.moveTo) })
        .where(and(
          eq(assignedTaskStatus.taskId, +taskId),
          eq(assignedTaskStatus.memberId, userId)
        ));
    }
  }

  /* 2️⃣  Routine tasks checkboxes */
  const today = new Date().toISOString().substring(0,10);
  for (const [rtId, checked] of Object.entries(body.routine || {})) {
    if (!checked) continue;
    await db.update(routineTaskDailyStatuses)
      .set({ status:"done", isLocked:true })
      .where(and(
        eq(routineTaskDailyStatuses.routineTaskId, +rtId),
        eq(routineTaskDailyStatuses.date, today)
      ));
  }

  /* 3️⃣  Log the submission (superintendent will verify later) */
  await db.insert(generalLogs).values({
    userId,
    action : "close_day_submitted",
    details: body.comment || "(no comment)",
  });

  return NextResponse.json({ ok:true });
}
