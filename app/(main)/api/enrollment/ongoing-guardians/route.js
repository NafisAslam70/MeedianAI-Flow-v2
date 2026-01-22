import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { students, Classes } from "@/lib/schema";
import { and, eq } from "drizzle-orm";

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const normalizeKey = (value, fallback) => {
  const raw = value ? String(value).trim() : "";
  if (raw) return raw.toLowerCase();
  return `guardian-${fallback}`;
};

export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user?.role || !["admin", "team_manager"].includes(session.user.role)) {
      return unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const classIdParam = searchParams.get("classId");
    const classId = classIdParam ? Number(classIdParam) : null;
    const status = searchParams.get("status") || "active";

    const filters = [];

    if (Number.isFinite(classId)) {
      filters.push(eq(students.classId, classId));
    }

    if (status && status !== "all") {
      filters.push(eq(students.status, status));
    }

    let query = db
      .select({
        studentId: students.id,
        studentName: students.name,
        classId: students.classId,
        className: Classes.name,
        status: students.status,
        guardianName: students.guardianName,
        guardianPhone: students.guardianPhone,
        guardianWhatsappNumber: students.guardianWhatsappNumber,
        address: students.address,
        isHosteller: students.isHosteller,
      })
      .from(students)
      .leftJoin(Classes, eq(students.classId, Classes.id));

    if (filters.length) {
      query = query.where(and(...filters));
    }

    const rows = await query;

    const guardiansMap = new Map();

    rows.forEach((row) => {
      const contact = row.guardianWhatsappNumber || row.guardianPhone || row.guardianName;
      const key = normalizeKey(contact, row.studentId);
      const existing = guardiansMap.get(key);

      const guardianName = row.guardianName || `Guardian of ${row.studentName}`;
      const guardianWhatsapp = row.guardianWhatsappNumber || row.guardianPhone || "";
      const location = row.address || row.className || "Unknown";

      const childEntry = {
        name: row.studentName,
        age: null,
        currentSchool: row.className ? `Class ${row.className}` : "MEED",
        classId: row.classId,
        className: row.className,
        isHosteller: row.isHosteller,
        status: row.status,
      };

      if (existing) {
        existing.children.push(childEntry);
        if (!existing.whatsapp && guardianWhatsapp) existing.whatsapp = guardianWhatsapp;
        if (!existing.location && location) existing.location = location;
        if (row.guardianName && existing.name !== row.guardianName) {
          existing.name = row.guardianName;
        }
        return;
      }

      guardiansMap.set(key, {
        id: `ongoing_${key}`,
        name: guardianName,
        whatsapp: guardianWhatsapp,
        location,
        status: "enrolled",
        engagementScore: 0,
        interests: null,
        children: [childEntry],
        interactions: [],
      });
    });

    return NextResponse.json({ guardians: Array.from(guardiansMap.values()) });
  } catch (error) {
    console.error("Error fetching ongoing guardians:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
