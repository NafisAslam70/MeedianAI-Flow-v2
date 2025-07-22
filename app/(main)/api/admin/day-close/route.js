import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { openCloseTimes, userTypeEnum } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized: Admin role required" }, { status: 401 });
  }

  try {
    const times = await db
      .select({
        id: openCloseTimes.id,
        userType: openCloseTimes.userType,
        dayOpenTime: openCloseTimes.dayOpenTime,
        dayCloseTime: openCloseTimes.dayCloseTime,
        closingWindowStart: openCloseTimes.closingWindowStart,
        closingWindowEnd: openCloseTimes.closingWindowEnd,
      })
      .from(openCloseTimes);

    console.log("Fetched open_close_times:", times); // Debug
    if (times.length === 0) {
      return NextResponse.json({ times: [], message: "No day-close times configured" });
    }

    return NextResponse.json({ times });
  } catch (error) {
    console.error("Error fetching day-close times:", error);
    return NextResponse.json({ error: `Failed to fetch day-close times: ${error.message}` }, { status: 500 });
  }
}

export async function PATCH(req) {
  const session = await auth();
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized: Admin role required" }, { status: 401 });
  }

  try {
    const { times } = await req.json();
    console.log("Received PATCH payload:", times);
    if (!Array.isArray(times) || times.length === 0) {
      return NextResponse.json({ error: "Invalid or missing times array" }, { status: 400 });
    }

    const updatedTimes = [];
    for (const time of times) {
      const { userType, dayOpenTime, dayCloseTime, closingWindowStart, closingWindowEnd } = time;

      if (!userType || !userTypeEnum.enumValues.includes(userType)) {
        return NextResponse.json({ error: `Invalid user type: ${userType}` }, { status: 400 });
      }

      const timeFields = { dayOpenTime, dayCloseTime, closingWindowStart, closingWindowEnd };
      for (const [field, value] of Object.entries(timeFields)) {
        if (!/^\d{2}:\d{2}:\d{2}$/.test(value)) {
          return NextResponse.json({ error: `Invalid ${field} format for user type: ${userType}. Expected HH:MM:SS` }, { status: 400 });
        }
      }

      const [existingRecord] = await db
        .select({ id: openCloseTimes.id })
        .from(openCloseTimes)
        .where(eq(openCloseTimes.userType, userType))
        .limit(1);

      const createdAt = new Date(); // Keep as Date object
      console.log(`Processing ${userType} with createdAt: ${createdAt}`);

      if (existingRecord) {
        const [updatedRecord] = await db
          .update(openCloseTimes)
          .set({
            dayOpenTime,
            dayCloseTime,
            closingWindowStart,
            closingWindowEnd,
            createdAt, // Pass Date object
          })
          .where(eq(openCloseTimes.userType, userType))
          .returning({
            id: openCloseTimes.id,
            userType: openCloseTimes.userType,
            dayOpenTime: openCloseTimes.dayOpenTime,
            dayCloseTime: openCloseTimes.dayCloseTime,
            closingWindowStart: openCloseTimes.closingWindowStart,
            closingWindowEnd: openCloseTimes.closingWindowEnd,
          });
        console.log(`Updated record for ${userType}:`, updatedRecord);
        updatedTimes.push(updatedRecord);
      } else {
        const [newRecord] = await db
          .insert(openCloseTimes)
          .values({
            userType,
            dayOpenTime,
            dayCloseTime,
            closingWindowStart,
            closingWindowEnd,
            createdAt, // Pass Date object
          })
          .returning({
            id: openCloseTimes.id,
            userType: openCloseTimes.userType,
            dayOpenTime: openCloseTimes.dayOpenTime,
            dayCloseTime: openCloseTimes.dayCloseTime,
            closingWindowStart: openCloseTimes.closingWindowStart,
            closingWindowEnd: openCloseTimes.closingWindowEnd,
          });
        console.log(`Inserted record for ${userType}:`, newRecord);
        updatedTimes.push(newRecord);
      }
    }

    return NextResponse.json({ times: updatedTimes, message: "Day-close times updated successfully" });
  } catch (error) {
    console.error("Error updating day-close times:", error);
    return NextResponse.json({ error: `Failed to update day-close times: ${error.message}` }, { status: 500 });
  }
}