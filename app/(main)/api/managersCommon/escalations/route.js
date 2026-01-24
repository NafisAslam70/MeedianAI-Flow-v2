import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  users,
  students,
  escalationsMatters,
  escalationsMatterMembers,
  escalationsMatterStudents,
  escalationsSteps,
  dayCloseOverrides,
  escalationStatusEnum,
  messages,
  tickets,
  ticketActivities,
} from "@/lib/schema";
import { and, eq, ne, inArray, desc, sql } from "drizzle-orm";
import { sendWhatsappMessage } from "@/lib/whatsapp";

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
    if (section === "allOpen" || section === "allClosed") {
      // Visible to admins and team managers (not plain members)
      if (!session || !["admin","team_manager"].includes(session.user?.role)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const isClosed = section === "allClosed";
      const rows = await db
        .select({
          id: escalationsMatters.id,
          title: escalationsMatters.title,
          description: escalationsMatters.description,
          status: escalationsMatters.status,
          level: escalationsMatters.level,
          createdAt: escalationsMatters.createdAt,
          updatedAt: escalationsMatters.updatedAt,
          creatorId: escalationsMatters.createdById,
          currentAssigneeId: escalationsMatters.currentAssigneeId,
        })
        .from(escalationsMatters)
        .where(isClosed ? eq(escalationsMatters.status, 'CLOSED') : ne(escalationsMatters.status, 'CLOSED'))
        .orderBy(desc(isClosed ? escalationsMatters.updatedAt : escalationsMatters.createdAt));
      if (!isClosed) {
        return NextResponse.json({ matters: rows }, { status: 200 });
      }
      // For closed items, include the latest CLOSE note ("closing lines")
      const ids = rows.map(r => r.id);
      let closeNoteByMatter = new Map();
      if (ids.length) {
        const steps = await db
          .select({ matterId: escalationsSteps.matterId, note: escalationsSteps.note, createdAt: escalationsSteps.createdAt })
          .from(escalationsSteps)
          .where(and(inArray(escalationsSteps.matterId, ids), eq(escalationsSteps.action, 'CLOSE')))
          .orderBy(desc(escalationsSteps.createdAt));
        for (const s of steps) {
          if (!closeNoteByMatter.has(s.matterId)) closeNoteByMatter.set(s.matterId, { note: s.note, createdAt: s.createdAt });
        }
      }
      const withClose = rows.map(r => ({ ...r, closeNote: (closeNoteByMatter.get(r.id) || {}).note || null, closeAt: (closeNoteByMatter.get(r.id) || {}).createdAt || r.updatedAt }));
      return NextResponse.json({ matters: withClose }, { status: 200 });
    }
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
    if (section === "counts") {
      const assigned = await db
        .select({ id: escalationsMatters.id })
        .from(escalationsMatters)
        .where(and(ne(escalationsMatters.status, 'CLOSED'), eq(escalationsMatters.currentAssigneeId, uid)));
      const createdOpen = await db
        .select({ id: escalationsMatters.id })
        .from(escalationsMatters)
        .where(and(ne(escalationsMatters.status, 'CLOSED'), eq(escalationsMatters.createdById, uid)));
      const involvedOpen = await db
        .select({ id: escalationsMatters.id })
        .from(escalationsMatters)
        .leftJoin(escalationsMatterMembers, eq(escalationsMatterMembers.matterId, escalationsMatters.id))
        .where(and(ne(escalationsMatters.status, 'CLOSED'), eq(escalationsMatterMembers.userId, uid)));
      const myOpenSet = new Set([...assigned, ...createdOpen, ...involvedOpen].map((r) => r.id));

      const raisedByMeCount = await db
        .select({ id: escalationsMatters.id })
        .from(escalationsMatters)
        .where(eq(escalationsMatters.createdById, uid));

      const allOpen = await db
        .select({ id: escalationsMatters.id })
        .from(escalationsMatters)
        .where(ne(escalationsMatters.status, 'CLOSED'));

      const closedTotal = await db
        .select({ id: escalationsMatters.id })
        .from(escalationsMatters)
        .where(eq(escalationsMatters.status, 'CLOSED'));

      return NextResponse.json({
        forYouCount: myOpenSet.size,
        raisedByMeCount: raisedByMeCount.length,
        openTotalCount: allOpen.length,
        closedTotalCount: closedTotal.length,
      }, { status: 200 });
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
      let studentMembers = [];
      try {
        studentMembers = await db
          .select({ id: escalationsMatterStudents.id, studentId: escalationsMatterStudents.studentId, name: students.name, className: students.class_name })
          .from(escalationsMatterStudents)
          .leftJoin(students, eq(escalationsMatterStudents.studentId, students.id))
          .where(eq(escalationsMatterStudents.matterId, id));
      } catch (e) {
        // Table may not be migrated yet; fail soft and omit students
        console.warn("[escalations] detail: studentMembers unavailable", e?.message || e);
        studentMembers = [];
      }
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
      return NextResponse.json({ matter: matterRows[0], members, studentMembers, steps }, { status: 200 });
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
    if (body?.action === "remind-members") {
      const matterId = Number(body.matterId);
      const memberIds = Array.isArray(body.memberIds)
        ? Array.from(new Set(body.memberIds.map((x) => Number(x)).filter(Boolean)))
        : [];
      const note = String(body.message || body.note || "Please meet the escalation leads immediately.").trim();
      if (!matterId || memberIds.length === 0) {
        return NextResponse.json({ error: "matterId and memberIds required" }, { status: 400 });
      }

      const [matter] = await db
        .select({ id: escalationsMatters.id, title: escalationsMatters.title, level: escalationsMatters.level })
        .from(escalationsMatters)
        .where(eq(escalationsMatters.id, matterId));
      if (!matter) return NextResponse.json({ error: "Matter not found" }, { status: 404 });

      const recipients = await db
        .select({
          id: users.id,
          name: users.name,
          whatsappNumber: users.whatsapp_number,
          whatsappEnabled: users.whatsapp_enabled,
        })
        .from(users)
        .where(inArray(users.id, memberIds));

      const uniqueRecipients = Array.from(new Map(recipients.map((r) => [r.id, r])).values());
      if (!uniqueRecipients.length) {
        return NextResponse.json({ sent: 0, results: [] }, { status: 200 });
      }

      const matterTitle = matter.title || `Matter #${matterId}`;
      const subject = `Escalation Reminder: ${matterTitle}`;
      const senderName = session.user?.name || "Manager";
      const reminderNote = `Escalation reminder for matter #${matterId}`;
      const timestampIso = new Date().toISOString();
      const messageRows = [];
      const results = [];

      for (const recipient of uniqueRecipients) {
        await db.insert(escalationsSteps).values({
          matterId,
          level: matter.level || 1,
          action: "PROGRESS",
          fromUserId: uid,
          toUserId: recipient.id,
          note,
        });

        let status = "sent";
        let error = null;

        if (!recipient.whatsappEnabled || !recipient.whatsappNumber) {
          status = "failed";
          error = recipient.whatsappEnabled === false ? "whatsapp_disabled" : "missing_whatsapp_number";
        } else {
          try {
            await sendWhatsappMessage(
              recipient.whatsappNumber,
              {
                recipientName: recipient.name || `User #${recipient.id}`,
                senderName,
                subject,
                message: note,
                note: reminderNote,
                contact: senderName,
                dateTime: timestampIso,
              }
            );
          } catch (sendError) {
            status = "failed";
            error = sendError?.message || String(sendError);
            console.error(`Failed to send escalation reminder to user ${recipient.id}:`, error);
          }
        }

        messageRows.push({
          senderId: uid,
          recipientId: recipient.id,
          subject,
          message: note,
          content: note,
          note: reminderNote,
          status,
        });
        results.push({ id: recipient.id, status, ...(error ? { error } : {}) });
      }

      if (messageRows.length) {
        await db.insert(messages).values(messageRows);
      }

      const sentCount = results.filter((r) => r.status === "sent" && !r.error).length;
      return NextResponse.json({ sent: sentCount, results }, { status: 200 });
    }

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
    const involvedStudentIds = Array.isArray(body.involvedStudentIds) ? Array.from(new Set(body.involvedStudentIds.map(Number).filter(Boolean))) : [];

    const [row] = await db
      .insert(escalationsMatters)
      .values({ title, description, createdById: uid, currentAssigneeId: l1AssigneeId, suggestedLevel2Id, status: "OPEN", level: 1 })
      .returning({ id: escalationsMatters.id });
    const matterId = row.id;

    for (const u of involvedUserIds) {
      try { await db.insert(escalationsMatterMembers).values({ matterId, userId: u }); } catch {}
    }
    for (const s of involvedStudentIds) {
      try { await db.insert(escalationsMatterStudents).values({ matterId, studentId: s }); } catch {}
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
      const toRow = await db.select({ role: users.role, name: users.name }).from(users).where(eq(users.id, toUserId));
      if (!toRow.length || !["admin", "team_manager"].includes(toRow[0].role)) {
        return NextResponse.json({ error: "L2 assignee must be an admin or team manager" }, { status: 400 });
      }
      const [m] = await db.select().from(escalationsMatters).where(eq(escalationsMatters.id, id));
      if (!m) return NextResponse.json({ error: "not found" }, { status: 404 });
      if (m.level !== 1) return NextResponse.json({ error: "Can only escalate at level 1" }, { status: 400 });
      if (!(isAdmin || m.currentAssigneeId === uid)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const now = new Date();
      await db
        .update(escalationsMatters)
        .set({ level: 2, status: "ESCALATED", currentAssigneeId: toUserId, updatedAt: now })
        .where(eq(escalationsMatters.id, id));
      await db.insert(escalationsSteps).values({ matterId: id, level: 2, action: "ESCALATE", fromUserId: uid, toUserId, note });

      const targetName = toRow[0]?.name || null;
      if (m.ticketId) {
        await db
          .update(tickets)
          .set({ status: "escalated", escalated: true, updatedAt: now, lastActivityAt: now })
          .where(eq(tickets.id, m.ticketId));
        await db.insert(ticketActivities).values({
          ticketId: m.ticketId,
          authorId: uid,
          type: "status_change",
          message: targetName
            ? `Escalation escalated to level 2 (${targetName})`
            : "Escalation escalated to level 2",
          fromStatus: "escalated",
          toStatus: "escalated",
          metadata: { escalationAction: "ESCALATE", matterId: id, toUserId },
        });
      }

      return NextResponse.json({ updated: 1 }, { status: 200 });
    }

    if (section === "hold") {
      const id = Number(body.id);
      const note = body.note ? String(body.note).trim() : "";
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      const [m] = await db.select().from(escalationsMatters).where(eq(escalationsMatters.id, id));
      if (!m) return NextResponse.json({ error: "not found" }, { status: 404 });
      if (m.status === "CLOSED") return NextResponse.json({ error: "Already closed" }, { status: 400 });
      if (!(isAdmin || m.currentAssigneeId === uid)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const now = new Date();
      const stepNote = note ? `On hold: ${note}` : "On hold";
      await db.update(escalationsMatters).set({ status: "ON_HOLD", updatedAt: now }).where(eq(escalationsMatters.id, id));
      await db.insert(escalationsSteps).values({
        matterId: id,
        level: m.level,
        action: "PROGRESS",
        fromUserId: uid,
        toUserId: m.currentAssigneeId,
        note: stepNote,
      });

      if (m.ticketId) {
        const message = note ? `Escalation on hold: ${note.slice(0, 160)}` : "Escalation on hold";
        await db.insert(ticketActivities).values({
          ticketId: m.ticketId,
          authorId: uid,
          type: "comment",
          message,
          metadata: { escalationAction: "ON_HOLD", level: m.level },
        });
        await db.update(tickets).set({ updatedAt: now, lastActivityAt: now }).where(eq(tickets.id, m.ticketId));
      }

      return NextResponse.json({ updated: 1 }, { status: 200 });
    }

    if (section === "withdraw") {
      const id = Number(body.id);
      const note = body.note ? String(body.note).trim() : "";
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      const [m] = await db.select().from(escalationsMatters).where(eq(escalationsMatters.id, id));
      if (!m) return NextResponse.json({ error: "not found" }, { status: 404 });
      if (m.status === "CLOSED") return NextResponse.json({ error: "Already closed" }, { status: 400 });
      if (!(isAdmin || m.createdById === uid)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const now = new Date();
      const closeNote = note ? `Withdrawn by creator: ${note}` : "Withdrawn by creator";
      await db.update(escalationsMatters).set({ status: "CLOSED", currentAssigneeId: null, updatedAt: now }).where(eq(escalationsMatters.id, id));
      await db.insert(escalationsSteps).values({ matterId: id, level: m.level, action: "CLOSE", fromUserId: uid, toUserId: null, note: closeNote });

      if (m.ticketId) {
        const message = note ? `Escalation withdrawn: ${note.slice(0, 120)}` : "Escalation withdrawn";
        await db
          .update(tickets)
          .set({
            status: "resolved",
            escalated: false,
            updatedAt: now,
            lastActivityAt: now,
            resolvedAt: now,
          })
          .where(eq(tickets.id, m.ticketId));
        await db.insert(ticketActivities).values({
          ticketId: m.ticketId,
          authorId: uid,
          type: "status_change",
          message,
          fromStatus: "escalated",
          toStatus: "resolved",
          metadata: { escalationAction: "WITHDRAW", matterId: id },
        });
      }

      return NextResponse.json({ updated: 1 }, { status: 200 });
    }

    if (section === "close") {
      const id = Number(body.id);
      const note = String(body.note || "").trim();
      if (!id || note.length === 0) return NextResponse.json({ error: "id and note required" }, { status: 400 });
      const [m] = await db.select().from(escalationsMatters).where(eq(escalationsMatters.id, id));
      if (!m) return NextResponse.json({ error: "not found" }, { status: 404 });
      if (!(isAdmin || m.currentAssigneeId === uid)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const now = new Date();
      await db.update(escalationsMatters).set({ status: "CLOSED", currentAssigneeId: null, updatedAt: now }).where(eq(escalationsMatters.id, id));
      await db.insert(escalationsSteps).values({ matterId: id, level: m.level, action: "CLOSE", fromUserId: uid, toUserId: null, note });

      if (m.ticketId) {
        const message = note ? `Escalation closed: ${note.slice(0, 120)}` : "Escalation closed";
        await db
          .update(tickets)
          .set({
            status: "resolved",
            escalated: false,
            updatedAt: now,
            lastActivityAt: now,
            resolvedAt: now,
          })
          .where(eq(tickets.id, m.ticketId));
        await db.insert(ticketActivities).values({
          ticketId: m.ticketId,
          authorId: uid,
          type: "status_change",
          message,
          fromStatus: "escalated",
          toStatus: "resolved",
          metadata: { escalationAction: "CLOSE", matterId: id },
        });
      }

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
      const now = new Date();
      await db.insert(escalationsSteps).values({ matterId: id, level: m.level, action: "PROGRESS", fromUserId: uid, toUserId: m.currentAssigneeId, note });
      await db.update(escalationsMatters).set({ updatedAt: now }).where(eq(escalationsMatters.id, id));

      if (m.ticketId) {
        const message = note ? `Escalation update: ${note.slice(0, 160)}` : "Escalation update posted";
        await db.insert(ticketActivities).values({
          ticketId: m.ticketId,
          authorId: uid,
          type: "comment",
          message,
          metadata: { escalationAction: "PROGRESS", level: m.level },
        });
        await db.update(tickets).set({ updatedAt: now, lastActivityAt: now }).where(eq(tickets.id, m.ticketId));
      }

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
