import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { mgcpVillages } from "@/lib/schema";
import { asc, eq } from "drizzle-orm";

const requireManager = (session) =>
  Boolean(session?.user) && ["admin", "team_manager"].includes(session.user.role);

export async function GET(request) {
  const session = await auth();
  if (!requireManager(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const beltId = Number(searchParams.get("beltId"));

  try {
    let query = db.select().from(mgcpVillages).orderBy(asc(mgcpVillages.name));
    if (Number.isFinite(beltId)) {
      query = query.where(eq(mgcpVillages.beltId, beltId));
    }
    const rows = await query;
    return NextResponse.json({ villages: rows }, { status: 200 });
  } catch (error) {
    console.error("GET mgcp villages error:", error);
    return NextResponse.json({ error: "Failed to load villages" }, { status: 500 });
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

  const beltId = Number(body?.beltId);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";
  if (!Number.isFinite(beltId) || !name) {
    return NextResponse.json({ error: "beltId and name are required" }, { status: 400 });
  }

  try {
    const [village] = await db
      .insert(mgcpVillages)
      .values({
        beltId,
        name,
        notes: notes || null,
        createdBy: session.user.id,
        createdAt: new Date(),
      })
      .returning();
    return NextResponse.json({ village }, { status: 201 });
  } catch (error) {
    console.error("POST mgcp villages error:", error);
    return NextResponse.json({ error: "Failed to add village" }, { status: 500 });
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
  if (typeof body?.name === "string") updates.name = body.name.trim();
  if (typeof body?.notes === "string") updates.notes = body.notes.trim();
  if (typeof body?.active === "boolean") updates.active = body.active;

  try {
    const [village] = await db.update(mgcpVillages).set(updates).where(eq(mgcpVillages.id, id)).returning();
    return NextResponse.json({ village }, { status: 200 });
  } catch (error) {
    console.error("PATCH mgcp villages error:", error);
    return NextResponse.json({ error: "Failed to update village" }, { status: 500 });
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
    await db.delete(mgcpVillages).where(eq(mgcpVillages.id, id));
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("DELETE mgcp villages error:", error);
    return NextResponse.json({ error: "Failed to delete village" }, { status: 500 });
  }
}
