import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { students, Classes } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request) {
  try {
    const studentsData = await db
      .select({
        id: students.id,
        name: students.name,
        admissionNumber: students.admissionNumber,
        classId: students.classId,
        className: Classes.name,
        sectionType: students.sectionType,
        isHosteller: students.isHosteller,
        status: students.status,
      })
      .from(students)
      .leftJoin(Classes, eq(students.classId, Classes.id))
      .where(eq(students.status, "active"))
      .orderBy(desc(students.createdAt));

    return NextResponse.json({ students: studentsData }, { status: 200 });
  } catch (error) {
    console.error("Error fetching students:", error);
    return NextResponse.json(
      { error: "Failed to fetch students" },
      { status: 500 }
    );
  }
}