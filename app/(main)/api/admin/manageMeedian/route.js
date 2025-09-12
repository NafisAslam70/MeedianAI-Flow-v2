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
  programPeriods,
  programScheduleCells,
  programScheduleDays,
} from "@/lib/schema";
import { eq, or, inArray, and, ne } from "drizzle-orm";
import bcrypt from "bcrypt";
import formidable from 'formidable';
import fetch from 'node-fetch';
import { v2 as cloudinary } from 'cloudinary';

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
  ]);
  if (memberReadable.has(section)) {
    if (!session || !["admin", "team_manager", "member"].includes(session.user?.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    if (section === "classes") {
      const track = (searchParams.get("track") || "").toLowerCase();
      const rows = await db
        .select({ id: Classes.id, name: Classes.name, section: Classes.section, track: Classes.track, active: Classes.active })
        .from(Classes);
      let filtered = rows;
      if (track) {
        filtered = rows.filter(r => ((r.track || "").toLowerCase() === track) || !r.track);
        if (filtered.length === 0) filtered = rows; // fallback to avoid empty UI if DB not backfilled yet
      }
      return NextResponse.json({ classes: filtered }, { status: 200 });
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

      return NextResponse.json({ users: userData, userMriRoles: userMriRolesMap }, { status: 200 });
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
        const name = String(body?.name || "").trim();
        const oldName = body?.oldName ? String(body.oldName).trim() : null;
        const oldTrack = body?.oldTrack ? String(body.oldTrack).trim() : null;
        const track = String(body?.track || "").trim();
        const sectionVal = body?.section ? String(body.section).trim() : null;
        const active = typeof body?.active === 'boolean' ? body.active : true;
        if (!track) return NextResponse.json({ error: "track required" }, { status: 400 });
        if (!name && !oldName) return NextResponse.json({ error: "name or oldName required" }, { status: 400 });
        // Validate name by track
        const isPre = track === 'pre_primary';
        const isEle = track === 'elementary';
        if (isPre) {
          const allowed = new Set(['Nursery','LKG','UKG']);
          if (name && !allowed.has(name)) return NextResponse.json({ error: "Pre-Primary name must be Nursery/LKG/UKG" }, { status: 400 });
        }
        if (isEle) {
          const isNumeric = name ? /^\d+$/.test(name) : false;
          const isRoman = name ? /^(i|ii|iii|iv|v|vi|vii|viii)$/i.test(name) : false;
          if (name && !(isNumeric || isRoman)) {
            return NextResponse.json({ error: "Elementary name must be numeric (1..8) or Roman (I..VIII)" }, { status: 400 });
          }
        }
        // Rename if oldName provided
        if (oldName || oldTrack) {
          await db.update(Classes)
            .set({ name, section: sectionVal ?? null, active, track })
            .where(and(eq(Classes.name, oldName || name), eq(Classes.track, oldTrack || track)));
          return NextResponse.json({ ok: true, renamed: true });
        }
        // Upsert by (name, track)
        try {
          await db.insert(Classes).values({ name, track, section: sectionVal ?? null, active });
        } catch (e) {
          await db.update(Classes)
            .set({ section: sectionVal ?? null, active })
            .where(and(eq(Classes.name, name), eq(Classes.track, track)));
        }
        return NextResponse.json({ ok: true });
      } catch (e) {
        return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
      }
    }
    // Create a role definition (used by admin meta-roles page and ensuring built-in roleKey)
    if (section === "metaRoleDefs") {
      const { roleKey, name, category = "rmri", active = true } = body || {};
      if (!roleKey || !name) {
        return NextResponse.json({ error: "roleKey and name required" }, { status: 400 });
      }
      const normalizedKey = String(roleKey).trim();
      const existing = await db.select().from(mriRoleDefs).where(eq(mriRoleDefs.roleKey, normalizedKey));
      if (existing.length) {
        return NextResponse.json({ roleDef: existing[0], message: "Role already exists" }, { status: 200 });
      }
      const [row] = await db
        .insert(mriRoleDefs)
        .values({ roleKey: normalizedKey, name: String(name).trim(), category: String(category).trim(), active: !!active })
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

      const { roleDefId, title, description, active, submissables, action, timeSensitive = false, execAt = null, windowStart = null, windowEnd = null } = body || {};
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
      const { name, startTime, endTime, hasSubSlots = false, assignedMemberId = null } = body || {};
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
        })
        .returning({
          id: dailySlots.id,
          name: dailySlots.name,
          startTime: dailySlots.startTime,
          endTime: dailySlots.endTime,
          hasSubSlots: dailySlots.hasSubSlots,
          assignedMemberId: dailySlots.assignedMemberId,
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
        if (u.password !== undefined && String(u.password).trim() !== "") {
          setObj.password = await bcrypt.hash(String(u.password), 10);
        }
        if (Object.keys(setObj).length) {
          await db.update(users).set(setObj).where(eq(users.id, id));
          updated += 1;
        }

        // MRI roles: allow multiple; ensure exclusivity per role across users
        if (Array.isArray(u.mriRoles)) {
          const desired = new Set(u.mriRoles.map(String));
          // Deactivate same role on other users
          for (const r of desired) {
            await db
              .update(userMriRoles)
              .set({ active: false })
              .where(and(eq(userMriRoles.role, r), eq(userMriRoles.active, true), ne(userMriRoles.userId, id)));
            // Upsert current user role active
            try {
              await db.insert(userMriRoles).values({ userId: id, role: r, active: true });
            } catch {
              await db
                .update(userMriRoles)
                .set({ active: true })
                .where(and(eq(userMriRoles.userId, id), eq(userMriRoles.role, r)));
            }
          }
          // Deactivate roles not desired
          await db
            .update(userMriRoles)
            .set({ active: false })
            .where(and(eq(userMriRoles.userId, id), eq(userMriRoles.active, true)));
          // Reactivate only desired ones (done above); ensure others remain false
          for (const r of desired) {
            await db
              .update(userMriRoles)
              .set({ active: true })
              .where(and(eq(userMriRoles.userId, id), eq(userMriRoles.role, r)));
          }
        }
      }
      return NextResponse.json({ updated }, { status: 200 });
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

    // default
    return NextResponse.json({ error: "Invalid section for DELETE" }, { status: 400 });
  } catch (error) {
    console.error(`Error in DELETE handler:`, error);
    return NextResponse.json({ error: `Failed to process DELETE: ${error.message}` }, { status: 500 });
  }
}
