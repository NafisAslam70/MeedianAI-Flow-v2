import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { and, eq, ilike, sql } from "drizzle-orm";
import { resources, resourceCategories, resourceLogs, users } from "@/lib/schema";

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/* List + Create + Batch Update */
export async function GET(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) return unauthorized();

  const { searchParams } = new URL(req.url);
  const q = String(searchParams.get("query") || "").trim();
  const status = String(searchParams.get("status") || "").trim();
  const category = Number(searchParams.get("category") || "");
  const building = String(searchParams.get("building") || "").trim();
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(100, Math.max(10, Number(searchParams.get("pageSize") || 20)));
  const offset = (page - 1) * pageSize;

  let where = sql`true`;
  if (q) where = and(where, ilike(resources.name, `%${q}%`));
  if (status) where = and(where, eq(resources.status, status));
  if (!Number.isNaN(category) && category) where = and(where, eq(resources.categoryId, category));
  if (building) where = and(where, ilike(resources.building, `%${building}%`));

  const rows = await db
    .select({
      id: resources.id,
      name: resources.name,
      assetTag: resources.assetTag,
      status: resources.status,
      building: resources.building,
      room: resources.room,
      categoryId: resources.categoryId,
      assignedTo: resources.assignedTo,
      createdAt: resources.createdAt,
    })
    .from(resources)
    .where(where)
    .orderBy(resources.createdAt)
    .limit(pageSize)
    .offset(offset);

  return NextResponse.json({ resources: rows, page, pageSize }, { status: 200 });
}

export async function POST(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const data = Array.isArray(body) ? body : [body];
  const payload = data.map((r) => ({
    name: String(r.name || "").trim(),
    assetTag: r.assetTag ? String(r.assetTag) : null,
    categoryId: r.categoryId || null,
    type: r.type || null,
    serialNo: r.serialNo || null,
    vendor: r.vendor || null,
    purchaseDate: r.purchaseDate ? new Date(r.purchaseDate) : null,
    warrantyEnd: r.warrantyEnd ? new Date(r.warrantyEnd) : null,
    cost: r.cost || null,
    building: r.building || null,
    room: r.room || null,
    status: r.status || undefined,
    assignedTo: r.assignedTo || null,
    notes: r.notes || null,
    tags: r.tags || [],
  }));
  if (!payload.every((p) => p.name)) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const inserted = [];
  for (const p of payload) {
    const [row] = await db.insert(resources).values(p).returning();
    inserted.push(row);
  }
  return NextResponse.json({ resources: inserted }, { status: 201 });
}

export async function PATCH(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const updates = Array.isArray(body?.updates) ? body.updates : [];
  for (const u of updates) {
    if (!u.id) continue;
    const patch = {};
    for (const k of [
      "name",
      "assetTag",
      "categoryId",
      "type",
      "serialNo",
      "vendor",
      "purchaseDate",
      "warrantyEnd",
      "cost",
      "building",
      "room",
      "status",
      "assignedTo",
      "notes",
      "tags",
    ]) if (k in u) patch[k] = u[k];
    if (Object.keys(patch).length) await db.update(resources).set(patch).where(eq(resources.id, Number(u.id)));
  }
  return NextResponse.json({ ok: true });
}

