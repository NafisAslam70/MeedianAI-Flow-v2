import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Students, mriReportAssignments } from "@/lib/schema";
import { ensureHostelDailyDueTemplate } from "@/lib/mriReports";
import { and, asc, eq } from "drizzle-orm";

const parseId = (value) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
};

export async function GET(req) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (session.user.role !== "admin") {
      const template = await ensureHostelDailyDueTemplate();
      if (!template?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
      const assignment = await db
        .select({ id: mriReportAssignments.id })
        .from(mriReportAssignments)
        .where(
          and(
            eq(mriReportAssignments.templateId, template.id),
            eq(mriReportAssignments.userId, Number(session.user.id)),
            eq(mriReportAssignments.active, true)
          )
        )
        .limit(1);
      if (!assignment.length) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
    }

    const { searchParams } = new URL(req.url);
    const classId = parseId(searchParams.get("classId"));
    if (!classId) {
      return NextResponse.json({ error: "Invalid classId" }, { status: 400 });
    }

    const rows = await db
      .select({
        id: Students.id,
        name: Students.name,
        classId: Students.classId,
      })
      .from(Students)
      .where(eq(Students.classId, classId))
      .orderBy(asc(Students.name));

    return NextResponse.json({ students: rows }, { status: 200 });
  } catch (error) {
    console.error("Error fetching hostel due students:", error);
    return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 });
  }
}
