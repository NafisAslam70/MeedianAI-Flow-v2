"use server";

import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { db } from "@/lib/db";
import { dayCloseRequests } from "@/lib/schema";
import { and, gte, lte, eq, count } from "drizzle-orm";

const allowedRoles = new Set(["admin", "team_manager"]);

export async function GET(req) {
  try {
    const token = await getToken({ req, secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET });
    if (!token?.role || !allowedRoles.has(token.role)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");

    const start = startParam ? new Date(startParam) : null;
    const end = endParam ? new Date(endParam) : null;
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }

    const rows = await db
      .select({
        userId: dayCloseRequests.userId,
        count: count(dayCloseRequests.id).as("count"),
      })
      .from(dayCloseRequests)
      .where(
        and(
          eq(dayCloseRequests.status, "approved"),
          gte(dayCloseRequests.date, start),
          lte(dayCloseRequests.date, end)
        )
      )
      .groupBy(dayCloseRequests.userId);

    return NextResponse.json({
      counts: rows.map((r) => ({ userId: r.userId, count: Number(r.count) || 0 })),
      range: { start: start.toISOString(), end: end.toISOString() },
    });
  } catch (error) {
    console.error("GET /api/managersCommon/dayClose/summary error", error);
    return NextResponse.json({ error: "Failed to load day close summary" }, { status: 500 });
  }
}
