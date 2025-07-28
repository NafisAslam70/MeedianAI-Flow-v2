// api/member/mri-status/route.js
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dailySlots, dailySlotAssignments, userOpenCloseTimes } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function GET(req) {
  try {
    const session = await auth();
    if (!session || !session.user || session.user.role !== "member") {
      console.error("Unauthorized access attempt:", { session });
      return NextResponse.json({ error: "Unauthorized: Member access required" }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    // Fetch open/close times
    const openCloseTimes = await db
      .select({
        dayOpenedAt: userOpenCloseTimes.dayOpenedAt,
        dayClosedAt: userOpenCloseTimes.dayClosedAt,
      })
      .from(userOpenCloseTimes)
      .where(
        and(
          eq(userOpenCloseTimes.userId, userId),
          eq(userOpenCloseTimes.createdAt, startOfDay)
        )
      )
      .limit(1);

    // Fetch completed slots (N-MRIs)
    const completedSlots = await db
      .select({
        slotId: dailySlots.id,
      })
      .from(dailySlotAssignments)
      .innerJoin(dailySlots, eq(dailySlotAssignments.slotId, dailySlots.id))
      .where(
        and(
          eq(dailySlotAssignments.memberId, userId),
          eq(dailySlots.createdAt, startOfDay)
        )
      );

    // Mock A-MRI statuses (Assembly, MSP-D1, MSP-D2, MHCP-1, MHCP-2)
    // Replace with actual database logic if A-MRIs are stored
    const rituals = [
      { id: "assembly", completed: false },
      { id: "msp-d1", completed: false },
      { id: "msp-d2", completed: false },
      { id: "mhcp-1", completed: false },
      { id: "mhcp-2", completed: false },
    ];

    const response = {
      dayOpenedAt: openCloseTimes[0]?.dayOpenedAt || null,
      dayClosedAt: openCloseTimes[0]?.dayClosedAt || null,
      rituals,
      completedSlots: completedSlots.map(s => s.slotId),
    };

    console.log("MRI status fetched:", { userId, date, response });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching MRI status:", error);
    return NextResponse.json({ error: `Failed to fetch MRI status: ${error.message}` }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session || !session.user || session.user.role !== "member") {
      console.error("Unauthorized access attempt:", { session });
      return NextResponse.json({ error: "Unauthorized: Member access required" }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const { ritualId, date, completed } = await req.json();

    if (!ritualId || !date) {
      return NextResponse.json({ error: "Ritual ID and date are required" }, { status: 400 });
    }

    // TODO: Implement actual database logic to update A-MRI status
    console.log("Updating ritual status:", { userId, ritualId, date, completed });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating ritual status:", error);
    return NextResponse.json({ error: `Failed to update ritual status: ${error.message}` }, { status: 500 });
  }
}