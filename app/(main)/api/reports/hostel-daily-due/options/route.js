import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Classes, mriReportAssignments, users } from "@/lib/schema";
import { ensureHostelDailyDueTemplate } from "@/lib/mriReports";
import { and, eq, gte, isNull, lte, or, asc } from "drizzle-orm";

const todayIso = () => new Date().toISOString().slice(0, 10);

const hasHostelAssignment = async (userId) => {
  const template = await ensureHostelDailyDueTemplate();
  if (!template?.id) return false;

  const isoDate = todayIso();
  const rows = await db
    .select({ id: mriReportAssignments.id })
    .from(mriReportAssignments)
    .where(
      and(
        eq(mriReportAssignments.templateId, template.id),
        eq(mriReportAssignments.userId, Number(userId)),
        eq(mriReportAssignments.active, true),
        or(isNull(mriReportAssignments.startDate), lte(mriReportAssignments.startDate, isoDate)),
        or(isNull(mriReportAssignments.endDate), gte(mriReportAssignments.endDate, isoDate))
      )
    )
    .limit(1);

  return rows.length > 0;
};

export async function GET(req) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const section = String(searchParams.get("section") || "").toLowerCase();

    const isAdmin = session.user.role === "admin";
    const allowed = isAdmin || (await hasHostelAssignment(session.user.id));
    if (!allowed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (section === "classes") {
      const rows = await db
        .select({
          id: Classes.id,
          name: Classes.name,
          section: Classes.section,
          track: Classes.track,
          active: Classes.active,
        })
        .from(Classes)
        .orderBy(asc(Classes.name), asc(Classes.section));
      return NextResponse.json({ classes: rows }, { status: 200 });
    }

    if (section === "users") {
      const rows = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          type: users.type,
          team_manager_type: users.team_manager_type,
          immediate_supervisor: users.immediate_supervisor,
          isTeacher: users.isTeacher,
        })
        .from(users)
        .orderBy(asc(users.name));
      return NextResponse.json({ users: rows }, { status: 200 });
    }

    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  } catch (error) {
    console.error("Error fetching hostel daily due options:", error);
    return NextResponse.json({ error: "Failed to fetch options" }, { status: 500 });
  }
}
