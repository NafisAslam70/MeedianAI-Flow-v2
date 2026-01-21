import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Classes, users } from "@/lib/schema";
import { asc } from "drizzle-orm";

export async function GET(req) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const section = String(searchParams.get("section") || "").toLowerCase();

    if (section === "classes") {
      const rows = await db
        .select({
          id: Classes.id,
          name: Classes.name,
          section: Classes.section,
          track: Classes.track,
          active: Classes.active,
        })
        .from(Classes)
        .orderBy(asc(Classes.name), asc(Classes.section));
      return NextResponse.json({ classes: rows }, { status: 200 });
    }

    if (section === "users") {
      const rows = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          type: users.type,
          team_manager_type: users.team_manager_type,
          immediate_supervisor: users.immediate_supervisor,
          isTeacher: users.isTeacher,
        })
        .from(users)
        .orderBy(asc(users.name));
      return NextResponse.json({ users: rows }, { status: 200 });
    }

    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  } catch (error) {
    console.error("Error fetching hostel daily due options:", error);
    return NextResponse.json({ error: "Failed to fetch options" }, { status: 500 });
  }
}
