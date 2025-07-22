import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { ne, eq } from "drizzle-orm";

export async function GET(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let query = db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      team_manager_type: users.team_manager_type,
    }).from(users);

    if (session.user.role === "team_manager") {
      query = query.where(eq(users.team_manager_type, session.user.team_manager_type));
    }

    const userList = await query;
    return NextResponse.json({ users: userList });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}