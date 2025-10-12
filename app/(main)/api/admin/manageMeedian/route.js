import { NextResponse } from "next/server";
export const runtime = "nodejs"; // if you’ll upload files
export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  users,
  openCloseTimes,
  dailySlots,
  dailySlotAssignments,
  schoolCalendar,
  students,
  userMriRoles,
  dailySlotLogs,
  routineTasks,
  routineTaskLogs,
  routineTaskDailyStatuses,
  assignedTaskStatus,
  assignedTaskLogs,
  sprints,
  messages,
  generalLogs,
  memberHistory,
  notCompletedTasks,
  userOpenCloseTimes,
  dayCloseRequests,
  leaveRequests,
  MRI_ROLE_OPTIONS, // ✅ expose enum options via API
  classParentTeachers,
  Classes,
  mspCodes,
  mspCodeAssignments,
  mriFamilies,
  mriPrograms,
  mriProgramRoles,
  mriRoleDefs,
  mriRoleTasks,
  mriReportTemplates,
  mriReportAssignments,
  mriReportInstances,
  programPeriods,
  programScheduleCells,
  programScheduleDays,
  slotWeeklyRoles,
  slotRoleAssignments,
  managerSectionGrants,
  campusGateStaffLogs,
  guardianGateLogs,
  nmriTodRoleEnum,
} from "@/lib/schema";
import { eq, or, inArray, and, sql, gte, lt, desc } from "drizzle-orm";
import bcrypt from "bcrypt";
import formidable from 'formidable';
import fetch from 'node-fetch';
import { v2 as cloudinary } from 'cloudinary';
import { ensurePtAssignmentsForUser, ensurePtAssignmentsForAllClassTeachers, ensurePtTemplate } from "@/lib/mriReports";

/* ============================== GET ============================== */
export async function GET(req) {
  const session = await auth();
  const { searchParams } = new URL(req.url);
  const rawSection = searchParams.get("section") || "";
  const section = String(rawSection).trim();
  const sectionLc = section.toLowerCase();

  // Access control: allow broader read for member-safe sections
  const memberReadable = new Set([
    "slots",
    "programPeriods",
    "programScheduleCells",
    "metaPrograms",
    "mspCodes",
    "mspCodeAssignments",
    "slotsWeekly",
    "controlsShareSelf",
  ]);
  const grantableSections = new Set([
    "slots",
    "slotsWeekly",
    "slotRoleAssignments",
    "seedSlotsWeekly",
    "mspCodes",
    "mspCodeAssignments",
    "classes",
    "classTeachers",
    "team",
    "students",
    "schoolCalendar",
    "mriRoles",
    "metaFamilies",
    "metaPrograms",
    "metaProgramRoles",
    "metaRoleDefs",
    "metaRoleTasks",
  "programPeriods",
  "programScheduleCells",
  "mriReportTemplates",
  "mriReportAssignments",
  "openCloseTimes",
  "userOpenCloseTimes",
  "randomsLab",
  "campusGateStaff",
  "guardianGateLogs",
]);
  if (memberReadable.has(section)) {
    if (!session || !["admin", "team_manager", "member"].includes(session.user?.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const role = session.user?.role;
    if (role === 'admin') {
      // ok
    } else if (role === 'team_manager') {
      if (!grantableSections.has(section)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const has = await db
        .select({ id: managerSectionGrants.id })
        .from(managerSectionGrants)
        .where(and(eq(managerSectionGrants.userId, session.user.id), eq(managerSectionGrants.section, section)));
      if (!has.length) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    if (section === 'controlsShareSelf') {
      if (!session || session.user?.role !== 'team_manager') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const grants = await db
        .select({ section: managerSectionGrants.section, canWrite: managerSectionGrants.canWrite, programId: managerSectionGrants.programId })
        .from(managerSectionGrants)
        .where(eq(managerSectionGrants.userId, session.user.id));
      return NextResponse.json({ grants }, { status: 200 });
    }
    if (section === 'controlsShare') {
      if (!session || session.user?.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const grants = await db.select().from(managerSectionGrants);
      const mgrs = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.role, 'team_manager'));
      return NextResponse.json({ managers: mgrs, grants, sections: Array.from(grantableSections), programs: await (async()=>{ const progs = await db.select({ id: mriPrograms.id, name: mriPrograms.name, programKey: mriPrograms.programKey }).from(mriPrograms); return progs; })() }, { status: 200 });
    }
    if (section === "mriReportTemplates") {
      await ensurePtTemplate();
      const templateKey = searchParams.get("templateKey");
      const query = db
        .select({
          id: mriReportTemplates.id,
          key: mriReportTemplates.key,
          name: mriReportTemplates.name,
          description: mriReportTemplates.description,
          allowPreSubmit: mriReportTemplates.allowPreSubmit,
          defaultFrequency: mriReportTemplates.defaultFrequency,
          defaultDueTime: mriReportTemplates.defaultDueTime,
          instructions: mriReportTemplates.instructions,
          formSchema: mriReportTemplates.formSchema,
          meta: mriReportTemplates.meta,
          active: mriReportTemplates.active,
          createdAt: mriReportTemplates.createdAt,
          updatedAt: mriReportTemplates.updatedAt,
        })
        .from(mriReportTemplates);

      if (templateKey) {
        query.where(eq(mriReportTemplates.key, templateKey));
      }

      const templates = await query;
      return NextResponse.json({ templates }, { status: 200 });
    }

    if (section === "mriReportAssignments") {
      const templateKey = searchParams.get("templateKey");
      const templateIdParam = searchParams.get("templateId");
      const activeOnly = (searchParams.get("activeOnly") || "").toLowerCase() === "true";
      const templateId = templateIdParam ? Number(templateIdParam) : null;

      const rows = await db
        .select({
          id: mriReportAssignments.id,
          templateId: mriReportAssignments.templateId,
          templateKey: mriReportTemplates.key,
          templateName: mriReportTemplates.name,
          targetType: mriReportAssignments.targetType,
          userId: mriReportAssignments.userId,
          userName: users.name,
          userEmail: users.email,
          classId: mriReportAssignments.classId,
          className: Classes.name,
          classSection: Classes.section,
          targetLabel: mriReportAssignments.targetLabel,
          startDate: mriReportAssignments.startDate,
          endDate: mriReportAssignments.endDate,
          active: mriReportAssignments.active,
          scopeMeta: mriReportAssignments.scopeMeta,
          createdAt: mriReportAssignments.createdAt,
          updatedAt: mriReportAssignments.updatedAt,
        })
        .from(mriReportAssignments)
        .innerJoin(mriReportTemplates, eq(mriReportTemplates.id, mriReportAssignments.templateId))
        .leftJoin(users, eq(users.id, mriReportAssignments.userId))
        .leftJoin(Classes, eq(Classes.id, mriReportAssignments.classId))
        .where(
          and(
            templateId ? eq(mriReportAssignments.templateId, templateId) : sql`true`,
            templateKey ? eq(mriReportTemplates.key, templateKey) : sql`true`,
            activeOnly ? eq(mriReportAssignments.active, true) : sql`true`
          )
        )
        .orderBy(mriReportAssignments.updatedAt);

      return NextResponse.json({ assignments: rows }, { status: 200 });
    }

    if (section === "classTeachers") {
      const rows = await db
        .select({
          id: classParentTeachers.id,
          classId: classParentTeachers.classId,
          userId: classParentTeachers.userId,
          startDate: classParentTeachers.startDate,
          endDate: classParentTeachers.endDate,
          active: classParentTeachers.active,
          createdAt: classParentTeachers.createdAt,
        })
        .from(classParentTeachers);
      return NextResponse.json({ classTeachers: rows }, { status: 200 });
    }

    if (section === "classes") {
      const track = (searchParams.get("track") || "").toLowerCase();
      const rows = await db
        .select({ id: Classes.id, name: Classes.name, section: Classes.section, track: Classes.track, active: Classes.active })
        .from(Classes);

      if (!track) {
        return NextResponse.json({ classes: rows }, { status: 200 });
      }

      const isPrePrimaryName = (value) => {
        const v = String(value || "").trim().toLowerCase();
        if (!v) return false;
        if (v === "lkg" || v === "ukg") return true;
        if (v === "nur" || v === "nursery") return true;
        // allow variations that start with "nur" (e.g., "NUR", "Nursery A")
        return v.startsWith("nur");
      };
      const romanRegex = /^(i|ii|iii|iv|v|vi|vii|viii)$/i;

      const filtered = rows.filter((r) => {
        const rowTrack = (r.track || "").toLowerCase();
        if (rowTrack === track || rowTrack === "both") return true;

        const name = String(r.name || "").trim();
        const nameLower = name.toLowerCase();
        if (!rowTrack) {
          if (track === "pre_primary") {
            return isPrePrimaryName(nameLower);
          }
          if (track === "elementary") {
            return /^\d+$/.test(name) || romanRegex.test(nameLower);
          }
        }
        return false;
      });

      return NextResponse.json({ classes: filtered.length ? filtered : rows }, { status: 200 });
    }
    if (section === "team") {
      const userData = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          type: users.type,
          whatsapp_number: users.whatsapp_number,
          member_scope: users.member_scope,
          team_manager_type: users.team_manager_type,
          immediate_supervisor: users.immediate_supervisor,
          isTeacher: users.isTeacher,
        })
        .from(users);

      const mriRoleData = await db
        .select({
          userId: userMriRoles.userId,
          role: userMriRoles.role,
          active: userMriRoles.active,
        })
        .from(userMriRoles)
        .where(eq(userMriRoles.active, true));

      const userMriRolesMap = {};
      mriRoleData.forEach(({ userId, role }) => {
        if (!userMriRolesMap[userId]) userMriRolesMap[userId] = [];
        userMriRolesMap[userId].push(role);
      });

      const roleDefs = await db
        .select({ roleKey: mriRoleDefs.roleKey, name: mriRoleDefs.name, category: mriRoleDefs.category, active: mriRoleDefs.active })
        .from(mriRoleDefs);

      return NextResponse.json({ users: userData, userMriRoles: userMriRolesMap, mriRoleDefs: roleDefs }, { status: 200 });
    }

    if (section === "openCloseTimes") {
      const times = await db
        .select({
          userType: openCloseTimes.userType,
          dayOpenedAt: openCloseTimes.dayOpenTime,
          dayClosedAt: openCloseTimes.dayCloseTime,
          closingWindowStart: openCloseTimes.closingWindowStart,
          closingWindowEnd: openCloseTimes.closingWindowEnd,
        })
        .from(openCloseTimes);
      return NextResponse.json({ times }, { status: 200 });
    }

    if (section === "userOpenCloseTimes") {
      const rows = await db
        .select({
          userId: userOpenCloseTimes.userId,
          dayOpenedAt: userOpenCloseTimes.dayOpenedAt,
          dayClosedAt: userOpenCloseTimes.dayClosedAt,
          useCustomTimes: userOpenCloseTimes.useCustomTimes,
        })
        .from(userOpenCloseTimes);
      return NextResponse.json({ userOpenCloseTimes: rows }, { status: 200 });
    }

    if (section === "slots") {
      const slots = await db
        .select({
          id: dailySlots.id,
          name: dailySlots.name,
          startTime: dailySlots.startTime,
          endTime: dailySlots.endTime,
          hasSubSlots: dailySlots.hasSubSlots,
          assignedMemberId: dailySlots.assignedMemberId,
          description: dailySlots.description,
          isHighGathering: dailySlots.isHighGathering,
        })
        .from(dailySlots)
        .orderBy(dailySlots.id);

      const assignments = await db
        .select({
          id: dailySlotAssignments.id,
          slotId: dailySlotAssignments.slotId,
          memberId: dailySlotAssignments.memberId,
          dayOfWeek: dailySlotAssignments.dayOfWeek,
          role: dailySlotAssignments.role,
        })
        .from(dailySlotAssignments);

      // Keep backward compat: surface a coarse assignedMemberId if any assignment exists
      const slotsWithAssignments = slots.map((slot) => ({
        ...slot,
        assignedMemberId:
          assignments.find((a) => a.slotId === slot.id)?.memberId ||
          slot.assignedMemberId ||
          null,
      }));

      return NextResponse.json({ slots: slotsWithAssignments, slotAssignments: assignments }, { status: 200 });
    }

    if (section === "slotsWeekly") {
      // Return weekly TOD templates with member assignments per slot
      const slots = await db
        .select({ id: dailySlots.id, name: dailySlots.name, startTime: dailySlots.startTime, endTime: dailySlots.endTime, isHighGathering: dailySlots.isHighGathering })
        .from(dailySlots)
        .orderBy(dailySlots.id);
      const roles = await db
        .select({ id: slotWeeklyRoles.id, slotId: slotWeeklyRoles.slotId, weekday: slotWeeklyRoles.weekday, role: slotWeeklyRoles.role, requiredCount: slotWeeklyRoles.requiredCount, active: slotWeeklyRoles.active })
        .from(slotWeeklyRoles);
      const assigns = await db
        .select({ id: slotRoleAssignments.id, slotWeeklyRoleId: slotRoleAssignments.slotWeeklyRoleId, userId: slotRoleAssignments.userId, active: slotRoleAssignments.active, startDate: slotRoleAssignments.startDate, endDate: slotRoleAssignments.endDate })
        .from(slotRoleAssignments);
      const userMap = new Map((await db.select({ id: users.id, name: users.name, role: users.role, type: users.type }).from(users)).map(u => [u.id, u]));

      const rolesBySlot = new Map();
      roles.forEach(r => {
        if (!rolesBySlot.has(r.slotId)) rolesBySlot.set(r.slotId, []);
        rolesBySlot.get(r.slotId).push({ ...r, members: [] });
      });
      const roleIndexById = new Map();
      rolesBySlot.forEach(list => list.forEach(rr => roleIndexById.set(rr.id, rr)));
      assigns.forEach(a => {
        const rr = roleIndexById.get(a.slotWeeklyRoleId);
        if (rr) rr.members.push({ id: a.id, userId: a.userId, user: userMap.get(a.userId) || null, active: a.active, startDate: a.startDate, endDate: a.endDate });
      });
      const out = slots.map(s => ({ slot: s, roles: (rolesBySlot.get(s.id) || []).sort((a,b)=> a.weekday-b.weekday || a.role.localeCompare(b.role)) }));
      return NextResponse.json({ week: out, roles: roles, assignments: assigns }, { status: 200 });
    }

    if (section === "students") {
      const studentData = await db
        .select({
          id: students.id,
          name: students.name,
          fatherName: students.father_name,
          className: students.class_name,
          residentialStatus: students.residential_status,
        })
        .from(students)
        .orderBy(students.class_name, students.name);
      return NextResponse.json({ students: studentData }, { status: 200 });
    }

    if (section === "schoolCalendar") {
      const calendarData = await db
        .select({
          id: schoolCalendar.id,
          majorTerm: schoolCalendar.major_term,
          minorTerm: schoolCalendar.minor_term,
          startDate: schoolCalendar.start_date,
          endDate: schoolCalendar.end_date,
          name: schoolCalendar.name,
          weekNumber: schoolCalendar.week_number,
          isMajorTermBoundary: schoolCalendar.is_major_term_boundary,
        })
        .from(schoolCalendar)
        .orderBy(schoolCalendar.start_date);
      return NextResponse.json({ calendar: calendarData }, { status: 200 });
    }

    if (section === "mriRoles") {
      return NextResponse.json({ mriRoles: MRI_ROLE_OPTIONS }, { status: 200 });
    }

    if (section === "posts") {
      return NextResponse.json({ error: "Removed: use mspCodes" }, { status: 410 });
    }

    if (section === "postAssignments") {
      return NextResponse.json({ error: "Removed: use mspCodeAssignments" }, { status: 410 });
    }

    if (section === "classTeachers") {
      const rows = await db
        .select({
          id: classParentTeachers.id,
          classId: classParentTeachers.classId,
          userId: classParentTeachers.userId,
          startDate: classParentTeachers.startDate,
          endDate: classParentTeachers.endDate,
          active: classParentTeachers.active,
          createdAt: classParentTeachers.createdAt,
        })
        .from(classParentTeachers);
      return NextResponse.json({ classTeachers: rows }, { status: 200 });
    }

    if (section === "mspCodes") {
      const rows = await db
        .select({
          id: mspCodes.id,
          code: mspCodes.code,
          program: mspCodes.program,
          familyKey: mspCodes.familyKey,
          track: mspCodes.track,
          title: mspCodes.title,
          parentSlice: mspCodes.parentSlice,
          active: mspCodes.active,
          createdAt: mspCodes.createdAt,
        })
        .from(mspCodes);
      return NextResponse.json({ codes: rows }, { status: 200 });
    }

    if (section === "mspCodeAssignments") {
      const rows = await db
        .select({
          id: mspCodeAssignments.id,
          mspCodeId: mspCodeAssignments.mspCodeId,
          userId: mspCodeAssignments.userId,
          startDate: mspCodeAssignments.startDate,
          endDate: mspCodeAssignments.endDate,
          isPrimary: mspCodeAssignments.isPrimary,
          active: mspCodeAssignments.active,
          createdAt: mspCodeAssignments.createdAt,
        })
        .from(mspCodeAssignments);
      return NextResponse.json({ assignments: rows }, { status: 200 });
    }
    if (section === "metaRoleDefsList") {
      const rows = await db.select().from(mriRoleDefs);
      return NextResponse.json({ roleDefs: rows }, { status: 200 });
    }
    if (section === "metaRoleTasks") {
      const roleDefId = Number(searchParams.get("roleDefId"));
      if (!roleDefId) return NextResponse.json({ error: "roleDefId required" }, { status: 400 });
      const rows = await db
        .select({
          id: mriRoleTasks.id,
          roleDefId: mriRoleTasks.roleDefId,
          title: mriRoleTasks.title,
          description: mriRoleTasks.description,
          active: mriRoleTasks.active,
          submissables: mriRoleTasks.submissables, // Include submissables
          action: mriRoleTasks.action, // Include action
          timeSensitive: mriRoleTasks.timeSensitive,
          execAt: mriRoleTasks.execAt,
          windowStart: mriRoleTasks.windowStart,
          windowEnd: mriRoleTasks.windowEnd,
          recurrence: mriRoleTasks.recurrence,
          createdAt: mriRoleTasks.createdAt,
          updatedAt: mriRoleTasks.updatedAt,
        })
        .from(mriRoleTasks)
        .where(eq(mriRoleTasks.roleDefId, roleDefId));
      return NextResponse.json({ tasks: rows }, { status: 200 });
    }
    // Note: metaFamilies updates are handled under PATCH below.
    // Note: Updates for metaPrograms, metaProgramRoles, metaRoleDefs are handled under PATCH below.

    if (section === "metaFamilies") {
      const rows = await db.select().from(mriFamilies);
      return NextResponse.json({ families: rows }, { status: 200 });
    }
    if (section === "metaPrograms") {
      const rows = await db.select().from(mriPrograms);
      return NextResponse.json({ programs: rows }, { status: 200 });
    }
    if (section === "metaProgramRoles") {
      const rows = await db.select().from(mriProgramRoles);
      return NextResponse.json({ programRoles: rows }, { status: 200 });
    }
    if (section === "metaRoleDefs") {
      const rows = await db.select().from(mriRoleDefs);
      return NextResponse.json({ roleDefs: rows }, { status: 200 });
    }

    // Program periods (GET)
    if (section === "programPeriods") {
      const programId = Number(searchParams.get("programId"));
      const track = searchParams.get("track");
      if (!programId) {
        return NextResponse.json({ error: "Missing required param: programId" }, { status: 400 });
      }
      let q = db
        .select({
          id: programPeriods.id,
          programId: programPeriods.programId,
          track: programPeriods.track,
          periodKey: programPeriods.periodKey,
          startTime: programPeriods.startTime,
          endTime: programPeriods.endTime,
        })
        .from(programPeriods);
      q = q.where(
        track
          ? and(eq(programPeriods.programId, programId), eq(programPeriods.track, track))
          : eq(programPeriods.programId, programId)
      );
      const rows = await q;
      return NextResponse.json({ periods: rows }, { status: 200 });
    }

    // Program schedule cells (GET)
    if (section === "programScheduleCells") {
      const programId = Number(searchParams.get("programId"));
      const track = String(searchParams.get("track") || "").trim();
      if (!programId || !track) {
        return NextResponse.json({ error: "Missing required params: programId and track" }, { status: 400 });
      }
      // Join classes and msp_codes for friendly names
      const rows = await db
        .select({
          id: programScheduleCells.id,
          programId: programScheduleCells.programId,
          track: programScheduleCells.track,
          classId: programScheduleCells.classId,
          className: Classes.name,
          periodKey: programScheduleCells.periodKey,
          mspCodeId: programScheduleCells.mspCodeId,
          mspCode: mspCodes.code,
          subject: programScheduleCells.subject,
        })
        .from(programScheduleCells)
        .leftJoin(Classes, eq(Classes.id, programScheduleCells.classId))
        .leftJoin(mspCodes, eq(mspCodes.id, programScheduleCells.mspCodeId))
        .where(and(eq(programScheduleCells.programId, programId), eq(programScheduleCells.track, track)));
      return NextResponse.json({ cells: rows }, { status: 200 });
    }

    // Program schedule days (GET)
    if (section === "programScheduleDays") {
      const programId = Number(searchParams.get("programId"));
      const track = String(searchParams.get("track") || "").trim();
      if (!programId || !track) {
        return NextResponse.json({ error: "Missing required params: programId and track" }, { status: 400 });
      }
      const day = String(searchParams.get("day") || "").trim();
      let where = and(eq(programScheduleDays.programId, programId), eq(programScheduleDays.track, track));
      if (day) where = and(where, eq(programScheduleDays.dayName, day));
      const rows = await db
        .select({
          id: programScheduleDays.id,
          programId: programScheduleDays.programId,
          track: programScheduleDays.track,
          classId: programScheduleDays.classId,
          className: Classes.name,
          dayName: programScheduleDays.dayName,
          periodKey: programScheduleDays.periodKey,
          mspCodeId: programScheduleDays.mspCodeId,
          mspCode: mspCodes.code,
          subject: programScheduleDays.subject,
        })
        .from(programScheduleDays)
        .leftJoin(Classes, eq(Classes.id, programScheduleDays.classId))
        .leftJoin(mspCodes, eq(mspCodes.id, programScheduleDays.mspCodeId))
        .where(where);
      return NextResponse.json({ days: rows }, { status: 200 });
    }

    if (section === "campusGateStaff") {
      const dateParam = searchParams.get("date");
      const targetDate = dateParam ? new Date(dateParam) : new Date();
      if (Number.isNaN(targetDate.getTime())) {
        return NextResponse.json({ error: "Invalid date" }, { status: 400 });
      }
      const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const rows = await db
        .select({
          id: campusGateStaffLogs.id,
          userId: campusGateStaffLogs.userId,
          userName: users.name,
          direction: campusGateStaffLogs.direction,
          purpose: campusGateStaffLogs.purpose,
          recordedAt: campusGateStaffLogs.recordedAt,
        })
        .from(campusGateStaffLogs)
        .innerJoin(users, eq(users.id, campusGateStaffLogs.userId))
        .where(
          and(
            gte(campusGateStaffLogs.recordedAt, dayStart),
            lt(campusGateStaffLogs.recordedAt, dayEnd)
          )
        )
        .orderBy(desc(campusGateStaffLogs.recordedAt));

      const logs = rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        userName: row.userName,
        direction: row.direction,
        purpose: row.purpose,
        recordedAt: row.recordedAt instanceof Date ? row.recordedAt.toISOString() : row.recordedAt,
      }));

      return NextResponse.json({ logs }, { status: 200 });
    }

    if (section === "guardianGateLogs") {
      const dateParam = searchParams.get("date");
      const targetDate = dateParam ? new Date(dateParam) : new Date();
      if (Number.isNaN(targetDate.getTime())) {
        return NextResponse.json({ error: "Invalid date" }, { status: 400 });
      }
      const dayKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}-${String(targetDate.getDate()).padStart(2, "0")}`;

      const rows = await db
        .select({
          id: guardianGateLogs.id,
          visitDate: guardianGateLogs.visitDate,
          guardianName: guardianGateLogs.guardianName,
          studentName: guardianGateLogs.studentName,
          className: guardianGateLogs.className,
          purpose: guardianGateLogs.purpose,
          inAt: guardianGateLogs.inAt,
          outAt: guardianGateLogs.outAt,
          signature: guardianGateLogs.signature,
          createdBy: guardianGateLogs.createdBy,
          createdAt: guardianGateLogs.createdAt,
          updatedAt: guardianGateLogs.updatedAt,
          createdByName: users.name,
        })
        .from(guardianGateLogs)
        .leftJoin(users, eq(users.id, guardianGateLogs.createdBy))
        .where(eq(guardianGateLogs.visitDate, dayKey))
        .orderBy(desc(guardianGateLogs.createdAt));

      const entries = rows.map((row) => ({
        id: row.id,
        visitDate: row.visitDate instanceof Date ? row.visitDate.toISOString().slice(0, 10) : row.visitDate,
        guardianName: row.guardianName,
        studentName: row.studentName,
        className: row.className,
        purpose: row.purpose,
        inAt: row.inAt instanceof Date ? row.inAt.toISOString() : row.inAt,
        outAt: row.outAt instanceof Date ? row.outAt.toISOString() : row.outAt,
        signature: row.signature,
        createdBy: row.createdBy,
        createdByName: row.createdByName,
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
        updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
      }));

      return NextResponse.json({ entries }, { status: 200 });
    }

    // Note: DELETE handlers for mspCodes and mspCodeAssignments are implemented under DELETE, not GET.

    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  } catch (error) {
    console.error(`Error fetching ${section}:`, error);
    return NextResponse.json({ error: `Failed to fetch ${section}: ${error.message}` }, { status: 500 });
  }
}

/* ============================== POST ============================== */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const section = searchParams.get("section");

  if (section === "upload") {
    try {
      const formData = await req.formData();
      const files = formData.getAll("files");

      console.log("Received files:", files);

      const uploadResults = [];
      for (const file of files) {
        const uploadResponse = await cloudinary.uploader.upload(file.path, {
          folder: "uploads",
        });
        uploadResults.push(uploadResponse);
      }

      return NextResponse.json({ message: "Files uploaded successfully!", uploads: uploadResults });
    } catch (error) {
      console.error("Error uploading files to Cloudinary:", error);
      return NextResponse.json({ error: "Failed to upload files to Cloudinary." }, { status: 500 });
    }
  }

  try {
    const body = await req.json();
    // Team manager write-gating across admin sections (except upload and controlsShare)
    if (session.user?.role === 'team_manager') {
      const sec = String(section || '').trim();
      const allowedWrite = new Set([
        "slots","slotsWeekly","slotRoleAssignments","seedSlotsWeekly",
        "mspCodes","mspCodeAssignments",
        "classes","classTeachers","randomsLab",
        "metaFamilies","metaPrograms","metaProgramRoles","metaRoleDefs","metaRoleTasks",
        "programPeriods","programScheduleCells",
        "mriReportTemplates","mriReportAssignments",
        "openCloseTimes","userOpenCloseTimes",
        "guardianGateLogs",
      ]);
      if (sec !== 'upload' && sec !== 'controlsShare') {
        if (!allowedWrite.has(sec)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const wr = await db
          .select({ id: managerSectionGrants.id, canWrite: managerSectionGrants.canWrite })
          .from(managerSectionGrants)
          .where(and(eq(managerSectionGrants.userId, session.user.id), eq(managerSectionGrants.section, sec)));
        if (!wr.length || wr[0].canWrite !== true) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    if (section === 'controlsShare') {
      if (session.user?.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const items = Array.isArray(body?.grants) ? body.grants : [];
      let upserts = 0, deletes = 0;
      for (const g of items) {
        const userId = Number(g?.userId);
        const sec = String(g?.section || '').trim();
        const programId = g?.programId ? Number(g.programId) : null;
        if (!userId || !sec) continue;
        if (g?.remove) {
          if (programId) {
            await db.delete(managerSectionGrants).where(and(eq(managerSectionGrants.userId, userId), eq(managerSectionGrants.section, sec), eq(managerSectionGrants.programId, programId)));
          } else {
            await db.delete(managerSectionGrants).where(and(eq(managerSectionGrants.userId, userId), eq(managerSectionGrants.section, sec), eq(managerSectionGrants.programId, null)));
          }
          deletes += 1;
        } else {
          try {
            await db.insert(managerSectionGrants).values({ userId, section: sec, programId: programId || null, canWrite: g?.canWrite === false ? false : true });
          } catch {
            if (programId) {
              await db.update(managerSectionGrants).set({ canWrite: g?.canWrite === false ? false : true }).where(and(eq(managerSectionGrants.userId, userId), eq(managerSectionGrants.section, sec), eq(managerSectionGrants.programId, programId)));
            } else {
              await db.update(managerSectionGrants).set({ canWrite: g?.canWrite === false ? false : true }).where(and(eq(managerSectionGrants.userId, userId), eq(managerSectionGrants.section, sec), eq(managerSectionGrants.programId, null)));
            }
          }
          upserts += 1;
        }
      }
      return NextResponse.json({ upserts, deletes }, { status: 200 });
    }
    if (section === "guardianGateLogs") {
      const visitDateRaw = typeof body?.visitDate === "string" ? body.visitDate.trim() : "";
      const guardianName = typeof body?.guardianName === "string" ? body.guardianName.trim() : "";
      const studentName = typeof body?.studentName === "string" ? body.studentName.trim() : "";
      const className = typeof body?.className === "string" ? body.className.trim() : "";
      const purpose = typeof body?.purpose === "string" ? body.purpose.trim() : "";
      const signature = typeof body?.signature === "string" ? body.signature.trim() : "";

      if (!visitDateRaw) {
        return NextResponse.json({ error: "visitDate is required" }, { status: 400 });
      }
      const visitDate = new Date(visitDateRaw);
      if (Number.isNaN(visitDate.getTime())) {
        return NextResponse.json({ error: "Invalid visitDate" }, { status: 400 });
      }
      if (!guardianName || !studentName || !className || !purpose) {
        return NextResponse.json({ error: "guardianName, studentName, className, and purpose are required" }, { status: 400 });
      }

      const parseTime = (raw) => {
        if (!raw || (typeof raw === "string" && !raw.trim())) return null;
        const value = typeof raw === "string" ? raw.trim() : String(raw);
        if (!value) return null;
        // Accept ISO strings or time-only values
        const isoCandidate = value.includes("T") ? value : `${visitDateRaw}T${value}`;
        const parsed = new Date(isoCandidate);
        if (!Number.isNaN(parsed.getTime())) return parsed;
        const parts = value.split(":").map((part) => Number(part));
        if (parts.length >= 2 && parts.every((num) => Number.isFinite(num))) {
          return new Date(
            visitDate.getFullYear(),
            visitDate.getMonth(),
            visitDate.getDate(),
            parts[0],
            parts[1],
            parts[2] || 0,
            0
          );
        }
        return null;
      };

      const inAt = parseTime(body?.inTime ?? body?.in_at);
      const outAt = parseTime(body?.outTime ?? body?.out_at);

      const now = new Date();

      const [entry] = await db
        .insert(guardianGateLogs)
        .values({
          visitDate: visitDateRaw,
          guardianName,
          studentName,
          className,
          purpose,
          inAt,
          outAt,
          signature: signature || null,
          createdBy: Number(session.user.id),
          createdAt: now,
          updatedAt: now,
        })
        .returning({
          id: guardianGateLogs.id,
          visitDate: guardianGateLogs.visitDate,
          guardianName: guardianGateLogs.guardianName,
          studentName: guardianGateLogs.studentName,
          className: guardianGateLogs.className,
          purpose: guardianGateLogs.purpose,
          inAt: guardianGateLogs.inAt,
          outAt: guardianGateLogs.outAt,
          signature: guardianGateLogs.signature,
          createdBy: guardianGateLogs.createdBy,
          createdAt: guardianGateLogs.createdAt,
          updatedAt: guardianGateLogs.updatedAt,
        });

      return NextResponse.json(
        {
          entry: {
            ...entry,
            visitDate:
              entry.visitDate instanceof Date
                ? entry.visitDate.toISOString().slice(0, 10)
                : entry.visitDate,
            inAt: entry.inAt instanceof Date ? entry.inAt.toISOString() : entry.inAt,
            outAt: entry.outAt instanceof Date ? entry.outAt.toISOString() : entry.outAt,
            createdAt: entry.createdAt instanceof Date ? entry.createdAt.toISOString() : entry.createdAt,
            updatedAt: entry.updatedAt instanceof Date ? entry.updatedAt.toISOString() : entry.updatedAt,
          },
        },
        { status: 200 }
      );
    }
    if (section === "mriReportAssignments") {
      await ensurePtTemplate();
      const action = typeof body?.action === "string" ? body.action.trim() : "";
      if (action === "syncClassTeachers") {
        const targetDate = body?.targetDate;
        const result = await ensurePtAssignmentsForAllClassTeachers(targetDate);
        return NextResponse.json(result, { status: 200 });
      }

      const normalizeDate = (value) => {
        if (!value) return null;
        if (value instanceof Date && !Number.isNaN(value.getTime())) {
          return value.toISOString().slice(0, 10);
        }
        const str = String(value).trim();
        if (!str) return null;
        const parsed = new Date(str);
        if (Number.isNaN(parsed.getTime())) return null;
        return parsed.toISOString().slice(0, 10);
      };

      let templateId = body?.templateId ? Number(body.templateId) : null;
      const templateKey = typeof body?.templateKey === "string" ? body.templateKey.trim() : "";
      if (!templateId) {
        const lookupKey = templateKey || "pt_daily_report";
        const [templateRow] = await db
          .select({ id: mriReportTemplates.id })
          .from(mriReportTemplates)
          .where(eq(mriReportTemplates.key, lookupKey))
          .limit(1);
        if (!templateRow) {
          return NextResponse.json({ error: "Template not found" }, { status: 404 });
        }
        templateId = templateRow.id;
      }

      const userId = body?.userId ? Number(body.userId) : null;
      if (!userId) {
        return NextResponse.json({ error: "userId is required" }, { status: 400 });
      }

      const [userRow] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
      if (!userRow) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const classId = body?.classId ? Number(body.classId) : null;
      let classRow = null;
      if (classId) {
        [classRow] = await db
          .select({ id: Classes.id, name: Classes.name, section: Classes.section, track: Classes.track })
          .from(Classes)
          .where(eq(Classes.id, classId))
          .limit(1);
        if (!classRow) {
          return NextResponse.json({ error: "Class not found" }, { status: 404 });
        }
      }

      const assistantId = body?.assistantUserId ? Number(body.assistantUserId) : null;
      if (assistantId && Number.isFinite(assistantId)) {
        const [assistantRow] = await db.select({ id: users.id }).from(users).where(eq(users.id, assistantId)).limit(1);
        if (!assistantRow) {
          return NextResponse.json({ error: "Assistant user not found" }, { status: 404 });
        }
      }

      let scopeMeta =
        typeof body?.scopeMeta === "object" && body.scopeMeta !== null
          ? { ...body.scopeMeta }
          : classRow
          ? {
              class: {
                id: classRow.id,
                name: classRow.name,
                section: classRow.section,
                track: classRow.track,
              },
            }
          : {};

      if (assistantId && Number.isFinite(assistantId)) {
        scopeMeta = { ...scopeMeta, assistantUserId: assistantId };
      } else if (scopeMeta && typeof scopeMeta === "object" && "assistantUserId" in scopeMeta) {
        const next = { ...scopeMeta };
        delete next.assistantUserId;
        scopeMeta = next;
      }

      const startDate = normalizeDate(body?.startDate) ?? new Date().toISOString().slice(0, 10);
      const endDate = normalizeDate(body?.endDate);
      const active = body?.active === false ? false : true;
      const valueTargetType = typeof body?.targetType === "string" ? body.targetType.trim() : "user";
      const targetLabel =
        typeof body?.targetLabel === "string"
          ? body.targetLabel.trim()
          : classRow
          ? `Class ${classRow.name}${classRow.section ? ` ${classRow.section}` : ""}`
          : null;

      const now = new Date();
      const insertValues = {
        templateId,
        targetType: valueTargetType || "user",
        userId,
        classId: classRow ? classRow.id : null,
        targetLabel: targetLabel || null,
        startDate,
        endDate,
        scopeMeta,
        active,
        createdBy: Number(session.user.id),
        updatedAt: now,
      };

      const [assignment] = await db
        .insert(mriReportAssignments)
        .values(insertValues)
        .onConflictDoUpdate({
          target: [mriReportAssignments.templateId, mriReportAssignments.userId, mriReportAssignments.classId],
          set: {
            targetType: insertValues.targetType,
            targetLabel: insertValues.targetLabel,
            startDate: insertValues.startDate,
            endDate: insertValues.endDate,
            scopeMeta: insertValues.scopeMeta,
            active: insertValues.active,
            updatedAt: now,
          },
        })
        .returning({
          id: mriReportAssignments.id,
        });

      if (!assignment) {
        return NextResponse.json({ error: "Failed to upsert assignment" }, { status: 500 });
      }

      const [row] = await db
        .select({
          id: mriReportAssignments.id,
          templateId: mriReportAssignments.templateId,
          templateKey: mriReportTemplates.key,
          templateName: mriReportTemplates.name,
          targetType: mriReportAssignments.targetType,
          userId: mriReportAssignments.userId,
          userName: users.name,
          userEmail: users.email,
          classId: mriReportAssignments.classId,
          className: Classes.name,
          classSection: Classes.section,
          targetLabel: mriReportAssignments.targetLabel,
          startDate: mriReportAssignments.startDate,
          endDate: mriReportAssignments.endDate,
          active: mriReportAssignments.active,
          scopeMeta: mriReportAssignments.scopeMeta,
          createdAt: mriReportAssignments.createdAt,
          updatedAt: mriReportAssignments.updatedAt,
        })
        .from(mriReportAssignments)
        .innerJoin(mriReportTemplates, eq(mriReportTemplates.id, mriReportAssignments.templateId))
        .leftJoin(users, eq(users.id, mriReportAssignments.userId))
        .leftJoin(Classes, eq(Classes.id, mriReportAssignments.classId))
        .where(eq(mriReportAssignments.id, assignment.id))
        .limit(1);

      await ensurePtAssignmentsForUser(userId, startDate);

      return NextResponse.json({ assignment: row }, { status: 200 });
    }
    if (section === "classTeachers") {
      const normalizeId = (value) => {
        if (typeof value === "number" && Number.isFinite(value)) return value;
        if (typeof value === "string") {
          const trimmed = value.trim();
          if (!trimmed) return null;
          const parsed = Number(trimmed);
          if (Number.isFinite(parsed)) return parsed;
        }
        return null;
      };

      let classId = normalizeId(body?.classId);
      let userId = normalizeId(body?.userId);

      if (!classId && typeof body?.className === "string" && body.className.trim()) {
        const [lookup] = await db
          .select({ id: Classes.id })
          .from(Classes)
          .where(eq(Classes.name, body.className.trim()))
          .limit(1);
        if (lookup) classId = lookup.id;
      }
      if (!userId && typeof body?.userEmail === "string" && body.userEmail.trim()) {
        const [lookup] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, body.userEmail.trim().toLowerCase()))
          .limit(1);
        if (lookup) userId = lookup.id;
      }

      if (!Number.isInteger(classId) || classId <= 0 || !Number.isInteger(userId) || userId <= 0) {
        const details = {
          classIdResolved: classId,
          userIdResolved: userId,
          classIdRaw: body?.classId,
          userIdRaw: body?.userId,
          className: body?.className,
          userEmail: body?.userEmail,
        };
        console.warn("classTeachers.assign invalid payload", details);
        return NextResponse.json(
          {
            error: `Invalid selection (classId=${details.classIdRaw ?? details.classIdResolved}, userId=${details.userIdRaw ?? details.userIdResolved})`,
            details,
          },
          { status: 400 }
        );
      }

      const [klass] = await db
        .select({ id: Classes.id })
        .from(Classes)
        .where(eq(Classes.id, classId))
        .limit(1);
      if (!klass) {
        return NextResponse.json({ error: "Class not found" }, { status: 404 });
      }

      const [teacher] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!teacher) {
        return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
      }

      const normalizeDate = (value) => {
        if (!value) return null;
        if (value instanceof Date && !Number.isNaN(value.getTime())) {
          return value.toISOString().slice(0, 10);
        }
        const str = String(value).trim();
        if (!str) return null;
        const parsed = new Date(str);
        if (Number.isNaN(parsed.getTime())) return null;
        return parsed.toISOString().slice(0, 10);
      };

      const startDate = normalizeDate(body?.startDate) ?? new Date().toISOString().slice(0, 10);

      await db
        .update(classParentTeachers)
        .set({ active: false, endDate: startDate })
        .where(and(eq(classParentTeachers.classId, classId), eq(classParentTeachers.active, true)));

      const [row] = await db
        .insert(classParentTeachers)
        .values({
          classId,
          userId,
          startDate,
          endDate: null,
          active: true,
        })
        .returning({
          id: classParentTeachers.id,
          classId: classParentTeachers.classId,
          userId: classParentTeachers.userId,
          startDate: classParentTeachers.startDate,
          endDate: classParentTeachers.endDate,
          active: classParentTeachers.active,
          createdAt: classParentTeachers.createdAt,
        });

      await db
        .insert(userMriRoles)
        .values({ userId, role: "pt_moderator", active: true })
        .onConflictDoUpdate({
          target: [userMriRoles.userId, userMriRoles.role],
          set: { active: true },
        });

      return NextResponse.json({ classTeacher: row, message: "Class teacher assigned" }, { status: 201 });
    }
    if (section === "seedSlotsWeekly") {
      // Seed templates for all slots and weekdays
      const slots = await db.select({ id: dailySlots.id, isHighGathering: dailySlots.isHighGathering }).from(dailySlots);
      let created = 0;
      for (const s of slots) {
        for (let wd = 0; wd <= 6; wd++) {
          const baseRoles = ["nmri_moderator", "nmri_guide_english"]; // discipline added for crowd slots
          const rolesToAdd = s.isHighGathering ? [...baseRoles, "nmri_guide_discipline"] : baseRoles;
          for (const role of rolesToAdd) {
            // Check if exists
            const existing = await db
              .select({ id: slotWeeklyRoles.id })
              .from(slotWeeklyRoles)
              .where(and(eq(slotWeeklyRoles.slotId, s.id), eq(slotWeeklyRoles.weekday, wd), eq(slotWeeklyRoles.role, role)));
            if (!existing.length) {
              await db.insert(slotWeeklyRoles).values({ slotId: s.id, weekday: wd, role, requiredCount: 1, active: true });
              created += 1;
            }
          }
        }
      }
      return NextResponse.json({ seeded: created }, { status: 200 });
    }

    if (section === "slotsWeekly") {
      // Upsert array of weekly role templates: [{ slotId, weekday, role, requiredCount, active }]
      const items = Array.isArray(body) ? body : Array.isArray(body?.upserts) ? body.upserts : [];
      if (!items.length) return NextResponse.json({ error: "Expected array of templates" }, { status: 400 });
      let upserts = 0;
      for (const it of items) {
        const slotId = Number(it?.slotId);
        const weekday = Number(it?.weekday);
        const role = String(it?.role || '').trim();
        if (!(slotId && Number.isInteger(weekday) && weekday >= 0 && weekday <= 6 && role)) continue;
        const requiredCount = it?.requiredCount != null ? Math.max(1, Number(it.requiredCount)) : 1;
        const active = it?.active == null ? true : !!it.active;
        const existing = await db
          .select({ id: slotWeeklyRoles.id })
          .from(slotWeeklyRoles)
          .where(and(eq(slotWeeklyRoles.slotId, slotId), eq(slotWeeklyRoles.weekday, weekday), eq(slotWeeklyRoles.role, role)));
        if (existing.length) {
          await db.update(slotWeeklyRoles)
            .set({ requiredCount, active })
            .where(eq(slotWeeklyRoles.id, existing[0].id));
        } else {
          await db.insert(slotWeeklyRoles).values({ slotId, weekday, role, requiredCount, active });
        }
        upserts += 1;
      }
      return NextResponse.json({ upserts }, { status: 200 });
    }

    if (section === "slotRoleAssignments") {
      // Create/update an assignment row
      const { id, slotWeeklyRoleId, userId, startDate = null, endDate = null, active = true } = body || {};
      const setObj = {
        slotWeeklyRoleId: Number(slotWeeklyRoleId),
        userId: Number(userId),
        startDate: startDate ? String(startDate) : null,
        endDate: endDate ? String(endDate) : null,
        active: !!active,
      };
      if (id) {
        await db.update(slotRoleAssignments).set(setObj).where(eq(slotRoleAssignments.id, Number(id)));
        const [row] = await db
          .select({ id: slotRoleAssignments.id, slotWeeklyRoleId: slotRoleAssignments.slotWeeklyRoleId, userId: slotRoleAssignments.userId, startDate: slotRoleAssignments.startDate, endDate: slotRoleAssignments.endDate, active: slotRoleAssignments.active, createdAt: slotRoleAssignments.createdAt })
          .from(slotRoleAssignments)
          .where(eq(slotRoleAssignments.id, Number(id)));
        return NextResponse.json({ assignment: row, message: "Assignment updated" }, { status: 200 });
      }
      if (!(setObj.slotWeeklyRoleId && setObj.userId)) {
        return NextResponse.json({ error: "slotWeeklyRoleId and userId required" }, { status: 400 });
      }
      // Prevent duplicate user assignment to same role row
      const dup = await db
        .select({ id: slotRoleAssignments.id })
        .from(slotRoleAssignments)
        .where(and(eq(slotRoleAssignments.slotWeeklyRoleId, setObj.slotWeeklyRoleId), eq(slotRoleAssignments.userId, setObj.userId)));
      if (dup.length) {
        await db.update(slotRoleAssignments).set(setObj).where(eq(slotRoleAssignments.id, dup[0].id));
        const [row] = await db
          .select({ id: slotRoleAssignments.id, slotWeeklyRoleId: slotRoleAssignments.slotWeeklyRoleId, userId: slotRoleAssignments.userId, startDate: slotRoleAssignments.startDate, endDate: slotRoleAssignments.endDate, active: slotRoleAssignments.active, createdAt: slotRoleAssignments.createdAt })
          .from(slotRoleAssignments)
          .where(eq(slotRoleAssignments.id, dup[0].id));
        return NextResponse.json({ assignment: row, message: "Assignment updated" }, { status: 200 });
      }
      const [row] = await db
        .insert(slotRoleAssignments)
        .values(setObj)
        .returning({ id: slotRoleAssignments.id, slotWeeklyRoleId: slotRoleAssignments.slotWeeklyRoleId, userId: slotRoleAssignments.userId, startDate: slotRoleAssignments.startDate, endDate: slotRoleAssignments.endDate, active: slotRoleAssignments.active, createdAt: slotRoleAssignments.createdAt });
      return NextResponse.json({ assignment: row, message: "Assignment created" }, { status: 201 });
    }
    if (section === "classesNormalize") {
      try {
        const rows = await db.select().from(Classes);
        const byKey = new Map(); // key: name|track
        rows.forEach(r => {
          const k = `${String(r.name)}|${(r.track||'').toLowerCase()}`;
          byKey.set(k, r);
        });

        const romanMap = new Map([
          ['I','1'], ['II','2'], ['III','3'], ['IV','4'],
          ['V','5'], ['VI','6'], ['VII','7'], ['VIII','8'],
        ]);
        const toOps = [];

        for (const r of rows) {
          const name = String(r.name || '').trim();
          const upper = name.toUpperCase();
          // Normalize NUR -> Nursery (pre_primary)
          if (upper === 'NUR') {
            const k = `Nursery|pre_primary`;
            if (!byKey.has(k)) {
              toOps.push(db.insert(Classes).values({ name: 'Nursery', track: 'pre_primary', section: r.section || null, active: true }));
            }
            toOps.push(db.update(Classes).set({ active: false }).where(eq(Classes.id, r.id)));
            continue;
          }
          if (upper === 'LKG' || upper === 'UKG') {
            toOps.push(db.update(Classes).set({ track: 'pre_primary', active: true }).where(eq(Classes.id, r.id)));
            continue;
          }
          if (romanMap.has(upper)) {
            // Keep Roman numerals as valid Elementary class names; ensure track set and active
            toOps.push(db.update(Classes).set({ track: 'elementary', active: true }).where(eq(Classes.id, r.id)));
            continue;
          }
          // If numeric and track missing, mark as elementary
          if (/^\d+$/.test(name) && (!r.track || r.track.toLowerCase() !== 'elementary')) {
            toOps.push(db.update(Classes).set({ track: 'elementary', active: true }).where(eq(Classes.id, r.id)));
          }
          // If Nursery/LKG/UKG and track missing, mark as pre_primary
          if ((name === 'Nursery' || name === 'LKG' || name === 'UKG') && (!r.track || r.track.toLowerCase() !== 'pre_primary')) {
            toOps.push(db.update(Classes).set({ track: 'pre_primary', active: true }).where(eq(Classes.id, r.id)));
          }
        }

        for (const op of toOps) { await op; }
        return NextResponse.json({ ok: true, updated: toOps.length });
      } catch (e) {
        return NextResponse.json({ error: e.message || 'Normalize failed' }, { status: 500 });
      }
    }
    if (section === "classes") {
      try {
        const remove = body?.remove === true;
        const idValue = body?.id ? Number(body.id) : null;
        let name = typeof body?.name === "string" ? String(body.name).trim() : "";
        const oldName = body?.oldName ? String(body.oldName).trim() : null;
        let track = typeof body?.track === "string" ? String(body.track).trim() : "";
        const oldTrack = body?.oldTrack ? String(body.oldTrack).trim() : null;
        const sectionVal = body?.section ? String(body.section).trim() : null;
        const active = typeof body?.active === "boolean" ? body.active : true;

        if (remove) {
          let klass = null;
          if (idValue) {
            const rows = await db
              .select({ id: Classes.id, name: Classes.name, track: Classes.track })
              .from(Classes)
              .where(eq(Classes.id, idValue))
              .limit(1);
            klass = rows[0];
          } else {
            const lookupName = name || oldName;
            const lookupTrack = track || oldTrack;
            if (!lookupName || !lookupTrack) {
              return NextResponse.json({ error: "name or id required to delete class" }, { status: 400 });
            }
            const rows = await db
              .select({ id: Classes.id, name: Classes.name, track: Classes.track })
              .from(Classes)
              .where(and(eq(Classes.name, lookupName), eq(Classes.track, lookupTrack)))
              .limit(1);
            klass = rows[0];
          }

          if (!klass) {
            return NextResponse.json({ error: "Class not found" }, { status: 404 });
          }

          const studentRows = await db
            .select({ count: sql`COUNT(*)::int` })
            .from(students)
            .where(eq(students.classId, klass.id));
          const studentCount = Number(studentRows?.[0]?.count ?? 0);
          if (studentCount > 0) {
            return NextResponse.json(
              {
                error: `Cannot delete ${klass.name}. ${studentCount} student${studentCount === 1 ? "" : "s"} still linked to this class. Reassign them first.`,
              },
              { status: 409 }
            );
          }

          await db.delete(programScheduleDays).where(eq(programScheduleDays.classId, klass.id));
          await db.delete(programScheduleCells).where(eq(programScheduleCells.classId, klass.id));
          await db.delete(classParentTeachers).where(eq(classParentTeachers.classId, klass.id));
          await db.delete(Classes).where(eq(Classes.id, klass.id));

          return NextResponse.json({ ok: true, deleted: true, id: klass.id, name: klass.name, track: klass.track }, { status: 200 });
        }

        if (!track) track = oldTrack || track;
        if (!track) return NextResponse.json({ error: "track required" }, { status: 400 });

        if (!name) name = oldName || name;
        if (!name) return NextResponse.json({ error: "name or oldName required" }, { status: 400 });

        const isPre = track === "pre_primary";
        const isEle = track === "elementary";
        if (isPre) {
          const allowed = new Set(["Nursery", "LKG", "UKG"]);
          if (name && !allowed.has(name)) return NextResponse.json({ error: "Pre-Primary name must be Nursery/LKG/UKG" }, { status: 400 });
        }
        if (isEle) {
          const isNumeric = /^\d+$/.test(name);
          const isRoman = /^(i|ii|iii|iv|v|vi|vii|viii)$/i.test(name);
          if (!(isNumeric || isRoman)) {
            return NextResponse.json({ error: "Elementary name must be numeric (1..8) or Roman (I..VIII)" }, { status: 400 });
          }
        }

        if (idValue) {
          await db
            .update(Classes)
            .set({ name, section: sectionVal ?? null, active, track })
            .where(eq(Classes.id, idValue));
          return NextResponse.json({ ok: true, updated: true });
        }

        if (oldName || oldTrack) {
          await db
            .update(Classes)
            .set({ name, section: sectionVal ?? null, active, track })
            .where(and(eq(Classes.name, oldName || name), eq(Classes.track, oldTrack || track)));
          return NextResponse.json({ ok: true, renamed: true });
        }

        try {
          await db.insert(Classes).values({ name, track, section: sectionVal ?? null, active });
        } catch (e) {
          await db
            .update(Classes)
            .set({ section: sectionVal ?? null, active })
            .where(and(eq(Classes.name, name), eq(Classes.track, track)));
        }
        return NextResponse.json({ ok: true });
      } catch (e) {
        return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
      }
    }
    // Create a role definition (used by admin meta-roles page and ensuring built-in roleKey)
    if (section === "metaRoleDefs") {
      const { roleKey, name, category = "rmri", subCategory = null, active = true } = body || {};
      if (!roleKey || !name) {
        return NextResponse.json({ error: "roleKey and name required" }, { status: 400 });
      }
      const normalizedKey = String(roleKey).trim();
      const existing = await db.select().from(mriRoleDefs).where(eq(mriRoleDefs.roleKey, normalizedKey));
      if (existing.length) {
        return NextResponse.json({ roleDef: existing[0], message: "Role already exists" }, { status: 200 });
      }
      const normalizedCategory = String(category).trim();
      const normalizedSubCategory = subCategory != null && String(subCategory).trim() !== ""
        ? String(subCategory).trim()
        : null;
      const [row] = await db
        .insert(mriRoleDefs)
        .values({
          roleKey: normalizedKey,
          name: String(name).trim(),
          category: normalizedCategory,
          subCategory: normalizedSubCategory,
          active: !!active,
        })
        .returning();
      return NextResponse.json({ roleDef: row, message: "Role created" }, { status: 201 });
    }

    if (section === "schoolCalendar") {
      const { majorTerm, minorTerm, startDate, endDate, name, weekNumber, isMajorTermBoundary } = body;
      if (!majorTerm || !minorTerm || !startDate || !endDate || !name) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }

      const [entry] = await db
        .insert(schoolCalendar)
        .values({
          major_term: majorTerm,
          minor_term: minorTerm,
          start_date: new Date(startDate),
          end_date: new Date(endDate),
          name,
          week_number: weekNumber ?? null,
          is_major_term_boundary: isMajorTermBoundary || false,
        })
        .returning({
          id: schoolCalendar.id,
          majorTerm: schoolCalendar.major_term,
          minorTerm: schoolCalendar.minor_term,
          startDate: schoolCalendar.start_date,
          endDate: schoolCalendar.end_date,
          name: schoolCalendar.name,
          weekNumber: schoolCalendar.week_number,
          isMajorTermBoundary: schoolCalendar.is_major_term_boundary,
        });

      return NextResponse.json({ entry, message: "Calendar entry added successfully" }, { status: 201 });
    }

    // Program schedule days (POST)
    if (section === "programScheduleDays") {
      const { programId, track, days = [], cells = [] } = body || {};
      if (!programId || !track || !Array.isArray(cells)) {
        return NextResponse.json({ error: "programId, track and cells[] required" }, { status: 400 });
      }
      const daySet = new Set((Array.isArray(days) ? days : []).map((d) => String(d)));
      // If days not provided, derive from cells
      if (daySet.size === 0) {
        cells.forEach((c) => c?.dayName && daySet.add(String(c.dayName)));
      }
      if (daySet.size === 0) {
        return NextResponse.json({ error: "days[] or dayName in cells is required" }, { status: 400 });
      }
      const dayList = Array.from(daySet);

      // Remove existing rows for the provided days to allow idempotent replace
      await db
        .delete(programScheduleDays)
        .where(
          and(
            eq(programScheduleDays.programId, Number(programId)),
            eq(programScheduleDays.track, String(track)),
            inArray(programScheduleDays.dayName, dayList)
          )
        );

      // Insert new rows
      const rows = cells
        .filter((c) => c && c.classId && c.dayName && c.periodKey)
        .map((c) => ({
          programId: Number(programId),
          track: String(track),
          classId: Number(c.classId),
          dayName: String(c.dayName),
          periodKey: String(c.periodKey),
          mspCodeId: c.mspCodeId ? Number(c.mspCodeId) : null,
          subject: c.subject ? String(c.subject) : null,
          active: true,
        }));
      if (!rows.length) return NextResponse.json({ error: "No valid cells to insert" }, { status: 400 });
      await db.insert(programScheduleDays).values(rows);
      return NextResponse.json({ inserted: rows.length }, { status: 201 });
    }

    // Create/Update Role Tasks
    if (section === "metaRoleTasks") {
      // Support batch updates shape from UI
      if (Array.isArray(body?.updates)) {
        let updated = 0;
        for (const u of body.updates) {
          const id = Number(u?.id);
          if (!id) continue;
          const setObj = {};
          if (u.title !== undefined) setObj.title = String(u.title).trim();
          if (u.description !== undefined) setObj.description = u.description ? String(u.description).trim() : null;
          if (u.action !== undefined) setObj.action = u.action ? String(u.action).trim() : null;
          if (u.active !== undefined) setObj.active = !!u.active;
          if (u.timeSensitive !== undefined) setObj.timeSensitive = !!u.timeSensitive;
          if (u.execAt !== undefined) setObj.execAt = u.execAt ? new Date(u.execAt) : null;
          if (u.windowStart !== undefined) setObj.windowStart = u.windowStart ? new Date(u.windowStart) : null;
          if (u.windowEnd !== undefined) setObj.windowEnd = u.windowEnd ? new Date(u.windowEnd) : null;
          if (u.recurrence !== undefined) {
            const v = String(u.recurrence || '').toLowerCase();
            setObj.recurrence = ['daily','weekly','monthly','none',''].includes(v) ? (v==='none'?'':v) : null;
          }
          if (u.submissables !== undefined) {
            const raw = u.submissables;
            let arr = null;
            if (Array.isArray(raw)) arr = raw.map((s) => String(s).trim()).filter(Boolean);
            else if (typeof raw === 'string') arr = raw.split(/\n|,/).map((s) => s.trim()).filter(Boolean);
            else if (raw && typeof raw === 'object') arr = Object.values(raw).map((s) => String(s).trim()).filter(Boolean);
            setObj.submissables = arr && arr.length ? JSON.stringify(arr) : null;
          }
          if (Object.keys(setObj).length === 0) continue;
          await db.update(mriRoleTasks).set(setObj).where(eq(mriRoleTasks.id, id));
          updated += 1;
        }
        return NextResponse.json({ updated }, { status: 200 });
      }

      const { roleDefId, title, description, active, submissables, action, timeSensitive = false, execAt = null, windowStart = null, windowEnd = null, recurrence = null } = body || {};
      if (!roleDefId || !title) {
        return NextResponse.json({ error: "roleDefId and title are required" }, { status: 400 });
      }

      // Validate roleDefId exists
      const roleExists = await db
        .select({ id: mriRoleDefs.id })
        .from(mriRoleDefs)
        .where(eq(mriRoleDefs.id, roleDefId));
      if (!roleExists.length) {
        return NextResponse.json({ error: "Invalid roleDefId: Role definition does not exist" }, { status: 400 });
      }

      // Normalize submissables to JSON text
      const normalizeSubs = (raw) => {
        if (!raw) return null;
        if (Array.isArray(raw)) return raw.map((s) => String(s).trim()).filter(Boolean);
        if (typeof raw === 'string') return raw.split(/\n|,/).map((s) => s.trim()).filter(Boolean);
        if (typeof raw === 'object') return Object.values(raw).map((s) => String(s).trim()).filter(Boolean);
        return null;
      };
      const subsArr = normalizeSubs(submissables);

      // Insert or update the task
      const [row] = await db
        .insert(mriRoleTasks)
        .values({
          roleDefId: Number(roleDefId),
          title: String(title).trim(),
          description: description ? String(description).trim() : null,
          active: !!active,
          submissables: subsArr && subsArr.length ? JSON.stringify(subsArr) : null,
          action: action ? String(action).trim() : null,
          timeSensitive: !!timeSensitive,
          execAt: execAt ? new Date(execAt) : null,
          windowStart: windowStart ? new Date(windowStart) : null,
          windowEnd: windowEnd ? new Date(windowEnd) : null,
          recurrence: recurrence ? String(recurrence).toLowerCase() : null,
        })
        .onConflictDoUpdate({
          target: [mriRoleTasks.roleDefId, mriRoleTasks.title],
          set: {
            description: description ? String(description).trim() : null,
            active: !!active,
            submissables: subsArr && subsArr.length ? JSON.stringify(subsArr) : null,
            action: action ? String(action).trim() : null,
            timeSensitive: !!timeSensitive,
            execAt: execAt ? new Date(execAt) : null,
            windowStart: windowStart ? new Date(windowStart) : null,
            windowEnd: windowEnd ? new Date(windowEnd) : null,
            recurrence: recurrence ? String(recurrence).toLowerCase() : null,
            updatedAt: new Date(),
          },
        })
        .returning({
          id: mriRoleTasks.id,
          roleDefId: mriRoleTasks.roleDefId,
          title: mriRoleTasks.title,
          description: mriRoleTasks.description,
          active: mriRoleTasks.active,
          submissables: mriRoleTasks.submissables,
          action: mriRoleTasks.action,
          timeSensitive: mriRoleTasks.timeSensitive,
          execAt: mriRoleTasks.execAt,
          windowStart: mriRoleTasks.windowStart,
          windowEnd: mriRoleTasks.windowEnd,
          recurrence: mriRoleTasks.recurrence,
          createdAt: mriRoleTasks.createdAt,
          updatedAt: mriRoleTasks.updatedAt,
        });

      return NextResponse.json({ task: row, message: "Role task created or updated successfully" }, { status: 201 });
    }

    // Create MSP Code
    if (section === "mspCodes") {
      const { code, program = "MSP", familyKey = "", track = "", title = "", parentSlice = "", active = true } = body || {};
      if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });
      const [row] = await db.insert(mspCodes).values({ code: String(code).trim(), program: String(program).trim(), familyKey: String(familyKey).trim(), track: String(track).trim(), title: String(title).trim() || null, parentSlice: String(parentSlice).trim() || null, active: !!active }).returning({ id: mspCodes.id, code: mspCodes.code, program: mspCodes.program, familyKey: mspCodes.familyKey, track: mspCodes.track, title: mspCodes.title, parentSlice: mspCodes.parentSlice, active: mspCodes.active, createdAt: mspCodes.createdAt });
      return NextResponse.json({ code: row, message: "MSP code created" }, { status: 201 });
    }

    // Create MSP Code Assignment
    if (section === "mspCodeAssignments") {
      const { mspCodeId, userId, startDate = null, endDate = null, isPrimary = true, active = true } = body || {};
      if (!mspCodeId || !userId) return NextResponse.json({ error: "mspCodeId and userId required" }, { status: 400 });
      const [row] = await db.insert(mspCodeAssignments).values({ mspCodeId: Number(mspCodeId), userId: Number(userId), startDate: startDate ? String(startDate) : null, endDate: endDate ? String(endDate) : null, isPrimary: !!isPrimary, active: !!active }).returning({ id: mspCodeAssignments.id, mspCodeId: mspCodeAssignments.mspCodeId, userId: mspCodeAssignments.userId, startDate: mspCodeAssignments.startDate, endDate: mspCodeAssignments.endDate, isPrimary: mspCodeAssignments.isPrimary, active: mspCodeAssignments.active, createdAt: mspCodeAssignments.createdAt });
      return NextResponse.json({ assignment: row, message: "Assignment created" }, { status: 201 });
    }

    // Create MRI Family (used by mri-families admin UI)
    if (section === "metaFamilies") {
      const { key, name, active = true } = body || {};
      if (!key || !name) return NextResponse.json({ error: "key and name required" }, { status: 400 });
      const normalizedKey = String(key).trim();
      // Prevent duplicates by key
      const existing = await db.select().from(mriFamilies).where(eq(mriFamilies.key, normalizedKey));
      if (existing.length) {
        return NextResponse.json({ family: existing[0], message: "Family already exists" }, { status: 200 });
      }
      const [row] = await db.insert(mriFamilies).values({ key: normalizedKey, name: String(name).trim(), active: !!active }).returning();
      return NextResponse.json({ family: row, message: "Family created" }, { status: 201 });
    }

    if (section === "slots") {
      const { name, startTime, endTime, hasSubSlots = false, assignedMemberId = null, description = null } = body || {};
      if (!name || !startTime || !endTime) {
        return NextResponse.json({ error: "Missing required fields: name, startTime, endTime" }, { status: 400 });
      }
      const [row] = await db
        .insert(dailySlots)
        .values({
          name: String(name).trim(),
          startTime,
          endTime,
          hasSubSlots: !!hasSubSlots,
          assignedMemberId: assignedMemberId ? Number(assignedMemberId) : null,
          description: description ? String(description) : null,
        })
        .returning({
          id: dailySlots.id,
          name: dailySlots.name,
          startTime: dailySlots.startTime,
          endTime: dailySlots.endTime,
          hasSubSlots: dailySlots.hasSubSlots,
          assignedMemberId: dailySlots.assignedMemberId,
          description: dailySlots.description,
          createdAt: dailySlots.createdAt,
        });
      return NextResponse.json({ slot: row, message: "Slot created" }, { status: 201 });
    }

    if (section === "programPeriods") {
      const { programId, periods } = body || {};
      if (!programId || !Array.isArray(periods)) return NextResponse.json({ error: "programId and periods[] required" }, { status: 400 });
      // Replace existing rows for the programId + track keys provided
      const tracks = Array.from(new Set(periods.map((p) => p.track)));
      for (const tr of tracks) {
        await db.delete(programPeriods).where(and(eq(programPeriods.programId, Number(programId)), eq(programPeriods.track, tr)));
      }
      for (const p of periods) {
        const { track, periodKey, startTime, endTime } = p || {};
        if (!track || !periodKey || !startTime || !endTime) return NextResponse.json({ error: `Invalid period row for ${periodKey}` }, { status: 400 });
        await db.insert(programPeriods).values({ programId: Number(programId), track, periodKey, startTime, endTime });
      }
      return NextResponse.json({ message: "Program periods saved" }, { status: 200 });
    }

    if (section === "programScheduleCells") {
      const { programId, track, cells } = body || {};
      if (!programId || !track || !Array.isArray(cells)) return NextResponse.json({ error: "programId, track, cells[] required" }, { status: 400 });
      // Clear existing for programId+track
      await db.delete(programScheduleCells).where(and(eq(programScheduleCells.programId, Number(programId)), eq(programScheduleCells.track, track)));
      // Insert cells
      for (const c of cells) {
        const { classId, periodKey, mspCodeId, subject } = c || {};
        if (!classId || !periodKey) return NextResponse.json({ error: `Invalid cell row for period ${periodKey}` }, { status: 400 });
        await db.insert(programScheduleCells).values({ programId: Number(programId), track, classId: Number(classId), periodKey, mspCodeId: mspCodeId ? Number(mspCodeId) : null, subject: subject || null });
      }
      return NextResponse.json({ message: "Program schedule cells saved" }, { status: 200 });
    }

    // Save program SOP (selfSchedulerDraft / selfSchedulerSeeds etc.)
    if (section === "programSOP") {
      const { programId, sop } = body || {};
      if (!programId || typeof sop !== "object") return NextResponse.json({ error: "programId and sop required" }, { status: 400 });
      // Ensure program exists
      const prog = await db.select().from(mriPrograms).where(eq(mriPrograms.id, Number(programId)));
      if (!prog || !prog.length) return NextResponse.json({ error: "program not found" }, { status: 404 });
      await db.update(mriPrograms).set({ sop }).where(eq(mriPrograms.id, Number(programId)));
      return NextResponse.json({ programId: Number(programId), sop }, { status: 200 });
    }

    // If no branch matched, return a helpful error instead of falling through
    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  } catch (error) {
    console.error(`Error in POST handler:`, error);
    return NextResponse.json({ error: `Failed to process POST: ${error.message}` }, { status: 500 });
  }
}

/* ============================== PATCH ============================== */
export async function PATCH(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const section = String(searchParams.get("section") || "").trim();

  try {
    const body = await req.json();
    // Team manager write-gating across admin sections
    if (session.user?.role === 'team_manager') {
      const allowedWrite = new Set([
        "team","bulkAssignMriRole",
        "slots","slotsWeekly","slotRoleAssignments",
        "mspCodes","mspCodeAssignments",
        "classes","classTeachers","mriReportAssignments",
        "metaFamilies","metaPrograms","metaProgramRoles","metaRoleDefs","metaRoleTasks",
        "programPeriods","programScheduleCells",
        "openCloseTimes","userOpenCloseTimes",
      ]);
      if (!allowedWrite.has(section)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const wr = await db
        .select({ id: managerSectionGrants.id, canWrite: managerSectionGrants.canWrite })
        .from(managerSectionGrants)
        .where(and(eq(managerSectionGrants.userId, session.user.id), eq(managerSectionGrants.section, section)));
      if (!wr.length || wr[0].canWrite !== true) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Batch update Users (team management)
    if (section === "team") {
      const updates = Array.isArray(body.updates) ? body.updates : [];
      if (!updates.length) return NextResponse.json({ error: "updates[] required" }, { status: 400 });
      let updated = 0;
      for (const u of updates) {
        const id = Number(u.id);
        if (!id) continue;
        const setObj = {};
        if (u.name !== undefined) setObj.name = String(u.name);
        if (u.email !== undefined) setObj.email = String(u.email);
        if (u.role !== undefined) setObj.role = String(u.role);
        if (u.team_manager_type !== undefined) setObj.team_manager_type = u.team_manager_type ? String(u.team_manager_type) : null;
        if (u.type !== undefined) setObj.type = String(u.type);
        if (u.member_scope !== undefined) setObj.member_scope = String(u.member_scope);
        if (u.whatsapp_number !== undefined) setObj.whatsapp_number = u.whatsapp_number ? String(u.whatsapp_number) : null;
        if (u.immediate_supervisor !== undefined) setObj.immediate_supervisor = u.immediate_supervisor ? Number(u.immediate_supervisor) : null;
        if (u.isTeacher !== undefined) setObj.isTeacher = u.isTeacher === null ? null : !!u.isTeacher;
        if (u.password !== undefined && String(u.password).trim() !== "") {
          setObj.password = await bcrypt.hash(String(u.password), 10);
        }
        if (Object.keys(setObj).length) {
          await db.update(users).set(setObj).where(eq(users.id, id));
          updated += 1;
        }

        // MRI roles: allow multiple assignments across users while keeping this user's list in sync
        if (Array.isArray(u.mriRoles)) {
          const desired = Array.from(new Set(u.mriRoles.map((role) => String(role).trim()).filter(Boolean)));

          // Mark all existing roles for this user inactive before re-applying the desired list
          await db
            .update(userMriRoles)
            .set({ active: false })
            .where(eq(userMriRoles.userId, id));

          for (const roleKey of desired) {
            try {
              await db.insert(userMriRoles).values({ userId: id, role: roleKey, active: true });
            } catch {
              await db
                .update(userMriRoles)
                .set({ active: true })
                .where(and(eq(userMriRoles.userId, id), eq(userMriRoles.role, roleKey)));
            }
          }
        }
      }
      return NextResponse.json({ updated }, { status: 200 });
    }

    // Bulk assign one MRI role to multiple users
    if (section === "bulkAssignMriRole") {
      const role = String(body.role || "").trim();
      const userIds = Array.isArray(body.userIds) ? body.userIds.map((x) => Number(x)).filter(Boolean) : [];
      if (!role) return NextResponse.json({ error: "role required" }, { status: 400 });
      let isValidRole = MRI_ROLE_OPTIONS.includes(role);
      if (!isValidRole) {
        const existingRole = await db
          .select({ id: mriRoleDefs.id })
          .from(mriRoleDefs)
          .where(eq(mriRoleDefs.roleKey, role))
          .limit(1);
        isValidRole = existingRole.length > 0;
      }
      if (!isValidRole) return NextResponse.json({ error: "invalid role" }, { status: 400 });
      if (!userIds.length) return NextResponse.json({ error: "userIds[] required" }, { status: 400 });

      // Upsert for provided users without touching existing assignments for others
      for (const uid of userIds) {
        try {
          await db.insert(userMriRoles).values({ userId: uid, role, active: true });
        } catch {
          await db
            .update(userMriRoles)
            .set({ active: true })
            .where(and(eq(userMriRoles.userId, uid), eq(userMriRoles.role, role)));
        }
      }

      return NextResponse.json({ role, assignedTo: userIds.length }, { status: 200 });
    }

    // Batch update per-user open/close times
    if (section === "userOpenCloseTimes") {
      const updates = Array.isArray(body.updates) ? body.updates : [];
      if (!updates.length) return NextResponse.json({ error: "updates[] required" }, { status: 400 });
      let upserts = 0, deletes = 0;
      for (const u of updates) {
        const userId = Number(u.userId);
        if (!userId) continue;
        const useCustom = !!u.useCustomTimes;
        if (!useCustom) {
          // Remove override row if exists
          await db.delete(userOpenCloseTimes).where(eq(userOpenCloseTimes.userId, userId));
          deletes += 1;
        } else {
          const dayOpenedAt = String(u.dayOpenedAt || "").trim();
          const dayClosedAt = String(u.dayClosedAt || "").trim();
          if (!dayOpenedAt || !dayClosedAt) continue; // require both when custom
          try {
            await db.insert(userOpenCloseTimes).values({ userId, dayOpenedAt, dayClosedAt, useCustomTimes: true });
          } catch {
            await db
              .update(userOpenCloseTimes)
              .set({ dayOpenedAt, dayClosedAt, useCustomTimes: true })
              .where(eq(userOpenCloseTimes.userId, userId));
          }
          upserts += 1;
        }
      }
      return NextResponse.json({ upserts, deletes }, { status: 200 });
    }

    // Batch update MSP Codes
    if (section === "mspCodes") {
      const updates = Array.isArray(body.updates) ? body.updates : [];
      if (!updates.length) return NextResponse.json({ error: "updates[] required" }, { status: 400 });
      let updated = 0;
      for (const u of updates) {
        const id = Number(u.id);
        if (!id) continue;
        const allowed = ["code", "program", "familyKey", "track", "title", "parentSlice", "active"];
        const setObj = {};
        for (const k of allowed) if (u[k] !== undefined) setObj[k] = u[k];
        if (Object.keys(setObj).length === 0) continue;
        await db.update(mspCodes).set(setObj).where(eq(mspCodes.id, id));
        updated += 1;
      }
      return NextResponse.json({ updated }, { status: 200 });
    }

    // Batch update MSP Code Assignments
    if (section === "mspCodeAssignments") {
      const updates = Array.isArray(body.updates) ? body.updates : [];
      if (!updates.length) return NextResponse.json({ error: "updates[] required" }, { status: 400 });
      let updated = 0;
      for (const u of updates) {
        const id = Number(u.id);
        if (!id) continue;
        const allowed = ["mspCodeId", "userId", "startDate", "endDate", "isPrimary", "active"];
        const setObj = {};
        for (const k of allowed) if (u[k] !== undefined) setObj[k] = u[k];
        if (Object.keys(setObj).length === 0) continue;
        await db.update(mspCodeAssignments).set(setObj).where(eq(mspCodeAssignments.id, id));
        updated += 1;
      }
      return NextResponse.json({ updated }, { status: 200 });
    }

    if (section === "mriReportAssignments") {
      const updatesRaw = Array.isArray(body?.updates)
        ? body.updates
        : Array.isArray(body)
        ? body
        : body?.id
        ? [body]
        : [];
      if (!updatesRaw.length) return NextResponse.json({ error: "updates[] required" }, { status: 400 });

      const normalizeDate = (value) => {
        if (value === undefined) return undefined;
        if (value === null || value === "") return null;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return null;
        return parsed.toISOString().slice(0, 10);
      };

      let updated = 0;
      for (const u of updatesRaw) {
        const id = Number(u?.id);
        if (!id) continue;
        const setObj = {};
        if (u.targetLabel !== undefined) {
          const label = String(u.targetLabel || "").trim();
          setObj.targetLabel = label || null;
        }
        if (u.startDate !== undefined) {
          const normalized = normalizeDate(u.startDate);
          setObj.startDate = normalized;
        }
        if (u.endDate !== undefined) {
          const normalized = normalizeDate(u.endDate);
          setObj.endDate = normalized;
        }
        if (u.active !== undefined) {
          setObj.active = !!u.active;
        }
        if (u.assistantUserId !== undefined) {
          const assistantIdRaw = u.assistantUserId;
          const assistantId = assistantIdRaw === null || assistantIdRaw === ""
            ? null
            : Number(assistantIdRaw);
          if (assistantId && Number.isFinite(assistantId)) {
            const [assistantRow] = await db
              .select({ id: users.id })
              .from(users)
              .where(eq(users.id, assistantId))
              .limit(1);
            if (!assistantRow) {
              return NextResponse.json({ error: `Assistant user ${assistantId} not found` }, { status: 404 });
            }
          }
          const [existing] = await db
            .select({ scopeMeta: mriReportAssignments.scopeMeta })
            .from(mriReportAssignments)
            .where(eq(mriReportAssignments.id, id))
            .limit(1);
          const currentMeta = existing?.scopeMeta && typeof existing.scopeMeta === "object"
            ? { ...existing.scopeMeta }
            : {};
          if (assistantId && Number.isFinite(assistantId)) {
            currentMeta.assistantUserId = assistantId;
          } else {
            delete currentMeta.assistantUserId;
          }
          setObj.scopeMeta = currentMeta;
        }
        if (Object.keys(setObj).length === 0) continue;
        setObj.updatedAt = new Date();
        await db.update(mriReportAssignments).set(setObj).where(eq(mriReportAssignments.id, id));
        updated += 1;
      }
      return NextResponse.json({ updated }, { status: 200 });
    }

    if (section === "slotRoleAssignments") {
      const updates = Array.isArray(body) ? body : Array.isArray(body.updates) ? body.updates : [];
      if (!updates.length) return NextResponse.json({ error: "updates[] required" }, { status: 400 });
      let updated = 0;
      for (const u of updates) {
        const id = Number(u?.id);
        if (!id) continue;
        const setObj = {};
        if (u.userId !== undefined) setObj.userId = Number(u.userId) || null;
        if (u.active !== undefined) setObj.active = !!u.active;
        if (u.startDate !== undefined) setObj.startDate = u.startDate ? String(u.startDate) : null;
        if (u.endDate !== undefined) setObj.endDate = u.endDate ? String(u.endDate) : null;
        if (Object.keys(setObj).length === 0) continue;
        await db.update(slotRoleAssignments).set(setObj).where(eq(slotRoleAssignments.id, id));
        updated += 1;
      }
      return NextResponse.json({ updated }, { status: 200 });
    }

    // Batch update Daily Slots (meta editor)
    if (section === "slots") {
      const updates = Array.isArray(body.updates) ? body.updates : [];
      if (!updates.length) return NextResponse.json({ error: "updates[] required" }, { status: 400 });
      let updated = 0;
      for (const u of updates) {
        const id = Number(u.slotId || u.id);
        if (!id) continue;
        const setObj = {};
        if (u.name !== undefined) setObj.name = String(u.name).trim();
        if (u.startTime !== undefined) setObj.startTime = u.startTime;
        if (u.endTime !== undefined) setObj.endTime = u.endTime;
        if (u.hasSubSlots !== undefined) setObj.hasSubSlots = !!u.hasSubSlots;
        if (u.assignedMemberId !== undefined) setObj.assignedMemberId = u.assignedMemberId ? Number(u.assignedMemberId) : null;
        if (u.isHighGathering !== undefined) setObj.isHighGathering = !!u.isHighGathering;
        if (u.description !== undefined) setObj.description = u.description ? String(u.description) : null;
        if (Object.keys(setObj).length === 0) continue;
        await db.update(dailySlots).set(setObj).where(eq(dailySlots.id, id));
        updated += 1;
      }
      return NextResponse.json({ updated }, { status: 200 });
    }

    if (section === "metaRoleDefs") {
      const updates = Array.isArray(body.updates) ? body.updates : [];
      if (!updates.length) return NextResponse.json({ error: "updates[] required" }, { status: 400 });
      let updated = 0;
      for (const u of updates) {
        const id = Number(u.id);
        if (!id) continue;
        const setObj = {};
        if (u.name !== undefined) setObj.name = String(u.name);
        if (u.category !== undefined) setObj.category = String(u.category);
        if (u.subCategory !== undefined) {
          const sc = String(u.subCategory || "").trim();
          setObj.subCategory = sc ? sc.toUpperCase() : null;
        }
        if (u.active !== undefined) setObj.active = !!u.active;
        if (Object.keys(setObj).length === 0) continue;
        await db.update(mriRoleDefs).set(setObj).where(eq(mriRoleDefs.id, id));
        updated += 1;
      }
      return NextResponse.json({ updated }, { status: 200 });
    }

    // Other PATCH sections can be added here (metaFamilies, metaPrograms, etc.)
    if (section === "metaFamilies") {
      const updates = Array.isArray(body.updates) ? body.updates : [];
      if (!updates.length) return NextResponse.json({ error: "updates[] required" }, { status: 400 });
      let updated = 0;
      for (const u of updates) {
        const id = Number(u.id);
        if (!id) continue;
        const setObj = {};
        if (u.active !== undefined) setObj.active = !!u.active;
        if (u.name !== undefined) setObj.name = String(u.name);
        if (Object.keys(setObj).length === 0) continue;
        await db.update(mriFamilies).set(setObj).where(eq(mriFamilies.id, id));
        updated += 1;
      }
      return NextResponse.json({ updated }, { status: 200 });
    }
    return NextResponse.json({ error: "Invalid section for PATCH" }, { status: 400 });
  } catch (error) {
    console.error(`Error in PATCH handler:`, error);
    return NextResponse.json({ error: `Failed to process PATCH: ${error.message}` }, { status: 500 });
  }
}

// Delete handler: support deleting metaFamilies and other deletions
export async function DELETE(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const section = String(searchParams.get("section") || "").trim();
    const body = await req.json().catch(() => ({}));

    // Team manager write-gating across admin sections
    if (session.user?.role === 'team_manager') {
      const allowedWrite = new Set([
        "slots","mspCodes","mspCodeAssignments","metaFamilies","mriReportAssignments","guardianGateLogs",
      ]);
      if (!allowedWrite.has(section)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const wr = await db
        .select({ id: managerSectionGrants.id, canWrite: managerSectionGrants.canWrite })
        .from(managerSectionGrants)
        .where(and(eq(managerSectionGrants.userId, session.user.id), eq(managerSectionGrants.section, section)));
      if (!wr.length || wr[0].canWrite !== true) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (section === "metaFamilies") {
      const id = Number(body.id);
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      await db.delete(mriFamilies).where(eq(mriFamilies.id, id));
      return NextResponse.json({ deleted: 1 }, { status: 200 });
    }

    if (section === "team") {
      const userId = Number(body.userId);
      if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
      await db.delete(users).where(eq(users.id, userId));
      // Also clean user-specific overrides and roles (foreign keys may cascade, but be explicit if not)
      try { await db.delete(userOpenCloseTimes).where(eq(userOpenCloseTimes.userId, userId)); } catch {}
      try { await db.delete(userMriRoles).where(eq(userMriRoles.userId, userId)); } catch {}
      return NextResponse.json({ deleted: 1 }, { status: 200 });
    }

    if (section === "slots") {
      const slotId = Number(body.slotId);
      if (!slotId) return NextResponse.json({ error: "slotId required" }, { status: 400 });
      // Clean related rows (weekly roles + assignments, legacy assignments)
      try {
        const roleIds = (await db.select({ id: slotWeeklyRoles.id }).from(slotWeeklyRoles).where(eq(slotWeeklyRoles.slotId, slotId))).map(r => r.id);
        if (roleIds.length) {
          await db.delete(slotRoleAssignments).where(inArray(slotRoleAssignments.slotWeeklyRoleId, roleIds));
        }
        await db.delete(slotWeeklyRoles).where(eq(slotWeeklyRoles.slotId, slotId));
      } catch {}
      try { await db.delete(dailySlotAssignments).where(eq(dailySlotAssignments.slotId, slotId)); } catch {}
      await db.delete(dailySlots).where(eq(dailySlots.id, slotId));
      return NextResponse.json({ deleted: 1 }, { status: 200 });
    }

    if (section === "mriReportAssignments") {
      const id = Number(body?.id);
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      await db.delete(mriReportAssignments).where(eq(mriReportAssignments.id, id));
      return NextResponse.json({ deleted: 1 }, { status: 200 });
    }

    if (section === "guardianGateLogs") {
      const idParam = body?.id ?? searchParams.get("id");
      const id = Number(idParam);
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      await db.delete(guardianGateLogs).where(eq(guardianGateLogs.id, id));
      return NextResponse.json({ deleted: 1 }, { status: 200 });
    }

    // default
    return NextResponse.json({ error: "Invalid section for DELETE" }, { status: 400 });
  } catch (error) {
    console.error(`Error in DELETE handler:`, error);
    return NextResponse.json({ error: `Failed to process DELETE: ${error.message}` }, { status: 500 });
  }
}
