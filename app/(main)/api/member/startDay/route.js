import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { userOpenCloseTimes, openCloseTimes, users } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req) {
  try {
    const session = await auth();
    if (!session || !["member", "team_manager"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number(session.user.id);
    const { date } = await req.json();
    if (!date) {
      return NextResponse.json({ error: "date param required" }, { status: 400 });
    }

    // Get user type
    const [user] = await db
      .select({ type: users.type })
      .from(users)
      .where(eq(users.id, userId));
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get dayOpenTime for user type
    const [openClose] = await db
      .select({ dayOpenTime: openCloseTimes.dayOpenTime })
      .from(openCloseTimes)
      .where(eq(openCloseTimes.userType, user.type));
    if (!openClose) {
      return NextResponse.json({ error: "Open/close times not found" }, { status: 404 });
    }

    // Check if within 10 minutes of dayOpenTime
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    if (date !== today) {
      return NextResponse.json({ error: "Can only start the current day" }, { status: 400 });
    }

    const dayOpenDateTime = new Date(`${date}T${openClose.dayOpenTime}`);
    const tenMinutesLater = new Date(dayOpenDateTime.getTime() + 10 * 60 * 1000);
    if (now < dayOpenDateTime || now > tenMinutesLater) {
      return NextResponse.json({ error: "Outside day open window" }, { status: 403 });
    }

    // Check if day already started
    const [existing] = await db
      .select({ id: userOpenCloseTimes.id })
      .from(userOpenCloseTimes)
      .where(and(eq(userOpenCloseTimes.userId, userId), eq(userOpenCloseTimes.createdAt, new Date(date))));
    if (existing) {
      return NextResponse.json({ error: "Day already started" }, { status: 400 });
    }

    // Log day start
    const [record] = await db
      .insert(userOpenCloseTimes)
      .values({
        userId,
        dayOpenedAt: now.toTimeString().split(" ")[0], // Store time only (HH:MM:SS)
        createdAt: new Date(date),
      })
      .returning();

    return NextResponse.json({ dayOpenedAt: record.dayOpenedAt }, { status: 201 });
  } catch (err) {
    console.error("startDay POST error:", err.message, err.stack);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}