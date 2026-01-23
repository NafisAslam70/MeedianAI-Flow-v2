import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  mgcpBelts,
  mgcpVillages,
  mgcpLeadManagers,
  mgcpBeltGuardians,
  mgcpLeads,
} from "@/lib/schema";
import { asc, eq } from "drizzle-orm";

const requireManager = (session) =>
  Boolean(session?.user) && ["admin", "team_manager"].includes(session.user.role);

const mapBelt = (belt) => ({
  id: belt.id,
  name: belt.name,
  notes: belt.notes,
  active: belt.active !== false,
  createdAt: belt.createdAt instanceof Date ? belt.createdAt.toISOString() : belt.createdAt,
});

export async function GET() {
  const session = await auth();
  if (!requireManager(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [beltRows, villageRows, managerRows, guardianRows, leadRows] = await Promise.all([
      db.select().from(mgcpBelts).orderBy(asc(mgcpBelts.name)),
      db.select().from(mgcpVillages).orderBy(asc(mgcpVillages.name)),
      db.select().from(mgcpLeadManagers).orderBy(asc(mgcpLeadManagers.name)),
      db.select().from(mgcpBeltGuardians).orderBy(asc(mgcpBeltGuardians.guardianName)),
      db.select().from(mgcpLeads).orderBy(asc(mgcpLeads.name)),
    ]);

    const beltMap = new Map();
    beltRows.forEach((belt) => {
      beltMap.set(belt.id, {
        ...mapBelt(belt),
        villages: [],
        leadManagers: [],
        guardians: [],
        leads: [],
      });
    });

    villageRows.forEach((village) => {
      const belt = beltMap.get(village.beltId);
      if (belt) belt.villages.push(village);
    });

    managerRows.forEach((manager) => {
      const belt = beltMap.get(manager.beltId);
      if (belt) belt.leadManagers.push(manager);
    });

    guardianRows.forEach((guardian) => {
      const belt = beltMap.get(guardian.beltId);
      if (belt) belt.guardians.push(guardian);
    });

    const randomLeads = [];
    leadRows.forEach((lead) => {
      if (!lead.beltId) {
        randomLeads.push(lead);
        return;
      }
      const belt = beltMap.get(lead.beltId);
      if (belt) belt.leads.push(lead);
    });

    return NextResponse.json(
      {
        belts: Array.from(beltMap.values()),
        randomLeads,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET mgcp belts error:", error);
    return NextResponse.json({ error: "Failed to load MGCP belts" }, { status: 500 });
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

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const [belt] = await db
      .insert(mgcpBelts)
      .values({
        name,
        notes: notes || null,
        createdBy: session.user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return NextResponse.json({ belt }, { status: 201 });
  } catch (error) {
    console.error("POST mgcp belts error:", error);
    return NextResponse.json({ error: "Failed to create belt" }, { status: 500 });
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

  const updates = { updatedAt: new Date() };
  if (typeof body?.name === "string") updates.name = body.name.trim();
  if (typeof body?.notes === "string") updates.notes = body.notes.trim();
  if (typeof body?.active === "boolean") updates.active = body.active;

  try {
    const [belt] = await db.update(mgcpBelts).set(updates).where(eq(mgcpBelts.id, id)).returning();
    return NextResponse.json({ belt }, { status: 200 });
  } catch (error) {
    console.error("PATCH mgcp belts error:", error);
    return NextResponse.json({ error: "Failed to update belt" }, { status: 500 });
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
    await db.delete(mgcpBelts).where(eq(mgcpBelts.id, id));
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("DELETE mgcp belts error:", error);
    return NextResponse.json({ error: "Failed to delete belt" }, { status: 500 });
  }
}
