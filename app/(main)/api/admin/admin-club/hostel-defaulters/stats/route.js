import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  academicHealthReports,
  ahrDefaulters,
  Students,
} from "@/lib/schema";
import { and, eq, gte, lt, inArray } from "drizzle-orm";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 62;

const toDateOnly = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

export async function GET(req) {
  const session = await auth();
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["admin", "team_manager"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const today = new Date();
  const endDate = toDateOnly(searchParams.get("endDate")) || today;
  const startFallback = new Date(endDate.getTime() - 13 * DAY_MS);
  const startDate = toDateOnly(searchParams.get("startDate")) || startFallback;

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }
  if (endDate < startDate) {
    return NextResponse.json({ error: "endDate must be after startDate" }, { status: 400 });
  }
  const dayCount = Math.round((endDate - startDate) / DAY_MS) + 1;
  if (dayCount > MAX_RANGE_DAYS) {
    return NextResponse.json({ error: `Date range too large (max ${MAX_RANGE_DAYS} days)` }, { status: 400 });
  }

  const assignedToUserId = Number(searchParams.get("assignedToUserId")) || null;

  const endExclusive = new Date(endDate.getTime() + DAY_MS);
  const filters = [
    gte(academicHealthReports.reportDate, startDate),
    lt(academicHealthReports.reportDate, endExclusive),
  ];
  if (assignedToUserId) filters.push(eq(academicHealthReports.assignedToUserId, assignedToUserId));

  const rows = await db
    .select({
      ahrId: academicHealthReports.id,
      reportDate: academicHealthReports.reportDate,
      assignedToUserId: academicHealthReports.assignedToUserId,
      studentId: ahrDefaulters.studentId,
      defaulterType: ahrDefaulters.defaulterType,
    })
    .from(ahrDefaulters)
    .leftJoin(academicHealthReports, eq(academicHealthReports.id, ahrDefaulters.ahrId))
    .where(and(...filters));

  const studentIds = Array.from(new Set(rows.map((r) => r.studentId).filter(Boolean)));
  let studentMap = new Map();
  if (studentIds.length) {
    const studentRows = await db
      .select({ id: Students.id, name: Students.name, classId: Students.classId })
      .from(Students)
      .where(inArray(Students.id, studentIds));
    studentMap = new Map(studentRows.map((s) => [Number(s.id), s]));
  }

  const perCategory = new Map();
  const perStudent = new Map();
  const perDay = new Map();

  rows.forEach((row) => {
    const cat = row.defaulterType || "UNKNOWN";
    perCategory.set(cat, (perCategory.get(cat) || 0) + 1);

    const sid = Number(row.studentId);
    if (sid) {
      const entry = perStudent.get(sid) || { studentId: sid, count: 0 };
      entry.count += 1;
      perStudent.set(sid, entry);
    }

    const dayKey = row.reportDate ? new Date(row.reportDate).toISOString().slice(0, 10) : null;
    if (dayKey) {
      const entry = perDay.get(dayKey) || { date: dayKey, count: 0 };
      entry.count += 1;
      perDay.set(dayKey, entry);
    }
  });

  const totalDefaulters = rows.length;
  const uniqueStudents = perStudent.size;
  const sortedCategories = Array.from(perCategory.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
  const sortedStudents = Array.from(perStudent.values())
    .map((s) => ({
      ...s,
      name: studentMap.get(s.studentId)?.name || `Student #${s.studentId}`,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const trend = Array.from(perDay.values()).sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json(
    {
      range: {
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
        days: dayCount,
      },
      summary: {
        totalDefaulters,
        uniqueStudents,
        topCategory: sortedCategories[0]?.type || null,
      },
      categories: sortedCategories,
      students: sortedStudents,
      trend,
    },
    { status: 200 }
  );
}
