import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appState, routineTaskDailyStatuses } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function POST(req) {
  try {
    const session = await auth();
    if (!session || !session.user || session.user.role !== "member") {
      console.error("Unauthorized access attempt:", { session });
      return NextResponse.json({ error: "Unauthorized: Member access required" }, { status: 401 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [currentState] = await db.select().from(appState).limit(1);
    if (!currentState) {
      console.error("App state not found");
      return NextResponse.json({ error: "App state not configured" }, { status: 500 });
    }

    if (currentState.dayClosedAt && new Date(currentState.dayClosedAt) >= today) {
      return NextResponse.json({ error: "Day already closed" }, { status: 400 });
    }

    await db
      .update(appState)
      .set({ dayClosedAt: new Date() })
      .where(eq(appState.id, currentState.id));

    await db
      .update(routineTaskDailyStatuses)
      .set({ isLocked: true })
      .where(eq(routineTaskDailyStatuses.date, today));

    console.log("Day closed:", { userId: session.user.id });

    return NextResponse.json({ message: "Day closed successfully" });
  } catch (error) {
    console.error("Error closing day:", error);
    return NextResponse.json({ error: `Failed to close day: ${error.message}` }, { status: 500 });
  }
}