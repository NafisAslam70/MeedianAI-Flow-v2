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
  // extra tables referenced in deletes
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
} from "@/lib/schema";
import { eq, or, inArray } from "drizzle-orm";
import bcrypt from "bcrypt";

/* ============================== GET ============================== */
// GET Handler: Fetch data based on section parameter
export async function GET(req) {
  const session = await auth();
  const { searchParams } = new URL(req.url);
  const section = searchParams.get("section");

  // Allow members for 'slots' section, restrict others
  if (section === "slots") {
    if (!session || !["admin", "team_manager", "member"].includes(session.user?.role)) {
      console.error("Unauthorized access attempt:", { user: session?.user });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    console.error("Unauthorized access attempt:", { user: session?.user });
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
      console.log("Fetched team data:", userData);
      return NextResponse.json({ users: userData }, { status: 200 });
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
      console.log("Fetched times data:", times);
      return NextResponse.json({ times }, { status: 200 });
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

      console.log("Fetched slots data with assignments:", slotsWithAssignments);
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
      console.log("Fetched student data:", studentData);
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
      console.log("Fetched calendar data:", calendarData);
      return NextResponse.json({ calendar: calendarData }, { status: 200 });
    }

    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  } catch (error) {
    console.error(`Error fetching ${section}:`, error);
    return NextResponse.json({ error: `Failed to fetch ${section}: ${error.message}` }, { status: 500 });
  }
}

/* ============================== POST ============================== */
// POST Handler: Add new entries
export async function POST(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    console.error("Unauthorized access attempt:", { user: session?.user });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const section = searchParams.get("section");

  try {
    const body = await req.json();

    if (section === "schoolCalendar") {
      const { majorTerm, minorTerm, startDate, endDate, name, weekNumber, isMajorTermBoundary } = body;
      if (!majorTerm || !minorTerm || !startDate || !endDate || !name) {
        console.error("Missing required calendar fields:", body);
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }

      const newEntry = await db
        .insert(schoolCalendar)
        .values({
          major_term: majorTerm,
          minor_term: minorTerm,
          start_date: new Date(startDate),
          end_date: new Date(endDate),
          name,
          week_number: weekNumber !== undefined ? weekNumber : null,
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

      console.log("Added new calendar entry:", newEntry[0]);
      return NextResponse.json({ entry: newEntry[0], message: "Calendar entry added successfully" }, { status: 201 });
    }

    if (section === "slots") {
      const { slotId, memberId } = body;
      if (!slotId || !memberId) {
        console.error("Missing required slot assignment fields:", { slotId, memberId });
        return NextResponse.json({ error: "Missing required fields: slotId or memberId" }, { status: 400 });
      }

      const slotExists = await db
        .select({ id: dailySlots.id })
        .from(dailySlots)
        .where(eq(dailySlots.id, slotId));
      if (slotExists.length === 0) {
        console.error("Invalid slotId:", slotId);
        return NextResponse.json({ error: `Invalid slotId: ${slotId}` }, { status: 400 });
      }

      const userIds = new Set((await db.select({ id: users.id }).from(users)).map((u) => u.id));
      if (!userIds.has(memberId)) {
        console.error("Invalid memberId:", memberId);
        return NextResponse.json({ error: `Invalid memberId: ${memberId}` }, { status: 400 });
      }

      const newAssignment = await db
        .insert(dailySlotAssignments)
        .values({ slotId, memberId })
        .returning({
          id: dailySlotAssignments.id,
          slotId: dailySlotAssignments.slotId,
          memberId: dailySlotAssignments.memberId,
        });

      console.log("Added new slot assignment:", newAssignment[0]);
      return NextResponse.json({ assignment: newAssignment[0], message: "Slot assignment added successfully" }, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  } catch (error) {
    console.error(`Error adding ${section}:`, error);
    return NextResponse.json({ error: `Failed to add ${section}: ${error.message}` }, { status: 500 });
  }
}

/* ============================== PATCH ============================== */
// PATCH Handler: Update existing entries
export async function PATCH(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    console.error("Unauthorized access attempt:", { user: session?.user });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const section = searchParams.get("section");

  try {
    const body = await req.json();

    if (section === "team") {
      const { updates } = body;
      if (!Array.isArray(updates) || updates.length === 0) {
        console.error("Invalid or empty team updates:", body);
        return NextResponse.json({ error: "Invalid or empty updates" }, { status: 400 });
      }

      // Fetch all user IDs for validation
      const allUsers = await db.select({ id: users.id, email: users.email }).from(users);
      const userIds = new Set(allUsers.map((u) => u.id));

      for (const user of updates) {
        if (
          !user.id ||
          !user.name ||
          !user.email ||
          !user.role ||
          !user.type ||
          !user.whatsapp_number ||
          !user.member_scope
        ) {
          console.error("Missing required user fields:", user);
          return NextResponse.json({ error: `Missing required user fields for user ${user.id}` }, { status: 400 });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) {
          console.error("Invalid email format:", user.email);
          return NextResponse.json({ error: `Invalid email format for user ${user.id}` }, { status: 400 });
        }
        if (!/^\+?\d{10,15}$/.test(user.whatsapp_number)) {
          console.error("Invalid WhatsApp number format:", user.whatsapp_number);
          return NextResponse.json({ error: `Invalid WhatsApp number format for user ${user.id}` }, { status: 400 });
        }
        if (!["admin", "team_manager", "member"].includes(user.role)) {
          console.error("Invalid role:", user.role);
          return NextResponse.json({ error: `Invalid role for user ${user.id}` }, { status: 400 });
        }
        if (!["residential", "non_residential", "semi_residential"].includes(user.type)) {
          console.error("Invalid user type:", user.type);
          return NextResponse.json({ error: `Invalid user type for user ${user.id}` }, { status: 400 });
        }
        if (!["o_member", "i_member", "s_member"].includes(user.member_scope)) {
          console.error("Invalid member scope:", user.member_scope);
          return NextResponse.json({ error: `Invalid member scope for user ${user.id}` }, { status: 400 });
        }
        if (
          user.role === "team_manager" &&
          !["head_incharge", "coordinator", "accountant", "chief_counsellor", "hostel_incharge", "principal"].includes(
            user.team_manager_type
          )
        ) {
          console.error("Invalid team manager type:", user.team_manager_type);
          return NextResponse.json({ error: `Invalid team manager type for user ${user.id}` }, { status: 400 });
        }
        // Validate immediate_supervisor
        if (user.immediate_supervisor !== null && user.immediate_supervisor !== undefined) {
          if (!userIds.has(user.immediate_supervisor)) {
            console.error("Invalid immediate_supervisor ID:", user.immediate_supervisor);
            return NextResponse.json({ error: `Invalid immediate_supervisor ID for user ${user.id}` }, { status: 400 });
          }
          if (user.immediate_supervisor === user.id) {
            console.error("User cannot be their own supervisor:", user.id);
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
          console.error("Email already in use:", normalizedEmail);
          return NextResponse.json({ error: `Email already in use for user ${user.id}` }, { status: 400 });
        }

        await db.update(users).set(updateData).where(eq(users.id, user.id));
      }

      console.log("Team updated successfully:", updates);
      return NextResponse.json({ message: "Team updated successfully" }, { status: 200 });
    }

    if (section === "openCloseTimes") {
      const { times } = body;
      if (!Array.isArray(times) || times.length === 0) {
        console.error("Invalid or empty times updates:", body);
        return NextResponse.json({ error: "Invalid or empty times" }, { status: 400 });
      }

      for (const time of times) {
        if (
          !time.userType ||
          !time.dayOpenedAt ||
          !time.dayClosedAt ||
          !time.closingWindowStart ||
          !time.closingWindowEnd
        ) {
          console.error("Missing required time fields:", time);
          return NextResponse.json({ error: `Missing required time fields for userType ${time.userType}` }, { status: 400 });
        }

        await db
          .update(openCloseTimes)
          .set({
            dayOpenTime: time.dayOpenedAt,
            dayCloseTime: time.dayClosedAt,
            closingWindowStart: time.closingWindowStart,
            closingWindowEnd: time.closingWindowEnd,
          })
          .where(eq(openCloseTimes.userType, time.userType));
      }

      console.log("Times updated successfully:", times);
      return NextResponse.json({ message: "Times updated successfully" }, { status: 200 });
    }

    if (section === "slots") {
      const { updates } = body;
      if (!Array.isArray(updates) || updates.length === 0) {
        console.error("Invalid or empty slot assignments updates:", body);
        return NextResponse.json({ error: "Invalid or empty updates" }, { status: 400 });
      }

      const userIds = new Set((await db.select({ id: users.id }).from(users)).map((u) => u.id));
      const slotIds = new Set((await db.select({ id: dailySlots.id }).from(dailySlots)).map((s) => s.id));

      const updatedAssignments = [];
      for (const update of updates) {
        const { slotId, memberId, startTime, endTime } = update;
        if (!slotId || (!memberId && !startTime && !endTime)) {
          console.error("Missing required slot assignment fields:", update);
          return NextResponse.json({
            error: `Missing required fields for slot assignment: slotId or memberId/startTime/endTime`,
          }, { status: 400 });
        }

        if (!slotIds.has(slotId)) {
          console.error("Invalid slotId:", slotId);
          return NextResponse.json({ error: `Invalid slotId: ${slotId}` }, { status: 400 });
        }
        if (memberId && !userIds.has(memberId)) {
          console.error("Invalid memberId:", memberId);
          return NextResponse.json({ error: `Invalid memberId: ${memberId}` }, { status: 400 });
        }

        if (memberId) {
          const existingAssignment = await db
            .select({ id: dailySlotAssignments.id })
            .from(dailySlotAssignments)
            .where(eq(dailySlotAssignments.slotId, slotId));

          if (existingAssignment.length > 0) {
            await db
              .update(dailySlotAssignments)
              .set({ memberId })
              .where(eq(dailySlotAssignments.slotId, slotId));
          } else {
            await db.insert(dailySlotAssignments).values({ slotId, memberId });
          }
          updatedAssignments.push({ slotId, memberId });
        }

        if (startTime && endTime) {
          await db
            .update(dailySlots)
            .set({ startTime, endTime })
            .where(eq(dailySlots.id, slotId));
          updatedAssignments.push({ slotId, startTime, endTime });
        }
      }

      console.log("Slot assignments updated successfully:", updatedAssignments);
      return NextResponse.json({ message: "Slot assignments updated successfully", assignments: updatedAssignments }, { status: 200 });
    }

    if (section === "schoolCalendar") {
      const { updates } = body;
      if (!Array.isArray(updates) || updates.length === 0) {
        console.error("Invalid or empty calendar updates:", body);
        return NextResponse.json({ error: "Invalid or empty updates" }, { status: 400 });
      }

      for (const update of updates) {
        const { id, majorTerm, minorTerm, startDate, endDate, name, weekNumber, isMajorTermBoundary } = update;
        if (!id || !majorTerm || !minorTerm || !startDate || !endDate || !name) {
          console.error("Missing required calendar fields:", update);
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
            week_number: weekNumber !== undefined ? weekNumber : null,
            is_major_term_boundary: isMajorTermBoundary || false,
          })
          .where(eq(schoolCalendar.id, id));
      }

      console.log("Calendar updated successfully:", updates);
      return NextResponse.json({ message: "Calendar updated successfully" }, { status: 200 });
    }

    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  } catch (error) {
    console.error(`Error updating ${section}:`, error);
    return NextResponse.json({ error: `Failed to update ${section}: ${error.message}` }, { status: 500 });
  }
}

/* ============================== DELETE ============================== */
// DELETE Handler: Delete a calendar entry, slot assignment, or user (no transactions; ordered cleanup)
export async function DELETE(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    console.error("Unauthorized access attempt:", { user: session?.user });
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

      // Prevent deleting yourself
      const me = Number(session.user?.id);
      if (Number(userId) === me) {
        return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
      }

      // Only allow team_manager to delete non-admins
      const [target] = await db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(eq(users.id, userId));
      if (!target) return NextResponse.json({ error: `User ${userId} not found` }, { status: 404 });
      if (session.user?.role === "team_manager" && target.role === "admin") {
        return NextResponse.json({ error: "Insufficient privileges to delete an admin." }, { status: 403 });
      }

      // --- CLEANUP IN SAFE ORDER (no transactions) ---
      // 1) Daily slot assignments and slots
      await db.delete(dailySlotAssignments).where(eq(dailySlotAssignments.memberId, userId));
      await db.update(dailySlots).set({ assignedMemberId: null }).where(eq(dailySlots.assignedMemberId, userId));
      await db.update(dailySlotLogs).set({ createdBy: null }).where(eq(dailySlotLogs.createdBy, userId));

      // 2) Routine tasks: delete statuses -> logs -> tasks
      const taskRows = await db
        .select({ id: routineTasks.id })
        .from(routineTasks)
        .where(eq(routineTasks.memberId, userId));
      if (taskRows.length) {
        const taskIds = taskRows.map((t) => t.id);
        await db.delete(routineTaskDailyStatuses).where(inArray(routineTaskDailyStatuses.routineTaskId, taskIds));
        await db.delete(routineTaskLogs).where(inArray(routineTaskLogs.routineTaskId, taskIds));
        await db.delete(routineTasks).where(inArray(routineTasks.id, taskIds));
      }
      // Also remove any stray logs authored by the user
      await db.delete(routineTaskLogs).where(eq(routineTaskLogs.userId, userId));

      // 3) Assigned tasks-related nullifications (cascades handle the rest)
      await db.update(assignedTaskStatus).set({ verifiedBy: null }).where(eq(assignedTaskStatus.verifiedBy, userId));
      await db.update(assignedTaskLogs).set({ userId: null }).where(eq(assignedTaskLogs.userId, userId));
      await db.update(sprints).set({ verifiedBy: null }).where(eq(sprints.verifiedBy, userId));
      // Note: assignedTaskStatus.memberId has onDelete:cascade; assignedTasks.createdBy has onDelete:cascade

      // 4) Messages
      await db.delete(messages).where(or(eq(messages.senderId, userId), eq(messages.recipientId, userId)));

      // 5) Logs / history / misc
      await db.delete(generalLogs).where(eq(generalLogs.userId, userId));
      await db.delete(memberHistory).where(eq(memberHistory.memberId, userId));
      await db.delete(notCompletedTasks).where(eq(notCompletedTasks.userId, userId));
      await db.delete(userOpenCloseTimes).where(eq(userOpenCloseTimes.userId, userId));

      // 6) Day close requests
      await db.update(dayCloseRequests).set({ approvedBy: null }).where(eq(dayCloseRequests.approvedBy, userId));
      await db.delete(dayCloseRequests).where(eq(dayCloseRequests.userId, userId));

      // 7) Leave requests
      await db
        .update(leaveRequests)
        .set({ approvedBy: null, transferTo: null })
        .where(or(eq(leaveRequests.approvedBy, userId), eq(leaveRequests.transferTo, userId)));
      await db.delete(leaveRequests).where(or(eq(leaveRequests.userId, userId), eq(leaveRequests.submittedTo, userId)));

      // 8) Supervisor chain: detach reports
      await db.update(users).set({ immediate_supervisor: null }).where(eq(users.immediate_supervisor, userId));

      // 9) Finally delete the user
      await db.delete(users).where(eq(users.id, userId));

      return NextResponse.json({ message: "User deleted successfully" }, { status: 200 });
    }

    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  } catch (error) {
    console.error(`Error deleting ${section}:`, error);
    return NextResponse.json({ error: `Failed to delete ${section}: ${error.message}` }, { status: 500 });
  }
}
