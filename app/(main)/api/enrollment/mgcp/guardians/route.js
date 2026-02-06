import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { mgcpBeltGuardians } from "@/lib/schema";
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
    let query = db.select().from(mgcpBeltGuardians).orderBy(asc(mgcpBeltGuardians.guardianName));
    if (Number.isFinite(beltId)) {
      query = query.where(eq(mgcpBeltGuardians.beltId, beltId));
    }
    const rows = await query;
    return NextResponse.json({ guardians: rows }, { status: 200 });
  } catch (error) {
    console.error("GET mgcp guardians error:", error);
    return NextResponse.json({ error: "Failed to load guardians" }, { status: 500 });
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
  const guardianName = typeof body?.guardianName === "string" ? body.guardianName.trim() : "";
  const guardianPhone = typeof body?.guardianPhone === "string" ? body.guardianPhone.trim() : "";
  const guardianWhatsapp = typeof body?.guardianWhatsapp === "string" ? body.guardianWhatsapp.trim() : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";
  const studentId = body?.studentId ? Number(body.studentId) : null;
  const isTrusted = Boolean(body?.isTrusted);

  if (!Number.isFinite(beltId) || !guardianName) {
    return NextResponse.json({ error: "beltId and guardianName are required" }, { status: 400 });
  }

  try {
    const [guardian] = await db
      .insert(mgcpBeltGuardians)
      .values({
        beltId,
        guardianName,
        guardianPhone: guardianPhone || null,
        guardianWhatsapp: guardianWhatsapp || null,
        studentId: Number.isFinite(studentId) ? studentId : null,
        isTrusted,
        notes: notes || null,
        createdBy: session.user.id,
        createdAt: new Date(),
      })
      .returning();
    return NextResponse.json({ guardian }, { status: 201 });
  } catch (error) {
    console.error("POST mgcp guardians error:", error);
    return NextResponse.json({ error: "Failed to add guardian" }, { status: 500 });
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
  if (typeof body?.guardianName === "string") updates.guardianName = body.guardianName.trim();
  if (typeof body?.guardianPhone === "string") updates.guardianPhone = body.guardianPhone.trim();
  if (typeof body?.guardianWhatsapp === "string") updates.guardianWhatsapp = body.guardianWhatsapp.trim();
  if (typeof body?.notes === "string") updates.notes = body.notes.trim();
  if (typeof body?.isTrusted === "boolean") updates.isTrusted = body.isTrusted;

  try {
    const [guardian] = await db
      .update(mgcpBeltGuardians)
      .set(updates)
      .where(eq(mgcpBeltGuardians.id, id))
      .returning();
    return NextResponse.json({ guardian }, { status: 200 });
  } catch (error) {
    console.error("PATCH mgcp guardians error:", error);
    return NextResponse.json({ error: "Failed to update guardian" }, { status: 500 });
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
    await db.delete(mgcpBeltGuardians).where(eq(mgcpBeltGuardians.id, id));
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("DELETE mgcp guardians error:", error);
    return NextResponse.json({ error: "Failed to delete guardian" }, { status: 500 });
  }
}
