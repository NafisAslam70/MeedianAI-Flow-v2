import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  mriReportAssignments,
  mriReportTemplates,
  mriReportInstances,
  managerSectionGrants,
  Classes,
  users,
} from "@/lib/schema";
import {
  eq,
  and,
  or,
  isNull,
  lte,
  gte,
  inArray,
} from "drizzle-orm";
import {
  ensurePtTemplate,
  ensureInstancesForAssignments,
} from "@/lib/mriReports";

const todayIso = () => {
  const now = new Date();
  return now.toISOString().slice(0, 10);
};

const managerHasWriteGrant = async (userId) => {
  const rows = await db
    .select({
      canWrite: managerSectionGrants.canWrite,
    })
    .from(managerSectionGrants)
    .where(
      and(
        eq(managerSectionGrants.userId, Number(userId)),
        eq(managerSectionGrants.section, "mriReportAssignments")
      )
    )
    .limit(1);
  if (!rows.length) return false;
  const flag = rows[0]?.canWrite;
  return flag === true;
};

const sanitizeDate = (value) => {
  if (!value) return todayIso();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return todayIso();
  return parsed.toISOString().slice(0, 10);
};

const parsePayload = (raw) => {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const stringifyPayload = (payload) => {
  if (!payload || typeof payload !== "object") return {};
  return payload;
};

export async function GET(req) {
  const session = await auth();
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;
  const userId = Number(session.user.id);
  const isManager = role === "admin" || role === "team_manager";

  if (role === "team_manager") {
    const hasGrant = await managerHasWriteGrant(userId);
    if (!hasGrant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { searchParams } = new URL(req.url);
  const isoDate = sanitizeDate(searchParams.get("date"));

  try {
    const template = await ensurePtTemplate();
    if (!template || !template.id) {
      return NextResponse.json({ error: "PT template missing" }, { status: 404 });
    }

    const rawAssignments = await db
      .select({
        id: mriReportAssignments.id,
        templateId: mriReportAssignments.templateId,
        userId: mriReportAssignments.userId,
        classId: mriReportAssignments.classId,
        targetLabel: mriReportAssignments.targetLabel,
        startDate: mriReportAssignments.startDate,
        endDate: mriReportAssignments.endDate,
        active: mriReportAssignments.active,
        scopeMeta: mriReportAssignments.scopeMeta,
        teacherName: users.name,
        teacherEmail: users.email,
        className: Classes.name,
        classSection: Classes.section,
      })
      .from(mriReportAssignments)
      .innerJoin(mriReportTemplates, eq(mriReportTemplates.id, mriReportAssignments.templateId))
      .leftJoin(Classes, eq(Classes.id, mriReportAssignments.classId))
      .leftJoin(users, eq(users.id, mriReportAssignments.userId))
      .where(
        and(
          eq(mriReportAssignments.templateId, template.id),
          eq(mriReportAssignments.active, true),
          or(isNull(mriReportAssignments.startDate), lte(mriReportAssignments.startDate, isoDate)),
          or(isNull(mriReportAssignments.endDate), gte(mriReportAssignments.endDate, isoDate))
        )
      );

    const assignments = isManager
      ? rawAssignments
      : rawAssignments.filter((row) => Number((row.scopeMeta || {}).assistantUserId || 0) === userId);

    if (!assignments.length) {
      return NextResponse.json(
        {
          date: isoDate,
          template,
          assignments: [],
          viewerId: userId,
        },
        { status: 200 }
      );
    }

    const assistantIds = Array.from(
      new Set(
        assignments
          .map((row) => Number((row.scopeMeta || {}).assistantUserId || 0))
          .filter((val) => Number.isFinite(val) && val > 0)
      )
    );

    let assistantMap = new Map();
    if (assistantIds.length) {
      const assistantRows = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(inArray(users.id, assistantIds));
      assistantMap = new Map(assistantRows.map((row) => [Number(row.id), { name: row.name, email: row.email }]));
    }

    await ensureInstancesForAssignments(
      assignments.map((row) => ({
        id: row.id,
        templateId: row.templateId,
        scopeMeta: row.scopeMeta,
      })),
      isoDate
    );

    const assignmentIds = assignments.map((row) => row.id);

    const instances = await db
      .select({
        id: mriReportInstances.id,
        assignmentId: mriReportInstances.assignmentId,
        payload: mriReportInstances.payload,
        status: mriReportInstances.status,
        confirmationNote: mriReportInstances.confirmationNote,
        targetDate: mriReportInstances.targetDate,
        updatedAt: mriReportInstances.updatedAt,
      })
      .from(mriReportInstances)
      .where(
        and(
          inArray(mriReportInstances.assignmentId, assignmentIds),
          eq(mriReportInstances.targetDate, isoDate)
        )
      );

    const instanceMap = new Map();
    for (const inst of instances) {
      instanceMap.set(inst.assignmentId, inst);
    }

    const responseAssignments = assignments.map((row) => {
      const inst = instanceMap.get(row.id) || null;
      const payload = inst ? parsePayload(inst.payload) : {};
      return {
        id: row.id,
        templateId: row.templateId,
        userId: row.userId,
        classId: row.classId,
        targetLabel: row.targetLabel,
        startDate: row.startDate,
        endDate: row.endDate,
        active: row.active,
        teacherName: row.teacherName,
        teacherEmail: row.teacherEmail,
        className: row.className,
        classSection: row.classSection,
        instanceId: inst?.id || null,
        status: inst?.status || "pending",
        confirmationNote: inst?.confirmationNote || null,
        updatedAt: inst?.updatedAt || null,
        payload,
        assistantUserId: row.scopeMeta?.assistantUserId ?? null,
        assistantName: (() => {
          const meta = assistantMap.get(Number(row.scopeMeta?.assistantUserId || 0));
          return meta?.name || null;
        })(),
        assistantEmail: (() => {
          const meta = assistantMap.get(Number(row.scopeMeta?.assistantUserId || 0));
          return meta?.email || null;
        })(),
      };
    });

    return NextResponse.json(
      {
        date: isoDate,
        template,
        assignments: responseAssignments,
        viewerId: userId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/managersCommon/pt-assist error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load PT assistance data" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  const session = await auth();
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;
  const userId = Number(session.user.id);
  const isManager = role === "admin" || role === "team_manager";

  if (role === "team_manager") {
    const hasGrant = await managerHasWriteGrant(userId);
    if (!hasGrant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const assignmentId = Number(body.assignmentId);
  if (!assignmentId) {
    return NextResponse.json({ error: "assignmentId is required" }, { status: 400 });
  }

  const isoDate = sanitizeDate(body.date);
  const payload = stringifyPayload(body.payload || {});
  const action = typeof body.action === "string" ? body.action.trim().toLowerCase() : "draft";

  try {
    const [assignment] = await db
      .select({
        id: mriReportAssignments.id,
        templateId: mriReportAssignments.templateId,
        userId: mriReportAssignments.userId,
        scopeMeta: mriReportAssignments.scopeMeta,
        active: mriReportAssignments.active,
        startDate: mriReportAssignments.startDate,
        endDate: mriReportAssignments.endDate,
      })
      .from(mriReportAssignments)
      .where(eq(mriReportAssignments.id, assignmentId))
      .limit(1);

    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    if (!isManager) {
      const assistantId = Number((assignment.scopeMeta || {}).assistantUserId || 0);
      if (assistantId !== userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    await ensureInstancesForAssignments(
      [
        {
          id: assignment.id,
          templateId: assignment.templateId,
          scopeMeta: assignment.scopeMeta,
        },
      ],
      isoDate
    );

    const [instance] = await db
      .select({
        id: mriReportInstances.id,
      })
      .from(mriReportInstances)
      .where(
        and(
          eq(mriReportInstances.assignmentId, assignment.id),
          eq(mriReportInstances.targetDate, isoDate)
        )
      )
      .limit(1);

    if (!instance) {
      return NextResponse.json({ error: "Instance not available" }, { status: 404 });
    }

    const { updateMriReportInstance } = await import("@/lib/mriReports");
    const updated = await updateMriReportInstance({
      instanceId: Number(instance.id),
      userId,
      role,
      payload,
      action,
      confirmationNote: body.confirmationNote || null,
    });

    return NextResponse.json({ instance: updated }, { status: 200 });
  } catch (error) {
    console.error("POST /api/managersCommon/pt-assist error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to save PT assistance entry" },
      { status: 500 }
    );
  }
}
