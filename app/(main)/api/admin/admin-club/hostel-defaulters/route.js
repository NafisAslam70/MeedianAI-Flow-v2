import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createAcademicHealthReport,
  updateAcademicHealthReport,
  ValidationError,
} from "@/lib/academicHealthReports";

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
    } = body || {};

    if (!reportDate || !assignedToUserId) {
      return NextResponse.json(
        { error: "reportDate and assignedToUserId are required" },
        { status: 400 }
      );
    }

    // Ensure an AHR exists (returns existing if already created)
    const report = await createAcademicHealthReport({
      reportDate,
      siteId,
      assignedToUserId: Number(assignedToUserId),
      checkMode,
      createdByUserId: Number(session.user.id),
    });

    // Upsert defaulters + actions (no validation run here)
    const updated = await updateAcademicHealthReport(
      report.id,
      { defaulters, actionsByCategory },
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
