// api/member/current-mri/route.js
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dailySlots, dailySlotAssignments } from "@/lib/schema";
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

    const now = new Date();
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const slots = await db
      .select({
        id: dailySlots.id,
        name: dailySlots.name,
        startTime: dailySlots.startTime,
        endTime: dailySlots.endTime,
        assignedMemberId: dailySlotAssignments.memberId,
      })
      .from(dailySlots)
      .leftJoin(dailySlotAssignments, eq(dailySlots.id, dailySlotAssignments.slotId))
      .where(
        and(
          eq(dailySlotAssignments.memberId, userId),
          eq(dailySlots.createdAt, startOfDay)
        )
      );

    let currentSlot = null;
    let timeLeft = null;

    slots.forEach((slot) => {
      if (!slot.startTime || !slot.endTime) {
        console.warn(`Invalid time format for slot ${slot.id}`);
        return;
      }

      const startHours = parseInt(slot.startTime.split(":")[0], 10);
      const endHours = parseInt(slot.endTime.split(":")[0], 10);
      const isMidnightSpanning = endHours < startHours;

      let startDate = now.toDateString();
      let endDate = now.toDateString();
      if (isMidnightSpanning) {
        const prevDay = new Date(now);
        prevDay.setDate(now.getDate() - 1);
        startDate = prevDay.toDateString();
      }

      const startTime = new Date(`${startDate} ${slot.startTime}`);
      const endTime = new Date(`${endDate} ${slot.endTime}`);

      if (isNaN(startTime) || isNaN(endTime)) {
        console.warn(`Invalid date object for slot ${slot.id}`);
        return;
      }

      if (now >= startTime && now < endTime) {
        currentSlot = slot;
        timeLeft = Math.max(0, Math.floor((endTime - now) / 1000));
      }
    });

    console.log("Current MRI fetched:", { userId, date, currentSlot });

    return NextResponse.json({ currentSlot, timeLeft });
  } catch (error) {
    console.error("Error fetching current MRI:", error);
    return NextResponse.json({ error: `Failed to fetch current MRI: ${error.message}` }, { status: 500 });
  }
}