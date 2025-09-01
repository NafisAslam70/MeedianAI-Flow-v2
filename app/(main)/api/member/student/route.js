import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { students, Classes } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { NextResponse, NextRequest } from "next/server";

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const db = drizzle(pool);

// GET handler to fetch students or classes
export async function GET(request) {
  try {
    // Extract query parameter 'type' safely
    const url = new URL(request.url);
    const type = url.searchParams.get("type");

    if (type === "classes") {
      const classData = await db.select().from(Classes);
      return NextResponse.json({ classes: classData }, { status: 200 });
    } else {
      // Fetch active students with class names
      const studentData = await db
        .select({
          id: students.id,
          name: students.name,
          admissionNumber: students.admissionNumber,
          admissionDate: students.admissionDate,
          aadharNumber: students.aadharNumber,
          dateOfBirth: students.dateOfBirth,
          gender: students.gender,
          classId: students.classId,
          className: Classes.name,
          sectionType: students.sectionType,
          isHosteller: students.isHosteller,
          transportChosen: students.transportChosen,
          guardianPhone: students.guardianPhone,
          guardianName: students.guardianName,
          guardianWhatsappNumber: students.guardianWhatsappNumber,
          motherName: students.motherName,
          address: students.address,
          bloodGroup: students.bloodGroup,
          feeStatus: students.feeStatus,
          status: students.status,
          accountOpened: students.accountOpened,
          createdAt: students.createdAt,
          notes: students.notes,
        })
        .from(students)
        .leftJoin(Classes, eq(students.classId, Classes.id))
        .where(eq(students.status, "active"));

      return NextResponse.json({ students: studentData }, { status: 200 });
    }
  } catch (error) {
    console.error("Error fetching data:", error);
    return NextResponse.json(
      { error: `Failed to fetch data: ${error.message}` },
      { status: 500 }
    );
  }
}

// POST handler to add a new student
export async function POST(request) {
  try {
    const body = await request.json();
    // Validate required fields
    const requiredFields = ["name", "admissionNumber", "classId"];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }

    // Insert new student with defaults
    const newStudent = await db
      .insert(students)
      .values({
        name: body.name,
        admissionNumber: body.admissionNumber,
        admissionDate: body.admissionDate ? new Date(body.admissionDate) : null,
        aadharNumber: body.aadharNumber || null,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
        gender: body.gender || null,
        classId: parseInt(body.classId),
        sectionType: body.sectionType || null,
        isHosteller: body.isHosteller || false,
        transportChosen: body.transportChosen || false,
        guardianPhone: body.guardianPhone || null,
        guardianName: body.guardianName || null,
        guardianWhatsappNumber: body.guardianWhatsappNumber || null,
        motherName: body.motherName || null,
        address: body.address || null,
        bloodGroup: body.bloodGroup || null,
        feeStatus: body.feeStatus || "Pending",
        status: body.status || "active",
        accountOpened: body.accountOpened || false,
        notes: body.notes || JSON.stringify([]),
      })
      .returning();

    return NextResponse.json({ student: newStudent[0] }, { status: 201 });
  } catch (error) {
    console.error("Error adding student:", error);
    return NextResponse.json(
      { error: `Failed to add student: ${error.message}` },
      { status: 500 }
    );
  }
}