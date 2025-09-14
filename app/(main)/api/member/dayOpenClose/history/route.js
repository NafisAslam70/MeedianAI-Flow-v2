import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { dayOpenCloseHistory } from "@/lib/schema";
import { and, eq, gte, lte } from "drizzle-orm";

export async function GET(req) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = Number(session.user.id);
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const type = (searchParams.get("type") || "both").toLowerCase(); // open | close | both

    const where = [eq(dayOpenCloseHistory.userId, userId)];
    if (from) where.push(gte(dayOpenCloseHistory.date, new Date(from)));
    if (to) where.push(lte(dayOpenCloseHistory.date, new Date(to)));

    let rows = await db
      .select({
        date: dayOpenCloseHistory.date,
        openedAt: dayOpenCloseHistory.openedAt,
        closedAt: dayOpenCloseHistory.closedAt,
        source: dayOpenCloseHistory.source,
      })
      .from(dayOpenCloseHistory)
      .where(where.length > 1 ? and(...where) : where[0])
      .then((r) => r.sort((a,b) => new Date(b.date) - new Date(a.date)));

    // type filter in-memory for simplicity/compatibility
    if (type === 'open') rows = rows.filter((r) => !!r.openedAt);
    else if (type === 'close') rows = rows.filter((r) => !!r.closedAt);

    return NextResponse.json({ history: rows }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}
