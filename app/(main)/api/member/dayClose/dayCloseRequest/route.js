import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  dayCloseRequests,
  users,
  openCloseTimes,
  escalationsMatters,
  escalationsMatterMembers,
  dayCloseOverrides,
  systemFlags,
  routineLogRequiredMembers,
} from "@/lib/schema";
import { eq, and, ne, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";

export async function POST(req) {
  const session = await auth();
  if (!session || !["member", "team_manager"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = Number(session.user.id);
  const { date, assignedTasksUpdates, routineTasksUpdates, routineLog, generalLog, mriCleared, mriReport, bypass = false } = await req.json(); // TO BE REMOVED FOR PRODUCTION: Remove bypass parameter

  try {
    // Validate inputs
    if (!date) {
      return NextResponse.json({ error: "Missing date" }, { status: 400 });
    }

    // Validate date format
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
    }

    // Validate assignedTasksUpdates (allow empty array)
    if (!Array.isArray(assignedTasksUpdates)) {
      return NextResponse.json({ error: "assignedTasksUpdates must be an array" }, { status: 400 });
    }
    for (const update of assignedTasksUpdates) {
      if (!Number.isInteger(update.id) || !update.statusUpdate || !["not_started", "in_progress", "pending_verification", "done"].includes(update.statusUpdate)) {
        return NextResponse.json({ error: `Invalid assigned task update data for task ID ${update.id}` }, { status: 400 });
      }
      if (update.newDeadline && isNaN(new Date(update.newDeadline).getTime())) {
        return NextResponse.json({ error: `Invalid deadline format for task ID ${update.id}` }, { status: 400 });
      }
    }

    // Validate routineTasksUpdates (allow empty array)
    if (!Array.isArray(routineTasksUpdates)) {
      return NextResponse.json({ error: "routineTasksUpdates must be an array" }, { status: 400 });
    }
    for (const task of routineTasksUpdates) {
      if (!Number.isInteger(task.id) || typeof task.done !== "boolean") {
        return NextResponse.json({ error: `Invalid routine task update data for task ID ${task.id}` }, { status: 400 });
      }
    }

    const FLAG_KEYS = {
      bypass: "show_day_close_bypass",
      mobileBlock: "block_mobile_day_close",
      routineLogAll: "routine_log_required_all",
      routineLogTeachers: "routine_log_required_teachers",
      routineLogNonTeachers: "routine_log_required_non_teachers",
    };

    const flagRows = await db
      .select({ key: systemFlags.key, value: systemFlags.value })
      .from(systemFlags)
      .where(inArray(systemFlags.key, Object.values(FLAG_KEYS)));
    const flagMap = new Map(flagRows.map((row) => [row.key, row.value]));

    const bypassEnabled = !!flagMap.get(FLAG_KEYS.bypass);
    const useBypass = !!bypass && bypassEnabled;
    if (!!bypass && !bypassEnabled) {
      return NextResponse.json({ error: "Day Close bypass is disabled by admin." }, { status: 403 });
    }

    const blockMobileDayClose = !!flagMap.get(FLAG_KEYS.mobileBlock);
    if (blockMobileDayClose) {
      const userAgent = req.headers.get("user-agent") || "";
      const isMobileDevice = /Mobi|Android|iPhone|iPad|Phone|iPod|Mobile|Tablet/i.test(userAgent);
      if (isMobileDevice) {
        return NextResponse.json(
          {
            error: "Day Close submissions from mobile devices are currently blocked. Please switch to a desktop browser.",
          },
          { status: 403 }
        );
      }
    }

    const user = await db
      .select({ type: users.type, isTeacher: users.isTeacher })
      .from(users)
      .where(eq(users.id, userId))
      .then((res) => res[0]);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const routineLogRequiredAll = !!flagMap.get(FLAG_KEYS.routineLogAll);
    const routineLogRequiredTeachers = !!flagMap.get(FLAG_KEYS.routineLogTeachers);
    const routineLogRequiredNonTeachers = !!flagMap.get(FLAG_KEYS.routineLogNonTeachers);
    const requiredRows = await db
      .select({ userId: routineLogRequiredMembers.userId })
      .from(routineLogRequiredMembers);
    const routineLogRequiredMemberIds = requiredRows
      .map((r) => Number(r.userId))
      .filter((n) => Number.isInteger(n));
    const isTeacher = user?.isTeacher === true;
    const routineLogRequired =
      routineLogRequiredAll ||
      (isTeacher && routineLogRequiredTeachers) ||
      (!isTeacher && routineLogRequiredNonTeachers) ||
      routineLogRequiredMemberIds.includes(userId);

    if (session.user?.role === "team_manager" && routineLogRequired) {
      for (const task of routineTasksUpdates) {
        const source = task?.managerSource;
        if (source === "assigned") {
          const assignedId = Number(task?.managerAssignedTaskId);
          if (!Number.isInteger(assignedId) || assignedId <= 0) {
            return NextResponse.json(
              { error: "Managerial report is required for all routine tasks. Please link assigned tasks." },
              { status: 400 }
            );
          }
        } else if (source === "log") {
          if (!String(task?.managerLog || "").trim()) {
            return NextResponse.json(
              { error: "Managerial report is required for all routine tasks. Please add quick notes." },
              { status: 400 }
            );
          }
        } else {
          return NextResponse.json(
            { error: "Managerial report is required for all routine tasks." },
            { status: 400 }
          );
        }
      }
    }

    if (routineLogRequired && !String(routineLog || "").trim()) {
      return NextResponse.json(
        { error: "Routine Task Log is required. Please add what you did before submitting." },
        { status: 400 }
      );
    }

    // TO BE REMOVED FOR PRODUCTION: Bypass closing window check
    // Validate closing window (skip if bypass is true)
    if (!useBypass) {
      const times = await db
        .select()
        .from(openCloseTimes)
        .where(eq(openCloseTimes.userType, user.type))
        .then((res) => res[0]);
      if (!times) {
        return NextResponse.json({ error: "Open/close times not found" }, { status: 404 });
      }
      const now = new Date();
      const closingStart = new Date();
      const [startH, startM] = times.closingWindowStart.split(":").map(Number);
      closingStart.setHours(startH, startM, 0, 0);
      const closingEnd = new Date();
      const [endH, endM] = times.closingWindowEnd.split(":").map(Number);
      closingEnd.setHours(endH, endM, 0, 0);
      if (now < closingStart || now > closingEnd) {
        return NextResponse.json({ error: "Not within closing window" }, { status: 400 });
      }
    }

    // Day-Close pause check: if user is involved in any open escalation and no active override, block
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
    if (count > 0 && !overrideActive) {
      return NextResponse.json({ error: "Day Close paused due to an active escalation involving you. Please resolve the escalation or contact your immediate supervisor/superintendent for an override." }, { status: 403 });
    }

    // Check for existing pending request
    const [existingRequest] = await db
      .select({ id: dayCloseRequests.id })
      .from(dayCloseRequests)
      .where(
        and(
          eq(dayCloseRequests.userId, userId),
          eq(dayCloseRequests.date, parsedDate),
          eq(dayCloseRequests.status, "pending")
        )
      );
    if (existingRequest) {
      return NextResponse.json({ error: "A pending day close request already exists for this date" }, { status: 400 });
    }

    // Store day close request
    const [request] = await db
      .insert(dayCloseRequests)
      .values({
        userId,
        date: parsedDate,
        status: "pending",
        assignedTasksUpdates: assignedTasksUpdates.length > 0 ? assignedTasksUpdates : null,
        routineTasksUpdates: routineTasksUpdates.length > 0 ? routineTasksUpdates : null,
        routineLog: routineLog || null,
        generalLog: generalLog || null,
        mriCleared: mriCleared ?? true,
        mriReport: mriReport || null,
        createdAt: new Date(),
      })
      .returning();

    return NextResponse.json({ request }, { status: 200 });
  } catch (error) {
    console.error("POST /api/member/dayClose/dayCloseRequest error:", error);
    return NextResponse.json({ error: `Failed to submit day close request: ${error.message}` }, { status: 500 });
  }
}
