// app/(main)/api/member/mris/students/route.js
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";                 // ✅ v5 helper
import { db } from "@/lib/db";
import { Students, Classes } from "@/lib/schema";
import { eq, and, sql } from "drizzle-orm";

export async function GET(req) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const statusFilter = (searchParams.get("status") || "active").toLowerCase();
  const classIdParam = searchParams.get("classId");
  const classId = classIdParam ? Number(classIdParam) : null;

  const conditions = [];
  if (statusFilter) {
    conditions.push(sql`lower(${Students.status}) = ${statusFilter}`);
  }
  if (classId && Number.isFinite(classId)) {
    conditions.push(eq(Students.classId, classId));
  }

  let query = db
    .select({
      id: Students.id,
      name: Students.name,
      admission_number: Students.admissionNumber,
      class_name: Classes.name,
      status: Students.status,
    })
    .from(Students)
    .leftJoin(Classes, eq(Students.classId, Classes.id));

  if (conditions.length === 1) {
    query = query.where(conditions[0]);
  } else if (conditions.length > 1) {
    query = query.where(and(...conditions));
  }

  const rows = await query.orderBy(Students.name);

  return NextResponse.json({ students: rows });
}
