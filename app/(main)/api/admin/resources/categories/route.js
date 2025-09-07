import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { resourceCategories } from "@/lib/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(resourceCategories);
  return NextResponse.json({ categories: rows });
}

export async function POST(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const { name, parentId, description } = body || {};
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const [row] = await db
    .insert(resourceCategories)
    .values({ name: String(name).trim(), parentId: parentId || null, description: description || null })
    .returning();
  return NextResponse.json({ category: row }, { status: 201 });
}

