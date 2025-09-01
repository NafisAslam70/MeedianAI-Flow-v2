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

  const rows = await db
    .select({
      id: Students.id,
      name: Students.name,
      admission_number: Students.admissionNumber,
      class_name: Classes.name,
      status: Students.status,
    })
    .from(Students)
    .leftJoin(Classes, eq(Students.classId, Classes.id))
    // optional: push filtering to SQL (case-insensitive)
    .where(sql`lower(${Students.status}) = ${statusFilter}`);

  return NextResponse.json({ students: rows });
}
