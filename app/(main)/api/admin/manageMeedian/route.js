import { NextResponse } from "next/server";
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
  programPeriods,
  programScheduleCells,
} from "@/lib/schema";
import { eq, or, inArray, and } from "drizzle-orm";
import bcrypt from "bcrypt";

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
          slotId: dailySlotAssignments.slotId,
          memberId: dailySlotAssignments.memberId,
        })
        .from(dailySlotAssignments);

      const slotsWithAssignments = slots.map((slot) => ({
        ...slot,
        assignedMemberId:
          assignments.find((a) => a.slotId === slot.id)?.memberId ||
          slot.assignedMemberId ||
          null,
      }));

      return NextResponse.json({ slots: slotsWithAssignments }, { status: 200 });
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

    // Note: DELETE handlers for mspCodes and mspCodeAssignments are implemented under DELETE, not GET.

    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  } catch (error) {
    console.error(`Error fetching ${section}:`, error);
    return NextResponse.json({ error: `Failed to fetch ${section}: ${error.message}` }, { status: 500 });
  }
}

/* ============================== POST ============================== */
export async function POST(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const section = searchParams.get("section");

  try {
    const body = await req.json();

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

    // Seed helper for MSP (requires existing MSP codes and Classes rows)
    if (section === "seedMSPSchedule") {
      const { programId, track, customPeriods, customMatrix } = body || {};
      if (!programId || !track) return NextResponse.json({ error: "programId and track required" }, { status: 400 });
      // Period templates
      const prePeriods = [
        ["P1", "07:25", "08:00"], ["P2", "08:00", "08:30"], ["P3", "08:30", "09:00"], ["P4", "09:00", "09:30"],
        ["P5", "10:00", "10:30"], ["P6", "10:30", "11:00"], ["P7", "11:00", "11:30"], ["P8", "11:30", "12:00"],
      ];
      const elePeriods = [
        ["P1", "07:35", "08:10"], ["P2", "08:10", "08:40"], ["P3", "08:40", "09:10"], ["P4", "09:10", "09:40"],
        ["P5", "10:00", "10:30"], ["P6", "10:30", "11:00"], ["P7", "11:00", "11:30"], ["P8", "11:30", "12:00"],
      ];
      let periodTriples = track === "pre_primary" ? prePeriods : elePeriods;
      if (Array.isArray(customPeriods) && customPeriods.length) {
        // Accept [[key,start,end]] or [{periodKey,startTime,endTime}]
        if (Array.isArray(customPeriods[0])) {
          periodTriples = customPeriods;
        } else if (typeof customPeriods[0] === "object") {
          periodTriples = customPeriods.map((p) => [p.periodKey, (p.startTime || "").slice(0,5), (p.endTime || "").slice(0,5)]);
        }
      }
      const periods = periodTriples.map(([k, s, e]) => ({ track, periodKey: k, startTime: String(s).includes(":") ? s + (String(s).length === 5 ? ":00" : "") : `${s}:00`, endTime: String(e).includes(":") ? e + (String(e).length === 5 ? ":00" : "") : `${e}:00` }));
      await db.delete(programPeriods).where(and(eq(programPeriods.programId, Number(programId)), eq(programPeriods.track, track)));
      for (const p of periods) await db.insert(programPeriods).values({ programId: Number(programId), ...p });

      // Class names map to ids; ensure classes exist
      const classNames = track === "pre_primary" ? ["Nursery", "LKG", "UKG"] : ["1", "2", "3", "4", "5", "6", "7"];
      const classRows = await db.select().from(Classes);
      const nameToId = new Map(classRows.map((c) => [String(c.name), c.id]));
      for (const name of classNames) {
        if (!nameToId.has(name)) {
          const [row] = await db.insert(Classes).values({ name }).returning();
          nameToId.set(name, row.id);
        }
      }

      // Helper to resolve msp_codes by code
      const codeRows = await db.select().from(mspCodes);
      const codeToId = new Map(codeRows.map((r) => [String(r.code), r.id]));
      const get = (code) => (code && codeToId.get(code)) || null;

      // Build cells from provided matrices (subjects inline)
      const cells = [];
      if (track === "pre_primary") {
        const matrix = customMatrix || {
          Nursery: {
            P1: ["PGL1", "English"], P2: ["PGL1", "Eng-Writing"], P3: ["PGL1", "GK"], P4: ["PRL1", "Hindi"],
            P5: ["PRL2", "Hindi-Writing"], P6: ["PRL1", "Urdu"], P7: ["PGL3", "Math"], P8: ["PGL1", "Table Math"],
          },
          LKG: {
            P1: ["PRL1", "Hindi"], P2: ["PRL1", "Hindi"], P3: ["PGL2", "GK"], P4: ["PGL2", "Math"],
            P5: ["PGL2", "Math"], P6: ["PGL1", "English"], P7: ["PRL1", "Urdu"], P8: [null, null],
          },
          UKG: {
            P1: ["PGL2", "Math"], P2: ["PGL2", "Math"], P3: ["PGL3", "GK"], P4: ["PGL3", "English"],
            P5: ["PGL3", "English"], P6: ["PRL2", "Hindi"], P7: ["PRL2", "Hindi"], P8: ["PRL2", "Urdu"],
          },
        };
        for (const [className, row] of Object.entries(matrix)) {
          const classId = nameToId.get(className);
          for (const [periodKey, [code, subject]] of Object.entries(row)) {
            cells.push({ programId: Number(programId), track, classId, periodKey, mspCodeId: get(code), subject });
          }
        }
      } else {
        // Elementary matrix (finalized): ESLC1=English; S.St split ESLC2(1)/(2); EHO2(1)=Computer; EHO2(2)=GK
        const matrix = customMatrix || {
          "1": { P1: ["EHO1","Hin"], P2: ["EMS1","Sci"], P3: ["EUA1","Arb"], P4: ["ESLC1","English"],
                 P5: ["EHO2(2)","GK"], P6: ["EUA1","U/QT"], P7: ["EMS1","Math"], P8: ["ESLC2(1)","S.St"] },

          "2": { P1: ["ESLC2(2)","S.St"], P2: ["EHO1","Hin"], P3: ["EMS1","Sci"], P4: ["EUA2","Arb"],
                 P5: ["ESLC1","English"], P6: ["EHO2(1)","Computer"], P7: ["EUA1","U/QT"], P8: ["EMS2","Math"] },

          "3": { P1: ["EMS2","Math"], P2: ["ESLC2(1)","S.St"], P3: ["EHO1","Hin"], P4: ["EHO2(2)","GK"],
                 P5: ["EMS2","Sci"], P6: ["ESLC1","English"], P7: ["EUA2","Arb"], P8: ["EUA1","U/QT"] },

          "4": { P1: ["EUA1","U/QT"], P2: ["EMS2","Math"], P3: ["ESLC2(2)","S.St"], P4: ["EHO1","Hin"],
                 P5: ["EUA2","Arb"], P6: ["EMS1","Sci"], P7: ["ESLC1","English"], P8: ["EHO2(1)","Computer"] },

          "5": { P1: ["EMS1","Sci"], P2: ["EUA1","U/QT"], P3: ["EMS2","Math"], P4: ["ESLC2(1)","S.St"],
                 P5: ["EHO1","Hin"], P6: ["EUA2","Arb"], P7: ["EHO2(2)","GK"], P8: ["ESLC1","English"] },

          "6": { P1: ["ESLC1","English"], P2: ["EHO2(1)","Computer"], P3: ["EUA2","U/QT"], P4: ["EMS2","Math"],
                 P5: ["ESLC2(2)","S.St"], P6: ["EHO1","Hin"], P7: ["EMS2","Sci"], P8: ["EUA2","Arb"] },

          "7": { P1: ["EUA2","Arb"], P2: ["ESLC1","English"], P3: ["EHO2(2)","GK"], P4: ["EUA1","U/QT"],
                 P5: ["EMS1","Math"], P6: ["ESLC2(1)","S.St"], P7: ["EHO1","Hin"], P8: ["EMS1","Sci"] },
        };
        for (const [className, row] of Object.entries(matrix)) {
          const classId = nameToId.get(className);
          for (const [periodKey, val] of Object.entries(row)) {
            let code = null, subject = null;
            if (Array.isArray(val)) {
              [code, subject] = val;
            } else if (typeof val === "string" || val === null) {
              code = val;
            } else if (typeof val === "object" && val) {
              code = val.code ?? null;
              subject = val.subject ?? null;
            }
            cells.push({ programId: Number(programId), track, classId, periodKey, mspCodeId: get(code), subject });
          }
        }
      }

      await db.delete(programScheduleCells).where(and(eq(programScheduleCells.programId, Number(programId)), eq(programScheduleCells.track, track)));
      for (const c of cells) await db.insert(programScheduleCells).values(c);

      return NextResponse.json({ message: "MSP schedule seeded", periods: periods.length, cells: cells.length }, { status: 200 });
    }
    if (section === "posts") {
      return NextResponse.json({ error: "Removed: use mspCodes" }, { status: 410 });
    }

    if (section === "postAssignments") {
      return NextResponse.json({ error: "Removed: use mspCodeAssignments" }, { status: 410 });
    }

    if (section === "mspCodes") {
      const { code, program = "MSP", familyKey, track, title, parentSlice, active = true } = body || {};
      if (!code || !familyKey || !track || !title) {
        return NextResponse.json({ error: "Missing required fields: code, familyKey, track, title" }, { status: 400 });
      }
      const [row] = await db
        .insert(mspCodes)
        .values({ code: String(code).trim(), program, familyKey, track, title, parentSlice: parentSlice || null, active: !!active })
        .returning({
          id: mspCodes.id,
          code: mspCodes.code,
          program: mspCodes.program,
          familyKey: mspCodes.familyKey,
          track: mspCodes.track,
          title: mspCodes.title,
          parentSlice: mspCodes.parentSlice,
          active: mspCodes.active,
          createdAt: mspCodes.createdAt,
        });
      return NextResponse.json({ code: row, message: "MSP code created" }, { status: 201 });
    }

    if (section === "seedMSPCodes") {
      // Idempotent seeding for standard MSP role codes
      const standard = [
        // Pre-Primary (unchanged)
        { code: "PGL1", familyKey: "PGL", track: "pre_primary", title: "Pre-Primary General 1" },
        { code: "PGL2", familyKey: "PGL", track: "pre_primary", title: "Pre-Primary General 2" },
        { code: "PGL3", familyKey: "PGL", track: "pre_primary", title: "Pre-Primary General 3" },
        { code: "PRL1", familyKey: "PRL", track: "pre_primary", title: "Pre-Primary Regional 1" },
        { code: "PRL2", familyKey: "PRL", track: "pre_primary", title: "Pre-Primary Regional 2" },
        // Elementary (finalized)
        { code: "EMS1", familyKey: "EMS", track: "elementary", title: "Elementary Science" },
        { code: "EMS2", familyKey: "EMS", track: "elementary", title: "Elementary Math" },

        { code: "ESLC1", familyKey: "ESLC", track: "elementary", title: "Elementary English" },
        // Social Studies split
        { code: "ESLC2(1)", familyKey: "ESLC", track: "elementary", title: "Social Studies slice 1", parentSlice: "SST" },
        { code: "ESLC2(2)", familyKey: "ESLC", track: "elementary", title: "Social Studies slice 2", parentSlice: "SST" },

        { code: "EUA1", familyKey: "EUA", track: "elementary", title: "Elementary Urdu / QT" },
        { code: "EUA2", familyKey: "EUA", track: "elementary", title: "Elementary Arabic" },

        { code: "EHO1", familyKey: "EHO", track: "elementary", title: "Elementary Hindi" },
        // GK / Computer split
        { code: "EHO2(1)", familyKey: "EHO", track: "elementary", title: "Computer", parentSlice: "Computer" },
        { code: "EHO2(2)", familyKey: "EHO", track: "elementary", title: "General Knowledge", parentSlice: "GK" },
      ];

      const existing = await db.select({ id: mspCodes.id, code: mspCodes.code }).from(mspCodes);
      const have = new Set(existing.map((r) => String(r.code)));
      let created = 0;
      for (const s of standard) {
        if (!have.has(s.code)) {
          await db.insert(mspCodes).values({ program: "MSP", ...s, active: true });
          created += 1;
        }
      }

      // Deactivate legacy base codes if present
      try {
        await db.update(mspCodes).set({ active: false }).where(inArray(mspCodes.code, ["ESLC2", "EHO2"]));
      } catch (_) {}

      return NextResponse.json({ message: `Seeded MSP codes (${created} new, ${standard.length - created} existing)` }, { status: 200 });
    }

    if (section === "mspCodeAssignments") {
      const { mspCodeId, userId, startDate, endDate, isPrimary = true, active = true } = body || {};
      if (!mspCodeId || !userId || !startDate) {
        return NextResponse.json({ error: "Missing required fields: mspCodeId, userId, startDate" }, { status: 400 });
      }
      const [row] = await db
        .insert(mspCodeAssignments)
        .values({
          mspCodeId: Number(mspCodeId),
          userId: Number(userId),
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : null,
          isPrimary: !!isPrimary,
          active: !!active,
        })
        .returning({
          id: mspCodeAssignments.id,
           mspCodeId: mspCodeAssignments.mspCodeId,
          userId: mspCodeAssignments.userId,
          startDate: mspCodeAssignments.startDate,
          endDate: mspCodeAssignments.endDate,
          isPrimary: mspCodeAssignments.isPrimary,
          active: mspCodeAssignments.active,
          createdAt: mspCodeAssignments.createdAt,
        });
      return NextResponse.json({ assignment: row, message: "MSP code assignment created" }, { status: 201 });
    }
    if (section === "metaFamilies") {
      const { key, name, active = true } = body || {};
      if (!key || !name) return NextResponse.json({ error: "key and name required" }, { status: 400 });
      const [row] = await db.insert(mriFamilies).values({ key, name, active: !!active }).returning();
      return NextResponse.json({ family: row }, { status: 201 });
    }
    if (section === "metaPrograms") {
      let { familyId, programKey, name, scope = "both", aims, sop, active = true } = body || {};
      if (!familyId || !programKey || !name) return NextResponse.json({ error: "familyId, programKey, name required" }, { status: 400 });
      // Normalize
      familyId = Number(familyId);
      programKey = String(programKey).trim().toUpperCase();

      // Guard: family exists
      const [fam] = await db.select({ id: mriFamilies.id }).from(mriFamilies).where(eq(mriFamilies.id, familyId));
      if (!fam) return NextResponse.json({ error: `Family ${familyId} not found` }, { status: 400 });

      // Upsert-friendly behavior: if programKey exists, return 409 with existing row
      const existing = await db.select().from(mriPrograms).where(eq(mriPrograms.programKey, programKey));
      if (existing.length) {
        return NextResponse.json({ error: `Program ${programKey} already exists`, program: existing[0] }, { status: 409 });
      }

      const [row] = await db
        .insert(mriPrograms)
        .values({ familyId, programKey, name, scope, aims: aims || null, sop: sop || null, active: !!active })
        .returning();
      return NextResponse.json({ program: row }, { status: 201 });
    }
    if (section === "metaProgramRoles") {
      const { programId, action, roleKey } = body || {};
      if (!programId || !action || !roleKey) return NextResponse.json({ error: "programId, action, roleKey required" }, { status: 400 });
      const res = await db
        .insert(mriProgramRoles)
        .values({ programId: Number(programId), action, roleKey })
        .onConflictDoNothing({ target: [mriProgramRoles.programId, mriProgramRoles.action, mriProgramRoles.roleKey] })
        .returning();
      return NextResponse.json({ programRole: res?.[0] || null, deduped: !res?.length }, { status: 201 });
    }

    if (section === "dedupeProgramRoles") {
      // Remove duplicate program role grants leaving the lowest id per (programId, action, roleKey)
      const rows = await db.select().from(mriProgramRoles);
      const seen = new Set();
      const dupIds = [];
      for (const r of rows.sort((a, b) => a.id - b.id)) {
        const key = `${r.programId}|${r.action}|${r.roleKey}`;
        if (seen.has(key)) dupIds.push(r.id); else seen.add(key);
      }
      if (dupIds.length) {
        await db.delete(mriProgramRoles).where(inArray(mriProgramRoles.id, dupIds));
      }
      return NextResponse.json({ message: `Removed ${dupIds.length} duplicate grants` }, { status: 200 });
    }
    if (section === "metaRoleDefs") {
      const { roleKey, name, category = "rmri", active = true } = body || {};
      if (!roleKey || !name) return NextResponse.json({ error: "roleKey and name required" }, { status: 400 });
      const [row] = await db
        .insert(mriRoleDefs)
        .values({ roleKey, name, category, active: !!active })
        .returning();
      return NextResponse.json({ roleDef: row }, { status: 201 });
    }

    if (section === "classTeachers") {
      const { classId, userId, startDate, endDate, active = true } = body || {};
      if (!classId || !userId) {
        return NextResponse.json({ error: "Missing required fields: classId, userId" }, { status: 400 });
      }

      // deactivate previous active teacher for this class
      await db
        .update(classParentTeachers)
        .set({ active: false, endDate: endDate ? new Date(endDate) : new Date() })
        .where(eq(classParentTeachers.classId, Number(classId)));

      const [row] = await db
        .insert(classParentTeachers)
        .values({
          classId: Number(classId),
          userId: Number(userId),
          startDate: startDate ? new Date(startDate) : new Date(),
          endDate: endDate ? new Date(endDate) : null,
          active: !!active,
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

      // ensure pt_moderator role exists for the teacher
      try {
        await db
          .insert(userMriRoles)
          .values({ userId: Number(userId), role: "pt_moderator", active: true })
          .onConflictDoNothing();
      } catch (_) {}

      return NextResponse.json({ classTeacher: row, message: "Class teacher assigned" }, { status: 201 });
    }

    if (section === "slots") {
      const { slotId, memberId } = body;
      if (!slotId || !memberId) {
        return NextResponse.json({ error: "Missing required fields: slotId or memberId" }, { status: 400 });
      }

      const slotExists = await db
        .select({ id: dailySlots.id })
        .from(dailySlots)
        .where(eq(dailySlots.id, slotId));
      if (slotExists.length === 0) {
        return NextResponse.json({ error: `Invalid slotId: ${slotId}` }, { status: 400 });
      }

      const userIds = new Set((await db.select({ id: users.id }).from(users)).map((u) => u.id));
      if (!userIds.has(memberId)) {
        return NextResponse.json({ error: `Invalid memberId: ${memberId}` }, { status: 400 });
      }

      const [assignment] = await db
        .insert(dailySlotAssignments)
        .values({ slotId, memberId })
        .returning({
          id: dailySlotAssignments.id,
          slotId: dailySlotAssignments.slotId,
          memberId: dailySlotAssignments.memberId,
        });

      return NextResponse.json({ assignment, message: "Slot assignment added successfully" }, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  } catch (error) {
    console.error(`Error adding ${section}:`, error);
    return NextResponse.json({ error: `Failed to add ${section}: ${error.message}` }, { status: 500 });
  }
}

/* ============================== PATCH ============================== */
export async function PATCH(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const section = searchParams.get("section");

  try {
    const body = await req.json();

    if (section === "team") {
      const { updates } = body;
      if (!Array.isArray(updates) || updates.length === 0) {
        return NextResponse.json({ error: "Invalid or empty updates" }, { status: 400 });
      }

      const allUsers = await db.select({ id: users.id, email: users.email }).from(users);
      const userIds = new Set(allUsers.map((u) => u.id));

      for (const user of updates) {
        if (!user.id || !user.name || !user.email || !user.role || !user.type || !user.whatsapp_number || !user.member_scope) {
          return NextResponse.json({ error: `Missing required user fields for user ${user.id}` }, { status: 400 });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) {
          return NextResponse.json({ error: `Invalid email format for user ${user.id}` }, { status: 400 });
        }
        if (!/^\+?\d{10,15}$/.test(user.whatsapp_number)) {
          return NextResponse.json({ error: `Invalid WhatsApp number format for user ${user.id}` }, { status: 400 });
        }
        if (!["admin", "team_manager", "member"].includes(user.role)) {
          return NextResponse.json({ error: `Invalid role for user ${user.id}` }, { status: 400 });
        }
        if (!["residential", "non_residential", "semi_residential"].includes(user.type)) {
          return NextResponse.json({ error: `Invalid user type for user ${user.id}` }, { status: 400 });
        }
        if (!["o_member", "i_member", "s_member"].includes(user.member_scope)) {
          return NextResponse.json({ error: `Invalid member scope for user ${user.id}` }, { status: 400 });
        }
        if (user.role === "team_manager" && !["head_incharge", "coordinator", "accountant", "chief_counsellor", "hostel_incharge", "principal"].includes(user.team_manager_type)) {
          return NextResponse.json({ error: `Invalid team manager type for user ${user.id}` }, { status: 400 });
        }

        if (user.immediate_supervisor !== null && user.immediate_supervisor !== undefined) {
          if (!userIds.has(user.immediate_supervisor)) {
            return NextResponse.json({ error: `Invalid immediate_supervisor ID for user ${user.id}` }, { status: 400 });
          }
          if (user.immediate_supervisor === user.id) {
            return NextResponse.json({ error: `User cannot be their own supervisor for user ${user.id}` }, { status: 400 });
          }
        }

        const normalizedEmail = String(user.email).toLowerCase();

        const updateData = {
          name: user.name,
          email: normalizedEmail,
          role: user.role,
          type: user.type,
          whatsapp_number: user.whatsapp_number,
          member_scope: user.member_scope,
          team_manager_type: user.role === "team_manager" ? user.team_manager_type : null,
          immediate_supervisor: user.immediate_supervisor ?? null,
        };
        if (user.password) {
          updateData.password = await bcrypt.hash(user.password, 10);
        }

        const existingUser = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, normalizedEmail));
        if (existingUser.length > 0 && existingUser[0].id !== user.id) {
          return NextResponse.json({ error: `Email already in use for user ${user.id}` }, { status: 400 });
        }

        await db.update(users).set(updateData).where(eq(users.id, user.id));

        if (Array.isArray(user.mriRoles)) {
          const currentRoles = await db
            .select({ role: userMriRoles.role })
            .from(userMriRoles)
            .where(and(eq(userMriRoles.userId, user.id), eq(userMriRoles.active, true)))
            .then((rows) => rows.map((r) => r.role));

          const newRoles = user.mriRoles;
          const rolesToAdd = newRoles.filter((role) => !currentRoles.includes(role));
          const rolesToRemove = currentRoles.filter((role) => !newRoles.includes(role));

          if (rolesToAdd.length > 0) {
            await db.insert(userMriRoles).values(
              rolesToAdd.map((role) => ({
                userId: user.id,
                role,
                active: true,
              }))
            );
          }

          if (rolesToRemove.length > 0) {
            await db
              .update(userMriRoles)
              .set({ active: false })
              .where(and(eq(userMriRoles.userId, user.id), inArray(userMriRoles.role, rolesToRemove)));
          }
        }
      }

      return NextResponse.json({ message: "Team updated successfully" }, { status: 200 });
    }

    if (section === "openCloseTimes") {
      const { times } = body;
      if (!Array.isArray(times) || times.length === 0) {
        return NextResponse.json({ error: "Invalid or empty times" }, { status: 400 });
      }

      for (const timeRow of times) {
        const { userType, dayOpenedAt, dayClosedAt, closingWindowStart, closingWindowEnd } = timeRow;
        if (!userType || !dayOpenedAt || !dayClosedAt || !closingWindowStart || !closingWindowEnd) {
          return NextResponse.json({ error: `Missing required time fields for userType ${userType}` }, { status: 400 });
        }

        await db
          .update(openCloseTimes)
          .set({
            dayOpenTime: dayOpenedAt,
            dayCloseTime: dayClosedAt,
            closingWindowStart,
            closingWindowEnd,
          })
          .where(eq(openCloseTimes.userType, userType));
      }

      return NextResponse.json({ message: "Times updated successfully" }, { status: 200 });
    }

    if (section === "userOpenCloseTimes") {
      const { updates } = body || {};
      if (!Array.isArray(updates) || updates.length === 0) {
        return NextResponse.json({ error: "Invalid or empty updates" }, { status: 400 });
      }

      const allUsers = await db.select({ id: users.id }).from(users);
      const userIdSet = new Set(allUsers.map((u) => u.id));
      const ensureSeconds = (t) => (t && /^\d{2}:\d{2}$/.test(t) ? `${t}:00` : t || null);

      for (const u of updates) {
        const userId = Number(u.userId);
        const useCustomTimes = !!u.useCustomTimes;
        const dayOpenedAt = ensureSeconds(u.dayOpenedAt);
        const dayClosedAt = ensureSeconds(u.dayClosedAt);

        if (!userIdSet.has(userId)) {
          return NextResponse.json({ error: `Invalid userId: ${userId}` }, { status: 400 });
        }
        if (useCustomTimes && !dayOpenedAt) {
          return NextResponse.json({ error: `dayOpenedAt is required when useCustomTimes is true for user ${userId}` }, { status: 400 });
        }

        const existing = await db
          .select({ id: userOpenCloseTimes.id })
          .from(userOpenCloseTimes)
          .where(eq(userOpenCloseTimes.userId, userId));

        if (useCustomTimes) {
          if (existing.length) {
            await db
              .update(userOpenCloseTimes)
              .set({ useCustomTimes: true, dayOpenedAt, dayClosedAt: dayClosedAt ?? null })
              .where(eq(userOpenCloseTimes.userId, userId));
          } else {
            await db.insert(userOpenCloseTimes).values({ userId, useCustomTimes: true, dayOpenedAt, dayClosedAt: dayClosedAt ?? null });
          }
        } else if (existing.length) {
          await db.update(userOpenCloseTimes).set({ useCustomTimes: false }).where(eq(userOpenCloseTimes.userId, userId));
        }
      }

      return NextResponse.json({ message: "Per-user open/close times updated" }, { status: 200 });
    }

    if (section === "slots") {
      const { updates } = body;
      if (!Array.isArray(updates) || updates.length === 0) {
        return NextResponse.json({ error: "Invalid or empty updates" }, { status: 400 });
      }

      const userIds = new Set((await db.select({ id: users.id }).from(users)).map((u) => u.id));
      const slotIds = new Set((await db.select({ id: dailySlots.id }).from(dailySlots)).map((s) => s.id));

      const updatedAssignments = [];
      for (const update of updates) {
        const { slotId, memberId, startTime, endTime } = update;
        if (!slotId || (!memberId && !startTime && !endTime)) {
          return NextResponse.json({ error: `Missing required fields for slot assignment: slotId or memberId/startTime/endTime` }, { status: 400 });
        }
        if (!slotIds.has(slotId)) return NextResponse.json({ error: `Invalid slotId: ${slotId}` }, { status: 400 });
        if (memberId && !userIds.has(memberId)) return NextResponse.json({ error: `Invalid memberId: ${memberId}` }, { status: 400 });

        if (memberId) {
          const existing = await db
            .select({ id: dailySlotAssignments.id })
            .from(dailySlotAssignments)
            .where(eq(dailySlotAssignments.slotId, slotId));

          if (existing.length) {
            await db.update(dailySlotAssignments).set({ memberId }).where(eq(dailySlotAssignments.slotId, slotId));
          } else {
            await db.insert(dailySlotAssignments).values({ slotId, memberId });
          }
          updatedAssignments.push({ slotId, memberId });
        }

        if (startTime && endTime) {
          await db.update(dailySlots).set({ startTime, endTime }).where(eq(dailySlots.id, slotId));
          updatedAssignments.push({ slotId, startTime, endTime });
        }
      }

      return NextResponse.json({ message: "Slot assignments updated successfully", assignments: updatedAssignments }, { status: 200 });
    }
    
    if (section === "schoolCalendar") {
      const { updates } = body;
      if (!Array.isArray(updates) || updates.length === 0) {
        return NextResponse.json({ error: "Invalid or empty updates" }, { status: 400 });
      }

      for (const update of updates) {
        const { id, majorTerm, minorTerm, startDate, endDate, name, weekNumber, isMajorTermBoundary } = update;
        if (!id || !majorTerm || !minorTerm || !startDate || !endDate || !name) {
          return NextResponse.json({ error: `Missing required fields for calendar entry ${id}` }, { status: 400 });
        }

        await db
          .update(schoolCalendar)
          .set({
            major_term: majorTerm,
            minor_term: minorTerm,
            start_date: new Date(startDate),
            end_date: new Date(endDate),
            name,
            week_number: weekNumber ?? null,
            is_major_term_boundary: isMajorTermBoundary || false,
          })
          .where(eq(schoolCalendar.id, id));
      }

      return NextResponse.json({ message: "Calendar updated successfully" }, { status: 200 });
    }

    if (section === "metaFamilies") {
      const { id } = body || {};
      if (!id) return NextResponse.json({ error: "Missing required field: id" }, { status: 400 });
      await db.delete(mriFamilies).where(eq(mriFamilies.id, Number(id)));
      return NextResponse.json({ message: "Family deleted" }, { status: 200 });
    }
    if (section === "metaPrograms") {
      const idParam = new URL(req.url).searchParams.get("id");
      const { id: idBody } = body || {};
      const id = idBody ?? (idParam ? Number(idParam) : undefined);
      if (!id) return NextResponse.json({ error: "Missing required field: id" }, { status: 400 });
      await db.delete(mriPrograms).where(eq(mriPrograms.id, Number(id)));
      return NextResponse.json({ message: "Program deleted" }, { status: 200 });
    }
    if (
      section === "metaProgramRoles" ||
      section === "programRoles" ||
      section === "mriProgramRoles" ||
      /programroles/i.test(section)
    ) {
      const idParam = new URL(req.url).searchParams.get("id");
      const { id: idBody } = body || {};
      const id = idBody ?? (idParam ? Number(idParam) : undefined);
      if (!id) return NextResponse.json({ error: "Missing required field: id" }, { status: 400 });
      await db.delete(mriProgramRoles).where(eq(mriProgramRoles.id, Number(id)));
      return NextResponse.json({ message: "Program role deleted" }, { status: 200 });
    }
    if (section === "metaRoleDefs") {
      const { id } = body || {};
      if (!id) return NextResponse.json({ error: "Missing required field: id" }, { status: 400 });
      await db.delete(mriRoleDefs).where(eq(mriRoleDefs.id, Number(id)));
      return NextResponse.json({ message: "Role def deleted" }, { status: 200 });
    }

    if (section === "mspCodes") {
      const { updates } = body || {};
      if (!Array.isArray(updates) || updates.length === 0) {
        return NextResponse.json({ error: "Invalid or empty updates" }, { status: 400 });
      }
      for (const u of updates) {
        const { id, code, program, familyKey, track, title, parentSlice, active } = u || {};
        if (!id) return NextResponse.json({ error: "Missing id in updates" }, { status: 400 });
        await db.update(mspCodes).set({
          ...(code ? { code: String(code).trim() } : {}),
          ...(program ? { program } : {}),
          ...(familyKey ? { familyKey } : {}),
          ...(track ? { track } : {}),
          ...(title ? { title } : {}),
          ...(parentSlice !== undefined ? { parentSlice: parentSlice || null } : {}),
          ...(active !== undefined ? { active: !!active } : {}),
        }).where(eq(mspCodes.id, Number(id)));
      }
      return NextResponse.json({ message: "MSP codes updated" }, { status: 200 });
    }

    if (section === "mspCodeAssignments") {
      const { updates } = body || {};
      if (!Array.isArray(updates) || updates.length === 0) {
        return NextResponse.json({ error: "Invalid or empty updates" }, { status: 400 });
      }
      for (const u of updates) {
        const { id, endDate, isPrimary, active } = u || {};
        if (!id) return NextResponse.json({ error: "Missing id in updates" }, { status: 400 });
        await db.update(mspCodeAssignments).set({
          ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
          ...(isPrimary !== undefined ? { isPrimary: !!isPrimary } : {}),
          ...(active !== undefined ? { active: !!active } : {}),
        }).where(eq(mspCodeAssignments.id, Number(id)));
      }
      return NextResponse.json({ message: "MSP code assignments updated" }, { status: 200 });
    }

    if (section === "metaFamilies") {
      const { updates } = body || {};
      if (!Array.isArray(updates) || updates.length === 0) return NextResponse.json({ error: "Invalid or empty updates" }, { status: 400 });
      for (const u of updates) {
        const { id, key, name, active } = u || {};
        if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
        await db
          .update(mriFamilies)
          .set({ ...(key ? { key } : {}), ...(name ? { name } : {}), ...(active !== undefined ? { active: !!active } : {}) })
          .where(eq(mriFamilies.id, Number(id)));
      }
      return NextResponse.json({ message: "Families updated" }, { status: 200 });
    }

    if (section === "metaPrograms") {
      const { updates } = body || {};
      if (!Array.isArray(updates) || updates.length === 0) return NextResponse.json({ error: "Invalid or empty updates" }, { status: 400 });
      for (const u of updates) {
        const { id, familyId, programKey, name, scope, aims, sop, active } = u || {};
        if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
        await db
          .update(mriPrograms)
          .set({
            ...(familyId ? { familyId: Number(familyId) } : {}),
            ...(programKey ? { programKey } : {}),
            ...(name ? { name } : {}),
            ...(scope ? { scope } : {}),
            ...(aims !== undefined ? { aims } : {}),
            ...(sop !== undefined ? { sop } : {}),
            ...(active !== undefined ? { active: !!active } : {}),
          })
          .where(eq(mriPrograms.id, Number(id)));
      }
      return NextResponse.json({ message: "Programs updated" }, { status: 200 });
    }

    if (section === "metaProgramRoles") {
      const { updates } = body || {};
      if (!Array.isArray(updates) || updates.length === 0) return NextResponse.json({ error: "Invalid or empty updates" }, { status: 400 });
      for (const u of updates) {
        const { id, action, roleKey } = u || {};
        if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
        await db
          .update(mriProgramRoles)
          .set({ ...(action ? { action } : {}), ...(roleKey ? { roleKey } : {}) })
          .where(eq(mriProgramRoles.id, Number(id)));
      }
      return NextResponse.json({ message: "Program roles updated" }, { status: 200 });
    }

    if (section === "metaRoleDefs") {
      const { updates } = body || {};
      if (!Array.isArray(updates) || updates.length === 0) return NextResponse.json({ error: "Invalid or empty updates" }, { status: 400 });
      for (const u of updates) {
        const { id, roleKey, name, category, active } = u || {};
        if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
        await db
          .update(mriRoleDefs)
          .set({
            ...(roleKey ? { roleKey } : {}),
            ...(name ? { name } : {}),
            ...(category ? { category } : {}),
            ...(active !== undefined ? { active: !!active } : {}),
          })
          .where(eq(mriRoleDefs.id, Number(id)));
      }
      return NextResponse.json({ message: "Role defs updated" }, { status: 200 });
    }

    if (section === "posts") {
      const { updates } = body || {};
      if (!Array.isArray(updates) || updates.length === 0) {
        return NextResponse.json({ error: "Invalid or empty updates" }, { status: 400 });
      }
      for (const u of updates) {
        const { id, code, title, family, notes, active } = u || {};
        if (!id) return NextResponse.json({ error: "Missing id in updates" }, { status: 400 });
        await db
          .update(postCodes)
          .set({
            ...(code ? { code: String(code).trim() } : {}),
            ...(title ? { title: String(title).trim() } : {}),
            ...(family !== undefined ? { family: family ? String(family).trim() : null } : {}),
            ...(notes !== undefined ? { notes } : {}),
            ...(active !== undefined ? { active: !!active } : {}),
          })
          .where(eq(postCodes.id, Number(id)));
      }
      return NextResponse.json({ message: "Posts updated" }, { status: 200 });
    }

    if (section === "postAssignments") {
      return NextResponse.json({ error: "Removed: use mspCodeAssignments" }, { status: 410 });
    }

    if (section === "classTeachers") {
      const { updates } = body || {};
      if (!Array.isArray(updates) || updates.length === 0) {
        return NextResponse.json({ error: "Invalid or empty updates" }, { status: 400 });
      }
      for (const u of updates) {
        const { id, endDate, active } = u || {};
        if (!id) return NextResponse.json({ error: "Missing id in updates" }, { status: 400 });
        await db
          .update(classParentTeachers)
          .set({
            ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
            ...(active !== undefined ? { active: !!active } : {}),
          })
          .where(eq(classParentTeachers.id, Number(id)));
      }
      return NextResponse.json({ message: "Class teacher assignments updated" }, { status: 200 });
    }

    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  } catch (error) {
    console.error(`Error updating ${section}:`, error);
    return NextResponse.json({ error: `Failed to update ${section}: ${error.message}` }, { status: 500 });
  }
}

/* ============================== DELETE ============================== */
export async function DELETE(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const section = searchParams.get("section");

  try {
    // DELETE requests may not include a body; parse defensively
    let body = {};
    try {
      body = await req.json();
    } catch (_) {
      body = {};
    }

    if (section === "schoolCalendar") {
      const { id } = body || {};
      if (!id) return NextResponse.json({ error: "Missing required field: id" }, { status: 400 });
      await db.delete(schoolCalendar).where(eq(schoolCalendar.id, id));
      return NextResponse.json({ message: "Calendar entry deleted successfully" }, { status: 200 });
    }

    if (section === "slots") {
      const { slotId } = body || {};
      if (!slotId) return NextResponse.json({ error: "Missing required field: slotId" }, { status: 400 });
      await db.delete(dailySlotAssignments).where(eq(dailySlotAssignments.slotId, slotId));
      return NextResponse.json({ message: "Slot assignment deleted successfully" }, { status: 200 });
    }

    if (section === "team") {
      const { userId } = body || {};
      if (!userId) return NextResponse.json({ error: "Missing required field: userId" }, { status: 400 });

      const me = Number(session.user?.id);
      if (Number(userId) === me) {
        return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
      }

      const [target] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, userId));
      if (!target) return NextResponse.json({ error: `User ${userId} not found` }, { status: 404 });
      if (session.user?.role === "team_manager" && target.role === "admin") {
        return NextResponse.json({ error: "Insufficient privileges to delete an admin." }, { status: 403 });
      }

      await db.delete(dailySlotAssignments).where(eq(dailySlotAssignments.memberId, userId));
      await db.update(dailySlots).set({ assignedMemberId: null }).where(eq(dailySlots.assignedMemberId, userId));
      await db.update(dailySlotLogs).set({ createdBy: null }).where(eq(dailySlotLogs.createdBy, userId));

      const taskRows = await db.select({ id: routineTasks.id }).from(routineTasks).where(eq(routineTasks.memberId, userId));
      if (taskRows.length) {
        const taskIds = taskRows.map((t) => t.id);
        await db.delete(routineTaskDailyStatuses).where(inArray(routineTaskDailyStatuses.routineTaskId, taskIds));
        await db.delete(routineTaskLogs).where(inArray(routineTaskLogs.routineTaskId, taskIds));
        await db.delete(routineTasks).where(inArray(routineTasks.id, taskIds));
      }
      await db.delete(routineTaskLogs).where(eq(routineTaskLogs.userId, userId));

      await db.update(assignedTaskStatus).set({ verifiedBy: null }).where(eq(assignedTaskStatus.verifiedBy, userId));
      await db.update(assignedTaskLogs).set({ userId: null }).where(eq(assignedTaskLogs.userId, userId));
      await db.update(sprints).set({ verifiedBy: null }).where(eq(sprints.verifiedBy, userId));

      await db.delete(messages).where(or(eq(messages.senderId, userId), eq(messages.recipientId, userId)));

      await db.delete(generalLogs).where(eq(generalLogs.userId, userId));
      await db.delete(memberHistory).where(eq(memberHistory.memberId, userId));
      await db.delete(notCompletedTasks).where(eq(notCompletedTasks.userId, userId));
      await db.delete(userOpenCloseTimes).where(eq(userOpenCloseTimes.userId, userId));

      await db.update(dayCloseRequests).set({ approvedBy: null }).where(eq(dayCloseRequests.approvedBy, userId));
      await db.delete(dayCloseRequests).where(eq(dayCloseRequests.userId, userId));

      await db
        .update(leaveRequests)
        .set({ approvedBy: null, transferTo: null })
        .where(or(eq(leaveRequests.approvedBy, userId), eq(leaveRequests.transferTo, userId)));
      await db.delete(leaveRequests).where(or(eq(leaveRequests.userId, userId), eq(leaveRequests.submittedTo, userId)));

      await db.update(users).set({ immediate_supervisor: null }).where(eq(users.immediate_supervisor, userId));

      await db.delete(users).where(eq(users.id, userId));

      return NextResponse.json({ message: "User deleted successfully" }, { status: 200 });
    }

    if (section === "posts") {
      return NextResponse.json({ error: "Removed: use mspCodes" }, { status: 410 });
    }

    if (section === "postAssignments") {
      return NextResponse.json({ error: "Removed: use mspCodeAssignments" }, { status: 410 });
    }

    if (section === "classTeachers") {
      const { id } = body || {};
      if (!id) return NextResponse.json({ error: "Missing required field: id" }, { status: 400 });
      await db.delete(classParentTeachers).where(eq(classParentTeachers.id, Number(id)));
      return NextResponse.json({ message: "Class teacher assignment deleted" }, { status: 200 });
    }

    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  } catch (error) {
    console.error(`Error deleting ${section}:`, error);
    return NextResponse.json({ error: `Failed to delete ${section}: ${error.message}` }, { status: 500 });
  }
}
