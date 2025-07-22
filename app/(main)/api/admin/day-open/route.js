import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { openCloseTimes, userTypeEnum } from "@/lib/schema";
import { eq, and, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function POST(req) {
  const session = await auth();
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { userType, closingWindowType, customClosingTime } = await req.json();
    if (!userType || !userTypeEnum.enumValues.includes(userType)) {
      return NextResponse.json({ error: "Invalid or missing user type" }, { status: 400 });
    }

    const currentDate = new Date().toISOString().split("T")[0];
    let dayClosedAt = null;
    let closingWindowStart = null;
    let closingWindowEnd = null;

    if (closingWindowType === "custom" && customClosingTime) {
      dayClosedAt = new Date(customClosingTime).toISOString();
      closingWindowStart = new Date(new Date(customClosingTime).setMinutes(new Date(customClosingTime).getMinutes() - 30)).toISOString();
      closingWindowEnd = dayClosedAt;
    } else {
      // Fetch default times from openCloseTimes or appState
      const [record] = await db
        .select()
        .from(openCloseTimes)
        .where(eq(openCloseTimes.userType, userType))
        .limit(1);
      if (!record) {
        return NextResponse.json({ error: "No schedule found for this user type" }, { status: 400 });
      }
      dayClosedAt = record.dayClosedAt;
      closingWindowStart = record.closingWindowStart;
      closingWindowEnd = record.closingWindowEnd;
    }

    // Check if day is already opened for this userType
    const [existingRecord] = await db
      .select()
      .from(openCloseTimes)
      .where(
        and(
          eq(openCloseTimes.userType, userType),
          eq(sql`DATE(${openCloseTimes.dayOpenedAt})`, currentDate)
        )
      );

    if (existingRecord && existingRecord.isDayOpened) {
      return NextResponse.json({ message: `Day already opened for ${userType}` });
    }

    // Update or insert record to mark day as opened
    if (existingRecord) {
      await db
        .update(openCloseTimes)
        .set({
          isDayOpened: true,
          dayOpenedAt: new Date().toISOString(),
          dayClosedAt,
          closingWindowStart,
          closingWindowEnd,
        })
        .where(eq(openCloseTimes.id, existingRecord.id));
    } else {
      await db.insert(openCloseTimes).values({
        userType,
        dayOpenedAt: new Date().toISOString(),
        dayClosedAt,
        closingWindowStart,
        closingWindowEnd,
        isDayOpened: true,
      });
    }

    return NextResponse.json({ message: `Day opened successfully for ${userType}` });
  } catch (error) {
    console.error("Error opening day:", error);
    return NextResponse.json({ error: "Failed to open day" }, { status: 500 });
  }
}