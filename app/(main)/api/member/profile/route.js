import { NextResponse }      from "next/server";
import { db }                from "@/lib/db";
import { users, openCloseTimes } from "@/lib/schema";
import { auth }              from "@/lib/auth";
import { eq }                from "drizzle-orm";

/*  ──────────────────────────────────────────────────────────
    GET /api/member/profile
    Optional query: ?userType=<residential|non_residential|semi_residential>
    Returns:
      { user: {…}, times: {…}|null }
    ────────────────────────────────────────────────────────── */
export async function GET(req) {
  try {
    /* ---------- auth ---------- */
    const session = await auth();
    if (
      !session ||
      !session.user ||
      !["admin", "member"].includes(session.user.role)
    ) {
      console.error("Unauthorized access attempt:", { session });
      return NextResponse.json(
        { error: "Unauthorized: Admin or Member access required" },
        { status: 401 }
      );
    }

    /* ---------- current user ---------- */
    const userId = parseInt(session.user.id);

    /* ---------- query‑string params ---------- */
    const { searchParams } = new URL(req.url);
    const userTypeParam = searchParams.get("userType"); // may be null

    /* ---------- fetch user row ---------- */
    const [user] = await db
      .select({
        id:               users.id,
        name:             users.name,
        email:            users.email,
        role:             users.role,
        type:             users.type,
        whatsapp_number:  users.whatsapp_number,
        whatsapp_enabled: users.whatsapp_enabled,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    /* ---------- decide which userType to use ---------- */
    const effectiveType = userTypeParam || user.type; // fall back to stored type

    /* ---------- open/close lookup ---------- */
    let times = null;
    if (effectiveType) {
      const [openClose] = await db
        .select({
          dayOpenTime:        openCloseTimes.dayOpenTime,
          dayCloseTime:       openCloseTimes.dayCloseTime,
          closingWindowStart: openCloseTimes.closingWindowStart,
          closingWindowEnd:   openCloseTimes.closingWindowEnd,
        })
        .from(openCloseTimes)
        .where(eq(openCloseTimes.userType, effectiveType));

      if (openClose) {
        times = {
          dayOpenTime:        openClose.dayOpenTime,
          dayCloseTime:       openClose.dayCloseTime,
          closingWindowStart: openClose.closingWindowStart,
          closingWindowEnd:   openClose.closingWindowEnd,
        };
      }
    }

    console.log("User profile fetched:", {
      userId,
      userType: effectiveType,
      times,
      whatsapp_number: user.whatsapp_number,
    });

    return NextResponse.json({ user, times });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json(
      { error: `Failed to fetch user profile: ${error.message}` },
      { status: 500 }
    );
  }
}
