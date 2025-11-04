"use server";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  Classes,
  Students,
  guardianCallReports,
  mriPrograms,
  users,
  mriReportAssignments,
  mriReportTemplates,
} from "@/lib/schema";
import { and, asc, desc, eq, ilike, or, lte, gte, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { ensurePhoneCallTemplate } from "@/lib/mriReports";

const isManager = (session) =>
  Boolean(session?.user) && ["admin", "team_manager"].includes(session.user.role);

const parseId = (value) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
};

const sanitizeText = (input) => {
  if (typeof input !== "string") return "";
  return input.trim();
};

const PHONE_CALL_TEMPLATE_KEY = "phone_call_drive";

const todayIso = () => new Date().toISOString().slice(0, 10);

const toIsoDate = (value) => {
  if (!value) return todayIso();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return todayIso();
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

const summarizeCampaignScope = (scopeMeta = {}, fallbackClass = {}) => {
  const callScope = scopeMeta.callScope || {};
  const classMeta = scopeMeta.class || fallbackClass;
  let label = "All classes";
  if (callScope.mode === "single_class") {
    if (callScope.classLabel) label = callScope.classLabel;
    else if (classMeta?.name) label = `Class ${classMeta.name}${classMeta.section ? ` ${classMeta.section}` : ""}`;
    else label = "Specific class";
  } else if (callScope.mode === "by_track") {
    label = callScope.track ? `Track: ${callScope.track}` : "Track campaign";
  } else if (callScope.mode === "custom") {
    label = "Custom list";
  }
  return {
    mode: callScope.mode || "all_classes",
    classId: callScope.classId ?? classMeta?.id ?? null,
    track: callScope.track ?? classMeta?.track ?? null,
    label,
  };
};

const formatCampaignAssignment = (assignment, viewerId) => {
  const scopeMeta = safeJson(assignment.scopeMeta, {});
  const campaignMeta = scopeMeta.campaign || {};
  const timelineMeta = scopeMeta.timeline || {};
  const scope = summarizeCampaignScope(scopeMeta, {
    id: assignment.classId ?? null,
    name: assignment.className ?? null,
    section: assignment.classSection ?? null,
    track: assignment.classTrack ?? null,
  });
  const startDate = assignment.startDate || timelineMeta.startDate || null;
  const dueDate = assignment.endDate || timelineMeta.dueDate || null;
  let status = assignment.active === false ? "snoozed" : "active";
  if (status === "active" && dueDate) {
    const due = new Date(dueDate);
    const today = new Date(todayIso());
    if (!Number.isNaN(due.getTime()) && due < today) {
      status = "overdue";
    }
  }
  return {
    id: assignment.id,
    label: assignment.targetLabel || campaignMeta.name || "Phone Call Drive",
    callType: campaignMeta.callType || null,
    focusArea: campaignMeta.focusArea || null,
    audience: campaignMeta.audience || null,
    instructions: campaignMeta.instructions || null,
    scope,
    startDate,
    dueDate,
    active: assignment.active !== false,
    status,
    assignedTo: {
      id: assignment.userId ?? null,
      name: assignment.userName || null,
      email: assignment.userEmail || null,
    },
    assignedToViewer: viewerId != null && assignment.userId === viewerId,
  };
};

export async function GET(req) {
  const session = await auth();
  if (!isManager(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const section = searchParams.get("section") || "logs";
  const viewerId = Number(session?.user?.id ?? 0) || null;
  const viewerRole = session?.user?.role || "";

  try {
    if (section === "campaigns") {
      await ensurePhoneCallTemplate();
      const isoDate = toIsoDate(searchParams.get("date"));

      const assignments = await db
        .select({
          id: mriReportAssignments.id,
          templateId: mriReportAssignments.templateId,
          userId: mriReportAssignments.userId,
          userName: users.name,
          userEmail: users.email,
          classId: mriReportAssignments.classId,
          className: Classes.name,
          classSection: Classes.section,
          classTrack: Classes.track,
          targetLabel: mriReportAssignments.targetLabel,
          startDate: mriReportAssignments.startDate,
          endDate: mriReportAssignments.endDate,
          active: mriReportAssignments.active,
          scopeMeta: mriReportAssignments.scopeMeta,
          updatedAt: mriReportAssignments.updatedAt,
        })
        .from(mriReportAssignments)
        .innerJoin(mriReportTemplates, eq(mriReportTemplates.id, mriReportAssignments.templateId))
        .leftJoin(users, eq(users.id, mriReportAssignments.userId))
        .leftJoin(Classes, eq(Classes.id, mriReportAssignments.classId))
        .where(
          and(
            eq(mriReportTemplates.key, PHONE_CALL_TEMPLATE_KEY),
            eq(mriReportAssignments.active, true),
            or(isNull(mriReportAssignments.startDate), lte(mriReportAssignments.startDate, isoDate)),
            or(isNull(mriReportAssignments.endDate), gte(mriReportAssignments.endDate, isoDate))
          )
        )
        .orderBy(asc(mriReportAssignments.endDate), asc(mriReportAssignments.targetLabel));

      const campaigns = assignments
        .filter((assignment) => {
          if (viewerRole === "admin") return true;
          if (viewerRole === "team_manager") return true;
          return assignment.userId === viewerId;
        })
        .map((assignment) => formatCampaignAssignment(assignment, viewerId));

      return NextResponse.json(
        {
          date: isoDate,
          campaigns,
        },
        { status: 200 }
      );
    }

    if (section === "options") {
      const [classRows, programRows] = await Promise.all([
        db
          .select({
            id: Classes.id,
            name: Classes.name,
            section: Classes.section,
            track: Classes.track,
            active: Classes.active,
          })
          .from(Classes)
          .where(eq(Classes.active, true))
          .orderBy(asc(Classes.name), asc(Classes.section)),
        db
          .select({
            id: mriPrograms.id,
            key: mriPrograms.programKey,
            name: mriPrograms.name,
          })
          .from(mriPrograms)
          .where(eq(mriPrograms.active, true))
          .orderBy(asc(mriPrograms.programKey)),
      ]);

      return NextResponse.json(
        {
          classes: classRows.map((row) => ({
            id: row.id,
            name: row.name,
            section: row.section,
            track: row.track,
          })),
          programs: programRows.map((row) => ({
            id: row.id,
            programKey: row.key,
            name: row.name,
          })),
        },
        { status: 200 }
      );
    }

    if (section === "students") {
      const classId = parseId(searchParams.get("classId"));
      if (!classId) {
        return NextResponse.json({ error: "Invalid classId" }, { status: 400 });
      }

      const rows = await db
        .select({
          id: Students.id,
          name: Students.name,
          classId: Students.classId,
          guardianName: Students.guardianName,
          guardianPhone: Students.guardianPhone,
          guardianWhatsappNumber: Students.guardianWhatsappNumber,
        })
        .from(Students)
        .where(eq(Students.classId, classId))
        .orderBy(asc(Students.name));

      return NextResponse.json(
        {
          students: rows.map((row) => ({
            id: row.id,
            name: row.name,
            classId: row.classId,
            guardianName: row.guardianName,
            guardianPhone: row.guardianPhone,
            guardianWhatsappNumber: row.guardianWhatsappNumber,
          })),
        },
        { status: 200 }
      );
    }

    // default: logs
    const filters = [];
    const classId = parseId(searchParams.get("classId"));
    const studentId = parseId(searchParams.get("studentId"));
    const programId = parseId(searchParams.get("programId"));
    const callDateRaw = sanitizeText(searchParams.get("callDate") || "");
    const searchTerm = sanitizeText(searchParams.get("q") || "");
    const followUpFilter = sanitizeText(searchParams.get("followUp") || "");
    const campaignAssignmentId = parseId(searchParams.get("campaignId"));

    if (classId) {
      filters.push(eq(guardianCallReports.classId, classId));
    }
    if (studentId) {
      filters.push(eq(guardianCallReports.studentId, studentId));
    }
    if (programId) {
      filters.push(eq(guardianCallReports.programId, programId));
    }
    if (callDateRaw) {
      filters.push(eq(guardianCallReports.callDate, callDateRaw));
    }
    if (campaignAssignmentId) {
      filters.push(eq(guardianCallReports.campaignAssignmentId, campaignAssignmentId));
    }
    if (followUpFilter === "needs") {
      filters.push(eq(guardianCallReports.followUpNeeded, true));
    } else if (followUpFilter === "closed") {
      filters.push(eq(guardianCallReports.followUpNeeded, false));
    }
    if (searchTerm) {
      const pattern = `%${searchTerm}%`;
      filters.push(
        or(
          ilike(Students.name, pattern),
          ilike(guardianCallReports.guardianName, pattern),
          ilike(guardianCallReports.report, pattern),
          ilike(mriPrograms.programKey, pattern),
          ilike(mriPrograms.name, pattern)
        )
      );
    }

    const campaignOwner = alias(users, "guardian_call_campaign_owner");

    let query = db
      .select({
        id: guardianCallReports.id,
        callDate: guardianCallReports.callDate,
        report: guardianCallReports.report,
        followUpNeeded: guardianCallReports.followUpNeeded,
        followUpDate: guardianCallReports.followUpDate,
        guardianName: guardianCallReports.guardianName,
        guardianPhone: guardianCallReports.guardianPhone,
        createdAt: guardianCallReports.createdAt,
        updatedAt: guardianCallReports.updatedAt,
        classId: guardianCallReports.classId,
        studentId: guardianCallReports.studentId,
        programId: guardianCallReports.programId,
        calledById: guardianCallReports.calledById,
        className: Classes.name,
        classSection: Classes.section,
        classTrack: Classes.track,
        studentName: Students.name,
        programKey: mriPrograms.programKey,
        programName: mriPrograms.name,
        calledByName: users.name,
        campaignAssignmentId: guardianCallReports.campaignAssignmentId,
        campaignTargetLabel: mriReportAssignments.targetLabel,
        campaignScopeMeta: mriReportAssignments.scopeMeta,
        campaignStartDate: mriReportAssignments.startDate,
        campaignEndDate: mriReportAssignments.endDate,
        campaignActive: mriReportAssignments.active,
        campaignOwnerId: campaignOwner.id,
        campaignOwnerName: campaignOwner.name,
        campaignOwnerEmail: campaignOwner.email,
        campaignTemplateKey: mriReportTemplates.key,
      })
      .from(guardianCallReports)
      .leftJoin(Classes, eq(Classes.id, guardianCallReports.classId))
      .leftJoin(Students, eq(Students.id, guardianCallReports.studentId))
      .leftJoin(mriPrograms, eq(mriPrograms.id, guardianCallReports.programId))
      .leftJoin(users, eq(users.id, guardianCallReports.calledById))
      .leftJoin(mriReportAssignments, eq(mriReportAssignments.id, guardianCallReports.campaignAssignmentId))
      .leftJoin(mriReportTemplates, eq(mriReportTemplates.id, mriReportAssignments.templateId))
      .leftJoin(campaignOwner, eq(campaignOwner.id, mriReportAssignments.userId));

    if (filters.length > 0) {
      query = query.where(and(...filters));
    }

    const rows = await query
      .orderBy(desc(guardianCallReports.callDate), desc(guardianCallReports.createdAt))
      .limit(250);

    const calls = rows.map((row) => {
      const campaign = row.campaignAssignmentId
        ? formatCampaignAssignment(
            {
              id: row.campaignAssignmentId,
              targetLabel: row.campaignTargetLabel,
              startDate: row.campaignStartDate,
              endDate: row.campaignEndDate,
              active: row.campaignActive !== false,
              scopeMeta: row.campaignScopeMeta,
              userId: row.campaignOwnerId,
              userName: row.campaignOwnerName,
              userEmail: row.campaignOwnerEmail,
              classId: row.classId,
              className: row.className,
              classSection: row.classSection,
              classTrack: row.classTrack,
            },
            viewerId
          )
        : null;

      return {
        id: row.id,
        callDate: row.callDate instanceof Date ? row.callDate.toISOString().slice(0, 10) : row.callDate,
        class: {
          id: row.classId,
          name: row.className,
          section: row.classSection,
          track: row.classTrack,
        },
        student: {
          id: row.studentId,
          name: row.studentName,
        },
        guardian: {
          name: row.guardianName,
          phone: row.guardianPhone,
        },
        program: row.programId
          ? {
              id: row.programId,
              key: row.programKey,
              name: row.programName,
            }
          : null,
        report: row.report,
        followUpNeeded: row.followUpNeeded,
        followUpDate: row.followUpDate instanceof Date ? row.followUpDate.toISOString().slice(0, 10) : row.followUpDate,
        campaign,
        calledBy: {
          id: row.calledById,
          name: row.calledByName,
        },
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
        updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
      };
    });

    return NextResponse.json({ calls }, { status: 200 });
  } catch (error) {
    console.error("guardian-calls GET error", error);
    return NextResponse.json({ error: "Failed to fetch guardian calls" }, { status: 500 });
  }
}

export async function POST(req) {
  const session = await auth();
  if (!isManager(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const classId = parseId(payload?.classId);
  const studentId = parseId(payload?.studentId);
  const programId = parseId(payload?.programId);
  const callDateRaw = sanitizeText(payload?.callDate);
  const report = sanitizeText(payload?.report);
  const followUpNeeded = Boolean(payload?.followUpNeeded);
  const followUpDateRaw = sanitizeText(payload?.followUpDate);
  const guardianNameInput = sanitizeText(payload?.guardianName);
  const guardianPhoneInput = sanitizeText(payload?.guardianPhone);
  const campaignAssignmentId = parseId(payload?.campaignAssignmentId ?? payload?.campaignId);

  if (!classId || !studentId) {
    return NextResponse.json({ error: "classId and studentId are required" }, { status: 400 });
  }
  if (!callDateRaw) {
    return NextResponse.json({ error: "callDate is required" }, { status: 400 });
  }
  const callDate = new Date(callDateRaw);
  if (Number.isNaN(callDate.getTime())) {
    return NextResponse.json({ error: "Invalid callDate" }, { status: 400 });
  }
  if (!report) {
    return NextResponse.json({ error: "report is required" }, { status: 400 });
  }
  if (followUpNeeded && !followUpDateRaw) {
    return NextResponse.json({ error: "followUpDate is required when follow-up is needed" }, { status: 400 });
  }

  let followUpDate = null;
  if (followUpDateRaw) {
    const parsed = new Date(followUpDateRaw);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Invalid followUpDate" }, { status: 400 });
    }
    followUpDate = parsed;
  }

  try {
    const [student] = await db
      .select({
        id: Students.id,
        name: Students.name,
        classId: Students.classId,
        guardianName: Students.guardianName,
        guardianPhone: Students.guardianPhone,
      })
      .from(Students)
      .where(eq(Students.id, studentId))
      .limit(1);

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 400 });
    }
    if (student.classId !== classId) {
      return NextResponse.json({ error: "Student does not belong to the selected class" }, { status: 400 });
    }

    let guardianName = guardianNameInput || student.guardianName || "";
    let guardianPhone = guardianPhoneInput || student.guardianPhone || "";
    guardianName = sanitizeText(guardianName);
    guardianPhone = sanitizeText(guardianPhone);

    if (!guardianName) {
      return NextResponse.json({ error: "Guardian name missing for this student. Please update student record first." }, { status: 400 });
    }

    if (campaignAssignmentId) {
      await ensurePhoneCallTemplate();
      const [campaignAssignment] = await db
        .select({
          id: mriReportAssignments.id,
          userId: mriReportAssignments.userId,
          active: mriReportAssignments.active,
        })
        .from(mriReportAssignments)
        .innerJoin(mriReportTemplates, eq(mriReportTemplates.id, mriReportAssignments.templateId))
        .where(
          and(
            eq(mriReportAssignments.id, campaignAssignmentId),
            eq(mriReportTemplates.key, PHONE_CALL_TEMPLATE_KEY)
          )
        )
        .limit(1);

      if (!campaignAssignment) {
        return NextResponse.json({ error: "Campaign assignment not found" }, { status: 400 });
      }
    }

    await db.insert(guardianCallReports).values({
      callDate,
      classId,
      studentId,
      programId: programId || null,
      guardianName,
      guardianPhone: guardianPhone || null,
      report,
      followUpNeeded,
      followUpDate: followUpDate || null,
      campaignAssignmentId: campaignAssignmentId || null,
      calledById: session.user.id,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("guardian-calls POST error", error);
    return NextResponse.json({ error: "Failed to save guardian call" }, { status: 500 });
  }
}

export async function PATCH(req) {
  const session = await auth();
  if (!isManager(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const reportId = parseId(payload?.id);
  const appendNote = sanitizeText(payload?.appendReport);
  const followUpNeeded = payload?.followUpNeeded === undefined ? null : Boolean(payload.followUpNeeded);
  const followUpDateRaw = sanitizeText(payload?.followUpDate);

  if (!reportId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  if (appendNote && appendNote.length < 3) {
    return NextResponse.json({ error: "Follow-up note is too short" }, { status: 400 });
  }
  if (followUpNeeded === true && !followUpDateRaw) {
    return NextResponse.json({ error: "followUpDate is required when follow-up is needed" }, { status: 400 });
  }

  let followUpDate = null;
  if (followUpDateRaw) {
    const parsed = new Date(followUpDateRaw);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Invalid followUpDate" }, { status: 400 });
    }
    followUpDate = parsed;
  }

  try {
    const [existing] = await db
      .select({
        id: guardianCallReports.id,
        report: guardianCallReports.report,
      })
      .from(guardianCallReports)
      .where(eq(guardianCallReports.id, reportId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Call report not found" }, { status: 404 });
    }

    const updates = {
      updatedAt: new Date(),
    };

    if (appendNote) {
      const caller = sanitizeText(session.user?.name || "");
      const stamp = new Date().toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      });
      const header = caller ? `Follow-up on ${stamp} by ${caller}` : `Follow-up on ${stamp}`;
      updates.report = `${existing.report.trim()}\n\n[${header}]\n${appendNote}`;
    }

    const followStateProvided = followUpNeeded !== null;
    const followDateProvided = Boolean(followUpDateRaw);
    if (followStateProvided) {
      updates.followUpNeeded = followUpNeeded;
    }
    if (followStateProvided || followDateProvided) {
      updates.followUpDate = followUpNeeded === false ? null : followUpDate ?? null;
    }

    await db
      .update(guardianCallReports)
      .set(updates)
      .where(eq(guardianCallReports.id, reportId));

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("guardian-calls PATCH error", error);
    return NextResponse.json({ error: "Failed to update guardian call" }, { status: 500 });
  }
}
