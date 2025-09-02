import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  users,
  assignedTasks,
  assignedTaskStatus,
  routineTasks,
  userMriRoles,
  meRightNowSessions,
} from "@/lib/schema";
import { auth } from "@/lib/auth";
import { and, desc, eq, inArray } from "drizzle-orm";
import crypto from "crypto";

// ───────────────────────────────────────────────────────────
// helpers
function pretty(label = "") {
  return String(label)
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
function etagFor(rows) {
  const h = crypto.createHash("sha1").update(JSON.stringify(rows)).digest("base64");
  return `"mrr:${h}"`;
}

// in-memory per-instance cache (ok for serverless runtimes)
let FEED_CACHE = { rows: null, etag: null, ts: 0 };
const FEED_TTL_MS = 5000; // 5s

export async function GET(req) {
  const session = await auth();
  if (!session || !["member", "team_manager", "admin"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "";
  const type = (searchParams.get("type") || "assigned").toLowerCase();
  const selfId = Number(session.user.id);

  // current (with avatar)
  if (action === "current") {
    const [row] = await db
      .select({
        userId: users.id,
        userName: users.name,
        avatar: users.image,
        role: users.role,
        type: meRightNowSessions.type,
        itemId: meRightNowSessions.itemId,
        itemTitle: meRightNowSessions.itemTitle,
        note: meRightNowSessions.note,
        startedAt: meRightNowSessions.startedAt,
        active: meRightNowSessions.active,
      })
      .from(meRightNowSessions)
      .innerJoin(users, eq(meRightNowSessions.userId, users.id))
      .where(and(eq(meRightNowSessions.userId, selfId), eq(meRightNowSessions.active, true)))
      .orderBy(desc(meRightNowSessions.startedAt))
      .limit(1);

    return NextResponse.json({ current: row || null });
  }

  // options for picker (user-scoped)
  if (action === "options") {
    if (type === "assigned") {
      const ALLOWED = ["not_started", "in_progress", "pending_verification"];
      const rows = await db
        .select({ id: assignedTasks.id, title: assignedTasks.title })
        .from(assignedTaskStatus)
        .innerJoin(assignedTasks, eq(assignedTaskStatus.taskId, assignedTasks.id))
        .where(and(eq(assignedTaskStatus.memberId, selfId), inArray(assignedTaskStatus.status, ALLOWED)));
      return NextResponse.json({ items: rows });
    }

    if (type === "routine") {
      const rows = await db
        .select({ id: routineTasks.id, title: routineTasks.description })
        .from(routineTasks)
        .where(eq(routineTasks.memberId, selfId));
      return NextResponse.json({ items: rows });
    }

    if (type === "mri") {
      const rows = await db
        .select({ id: userMriRoles.role, raw: userMriRoles.role })
        .from(userMriRoles)
        .where(and(eq(userMriRoles.userId, selfId), eq(userMriRoles.active, true)));

      const items = rows.map((r) => ({ id: r.id, title: pretty(r.raw) }));
      return NextResponse.json({ items });
    }

    return NextResponse.json({ items: [] });
  }

  // everyone’s active broadcasts — with ETag/304 + TTL cache
  if (action === "feed") {
    const now = Date.now();
    const inm = req.headers.get("if-none-match");

    if (FEED_CACHE.rows && now - FEED_CACHE.ts < FEED_TTL_MS) {
      const headers = new Headers({
        ETag: FEED_CACHE.etag,
        "Cache-Control": "private, max-age=5, stale-while-revalidate=20",
      });
      if (inm && inm === FEED_CACHE.etag) {
        return new Response(null, { status: 304, headers });
      }
      return NextResponse.json({ feed: FEED_CACHE.rows }, { headers });
    }

    const rows = await db
      .select({
        userId: users.id,
        userName: users.name,
        avatar: users.image,
        role: users.role,
        type: meRightNowSessions.type,
        itemId: meRightNowSessions.itemId,
        itemTitle: meRightNowSessions.itemTitle,
        note: meRightNowSessions.note,
        startedAt: meRightNowSessions.startedAt,
      })
      .from(meRightNowSessions)
      .innerJoin(users, eq(meRightNowSessions.userId, users.id))
      .where(eq(meRightNowSessions.active, true))
      .orderBy(desc(meRightNowSessions.startedAt));

    const etag = etagFor(rows);
    FEED_CACHE = { rows, etag, ts: now };

    const headers = new Headers({
      ETag: etag,
      "Cache-Control": "private, max-age=5, stale-while-revalidate=20",
    });

    if (inm && inm === etag) {
      return new Response(null, { status: 304, headers });
    }
    return NextResponse.json({ feed: rows }, { headers });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function POST(req) {
  const session = await auth();
  if (!session || !["member", "team_manager", "admin"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const selfId = Number(session.user.id);
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "";

  if (action === "start") {
    const body = await req.json();
    const type = String(body?.type || "assigned").toLowerCase();
    const itemId = String(body?.itemId || "");
    const note = body?.note ? String(body.note) : "";
    if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });

    // validate + resolve title
    let itemTitle = "Untitled";

    if (type === "assigned") {
      const [row] = await db
        .select({ title: assignedTasks.title })
        .from(assignedTaskStatus)
        .innerJoin(assignedTasks, eq(assignedTaskStatus.taskId, assignedTasks.id))
        .where(and(eq(assignedTaskStatus.memberId, selfId), eq(assignedTaskStatus.taskId, Number(itemId))))
        .limit(1);
      if (!row) return NextResponse.json({ error: "Task not assigned" }, { status: 404 });
      itemTitle = row.title;
    } else if (type === "routine") {
      const [row] = await db
        .select({ title: routineTasks.description })
        .from(routineTasks)
        .where(and(eq(routineTasks.id, Number(itemId)), eq(routineTasks.memberId, selfId)))
        .limit(1);
      if (!row) return NextResponse.json({ error: "Routine not found" }, { status: 404 });
      itemTitle = row.title;
    } else if (type === "mri") {
      const [row] = await db
        .select({ role: userMriRoles.role })
        .from(userMriRoles)
        .where(and(eq(userMriRoles.userId, selfId), eq(userMriRoles.role, itemId), eq(userMriRoles.active, true)))
        .limit(1);
      if (!row) return NextResponse.json({ error: "MRI role not found" }, { status: 404 });
      itemTitle = pretty(row.role);
    } else {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    // Neon (http) has no transaction support — do in sequence
    const now = new Date();
    await db
      .update(meRightNowSessions)
      .set({ active: false, endedAt: now })
      .where(and(eq(meRightNowSessions.userId, selfId), eq(meRightNowSessions.active, true)));

    const [current] = await db
      .insert(meRightNowSessions)
      .values({
        userId: selfId,
        type,
        itemId,
        itemTitle,
        note,
        startedAt: now,
        active: true,
      })
      .returning();

    // invalidate feed cache so everyone sees it on next poll
    FEED_CACHE = { rows: null, etag: null, ts: 0 };

    return NextResponse.json({ current }, { status: 200 });
  }

  if (action === "stop") {
    const now = new Date();
    await db
      .update(meRightNowSessions)
      .set({ active: false, endedAt: now })
      .where(and(eq(meRightNowSessions.userId, selfId), eq(meRightNowSessions.active, true)));

    FEED_CACHE = { rows: null, etag: null, ts: 0 };
    return NextResponse.json({ current: null }, { status: 200 });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
