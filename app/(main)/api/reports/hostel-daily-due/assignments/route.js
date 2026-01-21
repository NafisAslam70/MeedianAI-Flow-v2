import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { mriReportAssignments } from "@/lib/schema";
import { ensureHostelDailyDueTemplate } from "@/lib/mriReports";
import { and, eq, gte, isNull, lte, or } from "drizzle-orm";

const todayIso = () => new Date().toISOString().slice(0, 10);

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ assignments: [] }, { status: 200 });
    }

    const template = await ensureHostelDailyDueTemplate();
    if (!template?.id) {
      return NextResponse.json({ assignments: [] }, { status: 200 });
    }

    const isoDate = todayIso();
    const assignments = await db
      .select({
        id: mriReportAssignments.id,
        role: mriReportAssignments.role,
        active: mriReportAssignments.active,
        startDate: mriReportAssignments.startDate,
        endDate: mriReportAssignments.endDate,
      })
      .from(mriReportAssignments)
      .where(
        and(
          eq(mriReportAssignments.templateId, template.id),
          eq(mriReportAssignments.userId, Number(session.user.id)),
          eq(mriReportAssignments.active, true),
          or(isNull(mriReportAssignments.startDate), lte(mriReportAssignments.startDate, isoDate)),
          or(isNull(mriReportAssignments.endDate), gte(mriReportAssignments.endDate, isoDate))
        )
      );

    return NextResponse.json({ assignments }, { status: 200 });
  } catch (error) {
    console.error("Error fetching hostel daily due assignments:", error);
    return NextResponse.json({ error: "Failed to fetch assignments" }, { status: 500 });
  }
}
