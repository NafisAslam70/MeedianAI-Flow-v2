import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { notifications } from "@/lib/schema";
import { and, desc, eq } from "drizzle-orm";

export async function GET(req) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const url = new URL(req.url);
    const unread = url.searchParams.get("unread") === "1";
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit")) || 20));
    const where = unread ? and(eq(notifications.userId, Number(session.user.id)), eq(notifications.read, false)) : eq(notifications.userId, Number(session.user.id));
    const rows = await db
      .select()
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
    return NextResponse.json({ notifications: rows });
  } catch (e) {
    console.error("GET notifications", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PATCH(req) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id, all = false, read = true } = await req.json();
    if (!all && !id) return NextResponse.json({ error: "id or all required" }, { status: 400 });
    const where = all ? eq(notifications.userId, Number(session.user.id)) : and(eq(notifications.userId, Number(session.user.id)), eq(notifications.id, Number(id)));
    const updated = await db.update(notifications).set({ read: !!read }).where(where).returning({ id: notifications.id });
    return NextResponse.json({ updated });
  } catch (e) {
    console.error("PATCH notifications", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

