import { NextResponse } from "next/server";
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
} from "@/lib/schema";
import { eq, or, inArray, and } from "drizzle-orm";
import bcrypt from "bcrypt";

/* ============================== GET ============================== */
export async function GET(req) {
  const session = await auth();
  const { searchParams } = new URL(req.url);
  const section = searchParams.get("section");

  if (section === "slots") {
    if (!session || !["admin", "team_manager", "member"].includes(session.user?.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    const body = await req.json();

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

    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  } catch (error) {
    console.error(`Error deleting ${section}:`, error);
    return NextResponse.json({ error: `Failed to delete ${section}: ${error.message}` }, { status: 500 });
  }
}
