import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { schoolCalendar } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(req) {
  const session = await auth();
  if (!session || !session.user) {
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
    console.error("Error fetching calendar:", error);
    return NextResponse.json({ error: "Failed to fetch calendar" }, { status: 500 });
  }
}