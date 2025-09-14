import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, userMriRoles, scannerSessions, attendanceEvents, finalDailyAttendance, finalDailyAbsentees, userOpenCloseTimes } from "@/lib/schema";
import { and, eq, inArray } from "drizzle-orm";
import crypto from "crypto";

const b64u = (s) => Buffer.from(s).toString("base64").replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_');
const b64uJson = (o) => b64u(JSON.stringify(o));
const sign = (payload, secret) => crypto.createHmac("sha256", secret).update(payload).digest("hex");
const SECRET = process.env.ATTENDANCE_SECRET || process.env.NEXTAUTH_SECRET || "dev_secret";

function nowTs() { return Math.floor(Date.now() / 1000); }

export async function GET(req) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const section = String(searchParams.get("section") || "");
  try {
    if (section === "personalToken") {
      const uid = Number(session.user.id);
      const date = new Date().toISOString().slice(0,10);
      const payload = { uid, date, exp: nowTs() + 10 * 60, nonce: crypto.randomBytes(6).toString("hex") };
      const p = b64uJson(payload);
      const sig = sign(p, SECRET);
      return NextResponse.json({ token: `${p}.${sig}` });
    }
    if (section === "sessionEvents") {
      const sessionId = Number(searchParams.get('sessionId'));
      if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
      // fetch latest attendance events for this session
      const rows = await db
        .select({
          id: attendanceEvents.id,
          userId: attendanceEvents.userId,
          at: attendanceEvents.at,
          name: users.name,
        })
        .from(attendanceEvents)
        .leftJoin(users, eq(users.id, attendanceEvents.userId))
        .where(eq(attendanceEvents.sessionId, sessionId));
      // sort ascending by time
      rows.sort((a,b)=> new Date(a.at) - new Date(b.at));
      return NextResponse.json({ events: rows }, { status: 200 });
    }

    if (section === "report") {
      const dateStr = String(searchParams.get('date') || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return NextResponse.json({ error: 'date (YYYY-MM-DD) required' }, { status: 400 });
      const programKey = (searchParams.get('programKey') || '').toUpperCase() || null;
      const track = (searchParams.get('track') || '').toLowerCase() || null;
      const dateOnly = new Date(`${dateStr}T00:00:00.000Z`);

      // Build base filters
      const filters = [eq(finalDailyAttendance.date, dateOnly)];
      const filtersAbs = [eq(finalDailyAbsentees.date, dateOnly)];
      if (programKey) {
        filters.push(eq(finalDailyAttendance.programKey, programKey));
        filtersAbs.push(eq(finalDailyAbsentees.programKey, programKey));
      }
      if (track) {
        filters.push(eq(finalDailyAttendance.track, track));
        filtersAbs.push(eq(finalDailyAbsentees.track, track));
      }

      // Fetch presents
      const presents = await db
        .select({ userId: finalDailyAttendance.userId, name: finalDailyAttendance.name, at: finalDailyAttendance.at, isTeacher: users.isTeacher })
        .from(finalDailyAttendance)
        .leftJoin(users, eq(users.id, finalDailyAttendance.userId))
        .where(and(...filters));
      // Fetch absentees
      const abs = await db
        .select({ userId: finalDailyAbsentees.userId, name: finalDailyAbsentees.name, isTeacher: users.isTeacher })
        .from(finalDailyAbsentees)
        .leftJoin(users, eq(users.id, finalDailyAbsentees.userId))
        .where(and(...filtersAbs));

      // Sort for readability
      presents.sort((a,b)=> (a.name||'').localeCompare(b.name||''));
      abs.sort((a,b)=> (a.name||'').localeCompare(b.name||''));

      // Partition by isTeacher
      const presTeachers = presents.filter(p => p.isTeacher === true);
      const presNonTeachers = presents.filter(p => p.isTeacher !== true);
      const absTeachers = abs.filter(p => p.isTeacher === true);
      const absNonTeachers = abs.filter(p => p.isTeacher !== true);

      return NextResponse.json({
        date: dateStr,
        programKey: programKey || null,
        track: track || null,
        totals: {
          present: presents.length,
          absent: abs.length,
          presentTeachers: presTeachers.length,
          presentNonTeachers: presNonTeachers.length,
          absentTeachers: absTeachers.length,
          absentNonTeachers: absNonTeachers.length,
        },
        presents,
        absentees: abs,
      }, { status: 200 });
    }
    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const section = String(searchParams.get("section") || "");
  const body = await req.json().catch(() => ({}));
  try {
    if (section === "sessionStart") {
      // Require RMRI role holder (e.g., msp_ele_moderator)
      const roleRows = await db.select().from(userMriRoles).where(and(eq(userMriRoles.userId, Number(session.user.id)), eq(userMriRoles.active, true)));
      const roleKeys = new Set(roleRows.map(r => r.role));
      const roleKey = String(body.roleKey || "").toLowerCase();
      if (!roleKey || !roleKeys.has(roleKey)) return NextResponse.json({ error: "Not permitted for this role" }, { status: 403 });
      const programKey = String(body.programKey || "MSP").toUpperCase();
      const track = String(body.track || "elementary").toLowerCase();
      const ttlMin = Number(body.ttlMin || 25);
      const nonce = crypto.randomBytes(12).toString("hex");
      const expiresAt = new Date(Date.now() + ttlMin * 60 * 1000);
      const [row] = await db.insert(scannerSessions).values({ programKey, track, roleKey, startedBy: Number(session.user.id), nonce, active: true, expiresAt }).returning();
      const payload = { sid: row.id, nonce, exp: nowTs() + ttlMin * 60 };
      const p = b64uJson(payload);
      const sig = sign(p, SECRET);
      return NextResponse.json({ session: { id: row.id, programKey, track, expiresAt }, token: `${p}.${sig}` }, { status: 201 });
    }

    if (section === "ingest") {
      const { sessionToken, userToken, clientIp, wifiSsid, deviceFp } = body || {};
      if (!sessionToken || !userToken) return NextResponse.json({ error: "sessionToken and userToken required" }, { status: 400 });
      const [sp, ssig] = String(sessionToken).split('.') || [];
      const [up, usig] = String(userToken).split('.') || [];
      if (!sp || !ssig || !up || !usig) return NextResponse.json({ error: "Invalid token(s)" }, { status: 400 });
      if (sign(sp, SECRET) !== ssig || sign(up, SECRET) !== usig) return NextResponse.json({ error: "Bad signature" }, { status: 403 });
      const sPayload = JSON.parse(Buffer.from(sp.replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString('utf8'));
      const uPayload = JSON.parse(Buffer.from(up.replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString('utf8'));
      if (!sPayload?.sid || !uPayload?.uid) return NextResponse.json({ error: "Malformed payloads" }, { status: 400 });
      if (sPayload.exp && nowTs() > sPayload.exp) return NextResponse.json({ error: "Session expired" }, { status: 410 });
      if (uPayload.exp && nowTs() > uPayload.exp) return NextResponse.json({ error: "User token expired" }, { status: 410 });
      // Verify session active
      const [sess] = await db.select().from(scannerSessions).where(eq(scannerSessions.id, Number(sPayload.sid)));
      if (!sess || sess.active === false || (sess.expiresAt && new Date() > new Date(sess.expiresAt))) {
        return NextResponse.json({ error: "Session inactive" }, { status: 410 });
      }
      // Upsert attendance
      try {
        await db.insert(attendanceEvents).values({ sessionId: Number(sPayload.sid), userId: Number(uPayload.uid), clientIp: clientIp || null, wifiSsid: wifiSsid || null, deviceFp: deviceFp || null });
      } catch {
        // duplicate → ok
      }

      // Also persist 'Day Opened' for this user/date if not already set
      try {
        const today = new Date();
        const dateOnly = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
        const [existing] = await db
          .select({ id: userOpenCloseTimes.id })
          .from(userOpenCloseTimes)
          .where(and(eq(userOpenCloseTimes.userId, Number(uPayload.uid)), eq(userOpenCloseTimes.createdAt, dateOnly)));
        const hhmmss = new Date().toTimeString().split(" ")[0];
        if (!existing) {
          await db.insert(userOpenCloseTimes).values({ userId: Number(uPayload.uid), dayOpenedAt: hhmmss, createdAt: dateOnly });
        }
        // if exists, we assume it's already marked; avoid overriding
      } catch (_) {
        // best-effort; do not fail ingest
      }
      return NextResponse.json({ ok: true });
    }

    if (section === "sessionEnd") {
      const sessionId = Number(body.sessionId);
      if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });
      await db.update(scannerSessions).set({ active: false }).where(eq(scannerSessions.id, sessionId));
      return NextResponse.json({ ended: true });
    }

    if (section === "finalize") {
      const sessionId = Number(body.sessionId);
      const expectedUserIds = Array.isArray(body.expectedUserIds) ? body.expectedUserIds.map(Number).filter(Boolean) : null;
      if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });
      // Load session and events
      const [sess] = await db.select().from(scannerSessions).where(eq(scannerSessions.id, sessionId));
      if (!sess) return NextResponse.json({ error: "session not found" }, { status: 404 });
      const evs = await db
        .select({ userId: attendanceEvents.userId, at: attendanceEvents.at, name: users.name })
        .from(attendanceEvents)
        .leftJoin(users, eq(users.id, attendanceEvents.userId))
        .where(eq(attendanceEvents.sessionId, sessionId));
      const presentIds = Array.from(new Set(evs.map(e => Number(e.userId))));
      const today = new Date();
      const dateOnly = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
      // Insert presents
      for (const e of evs) {
        try {
          await db.insert(finalDailyAttendance).values({ sessionId, userId: e.userId, name: e.name || null, at: e.at, date: dateOnly, programKey: sess.programKey, track: sess.track, roleKey: sess.roleKey });
        } catch {}
      }
      // Compute expected list
      let expected = expectedUserIds;
      if (!expected) {
        const rows = await db.select({ id: users.id }).from(users);
        expected = rows.map(r => Number(r.id));
      }
      const absentees = expected.filter(id => !presentIds.includes(Number(id)));
      if (absentees.length) {
        // fetch names
        const names = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, absentees));
        const nameMap = new Map(names.map(n => [Number(n.id), n.name]));
        for (const uid of absentees) {
          try { await db.insert(finalDailyAbsentees).values({ sessionId, userId: uid, name: nameMap.get(Number(uid)) || null, date: dateOnly, programKey: sess.programKey, track: sess.track, roleKey: sess.roleKey }); } catch {}
        }
      }
      return NextResponse.json({ finalized: { presents: presentIds.length, absentees: absentees.length } }, { status: 200 });
    }

    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  } catch (e) {
    console.error("attendance error", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
