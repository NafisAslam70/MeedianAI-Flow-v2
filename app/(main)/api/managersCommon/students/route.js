import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { students } from "@/lib/schema";

export async function GET() {
  const session = await auth();
  if (!session || !["admin","team_manager"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const rows = await db
      .select({
        id: students.id,
        name: students.name,
        className: students.class_name,
        residentialStatus: students.residential_status,
      })
      .from(students);
    return NextResponse.json({ students: rows }, { status: 200 });
  } catch (e) {
    console.error("GET managersCommon/students error", e);
    return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 });
  }
}

