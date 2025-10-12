"use server";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { campusGateStaffLogs } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";

const allowedRoles = new Set(["admin", "team_manager", "member"]);

export async function POST(req) {
  const session = await auth();
  if (!session || !allowedRoles.has(session.user?.role || "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawDirection = typeof payload?.direction === "string" ? payload.direction.trim().toLowerCase() : "";
  if (!rawDirection || !["out", "in"].includes(rawDirection)) {
    return NextResponse.json({ error: "direction must be 'out' or 'in'" }, { status: 400 });
  }

  const purpose =
    rawDirection === "out"
      ? typeof payload?.purpose === "string"
        ? payload.purpose.trim()
        : ""
      : "";

  if (rawDirection === "out" && !purpose) {
    return NextResponse.json({ error: "Purpose is required when logging OUT" }, { status: 400 });
  }

  try {
    const [log] = await db
      .insert(campusGateStaffLogs)
      .values({
        userId: Number(session.user.id),
        direction: rawDirection,
        purpose: rawDirection === "out" ? purpose : null,
      })
      .returning({
        id: campusGateStaffLogs.id,
        direction: campusGateStaffLogs.direction,
        purpose: campusGateStaffLogs.purpose,
        recordedAt: campusGateStaffLogs.recordedAt,
      });

    return NextResponse.json(
      {
        log: {
          id: log.id,
          direction: log.direction,
          purpose: log.purpose,
          recordedAt: log.recordedAt instanceof Date ? log.recordedAt.toISOString() : log.recordedAt,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to record gate log", error);
    return NextResponse.json({ error: "Failed to record gate log" }, { status: 500 });
  }
}

export async function GET(req) {
  const session = await auth();
  if (!session || !allowedRoles.has(session.user?.role || "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limitParam = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(50, limitParam)) : 10;

  try {
    const rows = await db
      .select({
        id: campusGateStaffLogs.id,
        direction: campusGateStaffLogs.direction,
        purpose: campusGateStaffLogs.purpose,
        recordedAt: campusGateStaffLogs.recordedAt,
      })
      .from(campusGateStaffLogs)
      .where(eq(campusGateStaffLogs.userId, Number(session.user.id)))
      .orderBy(desc(campusGateStaffLogs.recordedAt))
      .limit(limit);

    const logs = rows.map((row) => ({
      id: row.id,
      direction: row.direction,
      purpose: row.purpose,
      recordedAt: row.recordedAt instanceof Date ? row.recordedAt.toISOString() : row.recordedAt,
    }));

    return NextResponse.json({ logs }, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch gate logs", error);
    return NextResponse.json({ error: "Failed to fetch gate logs" }, { status: 500 });
  }
}
