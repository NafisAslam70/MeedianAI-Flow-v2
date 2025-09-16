// app/api/managersCommon/dayCloseRequests/route.js
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { dayCloseRequests, users } from "@/lib/schema";
import { eq, and, gte, lt, desc, inArray, like } from "drizzle-orm";

export async function GET(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const section = searchParams.get("section");
  if (section === 'counts') {
    try {
      // Pending requests; for team_manager: only direct reports
      const base = db
        .select({ id: dayCloseRequests.id })
        .from(dayCloseRequests)
        .innerJoin(users, eq(dayCloseRequests.userId, users.id))
        .where(eq(dayCloseRequests.status, 'pending'));
      let rows;
      if (session.user.role === 'team_manager') {
        rows = await base.where(and(eq(dayCloseRequests.status, 'pending'), eq(users.immediate_supervisor, Number(session.user.id))));
      } else {
        rows = await base;
      }
      return NextResponse.json({ pendingCount: rows.length }, { status: 200 });
    } catch (e) {
      console.error('GET /dayCloseRequests?section=counts error', e);
      return NextResponse.json({ pendingCount: 0 }, { status: 200 });
    }
  }
  const dateParam = searchParams.get("date"); // optional: "YYYY-MM-DD"
  const userIdParam = searchParams.get("userId"); // optional: exact user ID
  const userNameParam = searchParams.get("userName"); // optional: partial name search
  const statusParam = searchParams.get("status"); // optional: "pending" | "approved" | "rejected"
  const historyParam = searchParams.get("history"); // "true" for approved/rejected
  const timeframeParam = searchParams.get("timeframe"); // "today" | "lastWeek" | "lastDay" | "last15Days" | "lastMonth"

  try {
    const conditions = [];

    // Date filter: exact date
    if (dateParam) {
      const start = new Date(dateParam);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      conditions.push(and(gte(dayCloseRequests.date, start), lt(dayCloseRequests.date, end)));
    }

    // Timeframe filter: today, last week, last day, last 15 days, last month
    if (timeframeParam && historyParam === "true") {
      const now = new Date();
      let startDate;
      if (timeframeParam === "today") {
        startDate = new Date(now.setHours(0, 0, 0, 0)); // Start of today
      } else if (timeframeParam === "lastWeek") {
        startDate = new Date(now.setDate(now.getDate() - 7));
      } else if (timeframeParam === "lastDay") {
        startDate = new Date(now.setDate(now.getDate() - 1));
      } else if (timeframeParam === "last15Days") {
        startDate = new Date(now.setDate(now.getDate() - 15));
      } else if (timeframeParam === "lastMonth") {
        startDate = new Date(now.setDate(now.getDate() - 30));
      }
      if (startDate) {
        conditions.push(gte(dayCloseRequests.approvedAt, startDate));
      }
    }

    // User filter: exact userId or partial name search
    if (userIdParam) {
      conditions.push(eq(dayCloseRequests.userId, Number(userIdParam)));
    }
    if (userNameParam) {
      conditions.push(like(users.name, `%${userNameParam}%`));
    }

    // Status filter
    if (statusParam) {
      conditions.push(eq(dayCloseRequests.status, statusParam));
    }

    // History filter
    if (historyParam === "true") {
      conditions.push(inArray(dayCloseRequests.status, ["approved", "rejected"]));
    }

    const baseSelect = db
      .select({
        id: dayCloseRequests.id,
        userId: dayCloseRequests.userId,
        date: dayCloseRequests.date,
        status: dayCloseRequests.status,
        mriCleared: dayCloseRequests.mriCleared,
        assignedTasksUpdates: dayCloseRequests.assignedTasksUpdates,
        routineTasksUpdates: dayCloseRequests.routineTasksUpdates,
        routineLog: dayCloseRequests.routineLog,
        generalLog: dayCloseRequests.generalLog,
        ISRoutineLog: dayCloseRequests.ISRoutineLog,
        ISGeneralLog: dayCloseRequests.ISGeneralLog,
        createdAt: dayCloseRequests.createdAt,
        approvedBy: dayCloseRequests.approvedBy,
        approvedAt: dayCloseRequests.approvedAt,
        userName: users.name,
      })
      .from(dayCloseRequests)
      .innerJoin(users, eq(dayCloseRequests.userId, users.id))
      .orderBy(desc(historyParam === "true" ? dayCloseRequests.approvedAt : dayCloseRequests.createdAt));

    // Restrict team managers to only see requests from their immediate subordinates
    if (session.user.role === "team_manager") {
      conditions.push(eq(users.immediate_supervisor, Number(session.user.id)));
    }

    const requests = conditions.length
      ? await baseSelect.where(and(...conditions))
      : await baseSelect.where(eq(dayCloseRequests.status, "pending"));

    return NextResponse.json({ requests }, { status: 200 });
  } catch (error) {
    console.error("GET /api/managersCommon/dayCloseRequests error:", error);
    return NextResponse.json({ error: `Failed to fetch day close requests: ${error.message}` }, { status: 500 });
  }
}
