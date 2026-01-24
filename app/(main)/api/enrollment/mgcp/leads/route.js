import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { mgcpLeads } from "@/lib/schema";
import { asc, eq, isNull } from "drizzle-orm";

const requireManager = (session) =>
  Boolean(session?.user) && ["admin", "team_manager"].includes(session.user.role);

export async function GET(request) {
  const session = await auth();
  if (!requireManager(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const beltId = Number(searchParams.get("beltId"));
  const scope = searchParams.get("scope") || "";

  try {
    let query = db.select().from(mgcpLeads).orderBy(asc(mgcpLeads.name));
    if (scope === "random") {
      query = query.where(isNull(mgcpLeads.beltId));
    } else if (Number.isFinite(beltId)) {
      query = query.where(eq(mgcpLeads.beltId, beltId));
    }
    const rows = await query;
    return NextResponse.json({ leads: rows }, { status: 200 });
  } catch (error) {
    console.error("GET mgcp leads error:", error);
    return NextResponse.json({ error: "Failed to load leads" }, { status: 500 });
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

  const beltId = body?.beltId ? Number(body.beltId) : null;
  const guardianId = body?.guardianId ? Number(body.guardianId) : null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const whatsapp = typeof body?.whatsapp === "string" ? body.whatsapp.trim() : "";
  const location = typeof body?.location === "string" ? body.location.trim() : "";
  const source = typeof body?.source === "string" ? body.source.trim() : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";
  const status = typeof body?.status === "string" ? body.status.trim() : "new";
  const category = typeof body?.category === "string" ? body.category.trim() : "MGCP Lead";

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const [lead] = await db
      .insert(mgcpLeads)
      .values({
        beltId: Number.isFinite(beltId) ? beltId : null,
        guardianId: Number.isFinite(guardianId) ? guardianId : null,
        name,
        phone: phone || null,
        whatsapp: whatsapp || null,
        location: location || null,
        source: source || null,
        notes: notes || null,
        category: category || "MGCP Lead",
        status: status || "new",
        createdAt: new Date(),
      })
      .returning();
    return NextResponse.json({ lead }, { status: 201 });
  } catch (error) {
    console.error("POST mgcp leads error:", error);
    return NextResponse.json({ error: "Failed to add lead" }, { status: 500 });
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
  if (typeof body?.location === "string") updates.location = body.location.trim();
  if (typeof body?.source === "string") updates.source = body.source.trim();
  if (typeof body?.notes === "string") updates.notes = body.notes.trim();
  if (typeof body?.category === "string") updates.category = body.category.trim();
  if (typeof body?.status === "string") updates.status = body.status.trim();
  if (typeof body?.guardianId !== "undefined") {
    const nextGuardianId = Number(body.guardianId);
    updates.guardianId = Number.isFinite(nextGuardianId) ? nextGuardianId : null;
  }

  try {
    const [lead] = await db.update(mgcpLeads).set(updates).where(eq(mgcpLeads.id, id)).returning();
    return NextResponse.json({ lead }, { status: 200 });
  } catch (error) {
    console.error("PATCH mgcp leads error:", error);
    return NextResponse.json({ error: "Failed to update lead" }, { status: 500 });
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
    await db.delete(mgcpLeads).where(eq(mgcpLeads.id, id));
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("DELETE mgcp leads error:", error);
    return NextResponse.json({ error: "Failed to delete lead" }, { status: 500 });
  }
}
