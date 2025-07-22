import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberHistory, users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    console.log("Unauthorized access attempt:", { session: session?.user });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let query = db
      .select({
        id: memberHistory.id,
        title: memberHistory.title,
        status: memberHistory.status,
        completedAt: memberHistory.completedAt,
        comment: memberHistory.comment,
        memberId: memberHistory.memberId,
        memberName: users.name,
      })
      .from(memberHistory)
      .leftJoin(users, eq(memberHistory.memberId, users.id));

    if (session.user.role === "team_manager") {
      query = query.where(
        and(
          eq(users.team_manager_type, session.user.team_manager_type),
          eq(memberHistory.memberId, parseInt(session.user.id))
        )
      );
    } else {
      query = query.where(eq(memberHistory.memberId, parseInt(session.user.id)));
    }

    const history = await query;
    return NextResponse.json({ history });
  } catch (error) {
    console.error("Error fetching history:", error);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}