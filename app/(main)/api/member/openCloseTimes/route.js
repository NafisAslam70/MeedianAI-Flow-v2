import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { openCloseTimes } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const userType = searchParams.get("userType");

  if (!userType) {
    return NextResponse.json({ error: "Missing userType" }, { status: 400 });
  }

  try {
    let times;

    if (userType === "all") {
      // Fetch all open/close times
      times = await db.select().from(openCloseTimes);
    } else {
      // Only fetch for a specific userType
      times = await db
        .select()
        .from(openCloseTimes)
        .where(eq(openCloseTimes.userType, userType));
    }

    if (!times || times.length === 0) {
      return NextResponse.json({ error: "Open/close times not found" }, { status: 404 });
    }

    return NextResponse.json({ times });
  } catch (error) {
    console.error("Error fetching open/close times:", error);
    return NextResponse.json({ error: "Failed to fetch open/close times" }, { status: 500 });
  }
}