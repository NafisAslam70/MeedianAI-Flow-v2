import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { mgcpLeadManagers } from "@/lib/schema";
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
    let query = db.select().from(mgcpLeadManagers).orderBy(asc(mgcpLeadManagers.name));
    if (Number.isFinite(beltId)) {
      query = query.where(eq(mgcpLeadManagers.beltId, beltId));
    }
    const rows = await query;
    return NextResponse.json({ managers: rows }, { status: 200 });
  } catch (error) {
    console.error("GET mgcp lead managers error:", error);
    return NextResponse.json({ error: "Failed to load lead managers" }, { status: 500 });
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
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const whatsapp = typeof body?.whatsapp === "string" ? body.whatsapp.trim() : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";

  if (!Number.isFinite(beltId) || !name) {
    return NextResponse.json({ error: "beltId and name are required" }, { status: 400 });
  }

  try {
    const [manager] = await db
      .insert(mgcpLeadManagers)
      .values({
        beltId,
        name,
        phone: phone || null,
        whatsapp: whatsapp || null,
        notes: notes || null,
        createdAt: new Date(),
        createdBy: session.user.id,
      })
      .returning();
    return NextResponse.json({ manager }, { status: 201 });
  } catch (error) {
    console.error("POST mgcp lead managers error:", error);
    return NextResponse.json({ error: "Failed to add lead manager" }, { status: 500 });
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
  if (typeof body?.phone === "string") updates.phone = body.phone.trim();
  if (typeof body?.whatsapp === "string") updates.whatsapp = body.whatsapp.trim();
  if (typeof body?.notes === "string") updates.notes = body.notes.trim();
  if (typeof body?.active === "boolean") updates.active = body.active;

  try {
    const [manager] = await db.update(mgcpLeadManagers).set(updates).where(eq(mgcpLeadManagers.id, id)).returning();
    return NextResponse.json({ manager }, { status: 200 });
  } catch (error) {
    console.error("PATCH mgcp lead managers error:", error);
    return NextResponse.json({ error: "Failed to update lead manager" }, { status: 500 });
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
    await db.delete(mgcpLeadManagers).where(eq(mgcpLeadManagers.id, id));
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("DELETE mgcp lead managers error:", error);
    return NextResponse.json({ error: "Failed to delete lead manager" }, { status: 500 });
  }
}
