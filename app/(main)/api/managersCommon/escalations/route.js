import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  users,
  escalationsMatters,
  escalationsMatterMembers,
  escalationsSteps,
  dayCloseOverrides,
  escalationStatusEnum,
} from "@/lib/schema";
import { and, eq, ne, inArray, desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

function canCreate(role) {
  return ["admin", "team_manager"].includes(role) || ["principal", "coordinator"].includes(role);
}

export async function GET(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager", "member"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const section = String(searchParams.get("section") || "");
  const id = Number(searchParams.get("id"));

  const uid = Number(session.user.id);
  const isAdmin = session.user.role === "admin";

  try {
    if (section === "forYou") {
      const rows = await db
        .select({
          id: escalationsMatters.id,
          title: escalationsMatters.title,
          description: escalationsMatters.description,
          status: escalationsMatters.status,
          level: escalationsMatters.level,
          createdAt: escalationsMatters.createdAt,
          creatorId: escalationsMatters.createdById,
        })
        .from(escalationsMatters)
        .where(eq(escalationsMatters.currentAssigneeId, uid))
        .orderBy(desc(escalationsMatters.createdAt));
      return NextResponse.json({ matters: rows }, { status: 200 });
    }
    if (section === "raisedByMe") {
      const rows = await db
        .select({
          id: escalationsMatters.id,
          title: escalationsMatters.title,
          status: escalationsMatters.status,
          level: escalationsMatters.level,
          currentAssigneeId: escalationsMatters.currentAssigneeId,
          createdAt: escalationsMatters.createdAt,
        })
        .from(escalationsMatters)
        .where(eq(escalationsMatters.createdById, uid))
        .orderBy(desc(escalationsMatters.createdAt));
      return NextResponse.json({ matters: rows }, { status: 200 });
    }
    if (section === "all") {
      if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const rows = await db.select().from(escalationsMatters).orderBy(desc(escalationsMatters.createdAt));
      return NextResponse.json({ matters: rows }, { status: 200 });
    }
    if (section === "detail") {
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      const matterRows = await db.select().from(escalationsMatters).where(eq(escalationsMatters.id, id));
      if (!matterRows.length) return NextResponse.json({ error: "not found" }, { status: 404 });
      const members = await db
        .select({
          id: escalationsMatterMembers.id,
          userId: escalationsMatterMembers.userId,
          userName: users.name,
        })
        .from(escalationsMatterMembers)
        .leftJoin(users, eq(escalationsMatterMembers.userId, users.id))
        .where(eq(escalationsMatterMembers.matterId, id));
      const rawSteps = await db
        .select({
          id: escalationsSteps.id,
          matterId: escalationsSteps.matterId,
          level: escalationsSteps.level,
          action: escalationsSteps.action,
          fromUserId: escalationsSteps.fromUserId,
          toUserId: escalationsSteps.toUserId,
          note: escalationsSteps.note,
          createdAt: escalationsSteps.createdAt,
        })
        .from(escalationsSteps)
        .where(eq(escalationsSteps.matterId, id))
        .orderBy(escalationsSteps.createdAt);
      const idSet = new Set();
      rawSteps.forEach(s => { if (s.fromUserId) idSet.add(s.fromUserId); if (s.toUserId) idSet.add(s.toUserId); });
      let nameMap = new Map();
      if (idSet.size > 0) {
        const arr = Array.from(idSet);
        const rows = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, arr));
        nameMap = new Map(rows.map(r => [r.id, r.name]));
      }
      const steps = rawSteps.map(s => ({
        ...s,
        fromUserName: s.fromUserId ? (nameMap.get(s.fromUserId) || null) : null,
        toUserName: s.toUserId ? (nameMap.get(s.toUserId) || null) : null,
      }));
      return NextResponse.json({ matter: matterRows[0], members, steps }, { status: 200 });
    }
    if (section === "isPaused") {
      const userId = Number(searchParams.get("userId") || uid);
      // count open matters where the user is involved
      const [{ count }] = await db.execute(sql`SELECT COUNT(*)::int as count
        FROM ${escalationsMatters} em
        JOIN ${escalationsMatterMembers} mm ON mm.matter_id = em.id
        WHERE mm.user_id = ${userId} AND em.status <> 'CLOSED'`);
      const overrideRows = await db
        .select()
        .from(dayCloseOverrides)
        .where(and(eq(dayCloseOverrides.userId, userId), eq(dayCloseOverrides.active, true)));
      const paused = Number(count) > 0 && overrideRows.length === 0;
      return NextResponse.json({ paused, openCount: Number(count), overrideActive: overrideRows.length > 0 }, { status: 200 });
    }
    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  } catch (e) {
    console.error("[escalations] GET error", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = session.user?.role;
  if (!canCreate(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const uid = Number(session.user.id);
  try {
    const body = await req.json();
    const title = String(body.title || "").trim();
    if (title.length < 3) return NextResponse.json({ error: "Title too short" }, { status: 400 });
    const description = body.description ? String(body.description) : null;
    const l1AssigneeId = Number(body.l1AssigneeId);
    if (!l1AssigneeId) return NextResponse.json({ error: "l1AssigneeId required" }, { status: 400 });
    // ensure L1 assignee is admin or team_manager
    const l1Row = await db.select({ role: users.role }).from(users).where(eq(users.id, l1AssigneeId));
    if (!l1Row.length || !["admin", "team_manager"].includes(l1Row[0].role)) {
      return NextResponse.json({ error: "L1 assignee must be an admin or team manager" }, { status: 400 });
    }
    const suggestedLevel2Id = body.suggestedLevel2Id ? Number(body.suggestedLevel2Id) : null;
    const involvedUserIds = Array.isArray(body.involvedUserIds) ? Array.from(new Set(body.involvedUserIds.map(Number).filter(Boolean))) : [];

    const [row] = await db
      .insert(escalationsMatters)
      .values({ title, description, createdById: uid, currentAssigneeId: l1AssigneeId, suggestedLevel2Id, status: "OPEN", level: 1 })
      .returning({ id: escalationsMatters.id });
    const matterId = row.id;

    for (const u of involvedUserIds) {
      try { await db.insert(escalationsMatterMembers).values({ matterId, userId: u }); } catch {}
    }

    await db.insert(escalationsSteps).values({ matterId, level: 1, action: "CREATED", fromUserId: uid, toUserId: l1AssigneeId, note: null });
    return NextResponse.json({ id: matterId }, { status: 201 });
  } catch (e) {
    console.error("[escalations] POST error", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const uid = Number(session.user.id);
  const isAdmin = session.user.role === "admin";
  const { searchParams } = new URL(req.url);
  const section = String(searchParams.get("section") || "");
  try {
    const body = await req.json();

    if (section === "escalate") {
      const id = Number(body.id);
      const toUserId = Number(body.l2AssigneeId);
      const note = body.note ? String(body.note) : null;
      if (!id || !toUserId) return NextResponse.json({ error: "id and l2AssigneeId required" }, { status: 400 });
      // ensure L2 assignee is admin or team_manager
      const toRow = await db.select({ role: users.role }).from(users).where(eq(users.id, toUserId));
      if (!toRow.length || !["admin", "team_manager"].includes(toRow[0].role)) {
        return NextResponse.json({ error: "L2 assignee must be an admin or team manager" }, { status: 400 });
      }
      const [m] = await db.select().from(escalationsMatters).where(eq(escalationsMatters.id, id));
      if (!m) return NextResponse.json({ error: "not found" }, { status: 404 });
      if (m.level !== 1) return NextResponse.json({ error: "Can only escalate at level 1" }, { status: 400 });
      if (!(isAdmin || m.currentAssigneeId === uid)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      await db
        .update(escalationsMatters)
        .set({ level: 2, status: "ESCALATED", currentAssigneeId: toUserId, updatedAt: new Date() })
        .where(eq(escalationsMatters.id, id));
      await db.insert(escalationsSteps).values({ matterId: id, level: 2, action: "ESCALATE", fromUserId: uid, toUserId, note });
      return NextResponse.json({ updated: 1 }, { status: 200 });
    }

    if (section === "close") {
      const id = Number(body.id);
      const note = String(body.note || "").trim();
      if (!id || note.length === 0) return NextResponse.json({ error: "id and note required" }, { status: 400 });
      const [m] = await db.select().from(escalationsMatters).where(eq(escalationsMatters.id, id));
      if (!m) return NextResponse.json({ error: "not found" }, { status: 404 });
      if (!(isAdmin || m.currentAssigneeId === uid)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      await db.update(escalationsMatters).set({ status: "CLOSED", currentAssigneeId: null, updatedAt: new Date() }).where(eq(escalationsMatters.id, id));
      await db.insert(escalationsSteps).values({ matterId: id, level: m.level, action: "CLOSE", fromUserId: uid, toUserId: null, note });
      return NextResponse.json({ updated: 1 }, { status: 200 });
    }

    if (section === "progress") {
      const id = Number(body.id);
      const note = String(body.note || "").trim();
      if (!id || note.length === 0) return NextResponse.json({ error: "id and note required" }, { status: 400 });
      const [m] = await db.select().from(escalationsMatters).where(eq(escalationsMatters.id, id));
      if (!m) return NextResponse.json({ error: "not found" }, { status: 404 });
      // Allow progress by: current assignee, creator, any involved member, or admin
      let allowed = isAdmin || m.currentAssigneeId === uid || m.createdById === uid;
      if (!allowed) {
        const involved = await db
          .select({ id: escalationsMatterMembers.id })
          .from(escalationsMatterMembers)
          .where(and(eq(escalationsMatterMembers.matterId, id), eq(escalationsMatterMembers.userId, uid)));
        if (involved && involved.length > 0) allowed = true;
      }
      if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      await db.insert(escalationsSteps).values({ matterId: id, level: m.level, action: "PROGRESS", fromUserId: uid, toUserId: m.currentAssigneeId, note });
      await db.update(escalationsMatters).set({ updatedAt: new Date() }).where(eq(escalationsMatters.id, id));
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (section === "override") {
      if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const userId = Number(body.userId);
      const active = !!body.active;
      const reason = body.reason ? String(body.reason) : null;
      const matterId = body.matterId ? Number(body.matterId) : null;
      if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
      if (active) {
        await db.insert(dayCloseOverrides).values({ userId, matterId, reason, active: true, createdBy: uid });
      } else {
        // deactivate all active overrides for user
        await db.update(dayCloseOverrides).set({ active: false, endedAt: new Date() }).where(and(eq(dayCloseOverrides.userId, userId), eq(dayCloseOverrides.active, true)));
      }
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  } catch (e) {
    console.error("[escalations] PATCH error", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
