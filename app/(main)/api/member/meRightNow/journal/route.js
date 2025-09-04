import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { meRightNowSessions } from "@/lib/schema";
import { and, eq, gte, lte } from "drizzle-orm";

export async function GET(req) {
  try {
    const session = await auth();
    if (!session || !["member", "team_manager", "admin"].includes(session.user?.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number(session.user.id);
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");

    const date = dateParam ? new Date(dateParam) : new Date();
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const rows = await db
      .select({
        id: meRightNowSessions.id,
        type: meRightNowSessions.type,
        itemId: meRightNowSessions.itemId,
        itemTitle: meRightNowSessions.itemTitle,
        note: meRightNowSessions.note,
        startedAt: meRightNowSessions.startedAt,
        endedAt: meRightNowSessions.endedAt,
        active: meRightNowSessions.active,
      })
      .from(meRightNowSessions)
      .where(
        and(
          eq(meRightNowSessions.userId, userId),
          gte(meRightNowSessions.startedAt, start),
          lte(meRightNowSessions.startedAt, end)
        )
      )
      .orderBy(meRightNowSessions.startedAt);

    return NextResponse.json({ sessions: rows });
  } catch (e) {
    console.error("journal error", e);
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}

