import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { students, Classes } from "@/lib/schema";
import { booleanValue, emptyToNull } from "@/lib/student-helpers";
import { eq } from "drizzle-orm";

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

const parseId = (params) => {
  const raw = params?.id;
  const id = Number(raw);
  if (!raw || Number.isNaN(id)) return null;
  return id;
};

const fetchStudent = async (id) => {
  const [student] = await db
    .select(studentSelect)
    .from(students)
    .leftJoin(Classes, eq(students.classId, Classes.id))
    .where(eq(students.id, id));
  return student;
};

export async function GET(_request, { params }) {
  const id = parseId(params);
  if (!id) {
    return NextResponse.json({ error: "Invalid student id" }, { status: 400 });
  }

  const student = await fetchStudent(id);
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  return NextResponse.json({ student }, { status: 200 });
}

export async function PATCH(request, { params }) {
  const id = parseId(params);
  if (!id) {
    return NextResponse.json({ error: "Invalid student id" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const updates = {};

    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.admissionNumber !== undefined) updates.admissionNumber = emptyToNull(body.admissionNumber);
    if (body.admissionDate !== undefined) updates.admissionDate = body.admissionDate ? new Date(body.admissionDate) : null;
    if (body.aadharNumber !== undefined) updates.aadharNumber = emptyToNull(body.aadharNumber);
    if (body.dateOfBirth !== undefined) updates.dateOfBirth = body.dateOfBirth ? new Date(body.dateOfBirth) : null;
    if (body.gender !== undefined) updates.gender = emptyToNull(body.gender);
    if (body.classId !== undefined) updates.classId = Number(body.classId);
    if (body.sectionType !== undefined) updates.sectionType = emptyToNull(body.sectionType);
    if (body.isHosteller !== undefined) updates.isHosteller = booleanValue(body.isHosteller);
    if (body.transportChosen !== undefined) updates.transportChosen = booleanValue(body.transportChosen);
    if (body.guardianPhone !== undefined) updates.guardianPhone = emptyToNull(body.guardianPhone);
    if (body.guardianName !== undefined) updates.guardianName = emptyToNull(body.guardianName);
    if (body.guardianWhatsappNumber !== undefined) updates.guardianWhatsappNumber = emptyToNull(body.guardianWhatsappNumber);
    if (body.motherName !== undefined) updates.motherName = emptyToNull(body.motherName);
    if (body.address !== undefined) updates.address = emptyToNull(body.address);
    if (body.bloodGroup !== undefined) updates.bloodGroup = emptyToNull(body.bloodGroup);
    if (body.feeStatus !== undefined) updates.feeStatus = emptyToNull(body.feeStatus);
    if (body.status !== undefined) updates.status = emptyToNull(body.status);
    if (body.accountOpened !== undefined) updates.accountOpened = booleanValue(body.accountOpened);
    if (body.academicYear !== undefined) updates.academicYear = emptyToNull(body.academicYear);
    if (body.notes !== undefined) updates.notes = Array.isArray(body.notes) ? body.notes : [];

    if (Object.keys(updates).length === 0) {
      const current = await fetchStudent(id);
      return NextResponse.json({ student: current }, { status: 200 });
    }

    await db.update(students).set(updates).where(eq(students.id, id));
    const updated = await fetchStudent(id);

    return NextResponse.json({ student: updated }, { status: 200 });
  } catch (error) {
    console.error("Error updating student:", error);
    return NextResponse.json({ error: `Failed to update student: ${error.message}` }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const id = parseId(params);
  if (!id) {
    return NextResponse.json({ error: "Invalid student id" }, { status: 400 });
  }

  try {
    const existing = await fetchStudent(id);
    if (!existing) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const url = new URL(request.url);
    const mode = url.searchParams.get("mode");
    if (mode === "hard") {
      await db.delete(students).where(eq(students.id, id));
      return NextResponse.json({ student: existing, deleted: true }, { status: 200 });
    }

    await db.update(students).set({ status: "inactive" }).where(eq(students.id, id));
    const updated = await fetchStudent(id);

    return NextResponse.json({ student: updated, deleted: false }, { status: 200 });
  } catch (error) {
    console.error("Error deleting student:", error);
    return NextResponse.json({ error: `Failed to delete student: ${error.message}` }, { status: 500 });
  }
}
