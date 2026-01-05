import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { students, Classes, academicYears } from "@/lib/schema";
import { financeDb } from "@/lib/finance-db";
import { booleanValue, emptyToNull } from "@/lib/student-helpers";
import { and, desc, eq, ilike, or } from "drizzle-orm";

const studentSelect = {
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
  academicYear: students.academicYear,
  createdAt: students.createdAt,
  notes: students.notes,
};

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get("type");

    if (type === "classes") {
      const rows = await db
        .select({
          id: Classes.id,
          name: Classes.name,
          section: Classes.section,
          track: Classes.track,
          active: Classes.active,
        })
        .from(Classes)
        .orderBy(Classes.name);

      return NextResponse.json({ classes: rows }, { status: 200 });
    }

    if (type === "years") {
      const queryAcademicYears = async (client) =>
        client
          .select({
            code: academicYears.code,
            name: academicYears.name,
            startDate: academicYears.startDate,
            endDate: academicYears.endDate,
            isActive: academicYears.isActive,
            isCurrent: academicYears.isCurrent,
          })
          .from(academicYears)
          .orderBy(desc(academicYears.isCurrent), desc(academicYears.code));

      try {
        const primaryClient = financeDb ?? db;
        const rows = await queryAcademicYears(primaryClient);
        return NextResponse.json({ academicYears: rows }, { status: 200 });
      } catch (err) {
        console.warn(
          "[students] Failed to fetch academic years from finance database. Falling back to default.",
          err?.message || err
        );
        if (financeDb) {
          const fallbackRows = await queryAcademicYears(db);
          return NextResponse.json({ academicYears: fallbackRows }, { status: 200 });
        }
        throw err;
      }
    }

    const search = url.searchParams.get("search");
    const status = url.searchParams.get("status") || "active";
    const academicYear = url.searchParams.get("academicYear");
    const classId = url.searchParams.get("classId");
    const residentialStatus = url.searchParams.get("residentialStatus");

    const filters = [];

    if (status && status !== "all") {
      filters.push(eq(students.status, status));
    }

    if (academicYear && academicYear !== "all") {
      filters.push(eq(students.academicYear, academicYear));
    }

    if (classId && classId !== "all") {
      filters.push(eq(students.classId, Number(classId)));
    }

    if (residentialStatus === "hosteller") {
      filters.push(eq(students.isHosteller, true));
    } else if (residentialStatus === "dayscholar") {
      filters.push(eq(students.isHosteller, false));
    }

    if (search && search.trim().length > 0) {
      const pattern = `%${search.trim()}%`;
      filters.push(
        or(
          ilike(students.name, pattern),
          ilike(students.admissionNumber, pattern),
          ilike(Classes.name, pattern),
          ilike(students.guardianName, pattern),
          ilike(students.guardianPhone, pattern)
        )
      );
    }

    let query = db.select(studentSelect).from(students).leftJoin(Classes, eq(students.classId, Classes.id));

    if (filters.length > 0) {
      query = query.where(and(...filters));
    }

    query = query.orderBy(Classes.name, students.name);

    const studentRows = await query;

    const aggregates = studentRows.reduce(
      (acc, row) => {
        acc.total += 1;
        if (row.isHosteller) acc.hostellers += 1;
        else acc.dayScholars += 1;
        if (row.status === "inactive" || row.status === "left") acc.inactive += 1;
        return acc;
      },
      { total: 0, hostellers: 0, dayScholars: 0, inactive: 0 }
    );

    return NextResponse.json(
      {
        students: studentRows,
        summary: aggregates,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching students:", error);
    return NextResponse.json({ error: `Failed to fetch data: ${error.message}` }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const requiredFields = ["name", "classId", "academicYear"];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }

    const academicYearCode = emptyToNull(body.academicYear);
    if (!academicYearCode) {
      return NextResponse.json({ error: "Missing required field: academicYear" }, { status: 400 });
    }

    const toDateOrNull = (value, label) => {
      if (!value) return null;
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) {
        throw new Error(`Invalid date for ${label}`);
      }
      return d;
    };

    const classIdNum = Number(body.classId);
    if (!Number.isFinite(classIdNum)) {
      return NextResponse.json({ error: "Invalid classId" }, { status: 400 });
    }

    const values = {
      name: body.name.trim(),
      admissionNumber: emptyToNull(body.admissionNumber),
      admissionDate: toDateOrNull(body.admissionDate, "admissionDate"),
      aadharNumber: emptyToNull(body.aadharNumber),
      dateOfBirth: toDateOrNull(body.dateOfBirth, "dateOfBirth"),
      gender: emptyToNull(body.gender),
      classId: classIdNum,
      sectionType: emptyToNull(body.sectionType),
      isHosteller: booleanValue(body.isHosteller),
      transportChosen: booleanValue(body.transportChosen),
      guardianPhone: emptyToNull(body.guardianPhone),
      guardianName: emptyToNull(body.guardianName),
      guardianWhatsappNumber: emptyToNull(body.guardianWhatsappNumber),
      motherName: emptyToNull(body.motherName),
      address: emptyToNull(body.address),
      bloodGroup: emptyToNull(body.bloodGroup),
      feeStatus: emptyToNull(body.feeStatus) || "Pending",
      status: emptyToNull(body.status) || "active",
      accountOpened: booleanValue(body.accountOpened),
      academicYear: academicYearCode,
      notes: Array.isArray(body.notes) ? body.notes : [],
    };

    const [inserted] = await db.insert(students).values(values).returning({ id: students.id });

    if (!inserted) {
      return NextResponse.json({ error: "Failed to add student" }, { status: 500 });
    }

    const [created] = await db
      .select(studentSelect)
      .from(students)
      .leftJoin(Classes, eq(students.classId, Classes.id))
      .where(eq(students.id, inserted.id));

    return NextResponse.json({ student: created }, { status: 201 });
  } catch (error) {
    console.error("Error adding student:", error);
    if (error.message && error.message.toLowerCase().startsWith("invalid date")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: `Failed to add student: ${error.message}` }, { status: 500 });
  }
}
