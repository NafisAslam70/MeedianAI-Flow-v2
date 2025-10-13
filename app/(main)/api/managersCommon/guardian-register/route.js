import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { guardianGateLogs, managerSectionGrants, users } from "@/lib/schema";
import { and, desc, eq } from "drizzle-orm";

const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const hasGuardianAccess = async (user) => {
  if (!user) return false;
  if (user.role === "admin") return true;
  const grants = await db
    .select({ id: managerSectionGrants.id })
    .from(managerSectionGrants)
    .where(and(eq(managerSectionGrants.userId, user.id), eq(managerSectionGrants.section, "guardianGateLogs")));
  return grants.length > 0;
};

const mapEntry = (row) => ({
  id: row.id,
  visitDate: row.visitDate instanceof Date ? row.visitDate.toISOString().slice(0, 10) : row.visitDate,
  guardianName: row.guardianName,
  studentName: row.studentName,
  className: row.className,
  purpose: row.purpose,
  inAt: row.inAt instanceof Date ? row.inAt.toISOString() : row.inAt,
  outAt: row.outAt instanceof Date ? row.outAt.toISOString() : row.outAt,
  signature: row.signature,
  createdBy: row.createdBy,
  createdByName: row.createdByName,
  createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
});

export async function GET(req) {
  const session = await auth();
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const allowed = await hasGuardianAccess(session.user);
  if (!allowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");
  const targetDate = dateParam ? new Date(dateParam) : new Date();
  if (Number.isNaN(targetDate.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  const dayKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}-${String(targetDate.getDate()).padStart(2, "0")}`;

  const rows = await db
    .select({
      id: guardianGateLogs.id,
      visitDate: guardianGateLogs.visitDate,
      guardianName: guardianGateLogs.guardianName,
      studentName: guardianGateLogs.studentName,
      className: guardianGateLogs.className,
      purpose: guardianGateLogs.purpose,
      inAt: guardianGateLogs.inAt,
      outAt: guardianGateLogs.outAt,
      signature: guardianGateLogs.signature,
      createdBy: guardianGateLogs.createdBy,
      createdAt: guardianGateLogs.createdAt,
      updatedAt: guardianGateLogs.updatedAt,
      createdByName: users.name,
    })
    .from(guardianGateLogs)
    .leftJoin(users, eq(users.id, guardianGateLogs.createdBy))
    .where(eq(guardianGateLogs.visitDate, dayKey))
    .orderBy(desc(guardianGateLogs.createdAt));

  return NextResponse.json({ entries: rows.map(mapEntry) });
}

const parseTime = (raw, visitDateRaw, visitDate) => {
  if (!raw || (typeof raw === "string" && !raw.trim())) return null;
  const value = typeof raw === "string" ? raw.trim() : String(raw);
  if (!value) return null;
  const isoCandidate = value.includes("T") ? value : `${visitDateRaw}T${value}`;
  const parsed = new Date(isoCandidate);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  const parts = value.split(":").map((part) => Number(part));
  if (parts.length >= 2 && parts.every((num) => Number.isFinite(num))) {
    return new Date(
      visitDate.getFullYear(),
      visitDate.getMonth(),
      visitDate.getDate(),
      parts[0],
      parts[1],
      parts[2] && Number.isFinite(parts[2]) ? parts[2] : 0
    );
  }
  return null;
};

export async function POST(req) {
  const session = await auth();
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const allowed = await hasGuardianAccess(session.user);
  if (!allowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const visitDateRaw = typeof body?.visitDate === "string" ? body.visitDate.trim() : "";
  const guardianName = typeof body?.guardianName === "string" ? body.guardianName.trim() : "";
  const studentName = typeof body?.studentName === "string" ? body.studentName.trim() : "";
  const className = typeof body?.className === "string" ? body.className.trim() : "";
  const purpose = typeof body?.purpose === "string" ? body.purpose.trim() : "";
  const signature = typeof body?.signature === "string" ? body.signature.trim() : "";

  if (!visitDateRaw) {
    return NextResponse.json({ error: "visitDate is required" }, { status: 400 });
  }
  const visitDate = new Date(visitDateRaw);
  if (Number.isNaN(visitDate.getTime())) {
    return NextResponse.json({ error: "Invalid visitDate" }, { status: 400 });
  }
  if (!guardianName || !studentName || !className || !purpose) {
    return NextResponse.json({ error: "guardianName, studentName, className, and purpose are required" }, { status: 400 });
  }

  const inAt = parseTime(body?.inTime, visitDateRaw, visitDate);
  const outAt = parseTime(body?.outTime, visitDateRaw, visitDate);

  await db.insert(guardianGateLogs).values({
    visitDate,
    guardianName,
    studentName,
    className,
    purpose,
    inAt: inAt || null,
    outAt: outAt || null,
    signature: signature || null,
    createdBy: session.user.id,
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE(req) {
  const session = await auth();
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const allowed = await hasGuardianAccess(session.user);
  if (!allowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const id = Number(body?.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await db.delete(guardianGateLogs).where(eq(guardianGateLogs.id, id));

  return NextResponse.json({ ok: true }, { status: 200 });
}
