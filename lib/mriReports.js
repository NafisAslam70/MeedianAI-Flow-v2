import { db } from "@/lib/db";
import {
  Classes,
  classParentTeachers,
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

const buildScopeMeta = (klass) => ({
  class: {
    id: klass?.id ?? null,
    name: klass?.name ?? null,
    section: klass?.section ?? null,
    track: klass?.track ?? null,
  },
});

export async function ensurePtAssignmentsForUser(userId, targetDate) {
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

export async function getMemberReports({ userId, targetDate }) {
  const isoDate = toISODate(targetDate);

  const assignments = await ensurePtAssignmentsForUser(userId, isoDate);

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

  if (!isOwner && !isManager) {
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
