import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { ne } from "drizzle-orm";

export async function GET(req) {
  try {
    const session = await auth();
    if (!session || !session.user || !["admin", "team_manager"].includes(session.user.role)) {
      console.error("Unauthorized access attempt:", { session });
      return NextResponse.json({ error: "Unauthorized: Admin or Team Manager access required" }, { status: 401 });
    }

    const userId = parseInt(session.user.id);

    const availableUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        type: users.type,
        team_manager_type: users.team_manager_type,
        immediate_supervisor: users.immediate_supervisor,
      })
      .from(users)
      .where(ne(users.id, userId));

    console.log("Users fetched for task assignment:", availableUsers.length, { userId });

    return NextResponse.json(
      { users: availableUsers },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } }
    );
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: `Failed to fetch users: ${error.message}` }, { status: 500 });
  }
}
