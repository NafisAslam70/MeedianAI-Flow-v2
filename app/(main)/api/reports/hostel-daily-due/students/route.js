import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Students } from "@/lib/schema";
import { asc, eq } from "drizzle-orm";

const parseId = (value) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
};

export async function GET(req) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const classId = parseId(searchParams.get("classId"));
    if (!classId) {
      return NextResponse.json({ error: "Invalid classId" }, { status: 400 });
    }

    const rows = await db
      .select({
        id: Students.id,
        name: Students.name,
        classId: Students.classId,
      })
      .from(Students)
      .where(eq(Students.classId, classId))
      .orderBy(asc(Students.name));

    return NextResponse.json({ students: rows }, { status: 200 });
  } catch (error) {
    console.error("Error fetching hostel due students:", error);
    return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 });
  }
}
