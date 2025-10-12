import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { and, eq, ilike } from "drizzle-orm";

export async function GET(req) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const search = url.searchParams.get("q") || "";
  const includeNonTeachers = url.searchParams.get("onlyTeachers") === "false";
  const limit = Number(url.searchParams.get("limit") || 0);

  const conditions = [];
  if (!includeNonTeachers) {
    conditions.push(eq(users.isTeacher, true));
  }
  if (search.trim()) {
    const pattern = `%${search.trim().toLowerCase()}%`;
    conditions.push(ilike(users.name, pattern));
  }

  let query = db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isTeacher: users.isTeacher,
    })
    .from(users)
    .orderBy(users.name);

  if (conditions.length === 1) {
    query = query.where(conditions[0]);
  } else if (conditions.length > 1) {
    query = query.where(and(...conditions));
  }

  if (Number.isFinite(limit) && limit > 0) {
    query = query.limit(limit);
  }

  const rows = await query;

  return NextResponse.json({
    teachers: rows.map((row) => ({
      id: row.id,
      name: row.name || `Member #${row.id}`,
      email: row.email || null,
      role: row.role || null,
      isTeacher: Boolean(row.isTeacher),
    })),
  });
}

