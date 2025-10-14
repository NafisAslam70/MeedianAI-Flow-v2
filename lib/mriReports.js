import { db } from "@/lib/db";
import {
  Classes,
  classParentTeachers,
  users,
  mriFamilies,
  mriReportTemplates,
  mriReportAssignments,
  mriReportInstances,
  mriReportAudits,
} from "@/lib/schema";
import {
  and,
  eq,
  or,
  inArray,
  isNull,
  lte,
  gte,
} from "drizzle-orm";

const PT_DAILY_REPORT_KEY = "pt_daily_report";
const PT_FAMILY_KEY = "amri";

const PT_TEMPLATE_DEFINITION = {
  key: PT_DAILY_REPORT_KEY,
  name: "PT Daily Report",
  description:
    "Parent Teacher (Class Teacher) daily MRI register capturing Class Discipline Diary (CDD) and Class Curriculum Diary (CCD).",
  allowPreSubmit: true,
  defaultFrequency: "daily",
  instructions:
    "Office assistant fills in the CDD & CCD during school hours. Class teacher reviews the captured data and confirms during day close.",
  formSchema: {
    sections: [
      {
        key: "cddRows",
        title: "Class Discipline Diary",
        repeat: true,
        fields: [
          { id: "date", type: "date", label: "Date" },
          { id: "assemblyUniformDefaulters", type: "chips", label: "Assembly/Uniform Defaulters" },
          { id: "languageDefaulters", type: "chips", label: "Language Defaulters" },
          { id: "homeworkDefaulters", type: "chips", label: "Homework Defaulters" },
          { id: "disciplineDefaulters", type: "chips", label: "Discipline Defaulters" },
          { id: "bestStudentOfDay", type: "chips", label: "Best Student(s) of the Day" },
          { id: "absentStudents", type: "chips", label: "Absent Students" },
          { id: "teacherSigned", type: "select", label: "CT Sign", options: ["Yes", "No"] },
          { id: "principalStamp", type: "select", label: "Principal Stamp", options: ["Yes", "No"] },
        ],
      },
      {
        key: "ccdRows",
        title: "Class Curriculum Diary",
        repeat: true,
        fields: [
          { id: "period", type: "text", label: "Period" },
          { id: "subject", type: "text", label: "Subject" },
          { id: "topic", type: "text", label: "Topic" },
          { id: "teacherName", type: "select", label: "Teacher" },
          { id: "classwork", type: "textarea", label: "Classwork (What happened)" },
          { id: "homework", type: "textarea", label: "Homework (Assigned)" },
          { id: "teacherSignature", type: "select", label: "Teacher Sign", options: ["Yes", "No"] },
          { id: "monitorInitials", type: "select", label: "Monitor Initials", options: ["Yes", "No"] },
        ],
      },
      {
        key: "attendanceRows",
        title: "Attendance Snapshot",
        repeat: true,
        fields: [
          { id: "session", type: "text", label: "Session (e.g., Morning)" },
          { id: "absentStudents", type: "chips", label: "Absent Students" },
          { id: "presentCount", type: "text", label: "Present Count" },
          { id: "absentCount", type: "text", label: "Absent Count" },
          { id: "notes", type: "textarea", label: "Notes / Exceptions" },
        ],
      },
    ],
  },
  meta: {
    version: 5,
    schema: "pt_daily_v1",
  },
};

const SUBJECT_DAILY_REPORT_KEY = "subject_daily_report";
const SUBJECT_FAMILY_KEY = "amri";

const SUBJECT_TEMPLATE_DEFINITION = {
  key: SUBJECT_DAILY_REPORT_KEY,
  name: "Subject Teaching Report",
  description:
    "Auto-generated log of periods captured in Class Curriculum Diaries where you were the selected subject teacher.",
  allowPreSubmit: true,
  defaultFrequency: "daily",
  instructions:
    "Review the CCD entries tagged to you across all classes today. Confirm after verifying that the captured subjects, topics, classwork and homework are accurate.",
  formSchema: {
    sections: [
      {
        key: "lessons",
        title: "Teaching Log",
        repeat: true,
        fields: [
          { id: "classLabel", type: "text", label: "Class" },
          { id: "period", type: "text", label: "Period" },
          { id: "subject", type: "text", label: "Subject" },
          { id: "topic", type: "text", label: "Topic" },
          { id: "classwork", type: "textarea", label: "Classwork (What happened)" },
          { id: "homework", type: "textarea", label: "Homework (Assigned)" },
        ],
      },
    ],
  },
  meta: {
    version: 1,
    schema: "subject_daily_v1",
  },
};

const RESOLVED_STATUSES = new Set(["submitted", "verified", "waived"]);

const toISODate = (input) => {
  const date = input ? new Date(input) : new Date();
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return date.toISOString().slice(0, 10);
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

const normalizePersonName = (value) => {
  if (!value) return "";
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(
      /\b(mr|mrs|ms|sir|madam|maam|ma'am|teacher|ustad|ustadh|ustadha|ustaza|ustaz|ustaad|ust|ct|coach|mentor|bro|sis|teacherincharge)\b/g,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
};

const namesLikelyMatch = (candidate, target) => {
  const normalizedCandidate = normalizePersonName(candidate);
  const normalizedTarget = normalizePersonName(target);
  if (!normalizedCandidate || !normalizedTarget) return false;
  if (normalizedCandidate === normalizedTarget) return true;
  if (normalizedCandidate.includes(normalizedTarget) || normalizedTarget.includes(normalizedCandidate)) {
    return true;
  }
  const candidateTokens = normalizedCandidate.split(" ").filter(Boolean);
  const targetTokens = normalizedTarget.split(" ").filter(Boolean);
  if (!candidateTokens.length || !targetTokens.length) return false;
  const targetSet = new Set(targetTokens);
  const overlap = candidateTokens.filter((token) => targetSet.has(token));
  if (!overlap.length) return false;
  if (candidateTokens.length === 1 || targetTokens.length === 1) return true;
  const candidateSetSize = new Set(candidateTokens).size;
  const targetSetSize = new Set(targetTokens).size;
  const minTokenCount = Math.min(candidateSetSize, targetSetSize);
  return overlap.length >= Math.max(1, Math.ceil(minTokenCount * 0.6));
};

const buildClassLabel = ({ className, classSection, targetLabel, scopeMeta }) => {
  const meta = safeJson(scopeMeta);
  const metaClass = meta?.class || {};
  const name = className || metaClass?.name || null;
  const section = classSection || metaClass?.section || null;
  if (name) {
    return `Class ${name}${section ? ` ${section}` : ""}`;
  }
  if (targetLabel) return targetLabel;
  return null;
};

const buildScopeMeta = (klass) => ({
  class: {
    id: klass?.id ?? null,
    name: klass?.name ?? null,
    section: klass?.section ?? null,
    track: klass?.track ?? null,
  },
});

export async function ensurePtAssignmentsForUser(userId, targetDate) {
  await ensurePtTemplate();
  const isoDate = toISODate(targetDate);
  const [template] = await db
    .select({
      id: mriReportTemplates.id,
    })
    .from(mriReportTemplates)
    .where(and(eq(mriReportTemplates.key, PT_DAILY_REPORT_KEY), eq(mriReportTemplates.active, true)));

  if (!template) return [];

  const classLinks = await db
    .select({
      id: classParentTeachers.id,
      classId: classParentTeachers.classId,
      startDate: classParentTeachers.startDate,
      endDate: classParentTeachers.endDate,
      klassId: Classes.id,
      klassName: Classes.name,
      klassSection: Classes.section,
      klassTrack: Classes.track,
    })
    .from(classParentTeachers)
    .innerJoin(Classes, eq(Classes.id, classParentTeachers.classId))
    .where(
      and(
        eq(classParentTeachers.userId, userId),
        eq(classParentTeachers.active, true),
        lte(classParentTeachers.startDate, isoDate),
        or(isNull(classParentTeachers.endDate), gte(classParentTeachers.endDate, isoDate))
      )
    );

  if (!classLinks.length) return [];

  const existingAssignments = await db
    .select({
      id: mriReportAssignments.id,
      classId: mriReportAssignments.classId,
    })
    .from(mriReportAssignments)
    .where(
      and(
        eq(mriReportAssignments.templateId, template.id),
        eq(mriReportAssignments.userId, userId)
      )
    );

  const existingByClass = new Map(
    existingAssignments.map((row) => [row.classId ?? null, row])
  );

  const inserts = [];
  for (const link of classLinks) {
    if (existingByClass.has(link.classId)) continue;
    inserts.push({
      templateId: template.id,
      targetType: "user",
      userId,
      classId: link.classId,
      targetLabel: link.klassName ? `Class ${link.klassName}${link.klassSection ? ` ${link.klassSection}` : ""}` : null,
      startDate: link.startDate,
      endDate: link.endDate,
      scopeMeta: buildScopeMeta({
        id: link.klassId,
        name: link.klassName,
        section: link.klassSection,
        track: link.klassTrack,
      }),
    });
  }

  if (inserts.length) {
    await db.insert(mriReportAssignments).values(inserts);
  }

  return db
    .select({
      id: mriReportAssignments.id,
      templateId: mriReportAssignments.templateId,
      classId: mriReportAssignments.classId,
      scopeMeta: mriReportAssignments.scopeMeta,
    })
    .from(mriReportAssignments)
    .where(
      and(
        eq(mriReportAssignments.templateId, template.id),
        eq(mriReportAssignments.userId, userId),
        eq(mriReportAssignments.active, true),
        or(isNull(mriReportAssignments.startDate), lte(mriReportAssignments.startDate, isoDate)),
        or(isNull(mriReportAssignments.endDate), gte(mriReportAssignments.endDate, isoDate))
      )
    );
}

export async function ensurePtAssignmentsForAllClassTeachers(targetDate) {
  const isoDate = toISODate(targetDate);
  const rows = await db
    .select({
      userId: classParentTeachers.userId,
    })
    .from(classParentTeachers)
    .where(and(eq(classParentTeachers.active, true), lte(classParentTeachers.startDate, isoDate), or(isNull(classParentTeachers.endDate), gte(classParentTeachers.endDate, isoDate))));

  const uniqueUserIds = Array.from(new Set(rows.map((row) => Number(row.userId)).filter(Boolean)));
  let totalAssignments = 0;
  for (const uid of uniqueUserIds) {
    const assignments = await ensurePtAssignmentsForUser(uid, isoDate);
    totalAssignments += assignments.length;
  }
  return {
    date: isoDate,
    syncedUsers: uniqueUserIds.length,
    assignmentsEnsured: totalAssignments,
  };
}

export async function ensureInstancesForAssignments(assignments, isoDate) {
  if (!assignments.length) return [];
  const assignmentIds = assignments.map((a) => a.id);

  const existingInstances = await db
    .select({
      id: mriReportInstances.id,
      assignmentId: mriReportInstances.assignmentId,
      templateId: mriReportInstances.templateId,
      status: mriReportInstances.status,
      payload: mriReportInstances.payload,
      confirmationNote: mriReportInstances.confirmationNote,
      meta: mriReportInstances.meta,
    })
    .from(mriReportInstances)
    .where(
      and(
        inArray(mriReportInstances.assignmentId, assignmentIds),
        eq(mriReportInstances.targetDate, isoDate)
      )
    );

  const existingByAssignment = new Map(existingInstances.map((inst) => [inst.assignmentId, inst]));
  const toInsert = [];

  for (const assignment of assignments) {
    if (existingByAssignment.has(assignment.id)) continue;
    toInsert.push({
      templateId: assignment.templateId,
      assignmentId: assignment.id,
      targetDate: isoDate,
      meta: assignment.scopeMeta || {},
    });
  }

  if (toInsert.length) {
    await db.insert(mriReportInstances).values(toInsert);
  }

  const refreshedInstances = await db
    .select({
      id: mriReportInstances.id,
      assignmentId: mriReportInstances.assignmentId,
      templateId: mriReportInstances.templateId,
      status: mriReportInstances.status,
      payload: mriReportInstances.payload,
      confirmationNote: mriReportInstances.confirmationNote,
      meta: mriReportInstances.meta,
    })
    .from(mriReportInstances)
    .where(
      and(
        inArray(mriReportInstances.assignmentId, assignmentIds),
        eq(mriReportInstances.targetDate, isoDate)
      )
    );

  return refreshedInstances;
}

async function ensureReportTemplate(definition, familyKey) {
  if (!definition?.key) {
    throw new Error("Report template definition requires a key");
  }

  const [existing] = await db
    .select({
      id: mriReportTemplates.id,
      key: mriReportTemplates.key,
      active: mriReportTemplates.active,
      meta: mriReportTemplates.meta,
    })
    .from(mriReportTemplates)
    .where(eq(mriReportTemplates.key, definition.key))
    .limit(1);

  const targetVersion = Number(definition.meta?.version ?? 0);
  const existingVersion = Number(existing?.meta?.version ?? 0);
  const needsUpdate = !existing?.active || existingVersion < targetVersion;

  if (existing && !needsUpdate) {
    return existing;
  }

  let familyId = null;
  if (familyKey) {
    try {
      const [family] = await db
        .select({ id: mriFamilies.id })
        .from(mriFamilies)
        .where(eq(mriFamilies.key, familyKey))
        .limit(1);
      if (family?.id) familyId = family.id;
    } catch {
      familyId = null;
    }
  }

  if (existing) {
    const [updated] = await db
      .update(mriReportTemplates)
      .set({
        active: true,
        allowPreSubmit: definition.allowPreSubmit,
        defaultFrequency: definition.defaultFrequency,
        instructions: definition.instructions,
        formSchema: definition.formSchema,
        meta: definition.meta,
        name: definition.name,
        description: definition.description,
        updatedAt: new Date(),
      })
      .where(eq(mriReportTemplates.id, existing.id))
      .returning({
        id: mriReportTemplates.id,
        key: mriReportTemplates.key,
        meta: mriReportTemplates.meta,
      });
    return updated || existing;
  }

  const [inserted] = await db
    .insert(mriReportTemplates)
    .values({
      familyId,
      key: definition.key,
      name: definition.name,
      description: definition.description,
      allowPreSubmit: definition.allowPreSubmit,
      defaultFrequency: definition.defaultFrequency,
      instructions: definition.instructions,
      formSchema: definition.formSchema,
      meta: definition.meta,
    })
    .onConflictDoNothing()
    .returning({
      id: mriReportTemplates.id,
      key: mriReportTemplates.key,
      meta: mriReportTemplates.meta,
    });

  return inserted || existing || { id: null, key: definition.key };
}

export async function ensurePtTemplate() {
  return ensureReportTemplate(PT_TEMPLATE_DEFINITION, PT_FAMILY_KEY);
}

async function ensureSubjectTemplate() {
  return ensureReportTemplate(SUBJECT_TEMPLATE_DEFINITION, SUBJECT_FAMILY_KEY);
}

const toNumeric = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const sortPeriods = (values) => {
  const unique = Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter((value) => value.length > 0)
    )
  );
  return unique.sort((a, b) => {
    const numA = extractNumericPeriod(a);
    const numB = extractNumericPeriod(b);
    if (numA === null && numB === null) return a.localeCompare(b);
    if (numA === null) return 1;
    if (numB === null) return -1;
    return numA - numB;
  });
};

const extractNumericPeriod = (value) => {
  if (value == null) return null;
  const match = String(value).match(/(\d+)/);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
};

async function buildSubjectReportLessons({ teacherId, teacherName, isoDate }) {
  if (!teacherId || !teacherName) {
    return { lessons: [], classSummary: [], sourceInstanceIds: [] };
  }

  const rows = await db
    .select({
      instanceId: mriReportInstances.id,
      payload: mriReportInstances.payload,
      meta: mriReportInstances.meta,
      classId: mriReportAssignments.classId,
      className: Classes.name,
      classSection: Classes.section,
      classTrack: Classes.track,
      targetLabel: mriReportAssignments.targetLabel,
      scopeMeta: mriReportAssignments.scopeMeta,
    })
    .from(mriReportInstances)
    .innerJoin(mriReportAssignments, eq(mriReportAssignments.id, mriReportInstances.assignmentId))
    .innerJoin(mriReportTemplates, eq(mriReportTemplates.id, mriReportInstances.templateId))
    .leftJoin(Classes, eq(Classes.id, mriReportAssignments.classId))
    .where(and(eq(mriReportTemplates.key, PT_DAILY_REPORT_KEY), eq(mriReportInstances.targetDate, isoDate)));

  const lessons = [];
  const classMap = new Map();
  const sourceInstanceIds = new Set();

  for (const row of rows) {
    const payload = safeJson(row.payload, {});
    const ccdRows = Array.isArray(payload?.ccdRows) ? payload.ccdRows : [];
    if (!ccdRows.length) continue;

    const scopeMeta = safeJson(row.scopeMeta);
    const metaClass = scopeMeta?.class || {};
    const classId = row.classId ?? metaClass?.id ?? null;
    const classTrack = row.classTrack ?? metaClass?.track ?? null;
    const classLabel = buildClassLabel({
      className: row.className,
      classSection: row.classSection,
      targetLabel: row.targetLabel,
      scopeMeta: row.scopeMeta,
    });

    for (const ccdRow of ccdRows) {
      const teacherIdCandidate = toNumeric(ccdRow?.teacherId ?? ccdRow?.teacher_id ?? ccdRow?.teacherID);
      let matches =
        (teacherIdCandidate && teacherIdCandidate === teacherId) ||
        namesLikelyMatch(ccdRow?.teacherName, teacherName) ||
        namesLikelyMatch(ccdRow?.teacher, teacherName) ||
        namesLikelyMatch(ccdRow?.teacher_name, teacherName) ||
        namesLikelyMatch(ccdRow?.teacherFullName, teacherName);

      if (!matches && Array.isArray(ccdRow?.teachers)) {
        matches = ccdRow.teachers.some((value) => namesLikelyMatch(value, teacherName));
      }

      if (!matches) continue;

      const lesson = {
        classId,
        classLabel: classLabel || null,
        classTrack: classTrack || null,
        period: ccdRow?.period ?? "",
        subject: ccdRow?.subject ?? "",
        topic: ccdRow?.topic ?? "",
        classwork: ccdRow?.classwork ?? "",
        homework: ccdRow?.homework ?? "",
        teacherSignature: ccdRow?.teacherSignature ?? "",
        monitorInitials: ccdRow?.monitorInitials ?? "",
        sourceInstanceId: row.instanceId,
      };

      lessons.push(lesson);
      sourceInstanceIds.add(row.instanceId);

      const classKey = classId || classLabel || `instance-${row.instanceId}`;
      if (!classMap.has(classKey)) {
        classMap.set(classKey, {
          classId,
          classLabel: classLabel || "Class",
          classTrack,
          totalPeriods: 0,
          periods: [],
        });
      }
      const summary = classMap.get(classKey);
      summary.totalPeriods += 1;
      summary.periods.push(String(lesson.period || ""));
    }
  }

  lessons.sort((a, b) => {
    const classCompare = (a.classLabel || "").localeCompare(b.classLabel || "");
    if (classCompare !== 0) return classCompare;
    const periodA = extractNumericPeriod(a.period);
    const periodB = extractNumericPeriod(b.period);
    if (periodA === null && periodB === null) {
      return String(a.period || "").localeCompare(String(b.period || ""));
    }
    if (periodA === null) return 1;
    if (periodB === null) return -1;
    return periodA - periodB;
  });

  classMap.forEach((entry) => {
    entry.periods = sortPeriods(entry.periods);
  });

  return {
    lessons,
    classSummary: Array.from(classMap.values()).sort((a, b) => (a.classLabel || "").localeCompare(b.classLabel || "")),
    sourceInstanceIds: Array.from(sourceInstanceIds),
  };
}

async function syncSubjectReportInstances({ teacher, assignments, instances, isoDate }) {
  if (!assignments.length || !instances.length) return;
  const teacherId = toNumeric(teacher?.id);
  const teacherName = teacher?.name || "";
  if (!teacherId || !teacherName) return;

  const { lessons, classSummary, sourceInstanceIds } = await buildSubjectReportLessons({
    teacherId,
    teacherName,
    isoDate,
  });

  for (const assignment of assignments) {
    const instance = instances.find((item) => item.assignmentId === assignment.id);
    if (!instance) continue;

    const existingPayload = safeJson(instance.payload, null);
    if (existingPayload?.subjectSourceManual === true) {
      // Respect manual overrides captured by the member.
      continue;
    }

    const payload = {
      date: isoDate,
      teacher: {
        id: teacherId,
        name: teacherName,
      },
      lessons,
      summary: {
        totalLessons: lessons.length,
        classes: classSummary,
      },
      sources: {
        ptInstances: sourceInstanceIds,
      },
      subjectSourceManual: false,
    };

    const payloadString = JSON.stringify(payload);
    const existingPayloadString = existingPayload ? JSON.stringify(existingPayload) : null;
    if (existingPayloadString === payloadString) continue;

    const currentMeta = safeJson(instance.meta, {});
    const nextMeta = {
      ...currentMeta,
      subjectSource: {
        ptInstances: sourceInstanceIds,
        syncedAt: new Date().toISOString(),
      },
    };

    await db
      .update(mriReportInstances)
      .set({
        payload,
        meta: nextMeta,
        updatedAt: new Date(),
      })
      .where(eq(mriReportInstances.id, instance.id));
  }
}

export async function ensureSubjectAssignmentsForUser(userId, targetDate) {
  const isoDate = toISODate(targetDate);
  const [teacher] = await db
    .select({
      id: users.id,
      name: users.name,
      isTeacher: users.isTeacher,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!teacher || teacher.isTeacher !== true) {
    return [];
  }

  const template = await ensureSubjectTemplate();
  if (!template?.id) return [];

  const existingAssignments = await db
    .select({
      id: mriReportAssignments.id,
      templateId: mriReportAssignments.templateId,
      classId: mriReportAssignments.classId,
      scopeMeta: mriReportAssignments.scopeMeta,
      targetLabel: mriReportAssignments.targetLabel,
    })
    .from(mriReportAssignments)
    .where(and(eq(mriReportAssignments.templateId, template.id), eq(mriReportAssignments.userId, userId)));

  let assignments = existingAssignments;

  if (!existingAssignments.length) {
    const [inserted] = await db
      .insert(mriReportAssignments)
      .values({
        templateId: template.id,
        targetType: "user",
        userId,
        targetLabel: "Subject Teaching Report",
        startDate: isoDate,
        scopeMeta: {
          teacher: {
            id: userId,
            name: teacher.name,
          },
        },
      })
      .returning({
        id: mriReportAssignments.id,
        templateId: mriReportAssignments.templateId,
        classId: mriReportAssignments.classId,
        scopeMeta: mriReportAssignments.scopeMeta,
        targetLabel: mriReportAssignments.targetLabel,
      });
    assignments = inserted ? [inserted] : [];
  }

  if (!assignments.length) return [];

  const instances = await ensureInstancesForAssignments(assignments, isoDate);
  await syncSubjectReportInstances({
    teacher,
    assignments,
    instances,
    isoDate,
  });

  return assignments;
}

export async function getMemberReports({ userId, targetDate }) {
  const isoDate = toISODate(targetDate);

  const ptAssignments = await ensurePtAssignmentsForUser(userId, isoDate);
  const subjectAssignments = await ensureSubjectAssignmentsForUser(userId, isoDate);

  const assignments = Array.from(
    new Map(
      [...ptAssignments, ...subjectAssignments].map((assignment) => [assignment.id, assignment])
    ).values()
  );

  if (!assignments.length) {
    return {
      date: isoDate,
      reports: [],
    };
  }

  const assignmentIds = assignments.map((a) => a.id);

  const rows = await db
    .select({
      assignmentId: mriReportAssignments.id,
      templateId: mriReportTemplates.id,
      templateKey: mriReportTemplates.key,
      templateName: mriReportTemplates.name,
      templateDescription: mriReportTemplates.description,
      allowPreSubmit: mriReportTemplates.allowPreSubmit,
      defaultFrequency: mriReportTemplates.defaultFrequency,
      templateActive: mriReportTemplates.active,
      formSchema: mriReportTemplates.formSchema,
      scopeMeta: mriReportAssignments.scopeMeta,
      classId: mriReportAssignments.classId,
      targetLabel: mriReportAssignments.targetLabel,
      className: Classes.name,
      classSection: Classes.section,
      classTrack: Classes.track,
    })
    .from(mriReportAssignments)
    .innerJoin(mriReportTemplates, eq(mriReportTemplates.id, mriReportAssignments.templateId))
    .leftJoin(Classes, eq(Classes.id, mriReportAssignments.classId))
    .where(
      and(
        inArray(mriReportAssignments.id, assignmentIds),
        eq(mriReportAssignments.active, true),
        eq(mriReportTemplates.active, true),
        or(isNull(mriReportAssignments.startDate), lte(mriReportAssignments.startDate, isoDate)),
        or(isNull(mriReportAssignments.endDate), gte(mriReportAssignments.endDate, isoDate))
      )
    );

  const instances = await ensureInstancesForAssignments(assignments, isoDate);
  const instancesByAssignment = new Map(instances.map((i) => [i.assignmentId, i]));

  const reports = rows.map((row) => {
    const instance = instancesByAssignment.get(row.assignmentId);
    const classMeta = {
      id: row.classId,
      name: row.className || safeJson(row.scopeMeta)?.class?.name || null,
      section: row.classSection || safeJson(row.scopeMeta)?.class?.section || null,
      track: row.classTrack || safeJson(row.scopeMeta)?.class?.track || null,
    };
    return {
      templateId: row.templateId,
      templateKey: row.templateKey,
      templateName: row.templateName,
      templateDescription: row.templateDescription,
      formSchema: safeJson(row.formSchema, { sections: [] }),
      assignmentId: row.assignmentId,
      instanceId: instance?.id ?? null,
      status: instance?.status ?? "pending",
      payload: instance?.payload ?? null,
      confirmationNote: instance?.confirmationNote ?? null,
      allowPreSubmit: row.allowPreSubmit,
      defaultFrequency: row.defaultFrequency,
      class: classMeta,
      targetLabel: row.targetLabel || classMeta.name,
      meta: {
        ...safeJson(row.scopeMeta),
        ...safeJson(instance?.meta),
      },
    };
  });

  return {
    date: isoDate,
    reports,
  };
}

export async function updateMriReportInstance({ instanceId, userId, role, payload, action, confirmationNote }) {
  const allowedActions = new Set(["draft", "submit", "verify", "waive"]);
  const resolvedAction = allowedActions.has(action) ? action : "draft";

  const [current] = await db
    .select({
      id: mriReportInstances.id,
      assignmentId: mriReportInstances.assignmentId,
      templateId: mriReportInstances.templateId,
      status: mriReportInstances.status,
      payload: mriReportInstances.payload,
      confirmationNote: mriReportInstances.confirmationNote,
      submittedBy: mriReportInstances.submittedBy,
      submittedAt: mriReportInstances.submittedAt,
      verifiedBy: mriReportInstances.verifiedBy,
      verifiedAt: mriReportInstances.verifiedAt,
      waivedBy: mriReportInstances.waivedBy,
      waivedAt: mriReportInstances.waivedAt,
      meta: mriReportInstances.meta,
      assignmentUserId: mriReportAssignments.userId,
      templateName: mriReportTemplates.name,
      templateAllowPreSubmit: mriReportTemplates.allowPreSubmit,
      assignmentScopeMeta: mriReportAssignments.scopeMeta,
    })
    .from(mriReportInstances)
    .innerJoin(mriReportAssignments, eq(mriReportAssignments.id, mriReportInstances.assignmentId))
    .innerJoin(mriReportTemplates, eq(mriReportTemplates.id, mriReportInstances.templateId))
    .where(eq(mriReportInstances.id, instanceId));

  if (!current) {
    throw new Error("Report instance not found");
  }

  const isOwner = current.assignmentUserId === userId;
  const isManager = role === "team_manager" || role === "admin";
  const assistantId = (() => {
    const meta = safeJson(current.assignmentScopeMeta);
    const value = meta?.assistantUserId;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  })();
  const isAssistant = assistantId === userId;

  if (!isOwner && !isManager && !isAssistant) {
    throw new Error("You are not allowed to update this report");
  }

  const now = new Date();

  const updateData = {
    updatedAt: now,
  };

  if (payload !== undefined) {
    updateData.payload = payload;
  }

  if (resolvedAction === "draft") {
    updateData.status = "draft";
  }

  if (resolvedAction === "submit") {
    if (!payload && !current.payload) {
      updateData.status = "draft";
    } else {
      updateData.status = "submitted";
    }
    updateData.submittedBy = userId;
    updateData.submittedAt = now;
    if (confirmationNote !== undefined) updateData.confirmationNote = confirmationNote || null;
  } else if (resolvedAction === "verify") {
    if (!isManager) {
      throw new Error("Only managers can verify reports");
    }
    updateData.status = "verified";
    updateData.verifiedBy = userId;
    updateData.verifiedAt = now;
    if (confirmationNote !== undefined) updateData.confirmationNote = confirmationNote || null;
  } else if (resolvedAction === "waive") {
    if (!isManager) {
      throw new Error("Only managers can waive reports");
    }
    updateData.status = "waived";
    updateData.waivedBy = userId;
    updateData.waivedAt = now;
    if (confirmationNote !== undefined) updateData.confirmationNote = confirmationNote || null;
  } else if (confirmationNote !== undefined) {
    updateData.confirmationNote = confirmationNote || null;
  }

  const [updated] = await db
    .update(mriReportInstances)
    .set(updateData)
    .where(eq(mriReportInstances.id, instanceId))
    .returning({
      id: mriReportInstances.id,
      assignmentId: mriReportInstances.assignmentId,
      templateId: mriReportInstances.templateId,
      status: mriReportInstances.status,
      payload: mriReportInstances.payload,
      confirmationNote: mriReportInstances.confirmationNote,
      submittedBy: mriReportInstances.submittedBy,
      submittedAt: mriReportInstances.submittedAt,
      verifiedBy: mriReportInstances.verifiedBy,
      verifiedAt: mriReportInstances.verifiedAt,
      waivedBy: mriReportInstances.waivedBy,
      waivedAt: mriReportInstances.waivedAt,
      meta: mriReportInstances.meta,
    });

  if (current) {
    await db.insert(mriReportAudits).values({
      instanceId,
      actorId: userId,
      action: resolvedAction,
      snapshot: {
        previous: current,
        updated,
      },
    });
  }

  return updated;
}

export function areReportsCleared(reports) {
  if (!Array.isArray(reports) || reports.length === 0) return true;
  return reports.every((report) => RESOLVED_STATUSES.has(report.status));
}
