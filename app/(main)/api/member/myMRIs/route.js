import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { dailySlotAssignments, dailySlots, assignedTasks, assignedTaskStatus } from "@/lib/schema";
import { eq, and, sql } from "drizzle-orm";

export async function GET(req) {
  // const session = await auth();
  // if (!session || !["member"].includes(session.user?.role)) {
  //   console.error("Unauthorized access attempt:", { user: session?.user });
  //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // }

    const session = await auth();
  if (!session || !["member", "team_manager"].includes(session.user?.role)) {
    console.error("Unauthorized access attempt:", { user: session?.user });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }


  const { searchParams } = new URL(req.url);
  const section = searchParams.get("section");
  const memberId = session.user.id;

  try {
    if (section === "today") {
      // Fetch today's A-MRIs from assigned_tasks
      const todayAMRIs = await db
        .select({
          title: assignedTasks.title,
          description: assignedTasks.description,
        })
        .from(assignedTasks)
        .innerJoin(assignedTaskStatus, eq(assignedTasks.id, assignedTaskStatus.taskId))
        .where(
          and(
            eq(assignedTaskStatus.memberId, memberId),
            eq(assignedTasks.taskType, "assigned"),
            sql`CAST(${assignedTaskStatus.assignedDate} AS TEXT) = ${new Date("2025-07-28").toISOString().split("T")[0]}`
          )
        );

      // Fetch all N-MRIs assigned to the user for today
      const todaySlots = await db
        .select({
          id: dailySlots.id,
          name: dailySlots.name,
          startTime: dailySlots.startTime,
          endTime: dailySlots.endTime,
          className: dailySlotAssignments.className,
          subject: dailySlotAssignments.subject,
          assignedMemberId: dailySlotAssignments.memberId,
        })
        .from(dailySlotAssignments)
        .innerJoin(dailySlots, eq(dailySlotAssignments.slotId, dailySlots.id))
        .where(eq(dailySlotAssignments.memberId, memberId))
        .orderBy(dailySlots.id);

      // Format slots without time-based filtering
      const formattedSlots = todaySlots.map((slot) => {
        if (!slot.startTime || !slot.endTime || !/^\d{2}:\d{2}:\d{2}$/.test(slot.startTime) || !/^\d{2}:\d{2}:\d{2}$/.test(slot.endTime)) {
          console.warn(`Invalid time format for slot ${slot.id}: ${slot.startTime} - ${slot.endTime}`);
          return null;
        }
        return {
          id: slot.id,
          name: slot.name,
          time: `${slot.startTime} - ${slot.endTime}`,
          className: slot.className || "N/A",
          subject: slot.subject || "N/A",
        };
      }).filter(slot => slot !== null);

      console.log("Fetched today's MRIs:", { aMRIs: todayAMRIs, nMRIs: formattedSlots });
      return NextResponse.json({ aMRIs: todayAMRIs, nMRIs: formattedSlots }, { status: 200 });
    }

    if (section === "weekly") {
      // Fetch weekly A-MRIs from assigned_tasks
      const weeklyAMRIs = await db
        .select({
          title: assignedTasks.title,
          description: assignedTasks.description,
          assignedDate: assignedTaskStatus.assignedDate,
        })
        .from(assignedTasks)
        .innerJoin(assignedTaskStatus, eq(assignedTasks.id, assignedTaskStatus.taskId))
        .where(
          and(
            eq(assignedTaskStatus.memberId, memberId),
            eq(assignedTasks.taskType, "assigned")
          )
        );

      // Group A-MRIs by day
      const weeklyAMRIsByDay = [
        { day: "Monday", tasks: [] },
        { day: "Tuesday", tasks: [] },
        { day: "Wednesday", tasks: [] },
        { day: "Thursday", tasks: [] },
        { day: "Friday", tasks: [] },
        { day: "Saturday", tasks: [] },
        { day: "Sunday", tasks: [] },
      ].map((dayObj) => ({
        ...dayObj,
        tasks: weeklyAMRIs
          .filter((task) => {
            const taskDate = new Date(task.assignedDate);
            return taskDate.toLocaleDateString("en-US", { weekday: "long" }) === dayObj.day;
          })
          .map((task) => `${task.title}${task.description ? ` - ${task.description}` : ""}`),
      }));

      // Fetch weekly N-MRIs from daily_slot_assignments (same for whole week)
      const weeklyNMRIs = await db
        .select({
          id: dailySlots.id,
          name: dailySlots.name,
          startTime: dailySlots.startTime,
          endTime: dailySlots.endTime,
          className: dailySlotAssignments.className,
          subject: dailySlotAssignments.subject,
          assignedMemberId: dailySlotAssignments.memberId,
        })
        .from(dailySlotAssignments)
        .innerJoin(dailySlots, eq(dailySlotAssignments.slotId, dailySlots.id))
        .where(eq(dailySlotAssignments.memberId, memberId))
        .orderBy(dailySlots.id);

      const formattedNMRIs = weeklyNMRIs.map((slot) => ({
        id: slot.id,
        name: slot.name,
        time: `${slot.startTime} - ${slot.endTime}`,
        className: slot.className || "N/A",
        subject: slot.subject || "N/A",
      }));

      console.log("Fetched weekly MRIs:", { aMRIs: weeklyAMRIsByDay, nMRIs: formattedNMRIs });
      return NextResponse.json({ aMRIs: weeklyAMRIsByDay, nMRIs: formattedNMRIs }, { status: 200 });
    }

    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  } catch (error) {
    console.error(`Error fetching ${section}:`, error);
    return NextResponse.json({ error: `Failed to fetch ${section}: ${error.message}` }, { status: 500 });
  }
}