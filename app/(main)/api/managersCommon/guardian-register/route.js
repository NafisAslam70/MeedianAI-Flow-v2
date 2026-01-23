import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Classes, guardianGateLogs, managerSectionGrants, Students, users } from "@/lib/schema";
import { and, asc, desc, eq, gte, ilike, lte, or } from "drizzle-orm";

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
  feesSubmitted: Boolean(row.feesSubmitted),
  satisfactionIslamic:
    row.satisfactionIslamic === null || row.satisfactionIslamic === undefined
      ? null
      : Number(row.satisfactionIslamic),
  satisfactionAcademic:
    row.satisfactionAcademic === null || row.satisfactionAcademic === undefined
      ? null
      : Number(row.satisfactionAcademic),
  inAt: row.inAt instanceof Date ? row.inAt.toISOString() : row.inAt,
  outAt: row.outAt instanceof Date ? row.outAt.toISOString() : row.outAt,
  signature: row.signature,
  createdBy: row.createdBy,
  createdByName: row.createdByName,
  createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
});

const isMissingColumnError = (error) => {
  const code = error?.code || error?.cause?.code;
  if (code === "42703") return true;
  const message = String(error?.cause?.message || error?.message || "");
  return message.includes("does not exist");
};

const buildGuardianLogSelection = (withSatisfaction) => ({
  id: guardianGateLogs.id,
  visitDate: guardianGateLogs.visitDate,
  guardianName: guardianGateLogs.guardianName,
  studentName: guardianGateLogs.studentName,
  className: guardianGateLogs.className,
  purpose: guardianGateLogs.purpose,
  feesSubmitted: guardianGateLogs.feesSubmitted,
  ...(withSatisfaction
    ? {
        satisfactionIslamic: guardianGateLogs.satisfactionIslamic,
        satisfactionAcademic: guardianGateLogs.satisfactionAcademic,
      }
    : {}),
  inAt: guardianGateLogs.inAt,
  outAt: guardianGateLogs.outAt,
  signature: guardianGateLogs.signature,
  createdBy: guardianGateLogs.createdBy,
  createdAt: guardianGateLogs.createdAt,
  updatedAt: guardianGateLogs.updatedAt,
  createdByName: users.name,
});

const selectGuardianLogs = async (queryBuilder) => {
  try {
    return await queryBuilder(true);
  } catch (error) {
    if (!isMissingColumnError(error)) throw error;
    const rows = await queryBuilder(false);
    return rows.map((row) => ({
      ...row,
      satisfactionIslamic: null,
      satisfactionAcademic: null,
    }));
  }
};

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
  const section = searchParams.get("section") || "logs";
  if (section === "options") {
    const rows = await db
      .select({
        id: Students.id,
        name: Students.name,
        guardianName: Students.guardianName,
        className: Classes.name,
        classSection: Classes.section,
        classTrack: Classes.track,
      })
      .from(Students)
      .leftJoin(Classes, eq(Classes.id, Students.classId))
      .orderBy(asc(Classes.name), asc(Students.name));

    return NextResponse.json(
      {
        students: rows.map((row) => ({
          id: row.id,
          name: row.name,
          guardianName: row.guardianName,
          className: [row.className, row.classSection, row.classTrack].filter(Boolean).join(" ").trim() || null,
        })),
      },
      { status: 200 }
    );
  }

  if (section === "guardian") {
    const guardianName = searchParams.get("guardianName")?.trim() || "";
    const studentName = searchParams.get("studentName")?.trim() || "";
    const studentNamesRaw = searchParams.get("studentNames")?.trim() || "";
    const limit = Math.min(Number(searchParams.get("limit")) || 25, 200);
    const days = Math.min(Math.max(Number(searchParams.get("days")) || 90, 7), 365);

    const formatKey = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const parseDateKey = (value) => {
      if (!value) return null;
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return null;
      return formatKey(parsed);
    };

    const endKey = parseDateKey(searchParams.get("endDate")) || todayKey();
    const startKey =
      parseDateKey(searchParams.get("startDate")) ||
      formatKey(new Date(Date.now() - days * 24 * 60 * 60 * 1000));

    const nameFilters = [];
    if (guardianName) {
      nameFilters.push(ilike(guardianGateLogs.guardianName, `%${guardianName}%`));
    }

    if (studentName) {
      nameFilters.push(ilike(guardianGateLogs.studentName, `%${studentName}%`));
    }

    if (studentNamesRaw) {
      studentNamesRaw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .forEach((name) => nameFilters.push(ilike(guardianGateLogs.studentName, `%${name}%`)));
    }

    if (!nameFilters.length) {
      return NextResponse.json({ error: "guardianName or studentName is required" }, { status: 400 });
    }

    const rows = await selectGuardianLogs((withSatisfaction) =>
      db
        .select(buildGuardianLogSelection(withSatisfaction))
        .from(guardianGateLogs)
        .leftJoin(users, eq(users.id, guardianGateLogs.createdBy))
        .where(
          and(
            or(...nameFilters),
            gte(guardianGateLogs.visitDate, startKey),
            lte(guardianGateLogs.visitDate, endKey)
          )
        )
        .orderBy(desc(guardianGateLogs.visitDate), desc(guardianGateLogs.createdAt))
        .limit(limit)
    );

    return NextResponse.json({ entries: rows.map(mapEntry) }, { status: 200 });
  }

  const dateParam = searchParams.get("date");
  const targetDate = dateParam ? new Date(dateParam) : new Date();
  if (Number.isNaN(targetDate.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  const dayKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}-${String(targetDate.getDate()).padStart(2, "0")}`;

  const rows = await selectGuardianLogs((withSatisfaction) =>
    db
      .select(buildGuardianLogSelection(withSatisfaction))
      .from(guardianGateLogs)
      .leftJoin(users, eq(users.id, guardianGateLogs.createdBy))
      .where(eq(guardianGateLogs.visitDate, dayKey))
      .orderBy(desc(guardianGateLogs.createdAt))
  );

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
  const satisfactionIslamicRaw = Number(body?.satisfactionIslamic);
  const satisfactionAcademicRaw = Number(body?.satisfactionAcademic);
  const feesSubmitted =
    body?.feesSubmitted === true ||
    body?.feesSubmitted === "true" ||
    body?.feesSubmitted === 1 ||
    body?.feesSubmitted === "1";

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
  const satisfactionIslamic =
    Number.isFinite(satisfactionIslamicRaw) && satisfactionIslamicRaw >= 1 && satisfactionIslamicRaw <= 5
      ? Math.round(satisfactionIslamicRaw)
      : null;
  const satisfactionAcademic =
    Number.isFinite(satisfactionAcademicRaw) && satisfactionAcademicRaw >= 1 && satisfactionAcademicRaw <= 5
      ? Math.round(satisfactionAcademicRaw)
      : null;

  const baseInsert = {
    visitDate,
    guardianName,
    studentName,
    className,
    purpose,
    feesSubmitted,
    inAt: inAt || null,
    outAt: outAt || null,
    signature: signature || null,
    createdBy: session.user.id,
  };

  try {
    await db.insert(guardianGateLogs).values({
      ...baseInsert,
      satisfactionIslamic,
      satisfactionAcademic,
    });
  } catch (error) {
    if (!isMissingColumnError(error)) throw error;
    await db.insert(guardianGateLogs).values(baseInsert);
  }

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
