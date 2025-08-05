// app/(main)/api/member/adminsAndManagers/route.js
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { users } from "@/lib/schema";
import { eq, or } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const adminsAndManagers = await db
      .select({
        id: users.id,
        name: users.name,
      })
      .from(users)
      .where(
        or(
          eq(users.role, "admin"),
          eq(users.role, "team_manager")
        )
      );

    return NextResponse.json({ users: adminsAndManagers }, { status: 200 });
  } catch (error) {
    console.error("GET /api/member/adminsAndManagers error:", error);
    return NextResponse.json({ error: `Failed to fetch admins and managers: ${error.message}` }, { status: 500 });
  }
}