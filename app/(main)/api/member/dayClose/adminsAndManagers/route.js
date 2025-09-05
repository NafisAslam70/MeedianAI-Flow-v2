// app/(main)/api/member/dayClose/adminsAndManagers/route.js
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const selfId = Number(session.user.id);
    // fetch current user to get immediate supervisor
    const [self] = await db
      .select({ id: users.id, immediate_supervisor: users.immediate_supervisor })
      .from(users)
      .where(eq(users.id, selfId));

    const admins = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.role, "admin"));

    let supervisor = [];
    if (self?.immediate_supervisor) {
      supervisor = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.id, self.immediate_supervisor));
    }

    // de-duplicate by id (in case supervisor is also an admin)
    const map = new Map();
    [...admins, ...supervisor].forEach((u) => map.set(u.id, u));
    const recipients = Array.from(map.values());

    return NextResponse.json({ users: recipients }, { status: 200 });
  } catch (error) {
    console.error("GET /api/member/dayClose/adminsAndManagers error:", error);
    return NextResponse.json({ error: `Failed to fetch admins and IS: ${error.message}` }, { status: 500 });
  }
}
