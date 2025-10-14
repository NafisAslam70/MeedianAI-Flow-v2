import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, userMriRoles, scannerSessions, attendanceEvents, finalDailyAttendance, finalDailyAbsentees, userOpenCloseTimes, dayOpenCloseHistory, directWhatsappMessages, mriPrograms } from "@/lib/schema";
import { and, eq, inArray } from "drizzle-orm";
import crypto from "crypto";
import { sendWhatsappMessage } from "@/lib/whatsapp";

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
      const programIdParam = searchParams.get('programId');
      const programId = programIdParam ? Number(programIdParam) : null;
      if (programIdParam && !Number.isFinite(programId)) {
        return NextResponse.json({ error: 'programId must be numeric' }, { status: 400 });
      }
      const track = (searchParams.get('track') || '').toLowerCase() || null;
      const dateOnly = new Date(`${dateStr}T00:00:00.000Z`);

      // Build base filters
      const filters = [eq(finalDailyAttendance.date, dateOnly)];
      const filtersAbs = [eq(finalDailyAbsentees.date, dateOnly)];
      if (programKey) {
        filters.push(eq(finalDailyAttendance.programKey, programKey));
        filtersAbs.push(eq(finalDailyAbsentees.programKey, programKey));
      }
      if (programId) {
        filters.push(eq(finalDailyAttendance.programId, programId));
        filtersAbs.push(eq(finalDailyAbsentees.programId, programId));
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
        programId: programId || null,
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
      const programIdRaw = body.programId;
      let programId = Number.isFinite(Number(programIdRaw)) ? Number(programIdRaw) : null;
      if (!programId && programKey) {
        const [programRow] = await db
          .select({ id: mriPrograms.id })
          .from(mriPrograms)
          .where(eq(mriPrograms.programKey, programKey))
          .limit(1);
        if (programRow?.id) programId = Number(programRow.id);
      }
      const target = String(body.target || "").trim().toLowerCase() || "members";
      const ttlMin = Number(body.ttlMin || 25);
      const nonce = crypto.randomBytes(12).toString("hex");
      const expiresAt = new Date(Date.now() + ttlMin * 60 * 1000);
      const [row] = await db
        .insert(scannerSessions)
        .values({
          programKey,
          track,
          programId,
          target,
          roleKey,
          startedBy: Number(session.user.id),
          nonce,
          active: true,
          expiresAt,
        })
        .returning();
      const payload = { sid: row.id, nonce, exp: nowTs() + ttlMin * 60 };
      const p = b64uJson(payload);
      const sig = sign(p, SECRET);
      return NextResponse.json({ session: { id: row.id, programKey, programId, track, target, expiresAt }, token: `${p}.${sig}` }, { status: 201 });
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
        const dateOnly = new Date(today);
        dateOnly.setHours(0,0,0,0); // local start-of-day to match mri-status query
        const [existing] = await db
          .select({ id: userOpenCloseTimes.id })
          .from(userOpenCloseTimes)
          .where(and(eq(userOpenCloseTimes.userId, Number(uPayload.uid)), eq(userOpenCloseTimes.createdAt, dateOnly)));
        const hhmmss = new Date().toTimeString().split(" ")[0];
        if (!existing) {
          await db.insert(userOpenCloseTimes).values({ userId: Number(uPayload.uid), dayOpenedAt: hhmmss, createdAt: dateOnly });
        }
        // History upsert for open
        try {
          const [hist] = await db
            .select({ id: dayOpenCloseHistory.id, openedAt: dayOpenCloseHistory.openedAt })
            .from(dayOpenCloseHistory)
            .where(and(eq(dayOpenCloseHistory.userId, Number(uPayload.uid)), eq(dayOpenCloseHistory.date, dateOnly)));
          if (!hist) {
            await db.insert(dayOpenCloseHistory).values({ userId: Number(uPayload.uid), date: dateOnly, openedAt: hhmmss, source: 'scan' });
          } else if (!hist.openedAt) {
            await db.update(dayOpenCloseHistory).set({ openedAt: hhmmss, source: 'scan' }).where(and(eq(dayOpenCloseHistory.userId, Number(uPayload.uid)), eq(dayOpenCloseHistory.date, dateOnly)));
          }
        } catch {}
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

    if (section === "notifyAbsentees") {
      if (!["admin", "team_manager"].includes(session.user?.role)) {
        return NextResponse.json({ error: "Not permitted" }, { status: 403 });
      }

      const dateStr = String(body.date || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return NextResponse.json({ error: "date (YYYY-MM-DD) required" }, { status: 400 });
      }

      const programKey = String(body.programKey || "").toUpperCase() || null;
      const programIdRaw = body.programId;
      const programId = Number.isFinite(Number(programIdRaw)) ? Number(programIdRaw) : null;
      const track = String(body.track || "").toLowerCase() || null;
      const subject = String(body.subject || "Attendance Reminder").trim();
      const messageBody = String(body.message || `We noticed your attendance is still pending for ${dateStr}. Please scan in or contact your moderator immediately.`).trim();
      const includeFooter = body.includeFooter !== false;
      const requestedIds = Array.isArray(body.recipientUserIds)
        ? new Set(
            body.recipientUserIds
              .map((id) => Number(id))
              .filter((id) => Number.isFinite(id))
          )
        : null;

      const [sender] = await db
        .select({ id: users.id, name: users.name, whatsapp_number: users.whatsapp_number })
        .from(users)
        .where(eq(users.id, Number(session.user.id)));

      if (!sender) {
        return NextResponse.json({ error: "Sender not found" }, { status: 404 });
      }

      const contact = String(body.contact || sender.whatsapp_number || "Leadership Desk").trim();
      const senderDisplay = sender.name
        ? `${sender.name} (from Meed Leadership Group)`
        : "System (from Meed Leadership Group)";

      const dateOnly = new Date(`${dateStr}T00:00:00.000Z`);
      const filters = [eq(finalDailyAbsentees.date, dateOnly)];
      if (programKey) filters.push(eq(finalDailyAbsentees.programKey, programKey));
      if (programId) filters.push(eq(finalDailyAbsentees.programId, programId));
      if (track) filters.push(eq(finalDailyAbsentees.track, track));
      const combine = (conds) => conds.reduce((acc, cond) => (acc ? and(acc, cond) : cond), undefined);
      const whereClause = combine(filters);

      let query = db
        .select({
          userId: finalDailyAbsentees.userId,
          name: users.name,
          whatsapp: users.whatsapp_number,
          whatsappEnabled: users.whatsapp_enabled,
        })
        .from(finalDailyAbsentees)
        .leftJoin(users, eq(users.id, finalDailyAbsentees.userId));
      if (whereClause) query = query.where(whereClause);
      let rows = await query;

      if (requestedIds) {
        if (!requestedIds.size) {
          return NextResponse.json({ sent: 0, skipped: rows.length, failed: 0, message: "No recipients selected." }, { status: 200 });
        }
        rows = rows.filter((row) => {
          const id = Number(row.userId);
          return Number.isFinite(id) && requestedIds.has(id);
        });
      }

      if (!rows.length) {
        return NextResponse.json({ sent: 0, skipped: 0, failed: 0, message: "No absentees to notify." }, { status: 200 });
      }

      const footer = `Sent on ${new Date().toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}. Please update your attendance on MeedianAI.`;

      let sent = 0;
      let skipped = 0;
      let failed = 0;

      for (const row of rows) {
        const numericId = Number(row.userId);
        const hasNumericId = Number.isFinite(numericId);
        if (!hasNumericId || !row.whatsapp || row.whatsappEnabled === false) {
          skipped += 1;
          continue;
        }

        const recipientName = row.name || `Member #${numericId}`;
        const now = new Date();

        const [log] = await db
          .insert(directWhatsappMessages)
          .values({
            senderId: Number(session.user.id),
            recipientType: "existing",
            recipientUserId: numericId,
            recipientName,
            recipientWhatsappNumber: row.whatsapp,
            subject,
            message: messageBody,
            note: includeFooter ? footer : null,
            contact,
            createdAt: now,
          })
          .returning({ id: directWhatsappMessages.id });

        try {
          const tw = await sendWhatsappMessage(
            row.whatsapp,
            {
              recipientName,
              senderName: senderDisplay,
              subject,
              message: messageBody,
              note: includeFooter ? footer : "",
              contact,
              dateTime: now.toLocaleString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }),
            },
            { whatsapp_enabled: row.whatsappEnabled }
          );

          await db
            .update(directWhatsappMessages)
            .set({ twilioSid: tw?.sid || null, note: includeFooter ? footer : null })
            .where(eq(directWhatsappMessages.id, log.id));
          sent += 1;
        } catch (err) {
          failed += 1;
          await db
            .update(directWhatsappMessages)
            .set({ status: "failed", error: err?.message || String(err) })
            .where(eq(directWhatsappMessages.id, log.id));
        }
      }

      return NextResponse.json({ sent, skipped, failed, total: rows.length }, { status: 200 });
    }

    if (section === "finalize") {
      const sessionId = Number(body.sessionId);
      const expectedUserIds = Array.isArray(body.expectedUserIds) ? body.expectedUserIds.map(Number).filter(Boolean) : null;
      if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });
      // Load session and events
      const [sess] = await db.select().from(scannerSessions).where(eq(scannerSessions.id, sessionId));
      if (!sess) return NextResponse.json({ error: "session not found" }, { status: 404 });
      const overrideProgramKey = body.programKey ? String(body.programKey).trim().toUpperCase() : null;
      const overrideProgramId = body.programId !== undefined && body.programId !== null && Number.isFinite(Number(body.programId)) ? Number(body.programId) : null;
      const overrideTrack = body.track ? String(body.track).trim().toLowerCase() : null;
      const overrideTarget = body.target ? String(body.target).trim().toLowerCase() : null;
      const effectiveProgramKey = overrideProgramKey || (sess.programKey ? String(sess.programKey).trim().toUpperCase() : null);
      const effectiveProgramId = overrideProgramId !== null ? overrideProgramId : (Number.isFinite(Number(sess.programId)) ? Number(sess.programId) : null);
      const effectiveTrack = overrideTrack || (sess.track ? String(sess.track).trim().toLowerCase() : null);
      const effectiveTarget = overrideTarget || (sess.target ? String(sess.target).trim().toLowerCase() : null);
      const evs = await db
        .select({ userId: attendanceEvents.userId, at: attendanceEvents.at, name: users.name })
        .from(attendanceEvents)
        .leftJoin(users, eq(users.id, attendanceEvents.userId))
        .where(eq(attendanceEvents.sessionId, sessionId));
      const presentIds = Array.from(new Set(evs.map((e) => Number(e.userId)).filter((id) => Number.isFinite(id))));
      const presentSet = new Set(presentIds);
      const today = new Date();
      const dateOnly = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
      const combine = (conds) => conds.reduce((acc, cond) => (acc ? and(acc, cond) : cond), undefined);
      const attendanceFilters = [eq(finalDailyAttendance.date, dateOnly)];
      const absenteeFilters = [eq(finalDailyAbsentees.date, dateOnly)];
      if (effectiveProgramKey) {
        attendanceFilters.push(eq(finalDailyAttendance.programKey, effectiveProgramKey));
        absenteeFilters.push(eq(finalDailyAbsentees.programKey, effectiveProgramKey));
      }
      if (effectiveProgramId !== null) {
        attendanceFilters.push(eq(finalDailyAttendance.programId, effectiveProgramId));
        absenteeFilters.push(eq(finalDailyAbsentees.programId, effectiveProgramId));
      }
      if (effectiveTrack) {
        attendanceFilters.push(eq(finalDailyAttendance.track, effectiveTrack));
        absenteeFilters.push(eq(finalDailyAbsentees.track, effectiveTrack));
      }
      // Insert presents
      for (const e of evs) {
        try {
          await db.insert(finalDailyAttendance).values({
            sessionId,
            userId: e.userId,
            name: e.name || null,
            at: e.at,
            date: dateOnly,
            programKey: effectiveProgramKey,
            programId: effectiveProgramId,
            track: effectiveTrack,
            target: effectiveTarget,
            roleKey: sess.roleKey,
          });
        } catch {}
      }
      if (presentIds.length) {
        const deleteWhere = combine([...absenteeFilters, inArray(finalDailyAbsentees.userId, presentIds)]);
        if (deleteWhere) await db.delete(finalDailyAbsentees).where(deleteWhere);
      }
      // Compute expected list
      let expected = expectedUserIds;
      if (!expected) {
        const rows = await db.select({ id: users.id }).from(users);
        expected = rows.map((r) => Number(r.id));
      }
      expected = Array.from(new Set(expected.filter((id) => Number.isFinite(id))));

      let previouslyPresentIds = new Set();
      if (expected.length) {
        const wherePrev = combine([...attendanceFilters, inArray(finalDailyAttendance.userId, expected)]);
        if (wherePrev) {
          const prevRows = await db
            .select({ userId: finalDailyAttendance.userId })
            .from(finalDailyAttendance)
            .where(wherePrev);
          previouslyPresentIds = new Set(prevRows.map((row) => Number(row.userId)));
        }
      }

      const absentees = expected.filter((id) => !presentSet.has(id) && !previouslyPresentIds.has(id));
      if (absentees.length) {
        // fetch names
        const purgeWhere = combine([...absenteeFilters, inArray(finalDailyAbsentees.userId, absentees)]);
        if (purgeWhere) await db.delete(finalDailyAbsentees).where(purgeWhere);
        const names = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, absentees));
        const nameMap = new Map(names.map(n => [Number(n.id), n.name]));
        for (const uid of absentees) {
          try {
            await db.insert(finalDailyAbsentees).values({
              sessionId,
              userId: uid,
              name: nameMap.get(Number(uid)) || null,
              date: dateOnly,
              programKey: effectiveProgramKey,
              programId: effectiveProgramId,
              track: effectiveTrack,
              target: effectiveTarget,
              roleKey: sess.roleKey,
            });
          } catch {}
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
