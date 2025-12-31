import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  mriReportInstances,
  mriReportAssignments,
  mriReportTemplates,
  users,
} from "@/lib/schema";
import { and, eq, gte, lte, inArray } from "drizzle-orm";
import { ensurePtTemplate } from "@/lib/mriReports";

const PT_KEY = "pt_daily_report";

const todayIso = () => new Date().toISOString().slice(0, 10);

const sanitizeDate = (value, fallback) => {
  if (!value) return fallback || todayIso();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback || todayIso();
  return parsed.toISOString().slice(0, 10);
};

const normalizeDate = (value, fallback) => {
  if (!value) return fallback || todayIso();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback || todayIso();
  return parsed.toISOString().slice(0, 10);
};

const safeJson = (value, fallback = {}) => {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const hasCapturedData = (payload) => {
  if (!payload || typeof payload !== "object") return false;
  const { cddRows, ccdRows, attendanceRows } = payload;
  return (
    (Array.isArray(cddRows) && cddRows.length > 0) ||
    (Array.isArray(ccdRows) && ccdRows.length > 0) ||
    (Array.isArray(attendanceRows) && attendanceRows.length > 0)
  );
};

const bumpMap = (map, key) => {
  if (!key) return;
  const cleaned = String(key).trim();
  if (!cleaned) return;
  map.set(cleaned, (map.get(cleaned) || 0) + 1);
};

const bumpList = (map, value) => {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((v) => bumpList(map, v));
    return;
  }
  String(value)
    .split(/[,;\n]/)
    .map((v) => v.trim())
    .filter(Boolean)
    .forEach((entry) => bumpMap(map, entry));
};

const summarizeCcd = (rows) => {
  if (!Array.isArray(rows) || !rows.length) return "";
  return rows
    .map((r) => {
      const period = r?.period ? `P${r.period}` : "P?";
      const subj = r?.subject ? `${r.subject}` : "";
      return subj ? `${period} ${subj}` : period;
    })
    .slice(0, 5)
    .join("; ");
};

const summarizeCdd = (rows) => {
  if (!Array.isArray(rows) || !rows.length) return "";
  const fields = [
    "assemblyUniformDefaulters",
    "languageDefaulters",
    "homeworkDefaulters",
    "disciplineDefaulters",
    "absentStudents",
  ];
  const parts = [];
  for (const field of fields) {
    const values = rows
      .flatMap((r) => (Array.isArray(r?.[field]) ? r[field] : String(r?.[field] || "").split(/[,;\n]/)))
      .map((v) => String(v || "").trim())
      .filter(Boolean);
    if (values.length) {
      parts.push(`${field.replace(/Defaulters/, "").replace(/Students/, "Absent")}: ${values.slice(0, 5).join(", ")}`);
    }
  }
  return parts.slice(0, 3).join(" | ");
};

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
  const classId = Number(searchParams.get("classId"));
  if (!Number.isFinite(classId)) {
    return NextResponse.json({ error: "classId is required" }, { status: 400 });
  }

  const startDate = sanitizeDate(searchParams.get("startDate"));
  const endDate = sanitizeDate(searchParams.get("endDate"), startDate);

  try {
    const template = await ensurePtTemplate();
    if (!template?.id) {
      return NextResponse.json({ error: "PT template missing" }, { status: 404 });
    }

    const rows = await db
      .select({
        assignmentId: mriReportInstances.assignmentId,
        instanceId: mriReportInstances.id,
        classId: mriReportAssignments.classId,
        assignmentUserId: mriReportAssignments.userId,
        teacherName: users.name,
        assistantUserId: mriReportAssignments.scopeMeta,
        status: mriReportInstances.status,
        targetDate: mriReportInstances.targetDate,
        payload: mriReportInstances.payload,
        updatedAt: mriReportInstances.updatedAt,
      })
      .from(mriReportInstances)
      .innerJoin(
        mriReportAssignments,
        eq(mriReportAssignments.id, mriReportInstances.assignmentId)
      )
      .innerJoin(
        mriReportTemplates,
        eq(mriReportTemplates.id, mriReportInstances.templateId)
      )
      .leftJoin(users, eq(users.id, mriReportAssignments.userId))
      .where(
        and(
          eq(mriReportTemplates.key, PT_KEY),
          eq(mriReportAssignments.classId, classId),
          gte(mriReportInstances.targetDate, startDate),
          lte(mriReportInstances.targetDate, endDate)
        )
      );

    const statusCounts = new Map();
    const perDay = new Map();
    const assignmentSet = new Set();
    let filled = 0;
    let submitted = 0;
    let approved = 0;
    let ccdRows = 0;
    let cddRows = 0;
    let latestUpdate = null;

    const ccdPeriodMap = new Map();
    const ccdSubjectMap = new Map();
    const ccdTeacherMap = new Map();

    const cddBuckets = {
      assemblyUniformDefaulters: new Map(),
      languageDefaulters: new Map(),
      homeworkDefaulters: new Map(),
      disciplineDefaulters: new Map(),
      absentStudents: new Map(),
    };

    const instances = [];
    const assistantIds = new Set();
    const perDayDefaulters = new Map(); // date -> category maps
    const perDayLessons = new Map(); // date -> lessons

    for (const row of rows) {
      const status = String(row?.status || "pending").toLowerCase();
      statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
      assignmentSet.add(row.assignmentId);

      const dateKey = row.targetDate;
      if (!perDay.has(dateKey)) {
        perDay.set(dateKey, {
          date: dateKey,
          instances: 0,
          filled: 0,
          submitted: 0,
          approved: 0,
        });
      }
      const day = perDay.get(dateKey);
      day.instances += 1;

      const payload = safeJson(row.payload);
      const hasData = hasCapturedData(payload);
      if (hasData) {
        filled += 1;
        day.filled += 1;
      }
      if (status === "submitted" || status === "verified" || status === "waived") {
        submitted += 1;
        day.submitted += 1;
      }
      if (status === "verified" || status === "waived") {
        approved += 1;
        day.approved += 1;
      }

      const ccd = Array.isArray(payload.ccdRows) ? payload.ccdRows : [];
      const cdd = Array.isArray(payload.cddRows) ? payload.cddRows : [];
      const attendance = Array.isArray(payload.attendanceRows) ? payload.attendanceRows : [];
      ccdRows += ccd.length;
      cddRows += cdd.length;

      for (const entry of ccd) {
        const entryDate = normalizeDate(entry?.date || row.targetDate, row.targetDate);
        bumpMap(ccdPeriodMap, entry?.period);
        bumpMap(ccdSubjectMap, entry?.subject);
        bumpMap(ccdTeacherMap, entry?.teacherName);
        if (!perDayLessons.has(entryDate)) perDayLessons.set(entryDate, []);
        perDayLessons.get(entryDate).push({
          period: entry?.period || "",
          subject: entry?.subject || "",
          teacherName: entry?.teacherName || "",
        });
      }

      for (const entry of cdd) {
        const entryDate = normalizeDate(entry?.date || row.targetDate, row.targetDate);
        bumpList(cddBuckets.assemblyUniformDefaulters, entry?.assemblyUniformDefaulters);
        bumpList(cddBuckets.languageDefaulters, entry?.languageDefaulters);
        bumpList(cddBuckets.homeworkDefaulters, entry?.homeworkDefaulters);
        bumpList(cddBuckets.disciplineDefaulters, entry?.disciplineDefaulters);
        bumpList(cddBuckets.absentStudents, entry?.absentStudents);
        if (!perDayDefaulters.has(entryDate)) {
          perDayDefaulters.set(entryDate, {
            assemblyUniformDefaulters: new Map(),
            languageDefaulters: new Map(),
            homeworkDefaulters: new Map(),
            disciplineDefaulters: new Map(),
            absentStudents: new Map(),
          });
        }
        const dayBuckets = perDayDefaulters.get(entryDate);
        bumpList(dayBuckets.assemblyUniformDefaulters, entry?.assemblyUniformDefaulters);
        bumpList(dayBuckets.languageDefaulters, entry?.languageDefaulters);
        bumpList(dayBuckets.homeworkDefaulters, entry?.homeworkDefaulters);
        bumpList(dayBuckets.disciplineDefaulters, entry?.disciplineDefaulters);
        bumpList(dayBuckets.absentStudents, entry?.absentStudents);
      }

      const updated = row?.updatedAt ? new Date(row.updatedAt) : null;
      if (updated && !Number.isNaN(updated.getTime())) {
        if (!latestUpdate || updated > latestUpdate) {
          latestUpdate = updated;
        }
      }

      instances.push({
        assignmentId: row.assignmentId,
        instanceId: row.instanceId,
        classId: row.classId,
        targetDate: row.targetDate,
        status,
        updatedAt: row.updatedAt,
        teacherName: row.teacherName || null,
        assistantUserId: (() => {
          const meta = safeJson(row.assistantUserId);
          const val = meta?.assistantUserId;
          const num = Number(val);
          if (Number.isFinite(num)) {
            assistantIds.add(num);
            return num;
          }
          return null;
        })(),
        filled: hasData,
        submitted: status === "submitted" || status === "verified" || status === "waived",
        approved: status === "verified" || status === "waived",
        ccdCount: ccd.length,
        cddCount: cdd.length,
        attendanceCount: attendance.length,
        ccdSummary: summarizeCcd(ccd),
        cddSummary: summarizeCdd(cdd),
        ccdRows: ccd,
        cddRows: cdd,
      });
    }

    let assistantMap = new Map();
    if (assistantIds.size) {
      const assistantRows = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(inArray(users.id, Array.from(assistantIds)));
      assistantMap = new Map(assistantRows.map((r) => [Number(r.id), r.name || `User #${r.id}`]));
    }

    instances.forEach((inst) => {
      if (inst.assistantUserId) {
        inst.assistantName = assistantMap.get(inst.assistantUserId) || `User #${inst.assistantUserId}`;
      } else {
        inst.assistantName = null;
      }
    });

    const toArray = (map) =>
      Array.from(map.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([key, count]) => ({ key, count }));

    const formatPerDayDefaulters = Array.from(perDayDefaulters.entries())
      .map(([date, cats]) => ({
        date,
        categories: {
          assemblyUniformDefaulters: toArray(cats.assemblyUniformDefaulters),
          languageDefaulters: toArray(cats.languageDefaulters),
          homeworkDefaulters: toArray(cats.homeworkDefaulters),
          disciplineDefaulters: toArray(cats.disciplineDefaulters),
          absentStudents: toArray(cats.absentStudents),
        },
      }))
      .sort((a, b) => (a.date > b.date ? 1 : -1));

    const formatPerDayLessons = Array.from(perDayLessons.entries())
      .map(([date, lessons]) => ({
        date,
        lessons: lessons.map((l) => ({
          period: l.period,
          subject: l.subject,
          teacherName: l.teacherName,
        })),
      }))
      .sort((a, b) => (a.date > b.date ? 1 : -1));

    return NextResponse.json({
      classId,
      startDate,
      endDate,
      totals: {
        instances: rows.length,
        assignments: assignmentSet.size,
        filled,
        submitted,
        approved,
        ccdRows,
        cddRows,
        statuses: toArray(statusCounts),
        latestUpdate: latestUpdate ? latestUpdate.toISOString() : null,
      },
      perDay: Array.from(perDay.values()).sort((a, b) => (a.date > b.date ? 1 : -1)),
      ccd: {
        periods: toArray(ccdPeriodMap),
        subjects: toArray(ccdSubjectMap),
        teachers: toArray(ccdTeacherMap),
        perDay: formatPerDayLessons,
      },
      cdd: {
        defaulters: {
          assemblyUniformDefaulters: toArray(cddBuckets.assemblyUniformDefaulters),
          languageDefaulters: toArray(cddBuckets.languageDefaulters),
          homeworkDefaulters: toArray(cddBuckets.homeworkDefaulters),
          disciplineDefaulters: toArray(cddBuckets.disciplineDefaulters),
          absentStudents: toArray(cddBuckets.absentStudents),
        },
        perDay: formatPerDayDefaulters,
      },
      instances,
    });
  } catch (error) {
    console.error("GET /api/admin/admin-club/pt-history error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load PT history" },
      { status: 500 }
    );
  }
}
