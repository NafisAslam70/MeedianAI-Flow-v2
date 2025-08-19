import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { dayCloseRequests, users, openCloseTimes } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req) {
  const session = await auth();
  if (!session || !["member", "team_manager"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = Number(session.user.id);
  const { date, assignedTasksUpdates, routineTasksUpdates, routineLog, generalLog, mriCleared, bypass = false } = await req.json(); // TO BE REMOVED FOR PRODUCTION: Remove bypass parameter

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

    // TO BE REMOVED FOR PRODUCTION: Bypass closing window check
    // Validate closing window (skip if bypass is true)
    if (!bypass) {
      const user = await db
        .select({ type: users.type })
        .from(users)
        .where(eq(users.id, userId))
        .then((res) => res[0]);
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
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
        createdAt: new Date(),
      })
      .returning();

    return NextResponse.json({ request }, { status: 200 });
  } catch (error) {
    console.error("POST /api/member/dayClose/dayCloseRequest error:", error);
    return NextResponse.json({ error: `Failed to submit day close request: ${error.message}` }, { status: 500 });
  }
}