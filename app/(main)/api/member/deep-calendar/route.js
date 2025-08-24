// app/(main)/api/member/deep-calendar/route.js
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth"; // <-- from your NextAuth v5 setup
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";

const DC_ORIGIN = "https://deep-calendar.vercel.app";

// Validate DeepCalendar token by hitting a public endpoint
async function validateDeepCalendarToken(token) {
  try {
    const res = await fetch(`${DC_ORIGIN}/api/public/${token}/goals`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
    return res.ok;
  } catch (err) {
    console.error("Token validation error:", err?.message || err);
    return false;
  }
}

export async function POST(request) {
  try {
    const session = await auth(); // v5
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { deep_calendar_token } = await request.json();
    if (!deep_calendar_token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const isValid = await validateDeepCalendarToken(deep_calendar_token);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid DeepCalendar token" }, { status: 400 });
    }

    await db
      .update(users)
      .set({ deep_calendar_token })
      .where(eq(users.id, parseInt(session.user.id, 10)));

    return NextResponse.json({ message: "Token saved successfully" }, { status: 200 });
  } catch (error) {
    console.error("POST /api/member/deep-calendar error:", error?.message || error);
    return NextResponse.json({ error: "Failed to save token" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await auth(); // v5
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [row] = await db
      .select({ deep_calendar_token: users.deep_calendar_token })
      .from(users)
      .where(eq(users.id, parseInt(session.user.id, 10)))
      .limit(1);

    return NextResponse.json(
      { deep_calendar_token: row?.deep_calendar_token ?? null },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/member/deep-calendar error:", error?.message || error);
    return NextResponse.json({ error: "Failed to retrieve token" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await auth(); // v5
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await db
      .update(users)
      .set({ deep_calendar_token: null })
      .where(eq(users.id, parseInt(session.user.id, 10)));

    return NextResponse.json({ message: "Token removed successfully" }, { status: 200 });
  } catch (error) {
    console.error("DELETE /api/member/deep-calendar error:", error?.message || error);
    return NextResponse.json({ error: "Failed to remove token" }, { status: 500 });
  }
}
