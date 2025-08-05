// app/(main)/api/member/dayCloseStatus/route.js
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { dayCloseRequests } from "@/lib/schema";
import { eq, and, sql } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = Number(session.user.id);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to start of day

  try {
    const [request] = await db
      .select({
        status: dayCloseRequests.status,
      })
      .from(dayCloseRequests)
      .where(
        and(
          eq(dayCloseRequests.userId, userId),
          eq(sql`DATE(${dayCloseRequests.date})`, sql`DATE(${today})`)
        )
      )
      .limit(1);

    return NextResponse.json({ status: request?.status || "none" }, { status: 200 });
  } catch (error) {
    console.error("GET /api/member/dayCloseStatus error:", error);
    return NextResponse.json({ error: `Failed to fetch status: ${error.message}` }, { status: 500 });
  }
}