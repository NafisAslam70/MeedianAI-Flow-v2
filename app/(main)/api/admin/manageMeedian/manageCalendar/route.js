import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { schoolCalendar } from "@/lib/schema";
import { eq } from "drizzle-orm";

// GET Handler: Fetch all calendar entries
export async function GET(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    console.error("Unauthorized access attempt:", { user: session?.user });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
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
  } catch (error) {
    console.error("Error fetching school calendar:", error);
    return NextResponse.json({ error: "Failed to fetch school calendar" }, { status: 500 });
  }
}

// POST Handler: Add a new calendar entry
export async function POST(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    console.error("Unauthorized access attempt:", { user: session?.user });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { majorTerm, minorTerm, startDate, endDate, name, weekNumber, isMajorTermBoundary } = body;

    if (!majorTerm || !minorTerm || !startDate || !endDate || !name) {
      console.error("Missing required fields:", body);
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
  } catch (error) {
    console.error("Error adding calendar entry:", error);
    return NextResponse.json({ error: "Failed to add calendar entry" }, { status: 500 });
  }
}

// PATCH Handler: Update existing calendar entries
export async function PATCH(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    console.error("Unauthorized access attempt:", { user: session?.user });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { updates } = body;

    if (!Array.isArray(updates) || updates.length === 0) {
      console.error("Invalid or empty updates:", body);
      return NextResponse.json({ error: "Invalid or empty updates" }, { status: 400 });
    }

    for (const update of updates) {
      const { id, majorTerm, minorTerm, startDate, endDate, name, weekNumber, isMajorTermBoundary } = update;

      if (!id || !majorTerm || !minorTerm || !startDate || !endDate || !name) {
        console.error("Missing required fields for update:", update);
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
  } catch (error) {
    console.error("Error updating school calendar:", error);
    return NextResponse.json({ error: "Failed to update school calendar" }, { status: 500 });
  }
}

// DELETE Handler: Delete a calendar entry
export async function DELETE(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    console.error("Unauthorized access attempt:", { user: session?.user });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
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
  } catch (error) {
    console.error("Error deleting school calendar:", error);
    return NextResponse.json({ error: "Failed to delete school calendar" }, { status: 500 });
  }
}