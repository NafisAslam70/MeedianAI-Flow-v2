import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { mriDefaulterLogs } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(req) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ entries: [] }, { status: 200 });

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date"); // "YYYY-MM-DD"
    if (!date) return NextResponse.json({ error: "Missing date" }, { status: 400 });

    const entries = await db.select().from(mriDefaulterLogs).where(eq(mriDefaulterLogs.date, date));
    return NextResponse.json({ entries });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { date, entries } = body || {};
    if (!date) return NextResponse.json({ error: "date is required" }, { status: 400 });

    const values = (Array.isArray(entries) ? entries : [])
      .filter(
        (e) =>
          e &&
          Number.isFinite(e.studentId) &&
          ["punctuality", "language", "discipline"].includes(e.type)
      )
      .map((e) => ({
        date, // DATE column; pass "YYYY-MM-DD"
        defaulter_type: e.type,
        studentId: Number(e.studentId),
        reportedBy: Number(session.user.id),
      }));

    if (values.length) {
      await db.insert(mriDefaulterLogs).values(values).onConflictDoNothing();
    }

    const out = await db.select().from(mriDefaulterLogs).where(eq(mriDefaulterLogs.date, date));
    return NextResponse.json({ ok: true, count: values.length, entries: out });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
