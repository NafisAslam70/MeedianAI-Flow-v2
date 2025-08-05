import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { generalLogs } from "@/lib/schema";

export async function POST(req) {
  const session = await auth();
  if (!session || !["member", "team_manager"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { action, details } = body;

  try {
    await db.insert(generalLogs).values({
      userId: session.user.id,
      action,
      details,
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: "Failed to log" }, { status: 500 });
  }
}