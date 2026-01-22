import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { memberAds, users, escalationsMatters } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

const CATEGORY_OPTIONS = new Set([
  "punctuality",
  "academics",
  "obedienceDiscipline",
  "languagePersonality",
  "willSkill",
]);

const normalizeCategory = (value) => {
  const key = String(value || "").trim();
  return CATEGORY_OPTIONS.has(key) ? key : "";
};

const toIso = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return String(value);
};

const mapEntry = (row) => ({
  id: row.id,
  memberId: row.memberId,
  memberName: row.memberName,
  category: row.category,
  occurredAt: toIso(row.occurredAt),
  evidence: row.evidence,
  notes: row.notes,
  points: row.points,
  isHidden: row.isHidden,
  createdBy: row.createdBy,
  createdByName: row.createdByName,
  escalationMatterId: row.escalationMatterId,
  escalationStatus: row.escalationStatus,
  escalationTitle: row.escalationTitle,
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt),
});

export async function GET(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memberAlias = alias(users, "ad_member");
  const creatorAlias = alias(users, "ad_creator");

  let query = db
    .select({
      id: memberAds.id,
      memberId: memberAds.memberId,
      memberName: memberAlias.name,
      category: memberAds.category,
      occurredAt: memberAds.occurredAt,
      evidence: memberAds.evidence,
      notes: memberAds.notes,
      points: memberAds.points,
      isHidden: memberAds.isHidden,
      createdBy: memberAds.createdBy,
      createdByName: creatorAlias.name,
      escalationMatterId: memberAds.escalationMatterId,
      escalationStatus: escalationsMatters.status,
      escalationTitle: escalationsMatters.title,
      createdAt: memberAds.createdAt,
      updatedAt: memberAds.updatedAt,
    })
    .from(memberAds)
    .leftJoin(memberAlias, eq(memberAds.memberId, memberAlias.id))
    .leftJoin(creatorAlias, eq(memberAds.createdBy, creatorAlias.id))
    .leftJoin(escalationsMatters, eq(memberAds.escalationMatterId, escalationsMatters.id));

  if (session.user.role !== "admin") {
    query = query.where(eq(memberAds.isHidden, false));
  }

  const rows = await query.orderBy(desc(memberAds.occurredAt), desc(memberAds.createdAt));

  return NextResponse.json({ entries: rows.map(mapEntry) }, { status: 200 });
}

export async function POST(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const memberId = Number(body?.memberId);
  const category = normalizeCategory(body?.category);
  const occurredAtRaw = String(body?.occurredAt || "").trim();
  const evidence = typeof body?.evidence === "string" ? body.evidence.trim() : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";
  const points = Number.isFinite(Number(body?.points)) ? Number(body.points) : 5;

  if (!memberId || !category || !occurredAtRaw || !evidence) {
    return NextResponse.json({ error: "memberId, category, occurredAt, and evidence are required" }, { status: 400 });
  }

  const occurredAt = new Date(occurredAtRaw);
  if (Number.isNaN(occurredAt.getTime())) {
    return NextResponse.json({ error: "Invalid occurredAt value" }, { status: 400 });
  }

  const [member] = await db.select({ id: users.id }).from(users).where(eq(users.id, memberId));
  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  await db.insert(memberAds).values({
    memberId,
    category,
    occurredAt,
    evidence: evidence || null,
    notes: notes || null,
    points: Number.isFinite(points) && points > 0 ? points : 5,
    createdBy: Number(session.user.id),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function PATCH(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const adId = Number(body?.adId);
  if (!adId) {
    return NextResponse.json({ error: "adId is required" }, { status: 400 });
  }
  if (Object.prototype.hasOwnProperty.call(body, "hidden")) {
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const hidden = !!body.hidden;
    await db
      .update(memberAds)
      .set({ isHidden: hidden, updatedAt: new Date() })
      .where(eq(memberAds.id, adId));
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const matterId = Number(body?.matterId);
  if (!matterId) {
    return NextResponse.json({ error: "matterId is required" }, { status: 400 });
  }

  const [ad] = await db
    .select({ id: memberAds.id, escalationMatterId: memberAds.escalationMatterId })
    .from(memberAds)
    .where(eq(memberAds.id, adId));

  if (!ad) {
    return NextResponse.json({ error: "AD entry not found" }, { status: 404 });
  }
  if (ad.escalationMatterId) {
    return NextResponse.json({ error: "AD already linked to an escalation" }, { status: 400 });
  }

  const [matter] = await db
    .select({ id: escalationsMatters.id })
    .from(escalationsMatters)
    .where(eq(escalationsMatters.id, matterId));

  if (!matter) {
    return NextResponse.json({ error: "Escalation matter not found" }, { status: 404 });
  }

  await db
    .update(memberAds)
    .set({ escalationMatterId: matterId, updatedAt: new Date() })
    .where(eq(memberAds.id, adId));

  return NextResponse.json({ ok: true }, { status: 200 });
}
