import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, openCloseTimes } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function GET(req) {
  try {
    const session = await auth();
    if (!session || !session.user || !["admin", "member"].includes(session.user.role)) {
      console.error("Unauthorized access attempt:", { session });
      return NextResponse.json({ error: "Unauthorized: Admin or Member access required" }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const { searchParams } = new URL(req.url);
    const userType = searchParams.get("userType");

    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        type: users.type,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let times = null;
    if (userType) {
      const [openClose] = await db
        .select({
          dayOpenTime: openCloseTimes.dayOpenTime,
          dayCloseTime: openCloseTimes.dayCloseTime,
          closingWindowStart: openCloseTimes.closingWindowStart,
          closingWindowEnd: openCloseTimes.closingWindowEnd,
        })
        .from(openCloseTimes)
        .where(eq(openCloseTimes.userType, userType));

      if (openClose) {
        times = {
          dayOpenTime: openClose.dayOpenTime,
          dayCloseTime: openClose.dayCloseTime,
          closingWindowStart: openClose.closingWindowStart,
          closingWindowEnd: openClose.closingWindowEnd,
        };
      }
    }

    console.log("User profile fetched:", { userId, userType, times });

    return NextResponse.json({ user, times });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json({ error: `Failed to fetch user profile: ${error.message}` }, { status: 500 });
  }
}