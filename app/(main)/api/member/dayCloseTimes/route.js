import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { openCloseTimes, userOpenCloseTimes, users } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(req) {
  const session = await auth();
  if (!session || !["member"].includes(session.user?.role)) {
    console.error("Unauthorized access attempt:", { user: session?.user });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = parseInt(session.user.id);

  try {
    // Fetch user type
    const user = await db
      .select({
        type: users.type,
      })
      .from(users)
      .where(eq(users.id, userId))
      .then((res) => res[0]);

    if (!user) {
      console.error("User not found:", { userId });
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check userOpenCloseTimes for custom open/close times
    const customTimes = await db
      .select({
        dayOpenTime: userOpenCloseTimes.dayOpenedAt,
        dayCloseTime: userOpenCloseTimes.dayClosedAt,
        useCustomTimes: userOpenCloseTimes.useCustomTimes,
      })
      .from(userOpenCloseTimes)
      .where(eq(userOpenCloseTimes.userId, userId))
      .limit(1)
      .then((res) => res[0]);

    // Fetch default times including closing window from openCloseTimes
    const defaultTimes = await db
      .select({
        dayOpenTime: openCloseTimes.dayOpenTime,
        dayCloseTime: openCloseTimes.dayCloseTime,
        closingWindowStart: openCloseTimes.closingWindowStart,
        closingWindowEnd: openCloseTimes.closingWindowEnd,
      })
      .from(openCloseTimes)
      .where(eq(openCloseTimes.userType, user.type))
      .limit(1)
      .then((res) => res[0]);

    if (!defaultTimes) {
      console.error("Open/close times not found for user type:", user.type);
      return NextResponse.json({ error: "Open/close times not found" }, { status: 404 });
    }

    // Use custom times for dayOpenTime/dayCloseTime if useCustomTimes is true, otherwise use defaults
    const times = {
      dayOpenTime: customTimes && customTimes.useCustomTimes ? customTimes.dayOpenTime : defaultTimes.dayOpenTime,
      dayCloseTime: customTimes && customTimes.useCustomTimes ? customTimes.dayCloseTime : defaultTimes.dayCloseTime,
      closingWindowStart: defaultTimes.closingWindowStart,
      closingWindowEnd: defaultTimes.closingWindowEnd,
    };

    console.log("Fetched open/close times:", times);
    return NextResponse.json({ times }, { status: 200 });
  } catch (error) {
    console.error("Error fetching open/close times:", error);
    return NextResponse.json({ error: `Failed to fetch open/close times: ${error.message}` }, { status: 500 });
  }
}