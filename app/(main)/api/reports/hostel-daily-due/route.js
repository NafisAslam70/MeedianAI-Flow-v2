import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hostelDailyDueReports, users } from "@/lib/schema";
import { escalationsMatters } from "@/lib/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");
    const assignedTo = searchParams.get("assignedTo");

    let query = db
      .select({
        id: hostelDailyDueReports.id,
        reportDate: hostelDailyDueReports.reportDate,
        entries: hostelDailyDueReports.entries,
        status: hostelDailyDueReports.status,
        submittedByName: users.name,
        createdAt: hostelDailyDueReports.createdAt,
      })
      .from(hostelDailyDueReports)
      .leftJoin(users, eq(hostelDailyDueReports.submittedBy, users.id))
      .orderBy(desc(hostelDailyDueReports.createdAt));

    // If assignedTo is provided, filter for reports assigned to this user
    if (assignedTo) {
      // Since entries is JSON, we need to filter in JavaScript after fetching
      // For now, fetch all and filter client-side, but ideally this should be done in DB
      const allReports = await query.limit(100); // Fetch more to filter
      const filteredReports = allReports.filter(report => {
        if (!report.entries) return false;
        // Check if any entry has assignedHigherAuthority matching the user
        return Array.isArray(report.entries) && report.entries.some(entry =>
          entry.assignedHigherAuthority === assignedTo && entry.actionType === 'assign_to_higher_authority'
        );
      });
      return NextResponse.json({ reports: filteredReports.slice(0, limit) }, { status: 200 });
    }

    const reports = await query.limit(limit);
    return NextResponse.json({ reports }, { status: 200 });
  } catch (error) {
    console.error("Error fetching hostel daily due reports:", error);
    return NextResponse.json(
      { error: "Failed to fetch reports" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { reportDate, entries, hostelInchargeId, submittedBy, reportId } = body;

    if (!reportDate || !entries || !submittedBy) {
      return NextResponse.json(
        { error: "Missing required fields: reportDate, entries, submittedBy" },
        { status: 400 }
      );
    }

    // If reportId is provided, this is an update (HA completing assigned report)
    if (reportId) {
      // Update existing report
      await db
        .update(hostelDailyDueReports)
        .set({
          entries: entries,
          status: 'completed'
        })
        .where(eq(hostelDailyDueReports.id, reportId));

      return NextResponse.json(
        { message: "Report updated successfully" },
        { status: 200 }
      );
    }

    // New report creation (HI creating report)
    if (!hostelInchargeId) {
      return NextResponse.json(
        { error: "Missing required field: hostelInchargeId for new reports" },
        { status: 400 }
      );
    }

    // Check if report already exists for this date and incharge
    const existingReport = await db
      .select()
      .from(hostelDailyDueReports)
      .where(
        and(
          eq(hostelDailyDueReports.reportDate, reportDate),
          eq(hostelDailyDueReports.hostelInchargeId, hostelInchargeId)
        )
      )
      .limit(1);

    if (existingReport.length > 0) {
      return NextResponse.json(
        { error: "Report already exists for this date and hostel incharge" },
        { status: 409 }
      );
    }

    // Validate entries for new reports
    const validEntries = entries.filter((entry) => {
      const hasBasicInfo = entry.particulars?.trim() || entry.studentInvolved?.trim();
      const hasActionInfo = entry.actionType && (
        (entry.actionType === "Student Self" && entry.actionDetails?.trim()) ||
        (entry.actionType === "Higher Authority" && entry.higherAuthorityAction?.trim()) ||
        (entry.actionType === "assign_to_higher_authority" && entry.assignedHigherAuthority)
      );
      return hasBasicInfo && hasActionInfo;
    });

    if (validEntries.length === 0) {
      return NextResponse.json(
        { error: "At least one entry with particulars and action details is required" },
        { status: 400 }
      );
    }

    // Create the report
    const [newReport] = await db
      .insert(hostelDailyDueReports)
      .values({
        reportDate,
        hostelInchargeId,
        entries: JSON.stringify(validEntries),
        submittedBy,
        status: "submitted",
      })
      .returning({
        id: hostelDailyDueReports.id,
        reportDate: hostelDailyDueReports.reportDate,
        status: hostelDailyDueReports.status,
        createdAt: hostelDailyDueReports.createdAt,
      });

    // Create escalations for entries that need escalation
    const escalationPromises = validEntries
      .filter(entry => entry.needsEscalation === "Yes")
      .map(entry => {
        const title = `Hostel Due Escalation: ${entry.particulars || 'Issue'} ${entry.studentInvolved ? `(${entry.studentInvolved})` : ''}`;
        const description = `Hostel Daily Due Report escalation\n\nParticulars: ${entry.particulars}\nStudent Involved: ${entry.studentInvolved || 'N/A'}\nAction Type: ${entry.actionType}\n${entry.actionType === "Student Self" ? `Action Details: ${entry.actionDetails}` : `Higher Authority Action: ${entry.higherAuthorityAction}`}\nStatus: ${entry.followUpStatus}\nAuth Sign: ${entry.authSign}`;

        return db.insert(escalationsMatters).values({
          title,
          description,
          createdById: submittedBy,
          status: "OPEN",
          level: 1,
        });
      });

    if (escalationPromises.length > 0) {
      await Promise.all(escalationPromises);
    }

    return NextResponse.json(
      {
        message: "Hostel daily due report submitted successfully",
        report: newReport,
        escalationsCreated: escalationPromises.length,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating hostel daily due report:", error);
    return NextResponse.json(
      { error: "Failed to create report" },
      { status: 500 }
    );
  }
}