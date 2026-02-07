import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createAcademicHealthReport,
  updateAcademicHealthReport,
  getAcademicHealthReportById,
  ValidationError,
} from "@/lib/academicHealthReports";
import { db } from "@/lib/db";
import { academicHealthReports } from "@/lib/schema";
import { and, eq } from "drizzle-orm";

/**
 * Creates/updates an AHR record for the given date + assignee and upserts defaulters/actions.
 * This lets Hostel Daily Defaulters (Admin Club tab) stay in sync with the AHR defaulters table.
 */
export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user || !["admin", "team_manager"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      reportDate,
      siteId = 1,
      assignedToUserId,
      defaulters = [],
      actionsByCategory = [],
      checkMode = "MSP",
      override = false,
      extend = false,
    } = body || {};

    if (!reportDate || !assignedToUserId) {
      return NextResponse.json(
        { error: "reportDate and assignedToUserId are required" },
        { status: 400 }
      );
    }

    // Check for existing report
    const existing = await db
      .select({ id: academicHealthReports.id })
      .from(academicHealthReports)
      .where(
        and(
          eq(academicHealthReports.reportDate, new Date(`${reportDate}T00:00:00`)),
          eq(academicHealthReports.siteId, Number(siteId)),
          eq(academicHealthReports.assignedToUserId, Number(assignedToUserId))
        )
      )
      .limit(1);

    const existingId = existing?.[0]?.id || null;

    if (existingId && !override && !extend) {
      return NextResponse.json(
        {
          error: "Report already exists for this date and dean.",
          conflict: true,
          reportId: existingId,
        },
        { status: 409 }
      );
    }

    const targetReport = existingId
      ? await getAcademicHealthReportById(existingId)
      : await createAcademicHealthReport({
          reportDate,
          siteId,
          assignedToUserId: Number(assignedToUserId),
          checkMode,
          createdByUserId: Number(session.user.id),
        });

    let mergedDefaulters = defaulters || [];
    if (existingId && extend && Array.isArray(targetReport?.defaulters)) {
      mergedDefaulters = [...targetReport.defaulters, ...(defaulters || [])];
    }

    // Aggregate actionsByCategory from mergedDefaulters if not provided explicitly
    const mergedActionsByCategory =
      actionsByCategory && actionsByCategory.length
        ? actionsByCategory
        : Object.values(
            (mergedDefaulters || []).reduce((acc, row) => {
              if (!row?.defaulterType) return acc;
              const set = new Set(acc[row.defaulterType]?.actions || []);
              (Array.isArray(row.actions) ? row.actions : []).forEach((a) => set.add(a));
              acc[row.defaulterType] = { category: row.defaulterType, actions: Array.from(set) };
              return acc;
            }, {})
          );

    const updated = await updateAcademicHealthReport(
      targetReport.id,
      { defaulters: mergedDefaulters, actionsByCategory: mergedActionsByCategory },
      { actorUserId: session.user.id, actorRole: session.user.role }
    );

    return NextResponse.json({ report: updated }, { status: 200 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message, details: error.details || null }, { status: 400 });
    }
    console.error("POST /api/admin/admin-club/hostel-defaulters error:", error);
    return NextResponse.json({ error: "Failed to save hostel defaulters" }, { status: 500 });
  }
}
