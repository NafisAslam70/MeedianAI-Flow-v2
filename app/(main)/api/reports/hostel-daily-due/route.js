import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  escalationsMatters,
  hostelDailyDueReports,
  mriReportAssignments,
  ticketActivities,
  tickets,
  users,
  memberSectionGrants,
} from "@/lib/schema";
import { computeTicketSla, findCategoryByKey, formatTicketNumber } from "@/lib/ticketsConfig";
import { ensureHostelDailyDueTemplate } from "@/lib/mriReports";
import { eq, and, desc } from "drizzle-orm";
import { mriReportTemplates, mriReportAssignments } from "@/lib/schema";

const HOSTEL_DUE_TEMPLATE_KEY = "hostel_daily_due_report";

const hasHostelReportAssignment = async (session) => {
  const uid = Number(session?.user?.id);
  if (!Number.isFinite(uid)) return false;
  const templateRow = await db
    .select({ id: mriReportTemplates.id })
    .from(mriReportTemplates)
    .where(eq(mriReportTemplates.key, HOSTEL_DUE_TEMPLATE_KEY))
    .limit(1);
  if (!templateRow.length) return false;
  const templateId = templateRow[0].id;
  const rows = await db
    .select({ id: mriReportAssignments.id })
    .from(mriReportAssignments)
    .where(and(eq(mriReportAssignments.templateId, templateId), eq(mriReportAssignments.userId, uid)));
  return rows.length > 0;
};
import { auth } from "@/lib/auth";

export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!["admin", "team_manager"].includes(session.user.role)) {
      const rows = await db
        .select({ id: memberSectionGrants.id })
        .from(memberSectionGrants)
        .where(and(eq(memberSectionGrants.userId, session.user.id), eq(memberSectionGrants.section, "hostelDueReport")));
      const hasGrant = rows.length > 0;
      const hasAssignment = await hasHostelReportAssignment(session);
      if (!hasGrant && !hasAssignment) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
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
        // Check if any entry has assigned hostel admin or school office
        return Array.isArray(report.entries) && report.entries.some(entry => {
          const assignedAdmin =
            entry.assignedHigherAuthority === assignedTo &&
            (entry.actionType === 'assign_to_higher_authority' ||
              entry.actionType === 'Higher Authority' ||
              entry.actionType === 'Hostel Admin');
          const assignedOffice = entry.assignedSchoolOffice === assignedTo;
          return assignedAdmin || assignedOffice;
        });
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
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!["admin", "team_manager"].includes(session.user.role)) {
      const hasAssignment = await hasHostelReportAssignment(session);
      if (!hasAssignment) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    const body = await request.json();
    const { reportDate, entries, hostelInchargeId, submittedBy, reportId } = body;

    if (!reportDate || !entries || !submittedBy) {
      return NextResponse.json(
        { error: "Missing required fields: reportDate, entries, submittedBy" },
        { status: 400 }
      );
    }

    // If reportId is provided, this is an update (Hostel Admin or School Office completion)
    if (reportId) {
      if (!Array.isArray(entries)) {
        return NextResponse.json({ error: "Entries must be an array" }, { status: 400 });
      }

      const now = new Date();
      const updatedEntries = [];
      let escalationsCreated = 0;
      let ticketsCreated = 0;

      for (const entry of entries) {
        const nextEntry = { ...entry };

        if (entry.needsEscalation === "Yes" && !entry.escalationId) {
          const studentLabel = Array.isArray(entry.studentInvolved)
            ? entry.studentInvolved.filter(Boolean).join(", ")
            : entry.studentInvolved || "";
          const actionDetails =
            entry.actionType === "Student Self"
              ? entry.actionDetails
              : entry.actionType === "HI Self"
              ? entry.actionDetails
              : entry.actionType === "Hostel Admin"
              ? entry.actionDetails
              : entry.actionType === "Higher Authority"
              ? entry.actionDetails
              : entry.actionType === "School Office"
              ? entry.actionDetails
              : entry.higherAuthorityAction;

          const [createdEscalation] = await db
            .insert(escalationsMatters)
            .values({
              title: `Hostel Due Escalation: ${entry.particulars || "Issue"}${studentLabel ? ` (${studentLabel})` : ""}`,
              description: `Hostel Daily Due Report escalation\n\nParticulars: ${entry.particulars}\nStudent Involved: ${studentLabel || "N/A"}\nAction Type: ${entry.actionType}\nAction Details: ${actionDetails || "N/A"}\nStatus: ${entry.followUpStatus}\nAuth Sign: ${entry.authSign}`,
              createdById: submittedBy,
              status: "OPEN",
              level: 1,
            })
            .returning({ id: escalationsMatters.id });

          if (createdEscalation?.id) {
            nextEntry.escalationId = createdEscalation.id;
            escalationsCreated += 1;
          }
        }

        if (entry.createTicket === "Yes" && !entry.ticketId) {
          const category = findCategoryByKey("hostel") || findCategoryByKey("operations");
          const priority = "normal";
          const titleBase = String(entry.particulars || "Hostel Due Issue").slice(0, 180);
          const studentLabel = Array.isArray(entry.studentInvolved)
            ? entry.studentInvolved.filter(Boolean).join(", ")
            : entry.studentInvolved || "";
          const description = `Hostel Daily Due Report ticket\n\nParticulars: ${entry.particulars}\nStudent Involved: ${studentLabel || "N/A"}\nAction Type: ${entry.actionType}\nAction Details: ${entry.actionDetails || "N/A"}`;
          const { firstResponseAt, resolveBy } = computeTicketSla(priority, now);
          const placeholderNumber = `TMP-${Date.now()}-${Math.floor(Math.random() * 1e5).toString(36)}`;
          const assignedToId = entry.assignedSchoolOffice ? Number(entry.assignedSchoolOffice) : null;

          const [createdTicket] = await db
            .insert(tickets)
            .values({
              ticketNumber: placeholderNumber,
              createdById: submittedBy,
              assignedToId: assignedToId || null,
              queue: category?.queue || "hostel",
              category: category?.label || "Hostel & Residential",
              subcategory: null,
              title: studentLabel ? `${titleBase} (${studentLabel})` : titleBase,
              description,
              priority,
              status: "open",
              escalated: false,
              slaFirstResponseAt: firstResponseAt,
              slaResolveBy: resolveBy,
              lastActivityAt: now,
              metadata: {
                categoryKey: category?.key || "hostel",
                hostelDailyDueReportId: reportId,
                entrySn: entry.sn,
              },
              createdAt: now,
              updatedAt: now,
            })
            .returning({ id: tickets.id, createdAt: tickets.createdAt });

          if (createdTicket?.id) {
            const finalNumber = formatTicketNumber(createdTicket.id, createdTicket.createdAt || now);
            await db.update(tickets).set({ ticketNumber: finalNumber }).where(eq(tickets.id, createdTicket.id));
            await db.insert(ticketActivities).values({
              ticketId: createdTicket.id,
              authorId: submittedBy,
              type: "comment",
              message: "Created from Hostel Daily Due Report.",
              createdAt: now,
            });
            nextEntry.ticketId = createdTicket.id;
            ticketsCreated += 1;
          }
        }

        updatedEntries.push(nextEntry);
      }

      const hasOfficeTransfer = updatedEntries.some((entry) => entry.assignedSchoolOffice);
      let isOfficeActor = false;
      try {
        const template = await ensureHostelDailyDueTemplate();
        if (template?.id) {
          const officeAssign = await db
            .select({ id: mriReportAssignments.id })
            .from(mriReportAssignments)
            .where(
              and(
                eq(mriReportAssignments.templateId, template.id),
                eq(mriReportAssignments.userId, Number(submittedBy)),
                eq(mriReportAssignments.role, "school_office"),
                eq(mriReportAssignments.active, true)
              )
            )
            .limit(1);
          isOfficeActor = officeAssign.length > 0;
        }
      } catch (_) {
        isOfficeActor = false;
      }

      await db
        .update(hostelDailyDueReports)
        .set({
          entries: updatedEntries,
          status: isOfficeActor ? "completed" : hasOfficeTransfer ? "submitted" : "completed",
        })
        .where(eq(hostelDailyDueReports.id, reportId));

      return NextResponse.json(
        { message: "Report updated successfully", escalationsCreated, ticketsCreated },
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

    // Validate entries for new reports (support legacy + current UI action types)
    const validEntries = entries.filter((entry) => {
      const particulars = typeof entry.particulars === "string" ? entry.particulars.trim() : "";
      const students =
        typeof entry.studentInvolved === "string"
          ? entry.studentInvolved.trim()
          : Array.isArray(entry.studentInvolved)
          ? entry.studentInvolved.filter(Boolean)
          : [];
      const hasBasicInfo = Boolean(particulars) || (Array.isArray(students) ? students.length > 0 : Boolean(students));

      const actionType = String(entry.actionType || "");
      const hasActionInfo =
        actionType === "Student Self"
          ? Boolean(entry.actionDetails?.trim())
          : actionType === "Higher Authority"
          ? Boolean(entry.assignedHigherAuthority)
          : actionType === "Hostel Admin"
          ? true
          : actionType === "assign_to_higher_authority"
          ? Boolean(entry.assignedHigherAuthority)
          : actionType === "HI Self"
          ? Boolean(entry.actionDetails?.trim())
          : actionType === "Admin"
          ? true
          : false;

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
        const studentLabel = Array.isArray(entry.studentInvolved)
          ? entry.studentInvolved.filter(Boolean).join(", ")
          : entry.studentInvolved || "";
        const title = `Hostel Due Escalation: ${entry.particulars || "Issue"}${studentLabel ? ` (${studentLabel})` : ""}`;
        const actionDetails =
          entry.actionType === "Student Self"
            ? entry.actionDetails
            : entry.actionType === "HI Self"
            ? entry.actionDetails
            : entry.actionType === "Higher Authority"
            ? entry.actionDetails
            : entry.actionType === "Hostel Admin"
            ? entry.actionDetails
            : entry.higherAuthorityAction;
        const description = `Hostel Daily Due Report escalation\n\nParticulars: ${entry.particulars}\nStudent Involved: ${studentLabel || "N/A"}\nAction Type: ${entry.actionType}\nAction Details: ${actionDetails || "N/A"}\nStatus: ${entry.followUpStatus}\nAuth Sign: ${entry.authSign}`;

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
