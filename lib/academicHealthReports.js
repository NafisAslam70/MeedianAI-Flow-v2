import { db } from "@/lib/db";
import {
  academicHealthReports,
  ahrCopyChecks,
  ahrClassDiaryChecks,
  ahrMorningCoaching,
  ahrEscalationDetails,
  ahrDefaulters,
  ahrActionsByCategory,
  ahrTransitionEnum,
  ahrCheckModeEnum,
  ahrEscalationStatusEnum,
  ahrDiaryTypeEnum,
  defaulterTypeEnum,
  finalDailyAttendance,
  users,
  Students,
  Classes,
  escalationsMatters,
  escalationsMatterMembers,
} from "@/lib/schema";
import { and, eq, gte, inArray, lt, or, desc } from "drizzle-orm";

const REPORT_STATUSES = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  APPROVED: "APPROVED",
  REOPENED: "REOPENED",
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MHCP_PROGRAM_KEY = "MHCP-2";
const MHCP_PROGRAM_ALIASES = ["MHCP-2", "MHCP2", "mhcp2", "MHCP2A"];
const MHCP_TRACK_ALIASES = ["mhcp2", "MHCP-2", "MHCP2"];

class ValidationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = "ValidationError";
    this.details = details;
  }
}

const coerceDateOnly = (value) => {
  if (!value) throw new ValidationError("reportDate is required");
  if (value instanceof Date) {
    const copy = new Date(value);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
      const dt = new Date(`${value}T00:00:00`);
      if (Number.isNaN(dt.getTime())) throw new ValidationError("Invalid reportDate provided");
      dt.setHours(0, 0, 0, 0);
      return dt;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new ValidationError("Invalid reportDate provided");
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }
  throw new ValidationError("Invalid reportDate provided");
};

const getDayRange = (dateInput) => {
  const start = coerceDateOnly(dateInput);
  const end = new Date(start.getTime() + DAY_MS);
  return { start, end };
};

const serializeDate = (value) => {
  if (!value) return null;
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
};

const serializeDateOnly = (value) => {
  if (!value) return null;
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
};

const safeJsonArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const mapEnumOptions = (enumSchema) => {
  if (!enumSchema?.enumValues) return [];
  return enumSchema.enumValues.map((value) => ({ value, label: humanizeEnum(value) }));
};

const humanizeEnum = (value) =>
  String(value || "")
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());

async function fetchTeachers() {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isTeacher: users.isTeacher,
    })
    .from(users)
    .where(eq(users.isTeacher, true))
    .orderBy(users.name);
  return rows.map((row) => ({
    id: row.id,
    name: row.name || `Teacher #${row.id}`,
    email: row.email || null,
  }));
}

async function fetchStudents() {
  const rows = await db
    .select({
      id: Students.id,
      name: Students.name,
      classId: Students.classId,
    })
    .from(Students)
    .orderBy(Students.name);
  return rows.map((row) => ({
    id: row.id,
    name: row.name || `Student #${row.id}`,
    classId: row.classId,
  }));
}

async function fetchClasses() {
  const rows = await db
    .select({
      id: Classes.id,
      name: Classes.name,
      section: Classes.section,
      track: Classes.track,
    })
    .from(Classes)
    .orderBy(Classes.name);
  return rows.map((row) => ({
    id: row.id,
    name: row.name || `Class #${row.id}`,
    section: row.section || "",
    label: row.section ? `${row.name} - ${row.section}` : row.name || `Class #${row.id}`,
    track: row.track || null,
  }));
}

async function fetchOpenEscalations({ forUserId }) {
  if (!forUserId) return [];
  const rows = await db
    .select({
      id: escalationsMatters.id,
      title: escalationsMatters.title,
      status: escalationsMatters.status,
      level: escalationsMatters.level,
      currentAssigneeId: escalationsMatters.currentAssigneeId,
      createdById: escalationsMatters.createdById,
      memberUserId: escalationsMatterMembers.userId,
    })
    .from(escalationsMatters)
    .leftJoin(escalationsMatterMembers, eq(escalationsMatterMembers.matterId, escalationsMatters.id))
    .where(
      and(
        inArray(escalationsMatters.status, ["OPEN", "ESCALATED"]),
        or(
          eq(escalationsMatters.currentAssigneeId, Number(forUserId)),
          eq(escalationsMatters.createdById, Number(forUserId)),
          eq(escalationsMatterMembers.userId, Number(forUserId))
        )
      )
    )
    .orderBy(desc(escalationsMatters.updatedAt));

  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.id)) {
      map.set(row.id, {
        id: row.id,
        title: row.title,
        status: row.status,
        level: row.level,
        currentAssigneeId: row.currentAssigneeId,
        createdById: row.createdById,
      });
    }
  });
  return Array.from(map.values());
}

async function fetchLatestMop2Checkin({ userId, reportDate }) {
  if (!userId || !reportDate) return null;
  const targetDate = coerceDateOnly(reportDate);
  const targetDateStr = serializeDateOnly(targetDate);

  const rows = await db
    .select({
      id: finalDailyAttendance.id,
      at: finalDailyAttendance.at,
      date: finalDailyAttendance.date,
      programKey: finalDailyAttendance.programKey,
      track: finalDailyAttendance.track,
    })
    .from(finalDailyAttendance)
    .where(
      and(
        eq(finalDailyAttendance.userId, Number(userId)),
        or(
          inArray(finalDailyAttendance.programKey, MHCP_PROGRAM_ALIASES),
          inArray(finalDailyAttendance.track, MHCP_TRACK_ALIASES)
        )
      )
    )
    .orderBy(desc(finalDailyAttendance.at), desc(finalDailyAttendance.date), desc(finalDailyAttendance.id))
    .limit(50);

  if (!rows.length) {
    console.info("[AcademicHealth] No attendance rows for user", {
      userId,
      reportDate,
      filters: {
        programAliases: MHCP_PROGRAM_ALIASES,
        trackAliases: MHCP_TRACK_ALIASES,
      },
    });
    return null;
  }

  const normaliseDate = (value) => {
    if (!value) return null;
    if (value instanceof Date) return serializeDateOnly(value);
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return null;
    return serializeDateOnly(dt);
  };

  const isTargetRow = (row) => {
    const dateFromAt = row.at ? serializeDateOnly(row.at) : null;
    const dateFromDate = normaliseDate(row.date);
    return dateFromAt === targetDateStr || dateFromDate === targetDateStr;
  };

  const match = rows.find(isTargetRow);

  if (match) {
    console.info("[AcademicHealth] Using MHCP attendance row", {
      attendanceId: match.id,
      programKey: match.programKey,
      track: match.track,
      at: match.at?.toISOString?.() ?? match.at,
      date: match.date ? normaliseDate(match.date) : null,
    });
    const time = match.at
      ? new Date(match.at)
      : match.date
      ? new Date(`${normaliseDate(match.date)}T06:30:00.000+05:30`)
      : null;
    return {
      checkinId: match.id,
      checkinTime: time,
    };
  }

  console.info("[AcademicHealth] No attendance rows matching date", {
    userId,
    reportDate,
    consideredRows: rows.slice(0, 5).map((row) => ({
      id: row.id,
      at: row.at?.toISOString?.() ?? row.at,
      date: normaliseDate(row.date),
      programKey: row.programKey,
      track: row.track,
    })),
  });

  const latest = rows[0];
  if (latest) {
    console.info("[AcademicHealth] Falling back to latest MHCP attendance row", {
      attendanceId: latest.id,
      programKey: latest.programKey,
      track: latest.track,
      at: latest.at?.toISOString?.() ?? latest.at,
      date: normaliseDate(latest.date),
    });
    const time = latest.at
      ? new Date(latest.at)
      : latest.date
      ? new Date(`${normaliseDate(latest.date)}T06:30:00.000+05:30`)
      : null;
    return {
      checkinId: latest.id,
      checkinTime: time,
    };
  }

  return null;
}

const serializeReportRow = (row) => {
  if (!row) return null;
  return {
    ...row,
    reportDate: serializeDateOnly(row.reportDate),
    mop2CheckinTime: serializeDate(row.mop2CheckinTime),
    createdAt: serializeDate(row.createdAt),
    updatedAt: serializeDate(row.updatedAt),
    mhcp2AbsentTeacherIds: safeJsonArray(row.mhcp2AbsentTeacherIds),
    mhcp2Substitutions: safeJsonArray(row.mhcp2Substitutions),
    escalationsHandledIds: safeJsonArray(row.escalationsHandledIds),
    signatureBlobPath: row.signatureBlobPath || null,
    signatureName: row.signatureName || null,
  };
};

const hydrateReport = async (reportId) => {
  const [base] = await db
    .select({
      id: academicHealthReports.id,
      reportDate: academicHealthReports.reportDate,
      siteId: academicHealthReports.siteId,
      assignedToUserId: academicHealthReports.assignedToUserId,
      status: academicHealthReports.status,
      mop2CheckinId: academicHealthReports.mop2CheckinId,
      mop2CheckinTime: academicHealthReports.mop2CheckinTime,
      attendanceConfirmed: academicHealthReports.attendanceConfirmed,
      maghribSalahLedById: academicHealthReports.maghribSalahLedById,
      slot12TransitionQuality: academicHealthReports.slot12TransitionQuality,
      slot12NmriModerated: academicHealthReports.slot12NmriModerated,
      slot12Ads: academicHealthReports.slot12Ads,
      mhcp2PresentCount: academicHealthReports.mhcp2PresentCount,
      mhcp2AllTeachersPresent: academicHealthReports.mhcp2AllTeachersPresent,
      mhcp2AbsentTeacherIds: academicHealthReports.mhcp2AbsentTeacherIds,
      mhcp2Substitutions: academicHealthReports.mhcp2Substitutions,
      mhcp2FocusToday: academicHealthReports.mhcp2FocusToday,
      mhcp2Discrepancies: academicHealthReports.mhcp2Discrepancies,
      section1Comment: academicHealthReports.section1Comment,
      checkMode: academicHealthReports.checkMode,
      escalationsHandledIds: academicHealthReports.escalationsHandledIds,
      selfDayClose: academicHealthReports.selfDayClose,
      finalRemarks: academicHealthReports.finalRemarks,
      signatureName: academicHealthReports.signatureName,
      signatureBlobPath: academicHealthReports.signatureBlobPath,
      createdByUserId: academicHealthReports.createdByUserId,
      createdAt: academicHealthReports.createdAt,
      updatedAt: academicHealthReports.updatedAt,
    })
    .from(academicHealthReports)
    .where(eq(academicHealthReports.id, Number(reportId)));
  if (!base) return null;

  const [copyChecks, classChecks, morningRows, escalations, defaulters, actions] = await Promise.all([
    db
      .select({
        id: ahrCopyChecks.id,
        studentId: ahrCopyChecks.studentId,
        copyTypes: ahrCopyChecks.copyTypes,
        adFlag: ahrCopyChecks.adFlag,
        note: ahrCopyChecks.note,
      })
      .from(ahrCopyChecks)
      .where(eq(ahrCopyChecks.ahrId, Number(reportId))),
    db
      .select({
        id: ahrClassDiaryChecks.id,
        classId: ahrClassDiaryChecks.classId,
        diaryType: ahrClassDiaryChecks.diaryType,
        adFlag: ahrClassDiaryChecks.adFlag,
        note: ahrClassDiaryChecks.note,
      })
      .from(ahrClassDiaryChecks)
      .where(eq(ahrClassDiaryChecks.ahrId, Number(reportId))),
    db
      .select({
        id: ahrMorningCoaching.id,
        absentees: ahrMorningCoaching.absentees,
        state: ahrMorningCoaching.state,
      })
      .from(ahrMorningCoaching)
      .where(eq(ahrMorningCoaching.ahrId, Number(reportId))),
    db
      .select({
        id: ahrEscalationDetails.id,
        escalationId: ahrEscalationDetails.escalationId,
        actionTaken: ahrEscalationDetails.actionTaken,
        outcome: ahrEscalationDetails.outcome,
        status: ahrEscalationDetails.status,
      })
      .from(ahrEscalationDetails)
      .where(eq(ahrEscalationDetails.ahrId, Number(reportId))),
    db
      .select({
        id: ahrDefaulters.id,
        studentId: ahrDefaulters.studentId,
        defaulterType: ahrDefaulters.defaulterType,
        reason: ahrDefaulters.reason,
      })
      .from(ahrDefaulters)
      .where(eq(ahrDefaulters.ahrId, Number(reportId))),
    db
      .select({
        id: ahrActionsByCategory.id,
        category: ahrActionsByCategory.category,
        actions: ahrActionsByCategory.actions,
      })
      .from(ahrActionsByCategory)
      .where(eq(ahrActionsByCategory.ahrId, Number(reportId))),
  ]);

  return {
    ...serializeReportRow(base),
    copyChecks: copyChecks.map((row) => ({
      ...row,
      copyTypes: safeJsonArray(row.copyTypes),
    })),
    classChecks,
    morningCoaching: morningRows.length ? morningRows[0] : null,
    escalationDetails: escalations,
    defaulters,
    actionsByCategory: actions.map((row) => ({
      ...row,
      actions: safeJsonArray(row.actions),
    })),
  };
};

export async function getAcademicHealthReportById(reportId) {
  if (!reportId) return null;
  return hydrateReport(reportId);
}

export async function listAcademicHealthReports({ date, siteId, assignedToUserId, status }) {
  const filters = [];
  if (date) {
    const { start, end } = getDayRange(date);
    filters.push(gte(academicHealthReports.reportDate, start));
    filters.push(lt(academicHealthReports.reportDate, end));
  }
  if (siteId) filters.push(eq(academicHealthReports.siteId, Number(siteId)));
  if (assignedToUserId) filters.push(eq(academicHealthReports.assignedToUserId, Number(assignedToUserId)));
  if (status) filters.push(eq(academicHealthReports.status, status));

  const rows = await db
    .select({
      id: academicHealthReports.id,
      reportDate: academicHealthReports.reportDate,
      siteId: academicHealthReports.siteId,
      assignedToUserId: academicHealthReports.assignedToUserId,
      status: academicHealthReports.status,
      createdAt: academicHealthReports.createdAt,
      updatedAt: academicHealthReports.updatedAt,
    })
    .from(academicHealthReports)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(academicHealthReports.reportDate));

  return rows.map(serializeReportRow);
}

export async function getAcademicHealthReportSupportingData({ assignedToUserId, reportDate } = {}) {
  const [teachers, students, classes] = await Promise.all([fetchTeachers(), fetchStudents(), fetchClasses()]);
  const rangedEscalations = await fetchOpenEscalations({ forUserId: assignedToUserId });
  const mop2Checkin = await fetchLatestMop2Checkin({ userId: assignedToUserId, reportDate });

  return {
    teachers,
    students,
    classes,
    defaulterTypes: mapEnumOptions(defaulterTypeEnum),
    transitionQualityOptions: mapEnumOptions(ahrTransitionEnum),
    checkModes: mapEnumOptions(ahrCheckModeEnum),
    diaryTypes: mapEnumOptions(ahrDiaryTypeEnum),
    escalationStatuses: mapEnumOptions(ahrEscalationStatusEnum),
    escalations: rangedEscalations,
    mop2Checkin: mop2Checkin
      ? { checkinId: mop2Checkin.checkinId, checkinTime: serializeDate(mop2Checkin.checkinTime) }
      : null,
    actionsCatalog: [
      { value: "VERBAL_WARNING", label: "Verbal Warning" },
      { value: "REFLECTION_SHEET", label: "Reflection Sheet" },
      { value: "PARENT_CALL", label: "Parent Call" },
      { value: "DUTY", label: "Duty / Service" },
      { value: "NOTICE", label: "Written Notice" },
      { value: "OTHER", label: "Other" },
    ],
  };
}

export async function createAcademicHealthReport({
  reportDate,
  siteId,
  assignedToUserId,
  checkMode,
  createdByUserId,
}) {
  if (!assignedToUserId) throw new ValidationError("assignedToUserId is required");
  if (!siteId) throw new ValidationError("siteId is required");
  if (!checkMode) throw new ValidationError("checkMode is required");

  const normalizedDate = coerceDateOnly(reportDate);

  const [existing] = await db
    .select({ id: academicHealthReports.id })
    .from(academicHealthReports)
    .where(
      and(
        eq(academicHealthReports.reportDate, normalizedDate),
        eq(academicHealthReports.assignedToUserId, Number(assignedToUserId)),
        eq(academicHealthReports.siteId, Number(siteId))
      )
    );
  if (existing) {
    return hydrateReport(existing.id);
  }

  const insertValues = {
    reportDate: normalizedDate,
    siteId: Number(siteId),
    assignedToUserId: Number(assignedToUserId),
    status: REPORT_STATUSES.DRAFT,
    checkMode,
    maghribSalahLedById: Number(assignedToUserId),
    slot12TransitionQuality: "SMOOTH",
    mhcp2FocusToday: "To be set",
    createdByUserId: Number(createdByUserId || assignedToUserId),
  };

  const [created] = await db.insert(academicHealthReports).values(insertValues).returning();
  if (!created) throw new Error("Failed to create academic health report");

  const prefillCheckin = await fetchLatestMop2Checkin({
    userId: assignedToUserId,
    reportDate: normalizedDate,
  });
  if (prefillCheckin) {
    await db
      .update(academicHealthReports)
      .set({
        mop2CheckinId: prefillCheckin.checkinId,
        mop2CheckinTime: prefillCheckin.checkinTime,
      })
      .where(eq(academicHealthReports.id, created.id));
  }

  return hydrateReport(created.id);
}

const upsertArrayTable = async (tx, table, rows, columns, reportId) => {
  await tx.delete(table).where(eq(table.ahrId, Number(reportId)));
  if (!Array.isArray(rows) || !rows.length) return;
  const sanitized = rows
    .map((row) => {
      if (!row) return null;
      const payload = { ahrId: Number(reportId) };
      columns.forEach(([key, columnKey]) => {
        payload[columnKey] = row[key];
      });
      return payload;
    })
    .filter(Boolean);
  if (!sanitized.length) return;
  await tx.insert(table).values(sanitized);
};

export async function updateAcademicHealthReport(reportId, payload, { actorUserId, actorRole }) {
  if (!reportId) throw new ValidationError("reportId is required");
  const existing = await hydrateReport(reportId);
  if (!existing) throw new ValidationError("Report not found");

  const isOwner = actorUserId && Number(actorUserId) === Number(existing.assignedToUserId);
  const isManager = ["admin", "team_manager"].includes(actorRole);
  if (!isOwner && !isManager) {
    throw new ValidationError("You are not permitted to edit this report");
  }

  const updates = {};
  const directFields = [
    "mop2CheckinId",
    "mop2CheckinTime",
    "attendanceConfirmed",
    "maghribSalahLedById",
    "slot12TransitionQuality",
    "slot12NmriModerated",
    "slot12Ads",
    "mhcp2PresentCount",
    "mhcp2AllTeachersPresent",
    "mhcp2AbsentTeacherIds",
    "mhcp2Substitutions",
    "mhcp2FocusToday",
    "mhcp2Discrepancies",
    "section1Comment",
    "checkMode",
    "escalationsHandledIds",
    "selfDayClose",
    "finalRemarks",
    "signatureName",
    "signatureBlobPath",
  ];

  directFields.forEach((field) => {
    if (field in payload) {
      const value = payload[field];
      if (["mhcp2AbsentTeacherIds", "mhcp2Substitutions", "escalationsHandledIds"].includes(field)) {
        updates[field] = Array.isArray(value) ? JSON.stringify(value) : JSON.stringify([]);
      } else if (field === "mop2CheckinTime" && value) {
        updates[field] = new Date(value);
      } else {
        updates[field] = value ?? null;
      }
    }
  });

  updates.updatedAt = new Date();

  await db.transaction(async (tx) => {
    if (Object.keys(updates).length) {
      await tx
        .update(academicHealthReports)
        .set(updates)
        .where(eq(academicHealthReports.id, Number(reportId)));
    }

    if ("copyChecks" in payload) {
      const rows = Array.isArray(payload.copyChecks) ? payload.copyChecks : [];
      await tx.delete(ahrCopyChecks).where(eq(ahrCopyChecks.ahrId, Number(reportId)));
      if (rows.length) {
        const insertRows = rows
          .map((row) => {
            if (!row?.studentId) return null;
            return {
              ahrId: Number(reportId),
              studentId: Number(row.studentId),
              copyTypes: JSON.stringify(Array.isArray(row.copyTypes) ? row.copyTypes : []),
              adFlag: Boolean(row.adFlag),
              note: row.note || null,
            };
          })
          .filter(Boolean);
        if (insertRows.length) {
          await tx.insert(ahrCopyChecks).values(insertRows);
        }
      }
    }

    if ("classChecks" in payload) {
      const rows = Array.isArray(payload.classChecks) ? payload.classChecks : [];
      await tx.delete(ahrClassDiaryChecks).where(eq(ahrClassDiaryChecks.ahrId, Number(reportId)));
      if (rows.length) {
        const insertRows = rows
          .map((row) => {
            if (!row?.classId) return null;
            return {
              ahrId: Number(reportId),
              classId: Number(row.classId),
              diaryType: row.diaryType || "CCD",
              adFlag: Boolean(row.adFlag),
              note: row.note || null,
            };
          })
          .filter(Boolean);
        if (insertRows.length) {
          await tx.insert(ahrClassDiaryChecks).values(insertRows);
        }
      }
    }

    if ("morningCoaching" in payload) {
      const item = payload.morningCoaching;
      await tx.delete(ahrMorningCoaching).where(eq(ahrMorningCoaching.ahrId, Number(reportId)));
      if (item && (item.absentees?.length || item.state)) {
        await tx.insert(ahrMorningCoaching).values({
          ahrId: Number(reportId),
          absentees: JSON.stringify(Array.isArray(item.absentees) ? item.absentees : []),
          state: item.state || null,
        });
      }
    }

    if ("escalationDetails" in payload) {
      const rows = Array.isArray(payload.escalationDetails) ? payload.escalationDetails : [];
      await tx.delete(ahrEscalationDetails).where(eq(ahrEscalationDetails.ahrId, Number(reportId)));
      if (rows.length) {
        const insertRows = rows
          .map((row) => {
            if (!row?.escalationId) return null;
            return {
              ahrId: Number(reportId),
              escalationId: Number(row.escalationId),
              actionTaken: row.actionTaken || null,
              outcome: row.outcome || null,
              status: row.status || "FOLLOW_UP",
            };
          })
          .filter(Boolean);
        if (insertRows.length) {
          await tx.insert(ahrEscalationDetails).values(insertRows);
        }
      }
    }

    if ("defaulters" in payload) {
      const rows = Array.isArray(payload.defaulters) ? payload.defaulters : [];
      await tx.delete(ahrDefaulters).where(eq(ahrDefaulters.ahrId, Number(reportId)));
      if (rows.length) {
        const insertRows = rows
          .map((row) => {
            if (!row?.studentId || !row?.defaulterType) return null;
            return {
              ahrId: Number(reportId),
              studentId: Number(row.studentId),
              defaulterType: row.defaulterType,
              reason: row.reason || null,
            };
          })
          .filter(Boolean);
        if (insertRows.length) {
          await tx.insert(ahrDefaulters).values(insertRows);
        }
      }
    }

    if ("actionsByCategory" in payload) {
      const rows = Array.isArray(payload.actionsByCategory) ? payload.actionsByCategory : [];
      await tx.delete(ahrActionsByCategory).where(eq(ahrActionsByCategory.ahrId, Number(reportId)));
      if (rows.length) {
        const insertRows = rows
          .map((row) => {
            if (!row?.category) return null;
            return {
              ahrId: Number(reportId),
              category: row.category,
              actions: JSON.stringify(Array.isArray(row.actions) ? row.actions : []),
            };
          })
          .filter(Boolean);
        if (insertRows.length) {
          await tx.insert(ahrActionsByCategory).values(insertRows);
        }
      }
    }
  });

  return hydrateReport(reportId);
}

const uniqueNumbers = (arr) => {
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const out = [];
  arr.forEach((item) => {
    const num = Number(item);
    if (Number.isFinite(num) && !seen.has(num)) {
      seen.add(num);
      out.push(num);
    }
  });
  return out;
};

const validateBeforeSubmit = (report) => {
  const errors = [];
  if (!report.mop2CheckinId || !report.mop2CheckinTime) {
    errors.push("MHCP-2 check-in not found. Please scan attendance before submitting.");
  }
  if (!report.attendanceConfirmed) {
    errors.push("Confirm your attendance before submitting.");
  }
  if (!report.maghribSalahLedById) {
    errors.push("Select who led Maghrib Salah.");
  }
  if (!report.slot12TransitionQuality) {
    errors.push("Provide Slot 12 transition quality.");
  }
  if (report.slot12TransitionQuality !== "SMOOTH" || report.slot12NmriModerated === false) {
    if (!report.slot12Ads || !report.slot12Ads.trim()) {
      errors.push("Document ADs for Slot 12 issues or missing NMRI moderation.");
    }
  }
  if (typeof report.mhcp2PresentCount !== "number" || report.mhcp2PresentCount < 0) {
    errors.push("Provide MHCP2 student headcount (0 or more).");
  }
  if (report.mhcp2AllTeachersPresent === false) {
    const absentIds = uniqueNumbers(report.mhcp2AbsentTeacherIds);
    if (!absentIds.length) {
      errors.push("List absent teachers or mark all teachers present.");
    }
  }
  if (!report.mhcp2FocusToday || report.mhcp2FocusToday.length < 3) {
    errors.push("Describe the MHCP2 focus for today.");
  }
  if (!report.checkMode) {
    errors.push("Select the check mode (MSP or Morning Coaching).");
  }
  const copyChecks = Array.isArray(report.copyChecks) ? report.copyChecks : [];
  const classChecks = Array.isArray(report.classChecks) ? report.classChecks : [];
  const copyStudentIds = uniqueNumbers(copyChecks.map((row) => row.studentId));
  if (report.checkMode === "MSP") {
    if (copyChecks.length !== 5 || copyStudentIds.length !== 5) {
      errors.push("Capture exactly five student copy checks with unique students.");
    }
    if (classChecks.length !== 2) {
      errors.push("Capture exactly two class diary checks for CCD/CDD.");
    }
  }
  if (report.checkMode === "MORNING_COACHING") {
    const mc = report.morningCoaching;
    if (!mc || !mc.state || mc.state.length < 10) {
      errors.push("Document the Morning Coaching state (topics/progress) in at least 10 characters.");
    }
  }
  if (report.defaulters?.length) {
    const categories = new Set(report.defaulters.map((row) => row.defaulterType));
    if (!report.actionsByCategory?.length) {
      errors.push("Log actions taken for each defaulter category.");
    } else {
      const actionCategories = new Set(report.actionsByCategory.map((row) => row.category));
      categories.forEach((cat) => {
        if (!actionCategories.has(cat)) {
          errors.push(`Add actions taken for defaulter category: ${humanizeEnum(cat)}.`);
        }
      });
    }
  }
  if (!report.selfDayClose) {
    errors.push("Confirm that you have completed your own day close.");
  }
  if (!report.signatureName || !report.signatureBlobPath) {
    errors.push("Provide your signature before submitting.");
  }
  if (report.escalationsHandledIds?.length) {
    const handled = new Set(uniqueNumbers(report.escalationsHandledIds));
    const detailIds = new Set(
      (report.escalationDetails || []).map((row) => Number(row.escalationId)).filter(Number.isFinite)
    );
    handled.forEach((id) => {
      if (!detailIds.has(id)) {
        errors.push(`Add action/outcome details for escalation #${id}.`);
      }
    });
  }
  if (errors.length) throw new ValidationError("Submission blocked until all required fields are completed.", errors);
};

export async function submitAcademicHealthReport(reportId, payload, { actorUserId, actorRole }) {
  if (!reportId) throw new ValidationError("reportId is required");
  const existing = await hydrateReport(reportId);
  if (!existing) throw new ValidationError("Report not found");
  if (existing.status === REPORT_STATUSES.SUBMITTED && !["admin", "team_manager"].includes(actorRole)) {
    throw new ValidationError("Report already submitted");
  }
  const isOwner = actorUserId && Number(actorUserId) === Number(existing.assignedToUserId);
  const isManager = ["admin", "team_manager"].includes(actorRole);
  if (!isOwner && !isManager) {
    throw new ValidationError("You are not permitted to submit this report");
  }

  const merged = {
    ...existing,
    ...payload,
  };

  if (payload?.mop2CheckinTime) {
    merged.mop2CheckinTime = new Date(payload.mop2CheckinTime);
  }
  if ("copyChecks" in payload) merged.copyChecks = payload.copyChecks;
  if ("classChecks" in payload) merged.classChecks = payload.classChecks;
  if ("morningCoaching" in payload) merged.morningCoaching = payload.morningCoaching;
  if ("defaulters" in payload) merged.defaulters = payload.defaulters;
  if ("actionsByCategory" in payload) merged.actionsByCategory = payload.actionsByCategory;
  if ("escalationDetails" in payload) merged.escalationDetails = payload.escalationDetails;

  validateBeforeSubmit(merged);

  await updateAcademicHealthReport(
    reportId,
    {
      ...payload,
      status: REPORT_STATUSES.SUBMITTED,
      signatureName: payload?.signatureName || existing.signatureName,
      signatureBlobPath: payload?.signatureBlobPath || existing.signatureBlobPath,
      attendanceConfirmed: merged.attendanceConfirmed,
      selfDayClose: merged.selfDayClose,
    },
    { actorUserId, actorRole }
  );

  await db
    .update(academicHealthReports)
    .set({
      status: REPORT_STATUSES.SUBMITTED,
      updatedAt: new Date(),
    })
    .where(eq(academicHealthReports.id, Number(reportId)));

  return hydrateReport(reportId);
}

export async function approveAcademicHealthReport(reportId, { actorRole }) {
  if (!["admin", "team_manager"].includes(actorRole)) {
    throw new ValidationError("Only managers can approve reports.");
  }
  const [existing] = await db
    .select({
      id: academicHealthReports.id,
      status: academicHealthReports.status,
    })
    .from(academicHealthReports)
    .where(eq(academicHealthReports.id, Number(reportId)));
  if (!existing) throw new ValidationError("Report not found");
  await db
    .update(academicHealthReports)
    .set({ status: REPORT_STATUSES.APPROVED, updatedAt: new Date() })
    .where(eq(academicHealthReports.id, Number(reportId)));
  return hydrateReport(reportId);
}

export async function reopenAcademicHealthReport(reportId, { actorRole }) {
  if (!["admin", "team_manager"].includes(actorRole)) {
    throw new ValidationError("Only managers can reopen reports.");
  }
  const [existing] = await db
    .select({
      id: academicHealthReports.id,
      status: academicHealthReports.status,
    })
    .from(academicHealthReports)
    .where(eq(academicHealthReports.id, Number(reportId)));
  if (!existing) throw new ValidationError("Report not found");
  await db
    .update(academicHealthReports)
    .set({ status: REPORT_STATUSES.REOPENED, updatedAt: new Date() })
    .where(eq(academicHealthReports.id, Number(reportId)));
  return hydrateReport(reportId);
}

export { ValidationError, REPORT_STATUSES };
