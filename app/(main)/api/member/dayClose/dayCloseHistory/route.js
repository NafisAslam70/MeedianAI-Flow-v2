// app/api/member/dayClose/dayCloseHistory/route.js
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { dayCloseRequests, users } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = Number(session.user.id);

  try {
    const requests = await db
      .select({
        id: dayCloseRequests.id,
        date: dayCloseRequests.date,
        status: dayCloseRequests.status,
        createdAt: dayCloseRequests.createdAt,
        approvedAt: dayCloseRequests.approvedAt,
        approvedByName: users.name,
        // 👇 include general logs for the thread component
        generalLog: dayCloseRequests.generalLog,
        ISGeneralLog: dayCloseRequests.ISGeneralLog,
      })
      .from(dayCloseRequests)
      .leftJoin(users, eq(dayCloseRequests.approvedBy, users.id))
      .where(eq(dayCloseRequests.userId, userId))
      .orderBy(desc(dayCloseRequests.date));

    return NextResponse.json({ requests }, { status: 200 });
  } catch (error) {
    console.error("GET /api/member/dayClose/dayCloseHistory error:", error);
    return NextResponse.json({ error: `Failed to fetch history: ${error.message}` }, { status: 500 });
  }
}
