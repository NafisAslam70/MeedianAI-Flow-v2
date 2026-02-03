import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  academicHealthReports,
  ahrDefaulters,
  mriReportAssignments,
  mriReportTemplates,
  users,
} from "@/lib/schema";
import { and, eq, gte, inArray, lt, desc } from "drizzle-orm";

const TEMPLATE_KEY = "academic_health_report";
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 31;

const toDateOnly = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

const ensureRange = (startDate, endDate) => {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }
  if (end < start) {
    return { start: end, end: start };
  }
  return { start, end };
};

const dateKey = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

const listDates = (startDate, endDate) => {
  const dates = [];
  const cursor = new Date(startDate.getTime());
  while (cursor <= endDate) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};

const safeJson = (value) => {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
};

const normalizeStatus = (value) => String(value || "DRAFT").toUpperCase();

export async function GET(req) {
  const session = await auth();
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = session.user.role;
  if (role !== "admin" && role !== "team_manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const today = new Date();
  const endDateStr = toDateOnly(searchParams.get("endDate")) || toDateOnly(today);
  const startFallback = new Date(today.getTime() - 6 * DAY_MS);
  const startDateStr = toDateOnly(searchParams.get("startDate")) || toDateOnly(startFallback);

  if (!startDateStr || !endDateStr) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const range = ensureRange(startDateStr, endDateStr);
  if (!range) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const dayCount = Math.round((range.end.getTime() - range.start.getTime()) / DAY_MS) + 1;
  if (dayCount > MAX_RANGE_DAYS) {
    return NextResponse.json({ error: `Date range too large (max ${MAX_RANGE_DAYS} days)` }, { status: 400 });
  }

  const assignedToUserId = Number(searchParams.get("assignedToUserId")) || null;
  const siteId = Number(searchParams.get("siteId")) || null;

  const endExclusive = new Date(range.end.getTime() + DAY_MS);

  const reportFilters = [
    gte(academicHealthReports.reportDate, range.start),
    lt(academicHealthReports.reportDate, endExclusive),
  ];
  if (assignedToUserId) reportFilters.push(eq(academicHealthReports.assignedToUserId, assignedToUserId));
  if (siteId) reportFilters.push(eq(academicHealthReports.siteId, siteId));

  const reports = await db
    .select({
      id: academicHealthReports.id,
      reportDate: academicHealthReports.reportDate,
      siteId: academicHealthReports.siteId,
      assignedToUserId: academicHealthReports.assignedToUserId,
      status: academicHealthReports.status,
      attendanceConfirmed: academicHealthReports.attendanceConfirmed,
      slot12TransitionQuality: academicHealthReports.slot12TransitionQuality,
      slot12NmriModerated: academicHealthReports.slot12NmriModerated,
      mhcp2PresentCount: academicHealthReports.mhcp2PresentCount,
      mhcp2AllTeachersPresent: academicHealthReports.mhcp2AllTeachersPresent,
      checkMode: academicHealthReports.checkMode,
      selfDayClose: academicHealthReports.selfDayClose,
      signatureName: academicHealthReports.signatureName,
      signatureBlobPath: academicHealthReports.signatureBlobPath,
      updatedAt: academicHealthReports.updatedAt,
      assignedName: users.name,
    })
    .from(academicHealthReports)
    .leftJoin(users, eq(users.id, academicHealthReports.assignedToUserId))
    .where(and(...reportFilters))
    .orderBy(desc(academicHealthReports.reportDate));

  const assignmentFilters = [eq(mriReportTemplates.key, TEMPLATE_KEY)];
  if (assignedToUserId) assignmentFilters.push(eq(mriReportAssignments.userId, assignedToUserId));

  const assignmentsRaw = await db
    .select({
      id: mriReportAssignments.id,
      userId: mriReportAssignments.userId,
      targetLabel: mriReportAssignments.targetLabel,
      startDate: mriReportAssignments.startDate,
      endDate: mriReportAssignments.endDate,
      active: mriReportAssignments.active,
      scopeMeta: mriReportAssignments.scopeMeta,
      updatedAt: mriReportAssignments.updatedAt,
      userName: users.name,
    })
    .from(mriReportAssignments)
    .innerJoin(mriReportTemplates, eq(mriReportTemplates.id, mriReportAssignments.templateId))
    .leftJoin(users, eq(users.id, mriReportAssignments.userId))
    .where(and(...assignmentFilters))
    .orderBy(desc(mriReportAssignments.updatedAt));

  const assignments = assignmentsRaw.map((row) => {
    const meta = safeJson(row.scopeMeta);
    const assignedSiteId = Number(meta?.siteId) || null;
    return {
      ...row,
      siteId: assignedSiteId,
      userName: row.userName || (row.userId ? `User #${row.userId}` : "Unassigned"),
      startDate: dateKey(row.startDate),
      endDate: dateKey(row.endDate),
    };
  });

  const dateList = listDates(range.start, range.end);

  const reportByKey = new Map();
  const reportByDateUser = new Map();
  reports.forEach((report) => {
    const key = `${dateKey(report.reportDate)}|${report.assignedToUserId}|${report.siteId}`;
    reportByKey.set(key, report);
    const looseKey = `${dateKey(report.reportDate)}|${report.assignedToUserId}`;
    if (!reportByDateUser.has(looseKey)) {
      reportByDateUser.set(looseKey, report);
    }
  });

  const perDay = new Map();
  dateList.forEach((date) => {
    perDay.set(date, {
      date,
      expected: 0,
      found: 0,
      submitted: 0,
      approved: 0,
      missing: 0,
    });
  });

  const perAssignee = new Map();
  assignments.forEach((assignment) => {
    if (!assignment.userId) return;
    if (!perAssignee.has(assignment.userId)) {
      perAssignee.set(assignment.userId, {
        userId: assignment.userId,
        userName: assignment.userName,
        expected: 0,
        found: 0,
        submitted: 0,
        approved: 0,
        missing: 0,
        latestReportDate: null,
      });
    }
  });

  const isDateInAssignmentRange = (dateStr, assignment) => {
    if (!dateStr) return false;
    const start = assignment.startDate || null;
    const end = assignment.endDate || null;
    if (start && dateStr < start) return false;
    if (end && dateStr > end) return false;
    return true;
  };

  const shouldIncludeAssignment = (assignment) => {
    if (assignment.active === false) return false;
    if (siteId && assignment.siteId && assignment.siteId !== siteId) return false;
    return true;
  };

  for (const assignment of assignments) {
    if (!assignment.userId) continue;
    if (!shouldIncludeAssignment(assignment)) continue;

    for (const dateStr of dateList) {
      if (!isDateInAssignmentRange(dateStr, assignment)) continue;

      const perDayRow = perDay.get(dateStr);
      if (!perDayRow) continue;

      const assigneeRow = perAssignee.get(assignment.userId);
      if (!assigneeRow) continue;

      perDayRow.expected += 1;
      assigneeRow.expected += 1;

      const reportKey = assignment.siteId
        ? `${dateStr}|${assignment.userId}|${assignment.siteId}`
        : `${dateStr}|${assignment.userId}`;
      const report = assignment.siteId ? reportByKey.get(reportKey) : reportByDateUser.get(reportKey);
      if (!report) {
        perDayRow.missing += 1;
        assigneeRow.missing += 1;
        continue;
      }

      perDayRow.found += 1;
      assigneeRow.found += 1;

      const status = normalizeStatus(report.status);
      if (status === "SUBMITTED" || status === "APPROVED") {
        perDayRow.submitted += 1;
        assigneeRow.submitted += 1;
      }
      if (status === "APPROVED") {
        perDayRow.approved += 1;
        assigneeRow.approved += 1;
      }

      const reportDateStr = dateKey(report.reportDate);
      if (reportDateStr && (!assigneeRow.latestReportDate || reportDateStr > assigneeRow.latestReportDate)) {
        assigneeRow.latestReportDate = reportDateStr;
      }
    }
  }

  const statusCounts = {
    DRAFT: 0,
    SUBMITTED: 0,
    APPROVED: 0,
    REOPENED: 0,
  };

  const checkModeCounts = new Map();
  const transitionCounts = new Map();

  let attendanceMissing = 0;
  let transitionIssues = 0;
  let nmriNotModerated = 0;
  let mhcpTeachersMissing = 0;
  let missingSignature = 0;
  let selfDayCloseMissing = 0;
  let mhcpPresentTotal = 0;
  let mhcpPresentCount = 0;

  reports.forEach((report) => {
    const status = normalizeStatus(report.status);
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    const checkMode = String(report.checkMode || "").toUpperCase();
    if (checkMode) checkModeCounts.set(checkMode, (checkModeCounts.get(checkMode) || 0) + 1);

    const transition = String(report.slot12TransitionQuality || "").toUpperCase();
    if (transition) transitionCounts.set(transition, (transitionCounts.get(transition) || 0) + 1);

    if (!report.attendanceConfirmed) attendanceMissing += 1;
    if (transition && transition !== "SMOOTH") transitionIssues += 1;
    if (report.slot12NmriModerated === false) nmriNotModerated += 1;
    if (report.mhcp2AllTeachersPresent === false) mhcpTeachersMissing += 1;
    if (!report.signatureName || !report.signatureBlobPath) missingSignature += 1;
    if (!report.selfDayClose) selfDayCloseMissing += 1;

    if (Number.isFinite(Number(report.mhcp2PresentCount))) {
      mhcpPresentTotal += Number(report.mhcp2PresentCount);
      mhcpPresentCount += 1;
    }
  });

  const reportIds = reports.map((report) => report.id).filter(Boolean);
  let defaulterTypes = [];
  if (reportIds.length) {
    const defaulterRows = await db
      .select({ defaulterType: ahrDefaulters.defaulterType })
      .from(ahrDefaulters)
      .where(inArray(ahrDefaulters.ahrId, reportIds));

    const typeCounts = new Map();
    defaulterRows.forEach((row) => {
      const key = String(row.defaulterType || "OTHER");
      typeCounts.set(key, (typeCounts.get(key) || 0) + 1);
    });
    defaulterTypes = Array.from(typeCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }

  const perDayList = Array.from(perDay.values()).sort((a, b) => a.date.localeCompare(b.date));
  const perAssigneeList = Array.from(perAssignee.values()).sort((a, b) =>
    String(a.userName || "").localeCompare(String(b.userName || ""))
  );

  const expectedTotal = perDayList.reduce((sum, row) => sum + row.expected, 0);
  const submittedTotal = perDayList.reduce((sum, row) => sum + row.submitted, 0);
  const approvedTotal = perDayList.reduce((sum, row) => sum + row.approved, 0);
  const missingTotal = perDayList.reduce((sum, row) => sum + row.missing, 0);
  const foundTotal = perDayList.reduce((sum, row) => sum + row.found, 0);
  const completionRate = expectedTotal ? Math.round((submittedTotal / expectedTotal) * 100) : 0;

  return NextResponse.json(
    {
      range: {
        startDate: dateKey(range.start),
        endDate: dateKey(range.end),
        days: dayCount,
      },
      assignments,
      reports: reports.map((report) => ({
        ...report,
        reportDate: dateKey(report.reportDate),
        updatedAt: report.updatedAt ? new Date(report.updatedAt).toISOString() : null,
        assignedName: report.assignedName || `User #${report.assignedToUserId}`,
        status: normalizeStatus(report.status),
      })),
      totals: {
        expected: expectedTotal,
        found: foundTotal,
        submitted: submittedTotal,
        approved: approvedTotal,
        missing: missingTotal,
        completionRate,
        statusCounts,
      },
      perDay: perDayList,
      perAssignee: perAssigneeList,
      flags: {
        attendanceMissing,
        transitionIssues,
        nmriNotModerated,
        mhcpTeachersMissing,
        missingSignature,
        selfDayCloseMissing,
      },
      averages: {
        mhcp2PresentAvg: mhcpPresentCount ? Math.round(mhcpPresentTotal / mhcpPresentCount) : null,
      },
      distributions: {
        checkModes: Array.from(checkModeCounts.entries()).map(([mode, count]) => ({ mode, count })),
        transitions: Array.from(transitionCounts.entries()).map(([transition, count]) => ({ transition, count })),
      },
      defaulterTypes,
    },
    { status: 200 }
  );
}
