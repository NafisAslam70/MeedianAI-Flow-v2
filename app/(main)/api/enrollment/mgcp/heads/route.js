import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { mgcpHeads, users } from "@/lib/schema";
import { asc, eq } from "drizzle-orm";

const requireManager = (session) =>
  Boolean(session?.user) && ["admin", "team_manager"].includes(session.user.role);

export async function GET() {
  const session = await auth();
  if (!requireManager(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await db
      .select({
        id: mgcpHeads.id,
        userId: mgcpHeads.userId,
        active: mgcpHeads.active,
        name: users.name,
        email: users.email,
        role: users.role,
      })
      .from(mgcpHeads)
      .leftJoin(users, eq(users.id, mgcpHeads.userId))
      .orderBy(asc(users.name));

    return NextResponse.json({ heads: rows }, { status: 200 });
  } catch (error) {
    console.error("GET mgcp heads error:", error);
    return NextResponse.json({ error: "Failed to load MGCP heads" }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await auth();
  if (!requireManager(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userId = Number(body?.userId);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  try {
    const existing = await db
      .select({ id: mgcpHeads.id })
      .from(mgcpHeads)
      .where(eq(mgcpHeads.userId, userId));
    if (existing.length) {
      return NextResponse.json({ head: existing[0] }, { status: 200 });
    }

    const [head] = await db
      .insert(mgcpHeads)
      .values({
        userId,
        createdBy: session.user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return NextResponse.json({ head }, { status: 201 });
  } catch (error) {
    console.error("POST mgcp heads error:", error);
    return NextResponse.json({ error: "Failed to add MGCP head" }, { status: 500 });
  }
}

export async function PATCH(request) {
  const session = await auth();
  if (!requireManager(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = Number(body?.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const updates = {};
  if (typeof body?.active === "boolean") updates.active = body.active;
  updates.updatedAt = new Date();

  try {
    const [head] = await db.update(mgcpHeads).set(updates).where(eq(mgcpHeads.id, id)).returning();
    return NextResponse.json({ head }, { status: 200 });
  } catch (error) {
    console.error("PATCH mgcp heads error:", error);
    return NextResponse.json({ error: "Failed to update MGCP head" }, { status: 500 });
  }
}

export async function DELETE(request) {
  const session = await auth();
  if (!requireManager(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = Number(body?.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    await db.delete(mgcpHeads).where(eq(mgcpHeads.id, id));
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("DELETE mgcp heads error:", error);
    return NextResponse.json({ error: "Failed to remove MGCP head" }, { status: 500 });
  }
}
