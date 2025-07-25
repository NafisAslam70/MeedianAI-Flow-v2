import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { users, openCloseTimes, dailySlots, schoolCalendar, students } from "@/lib/schema";
import { eq } from "drizzle-orm";

// GET Handler: Fetch data based on section parameter
export async function GET(req) {
  const session = await auth();
  const { searchParams } = new URL(req.url);
  const section = searchParams.get("section");

  // Allow members for 'slots' section
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
      console.log("Fetched slots data:", slots);
      return NextResponse.json({ slots }, { status: 200 });
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
        .orderBy(students.class_name, students.name); // Sort by class and name
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
    return NextResponse.json({ error: `Failed to fetch ${section}` }, { status: 500 });
  }
}

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
          name: name,
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

    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  } catch (error) {
    console.error(`Error adding ${section}:`, error);
    return NextResponse.json({ error: `Failed to add ${section}` }, { status: 500 });
  }
}

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

      for (const user of updates) {
        if (!user.id || !user.name || !user.email || !user.role || !user.type) {
          console.error("Missing required user fields:", user);
          return NextResponse.json({ error: "Missing required user fields" }, { status: 400 });
        }

        const updateData = {
          name: user.name,
          email: user.email,
          role: user.role,
          type: user.type,
        };
        if (user.password) {
          updateData.password = user.password;
        }

        await db
          .update(users)
          .set(updateData)
          .where(eq(users.id, user.id));
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
        if (!time.userType || !time.dayOpenedAt || !time.dayClosedAt || !time.closingWindowStart || !time.closingWindowEnd) {
          console.error("Missing required time fields:", time);
          return NextResponse.json({ error: "Missing required time fields" }, { status: 400 });
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
        console.error("Invalid or empty slots updates:", body);
        return NextResponse.json({ error: "Invalid or empty updates" }, { status: 400 });
      }

      for (const slot of updates) {
        if (!slot.id || !slot.name || !slot.startTime || !slot.endTime) {
          console.error("Missing required slot fields:", slot);
          return NextResponse.json({ error: "Missing required slot fields" }, { status: 400 });
        }

        await db
          .update(dailySlots)
          .set({
            name: slot.name,
            startTime: slot.startTime,
            endTime: slot.endTime,
            hasSubSlots: slot.hasSubSlots ?? false,
            assignedMemberId: slot.assignedMemberId,
          })
          .where(eq(dailySlots.id, slot.id));
      }

      console.log("Slots updated successfully:", updates);
      return NextResponse.json({ message: "Slots updated successfully" }, { status: 200 });
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
          return NextResponse.json({ error: "Missing required fields for update" }, { status: 400 });
        }

        await db
          .update(schoolCalendar)
          .set({
            major_term: majorTerm,
            minor_term: minorTerm,
            start_date: new Date(startDate),
            end_date: new Date(endDate),
            name: name,
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
    return NextResponse.json({ error: `Failed to update ${section}` }, { status: 500 });
  }
}

// DELETE Handler: Delete a calendar entry
export async function DELETE(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    console.error("Unauthorized access attempt:", { user: session?.user });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const section = searchParams.get("section");

  try {
    if (section === "schoolCalendar") {
      const body = await req.json();
      const { id } = body;
      if (!id) {
        console.error("Missing required field: id", body);
        return NextResponse.json({ error: "Missing required field: id" }, { status: 400 });
      }

      await db
        .delete(schoolCalendar)
        .where(eq(schoolCalendar.id, id));

      console.log(`Deleted calendar entry with id: ${id}`);
      return NextResponse.json({ message: "Calendar entry deleted successfully" }, { status: 200 });
    }

    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  } catch (error) {
    console.error(`Error deleting ${section}:`, error);
    return NextResponse.json({ error: `Failed to delete ${section}` }, { status: 500 });
  }
}