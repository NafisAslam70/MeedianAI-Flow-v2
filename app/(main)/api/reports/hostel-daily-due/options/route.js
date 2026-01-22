import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Classes, mriReportAssignments, users } from "@/lib/schema";
import { ensureHostelDailyDueTemplate } from "@/lib/mriReports";
import { and, asc, eq, inArray } from "drizzle-orm";

export async function GET(req) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const section = String(searchParams.get("section") || "").toLowerCase();

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

    if (section === "authorities") {
      const template = await ensureHostelDailyDueTemplate();
      if (!template?.id) {
        return NextResponse.json({ authorities: [] }, { status: 200 });
      }

      const rows = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          team_manager_type: users.team_manager_type,
        })
        .from(mriReportAssignments)
        .innerJoin(users, eq(users.id, mriReportAssignments.userId))
        .where(
          and(
            eq(mriReportAssignments.templateId, template.id),
            inArray(mriReportAssignments.role, ["hostel_admin", "hostel_authority"]),
            eq(mriReportAssignments.active, true)
          )
        )
        .orderBy(asc(users.name));

      return NextResponse.json({ authorities: rows }, { status: 200 });
    }

    if (section === "schooloffice") {
      const template = await ensureHostelDailyDueTemplate();
      if (!template?.id) {
        return NextResponse.json({ schoolOffice: [] }, { status: 200 });
      }

      const rows = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          team_manager_type: users.team_manager_type,
        })
        .from(mriReportAssignments)
        .innerJoin(users, eq(users.id, mriReportAssignments.userId))
        .where(
          and(
            eq(mriReportAssignments.templateId, template.id),
            eq(mriReportAssignments.role, "school_office"),
            eq(mriReportAssignments.active, true)
          )
        )
        .orderBy(asc(users.name));

      return NextResponse.json({ schoolOffice: rows }, { status: 200 });
    }

    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  } catch (error) {
    console.error("Error fetching hostel daily due options:", error);
    return NextResponse.json({ error: "Failed to fetch options" }, { status: 500 });
  }
}
