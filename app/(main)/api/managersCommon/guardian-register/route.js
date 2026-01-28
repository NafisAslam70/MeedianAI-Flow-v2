import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  Classes,
  guardianGateLogs,
  managerSectionGrants,
  Students,
  users,
  visitorGateLogs,
} from "@/lib/schema";
import { and, asc, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";

const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const QUEUE_STATUS = {
  WAITING: "WAITING",
  CALLED: "CALLED",
  SERVED: "SERVED",
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
  isProxy: Boolean(row.isProxy),
  proxyName: row.proxyName ?? null,
  proxyRelation: row.proxyRelation ?? null,
  studentName: row.studentName,
  className: row.className,
  purpose: row.purpose,
  purposeNote: row.purposeNote ?? null,
  tokenNumber: row.tokenNumber ?? null,
  queueStatus: row.queueStatus ?? null,
  calledAt: row.calledAt instanceof Date ? row.calledAt.toISOString() : row.calledAt ?? null,
  servedAt: row.servedAt instanceof Date ? row.servedAt.toISOString() : row.servedAt ?? null,
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

const isSatisfactionColumnError = (error) => {
  const message = String(error?.cause?.message || error?.message || "");
  return message.includes("satisfaction_islamic") || message.includes("satisfaction_academic");
};

const isQueueColumnError = (error) => {
  const message = String(error?.cause?.message || error?.message || "");
  return (
    message.includes("token_number") ||
    message.includes("queue_status") ||
    message.includes("called_at") ||
    message.includes("served_at")
  );
};

const isPurposeNoteColumnError = (error) => {
  const message = String(error?.cause?.message || error?.message || "");
  return message.includes("purpose_note");
};

const isProxyColumnError = (error) => {
  const message = String(error?.cause?.message || error?.message || "");
  return message.includes("proxy_name") || message.includes("proxy_relation") || message.includes("is_proxy");
};

const buildGuardianLogSelection = ({ withSatisfaction, withQueue, withPurposeNote, withProxy }) => ({
  id: guardianGateLogs.id,
  visitDate: guardianGateLogs.visitDate,
  guardianName: guardianGateLogs.guardianName,
  ...(withProxy
    ? {
        isProxy: guardianGateLogs.isProxy,
        proxyName: guardianGateLogs.proxyName,
        proxyRelation: guardianGateLogs.proxyRelation,
      }
    : {}),
  studentName: guardianGateLogs.studentName,
  className: guardianGateLogs.className,
  purpose: guardianGateLogs.purpose,
  ...(withPurposeNote ? { purposeNote: guardianGateLogs.purposeNote } : {}),
  ...(withQueue
    ? {
        tokenNumber: guardianGateLogs.tokenNumber,
        queueStatus: guardianGateLogs.queueStatus,
        calledAt: guardianGateLogs.calledAt,
        servedAt: guardianGateLogs.servedAt,
      }
    : {}),
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
  const desired = { withSatisfaction: true, withQueue: true, withPurposeNote: true, withProxy: true };
  try {
    return await queryBuilder(desired);
  } catch (error) {
    if (!isMissingColumnError(error)) throw error;
    const fallback = {
      withSatisfaction: !isSatisfactionColumnError(error),
      withQueue: !isQueueColumnError(error),
      withPurposeNote: !isPurposeNoteColumnError(error),
      withProxy: !isProxyColumnError(error),
    };
    try {
      return await queryBuilder(fallback);
    } catch (fallbackError) {
      if (!isMissingColumnError(fallbackError)) throw fallbackError;
    }
    const rows = await queryBuilder({
      withSatisfaction: false,
      withQueue: false,
      withPurposeNote: false,
      withProxy: false,
    });
    return rows.map((row) => ({
      ...row,
      satisfactionIslamic: null,
      satisfactionAcademic: null,
    }));
  }
};

const mapVisitorEntry = (row) => ({
  id: row.id,
  visitDate: row.visitDate instanceof Date ? row.visitDate.toISOString().slice(0, 10) : row.visitDate,
  visitorName: row.visitorName,
  visitorPhone: row.visitorPhone ?? null,
  visitingReason: row.visitingReason,
  inAt: row.inAt instanceof Date ? row.inAt.toISOString() : row.inAt,
  outAt: row.outAt instanceof Date ? row.outAt.toISOString() : row.outAt,
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

    const rows = await selectGuardianLogs((options) =>
      db
        .select(buildGuardianLogSelection(options))
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

  if (section === "queue") {
    const dateParam = searchParams.get("date") || todayKey();
    const targetDate = new Date(dateParam);
    if (Number.isNaN(targetDate.getTime())) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
    const dayKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}-${String(targetDate.getDate()).padStart(2, "0")}`;

    let rows;
    try {
      rows = await db
        .select({
          id: guardianGateLogs.id,
          tokenNumber: guardianGateLogs.tokenNumber,
          queueStatus: guardianGateLogs.queueStatus,
          calledAt: guardianGateLogs.calledAt,
          guardianName: guardianGateLogs.guardianName,
          studentName: guardianGateLogs.studentName,
        })
        .from(guardianGateLogs)
        .where(and(eq(guardianGateLogs.visitDate, dayKey), sql`${guardianGateLogs.tokenNumber} is not null`))
        .orderBy(asc(guardianGateLogs.tokenNumber));
    } catch (error) {
      if (isMissingColumnError(error)) {
        return NextResponse.json(
          { error: "Queue columns unavailable. Run the latest guardian queue migration." },
          { status: 409 }
        );
      }
      throw error;
    }

    const normalized = rows.map((row) => ({
      ...row,
      queueStatus: row.queueStatus || QUEUE_STATUS.WAITING,
    }));
    const waiting = normalized.filter((row) => row.queueStatus === QUEUE_STATUS.WAITING);
    const called = normalized.filter((row) => row.queueStatus === QUEUE_STATUS.CALLED);
    const nowServing = called.sort((a, b) => {
      const aTime = a.calledAt ? new Date(a.calledAt).getTime() : 0;
      const bTime = b.calledAt ? new Date(b.calledAt).getTime() : 0;
      return bTime - aTime;
    })[0] || null;
    const nextUp = waiting.slice(0, 5);

    return NextResponse.json(
      {
        date: dayKey,
        nowServing,
        nextUp,
        waitingCount: waiting.length,
      },
      { status: 200 }
    );
  }

  if (section === "visitors") {
    const dateParam = searchParams.get("date");
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    if (Number.isNaN(targetDate.getTime())) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
    const dayKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}-${String(targetDate.getDate()).padStart(2, "0")}`;

    const rows = await db
      .select({
        id: visitorGateLogs.id,
        visitDate: visitorGateLogs.visitDate,
        visitorName: visitorGateLogs.visitorName,
        visitorPhone: visitorGateLogs.visitorPhone,
        visitingReason: visitorGateLogs.visitingReason,
        inAt: visitorGateLogs.inAt,
        outAt: visitorGateLogs.outAt,
        createdBy: visitorGateLogs.createdBy,
        createdAt: visitorGateLogs.createdAt,
        updatedAt: visitorGateLogs.updatedAt,
        createdByName: users.name,
      })
      .from(visitorGateLogs)
      .leftJoin(users, eq(users.id, visitorGateLogs.createdBy))
      .where(eq(visitorGateLogs.visitDate, dayKey))
      .orderBy(desc(visitorGateLogs.createdAt));

    return NextResponse.json({ entries: rows.map(mapVisitorEntry) }, { status: 200 });
  }

  const dateParam = searchParams.get("date");
  const targetDate = dateParam ? new Date(dateParam) : new Date();
  if (Number.isNaN(targetDate.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  const dayKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}-${String(targetDate.getDate()).padStart(2, "0")}`;

  const rows = await selectGuardianLogs((options) =>
    db
      .select(buildGuardianLogSelection(options))
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

  const entryType = typeof body?.entryType === "string" ? body.entryType.trim() : "guardian";
  const visitDateRaw = typeof body?.visitDate === "string" ? body.visitDate.trim() : "";

  if (entryType === "visitor") {
    const visitorName = typeof body?.visitorName === "string" ? body.visitorName.trim() : "";
    const visitorPhone = typeof body?.visitorPhone === "string" ? body.visitorPhone.trim() : "";
    const visitingReason = typeof body?.visitingReason === "string" ? body.visitingReason.trim() : "";
    const inTimeRaw = typeof body?.inTime === "string" ? body.inTime.trim() : "";

    if (!visitDateRaw) {
      return NextResponse.json({ error: "visitDate is required" }, { status: 400 });
    }
    const visitDate = new Date(visitDateRaw);
    if (Number.isNaN(visitDate.getTime())) {
      return NextResponse.json({ error: "Invalid visitDate" }, { status: 400 });
    }
    if (!visitorName || !visitingReason || !inTimeRaw) {
      return NextResponse.json(
        { error: "visitorName, visitingReason, and inTime are required" },
        { status: 400 }
      );
    }

    const inAt = parseTime(inTimeRaw, visitDateRaw, visitDate);
    const outAt = parseTime(body?.outTime, visitDateRaw, visitDate);
    if (!inAt) {
      return NextResponse.json({ error: "Invalid inTime" }, { status: 400 });
    }

    await db.insert(visitorGateLogs).values({
      visitDate,
      visitorName,
      visitorPhone: visitorPhone || null,
      visitingReason,
      inAt: inAt || null,
      outAt: outAt || null,
      createdBy: session.user.id,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  }
  const guardianName = typeof body?.guardianName === "string" ? body.guardianName.trim() : "";
  const inTimeRaw = typeof body?.inTime === "string" ? body.inTime.trim() : "";
  const isProxy = body?.isProxy === true || body?.isProxy === "true" || body?.isProxy === 1 || body?.isProxy === "1";
  const proxyName = typeof body?.proxyName === "string" ? body.proxyName.trim() : "";
  const proxyRelation = typeof body?.proxyRelation === "string" ? body.proxyRelation.trim() : "";
  const studentName = typeof body?.studentName === "string" ? body.studentName.trim() : "";
  const className = typeof body?.className === "string" ? body.className.trim() : "";
  const purpose = typeof body?.purpose === "string" ? body.purpose.trim() : "";
  const purposeNote = typeof body?.purposeNote === "string" ? body.purposeNote.trim() : "";
  const signature = typeof body?.signature === "string" ? body.signature.trim() : "";
  const satisfactionIslamicRaw = Number(body?.satisfactionIslamic);
  const satisfactionAcademicRaw = Number(body?.satisfactionAcademic);
  const feesSubmitted =
    body?.feesSubmitted === true ||
    body?.feesSubmitted === "true" ||
    body?.feesSubmitted === 1 ||
    body?.feesSubmitted === "1";
  const assignToken = body?.assignToken !== false;

  if (!visitDateRaw) {
    return NextResponse.json({ error: "visitDate is required" }, { status: 400 });
  }
  const visitDate = new Date(visitDateRaw);
  if (Number.isNaN(visitDate.getTime())) {
    return NextResponse.json({ error: "Invalid visitDate" }, { status: 400 });
  }
  if (!guardianName || !studentName || !className || !purpose || !inTimeRaw) {
    return NextResponse.json(
      { error: "guardianName, studentName, className, purpose, and inTime are required" },
      { status: 400 }
    );
  }
  if (purpose === "Other" && !purposeNote) {
    return NextResponse.json({ error: "Purpose note is required when purpose is Other." }, { status: 400 });
  }
  if (isProxy && (!proxyName || !proxyRelation)) {
    return NextResponse.json({ error: "Proxy name and relation are required when someone else visits." }, { status: 400 });
  }

  const inAt = parseTime(inTimeRaw, visitDateRaw, visitDate);
  const outAt = parseTime(body?.outTime, visitDateRaw, visitDate);
  if (!inAt) {
    return NextResponse.json({ error: "Invalid inTime" }, { status: 400 });
  }
  const satisfactionIslamic =
    Number.isFinite(satisfactionIslamicRaw) && satisfactionIslamicRaw >= 1 && satisfactionIslamicRaw <= 5
      ? Math.round(satisfactionIslamicRaw)
      : null;
  const satisfactionAcademic =
    Number.isFinite(satisfactionAcademicRaw) && satisfactionAcademicRaw >= 1 && satisfactionAcademicRaw <= 5
      ? Math.round(satisfactionAcademicRaw)
      : null;

  let tokenNumber = null;
  let queueStatus = null;
  if (assignToken) {
    try {
      const result = await db.execute(
        sql`SELECT COALESCE(MAX(token_number), 0)::int as max FROM ${guardianGateLogs} WHERE ${guardianGateLogs.visitDate} = ${visitDateRaw}`
      );
      const maxValue = result?.rows?.[0]?.max ?? result?.[0]?.max ?? 0;
      tokenNumber = Number(maxValue) + 1;
      queueStatus = QUEUE_STATUS.WAITING;
    } catch (error) {
      if (isMissingColumnError(error)) {
        return NextResponse.json(
          { error: "Queue columns unavailable. Run the latest guardian queue migration." },
          { status: 409 }
        );
      }
      throw error;
    }
  }

  const baseInsert = {
    visitDate,
    guardianName,
    isProxy,
    proxyName: isProxy ? proxyName : null,
    proxyRelation: isProxy ? proxyRelation : null,
    studentName,
    className,
    purpose,
    purposeNote: purposeNote || null,
    ...(assignToken
      ? {
          tokenNumber,
          queueStatus,
        }
      : {}),
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
    if (assignToken && isQueueColumnError(error)) {
      const fallbackInsert = { ...baseInsert };
      delete fallbackInsert.tokenNumber;
      delete fallbackInsert.queueStatus;
      delete fallbackInsert.purposeNote;
      await db.insert(guardianGateLogs).values(fallbackInsert);
      tokenNumber = null;
      queueStatus = null;
    } else {
      const fallbackInsert = { ...baseInsert };
      delete fallbackInsert.purposeNote;
      await db.insert(guardianGateLogs).values(fallbackInsert);
    }
  }

  return NextResponse.json({ ok: true, tokenNumber, queueStatus }, { status: 200 });
}

export async function PATCH(req) {
  const session = await auth();
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const allowed = await hasGuardianAccess(session.user);
  if (!allowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const section = searchParams.get("section") || "";

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (section === "call-next") {
    const visitDateRaw = typeof body?.visitDate === "string" ? body.visitDate.trim() : todayKey();
    const visitDate = new Date(visitDateRaw);
    if (Number.isNaN(visitDate.getTime())) {
      return NextResponse.json({ error: "Invalid visitDate" }, { status: 400 });
    }
    const now = new Date();

    try {
      const called = await db.transaction(async (tx) => {
        const [next] = await tx
          .select({
            id: guardianGateLogs.id,
            tokenNumber: guardianGateLogs.tokenNumber,
            guardianName: guardianGateLogs.guardianName,
            studentName: guardianGateLogs.studentName,
          })
          .from(guardianGateLogs)
          .where(
            and(
              eq(guardianGateLogs.visitDate, visitDateRaw),
              or(
                eq(guardianGateLogs.queueStatus, QUEUE_STATUS.WAITING),
                sql`${guardianGateLogs.queueStatus} is null`
              ),
              sql`${guardianGateLogs.tokenNumber} is not null`
            )
          )
          .orderBy(asc(guardianGateLogs.tokenNumber))
          .limit(1);

        if (!next) return null;

        await tx
          .update(guardianGateLogs)
          .set({ queueStatus: QUEUE_STATUS.SERVED, servedAt: now })
          .where(
            and(eq(guardianGateLogs.visitDate, visitDateRaw), eq(guardianGateLogs.queueStatus, QUEUE_STATUS.CALLED))
          );

        await tx
          .update(guardianGateLogs)
          .set({ queueStatus: QUEUE_STATUS.CALLED, calledAt: now })
          .where(eq(guardianGateLogs.id, next.id));

        return next;
      });

      if (!called) {
        return NextResponse.json({ error: "No waiting tokens." }, { status: 400 });
      }

      return NextResponse.json({ called }, { status: 200 });
    } catch (error) {
      if (isMissingColumnError(error)) {
        return NextResponse.json(
          { error: "Queue columns unavailable. Run the latest guardian queue migration." },
          { status: 409 }
        );
      }
      throw error;
    }
  }

  if (section === "update-entry") {
    const entryType = typeof body?.entryType === "string" ? body.entryType.trim() : "guardian";
    const id = Number(body?.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const inTimeRaw = typeof body?.inTime === "string" ? body.inTime.trim() : "";
    const outTimeRaw = typeof body?.outTime === "string" ? body.outTime.trim() : "";

    const getVisitDate = async () => {
      if (typeof body?.visitDate === "string" && body.visitDate.trim()) {
        return body.visitDate.trim();
      }
      if (entryType === "visitor") {
        const [row] = await db
          .select({ visitDate: visitorGateLogs.visitDate })
          .from(visitorGateLogs)
          .where(eq(visitorGateLogs.id, id));
        return row?.visitDate instanceof Date ? row.visitDate.toISOString().slice(0, 10) : row?.visitDate;
      }
      const [row] = await db
        .select({ visitDate: guardianGateLogs.visitDate })
        .from(guardianGateLogs)
        .where(eq(guardianGateLogs.id, id));
      return row?.visitDate instanceof Date ? row.visitDate.toISOString().slice(0, 10) : row?.visitDate;
    };

    const visitDateRaw = await getVisitDate();
    if (!visitDateRaw) {
      return NextResponse.json({ error: "visitDate not found" }, { status: 400 });
    }
    const visitDate = new Date(visitDateRaw);
    if (Number.isNaN(visitDate.getTime())) {
      return NextResponse.json({ error: "Invalid visitDate" }, { status: 400 });
    }

    const inAt = parseTime(inTimeRaw, visitDateRaw, visitDate);
    const outAt = parseTime(outTimeRaw, visitDateRaw, visitDate);

    if (entryType === "visitor") {
      await db
        .update(visitorGateLogs)
        .set({ inAt: inAt || null, outAt: outAt || null, updatedAt: new Date() })
        .where(eq(visitorGateLogs.id, id));
    } else {
      await db
        .update(guardianGateLogs)
        .set({ inAt: inAt || null, outAt: outAt || null, updatedAt: new Date() })
        .where(eq(guardianGateLogs.id, id));
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  }

  return NextResponse.json({ error: "Invalid section" }, { status: 400 });
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
  const entryType = typeof body?.entryType === "string" ? body.entryType.trim() : "guardian";
  const id = Number(body?.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  if (entryType === "visitor") {
    await db.delete(visitorGateLogs).where(eq(visitorGateLogs.id, id));
  } else {
    await db.delete(guardianGateLogs).where(eq(guardianGateLogs.id, id));
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
