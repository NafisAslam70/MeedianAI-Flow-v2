import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  tickets,
  ticketActivities,
  users,
  escalationsMatters,
  escalationsMatterMembers,
  escalationsSteps,
} from "@/lib/schema";
import { TICKET_PRIORITY_OPTIONS, TICKET_STATUS_FLOW, formatTicketNumber } from "@/lib/ticketsConfig";
import { sendWhatsappMessage } from "@/lib/whatsapp";
import { messages } from "@/lib/schema";
import { createNotifications } from "@/lib/notify";
import { alias } from "drizzle-orm/pg-core";
import { asc, eq } from "drizzle-orm";

const MANAGER_ROLES = new Set(["admin", "team_manager"]);
const PRIORITY_SET = new Set(TICKET_PRIORITY_OPTIONS);
const STATUS_SET = new Set(TICKET_STATUS_FLOW);

function sanitizeNote(value, max = 2000) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, max);
}

function sanitizeComment(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, 2000);
}

export async function GET(_req, { params }) {
  const session = await auth();
  if (!session?.user || !MANAGER_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ticketId = Number(params?.ticketId);
  if (!ticketId) {
    return NextResponse.json({ error: "Invalid ticket id" }, { status: 400 });
  }

  const creatorAlias = alias(users, "ticket_creator");
  const assigneeAlias = alias(users, "ticket_assignee");

  try {
    const [ticketRow] = await db
      .select({
        id: tickets.id,
        ticketNumber: tickets.ticketNumber,
        title: tickets.title,
        description: tickets.description,
        status: tickets.status,
        priority: tickets.priority,
        queue: tickets.queue,
        category: tickets.category,
        subcategory: tickets.subcategory,
        escalated: tickets.escalated,
        metadata: tickets.metadata,
        attachments: tickets.attachments,
        createdAt: tickets.createdAt,
        updatedAt: tickets.updatedAt,
        lastActivityAt: tickets.lastActivityAt,
        slaFirstResponseAt: tickets.slaFirstResponseAt,
        slaResolveBy: tickets.slaResolveBy,
        firstResponseAt: tickets.firstResponseAt,
        resolvedAt: tickets.resolvedAt,
        closedAt: tickets.closedAt,
        reopenedAt: tickets.reopenedAt,
        createdById: tickets.createdById,
        createdByName: creatorAlias.name,
        assignedToId: tickets.assignedToId,
        assignedToName: assigneeAlias.name,
      })
      .from(tickets)
      .innerJoin(creatorAlias, eq(creatorAlias.id, tickets.createdById))
      .leftJoin(assigneeAlias, eq(assigneeAlias.id, tickets.assignedToId))
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticketRow) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const activityAuthor = alias(users, "ticket_activity_author");
    const activities = await db
      .select({
        id: ticketActivities.id,
        type: ticketActivities.type,
        message: ticketActivities.message,
        metadata: ticketActivities.metadata,
        fromStatus: ticketActivities.fromStatus,
        toStatus: ticketActivities.toStatus,
        createdAt: ticketActivities.createdAt,
        authorId: ticketActivities.authorId,
        authorName: activityAuthor.name,
      })
      .from(ticketActivities)
      .leftJoin(activityAuthor, eq(activityAuthor.id, ticketActivities.authorId))
      .where(eq(ticketActivities.ticketId, ticketId))
      .orderBy(asc(ticketActivities.createdAt));

    return NextResponse.json({ ticket: ticketRow, activities, statusFlow: TICKET_STATUS_FLOW });
  } catch (error) {
    console.error("[managers/tickets/:id] GET error", error);
    return NextResponse.json({ error: "Failed to load ticket" }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  const session = await auth();
  if (!session?.user || !MANAGER_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const managerId = Number(session.user.id);
  if (!managerId) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  const ticketId = Number(params?.ticketId);
  if (!ticketId) {
    return NextResponse.json({ error: "Invalid ticket id" }, { status: 400 });
  }

  const payload = await req.json().catch(() => ({}));
  const action = String(payload?.action || "").toLowerCase();
  if (!action) {
    return NextResponse.json({ error: "Action is required" }, { status: 400 });
  }

  try {
    const [ticketRow] = await db
      .select({
        id: tickets.id,
        status: tickets.status,
        priority: tickets.priority,
        assignedToId: tickets.assignedToId,
        createdById: tickets.createdById,
        ticketNumber: tickets.ticketNumber,
        escalated: tickets.escalated,
        title: tickets.title,
        description: tickets.description,
        firstResponseAt: tickets.firstResponseAt,
        resolvedAt: tickets.resolvedAt,
        closedAt: tickets.closedAt,
        reopenedAt: tickets.reopenedAt,
      })
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticketRow) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const now = new Date();

    async function notifyRaiser(subject, body, meta = {}) {
      try {
        const [raiser] = await db
          .select({
            id: users.id,
            name: users.name,
            whatsappNumber: users.whatsapp_number,
            whatsappEnabled: users.whatsapp_enabled,
          })
          .from(users)
          .where(eq(users.id, ticketRow.createdById))
          .limit(1);

        if (!raiser) return;
        // Do not notify self (the actor) to avoid self-notifications
        if (raiser.id === managerId) return;

        const timestampIso = new Date().toISOString();
        let status = "sent";
        let error = null;

        if (!raiser.whatsappEnabled || !raiser.whatsappNumber) {
          status = "failed";
          error = raiser.whatsappEnabled === false ? "whatsapp_disabled" : "missing_whatsapp_number";
        } else {
          try {
            await sendWhatsappMessage(raiser.whatsappNumber, {
              recipientName: raiser.name || `User #${raiser.id}`,
              senderName: `Ticket Desk`,
              subject,
              message: body,
              note: meta?.note || "",
              contact: meta?.contact || "",
              dateTime: timestampIso,
            });
          } catch (err) {
            status = "failed";
            error = err?.message || String(err);
          }
        }

        await db.insert(messages).values({
          senderId: managerId,
          recipientId: raiser.id,
          subject,
          message: body,
          content: body,
          note: meta?.note || null,
          status,
        });

        // Also create an in-app notification (reuse task_update type)
        await createNotifications({
          recipients: [raiser.id],
          type: "task_update",
          title: subject,
          body,
          entityKind: "ticket",
          entityId: ticketId,
          meta: {
            ticketNumber: ticketRow.ticketNumber || String(ticketRow.id),
            action: meta?.action || null,
            authorId: managerId,
          },
        });
      } catch (e) {
        console.error("[tickets notifyRaiser] error", e);
      }
    }

    if (action === "assign") {
      const assigneeId = Number(payload?.assigneeId);
      if (!assigneeId) {
        return NextResponse.json({ error: "assigneeId is required" }, { status: 400 });
      }

      const [assignee] = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.id, assigneeId))
        .limit(1);

      if (!assignee) {
        return NextResponse.json({ error: "Assignee not found" }, { status: 404 });
      }

      await db
        .update(tickets)
        .set({ assignedToId: assigneeId, updatedAt: now, lastActivityAt: now })
        .where(eq(tickets.id, ticketId));

      await db.insert(ticketActivities).values({
        ticketId,
        authorId: managerId,
        type: "assignment",
        message: `Assigned to ${assignee.name}`,
        metadata: { toUserId: assigneeId, previousAssigneeId: ticketRow.assignedToId },
      });

      await notifyRaiser(
        `Ticket ${ticketRow.ticketNumber || ticketRow.id} assigned`,
        `Your ticket "${ticketRow.title}" is now assigned to ${assignee.name}.`
      );

      // Notify new assignee as well
      try {
        const subjectA = `Ticket ${ticketRow.ticketNumber || ticketRow.id} assigned to you`;
        const bodyA = `"${ticketRow.title}" is now assigned to you.`;
        const [u] = await db
          .select({ id: users.id, name: users.name, whatsappNumber: users.whatsapp_number, whatsappEnabled: users.whatsapp_enabled })
          .from(users)
          .where(eq(users.id, assigneeId))
          .limit(1);
        if (u && u.id !== managerId) {
          await createNotifications({ recipients: [u.id], type: "task_update", title: subjectA, body: bodyA, entityKind: "ticket", entityId: ticketId, meta: { ticketNumber: ticketRow.ticketNumber || String(ticketId), action: "assigned" } });
          try {
            if (u.whatsappEnabled && u.whatsappNumber) {
              await sendWhatsappMessage(u.whatsappNumber, { recipientName: u.name || `User #${u.id}`, senderName: "Ticket Desk", subject: subjectA, message: bodyA, dateTime: new Date().toISOString() });
            }
          } catch (_) {}
          await db.insert(messages).values({ senderId: managerId, recipientId: u.id, subject: subjectA, message: bodyA, content: bodyA, status: "sent" });
        }
      } catch (_) {}

      return NextResponse.json({ ok: true });
    }

    if (action === "priority") {
      const priority = String(payload?.priority || "").toLowerCase();
      if (!PRIORITY_SET.has(priority)) {
        return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
      }

      if (priority === ticketRow.priority) {
        return NextResponse.json({ ok: true, unchanged: true });
      }

      await db
        .update(tickets)
        .set({ priority, updatedAt: now, lastActivityAt: now })
        .where(eq(tickets.id, ticketId));

      await db.insert(ticketActivities).values({
        ticketId,
        authorId: managerId,
        type: "priority_change",
        message: `Priority updated to ${priority.toUpperCase()}`,
        metadata: { fromPriority: ticketRow.priority, toPriority: priority },
      });

      await notifyRaiser(
        `Ticket ${ticketRow.ticketNumber || ticketRow.id} priority updated`,
        `Priority changed to ${priority.toUpperCase()} for "${ticketRow.title}".`
      );

      return NextResponse.json({ ok: true });
    }

    if (action === "status") {
      const status = String(payload?.status || "").toLowerCase();
      if (!STATUS_SET.has(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }

      if (status === ticketRow.status) {
        return NextResponse.json({ ok: true, unchanged: true });
      }

      const updates = { status, updatedAt: now, lastActivityAt: now };

      if (!ticketRow.ticketNumber) {
        updates.ticketNumber = formatTicketNumber(ticketRow.id, now);
      }

      if (!ticketRow.firstResponseAt && status !== "open") {
        updates.firstResponseAt = now;
      }
      if (status === "resolved") {
        updates.resolvedAt = now;
        updates.escalated = false;
      }
      if (status === "closed") {
        updates.closedAt = now;
        updates.escalated = false;
      }
      if (ticketRow.status === "closed" && status !== "closed") {
        updates.reopenedAt = now;
      }
      if (status !== "escalated") {
        updates.escalated = false;
      }
      if (status === "escalated") {
        updates.escalated = true;
      }

      await db.update(tickets).set(updates).where(eq(tickets.id, ticketId));

      await db.insert(ticketActivities).values({
        ticketId,
        authorId: managerId,
        type: "status_change",
        message: `Status changed to ${status.replace(/_/g, " ").toUpperCase()}`,
        fromStatus: ticketRow.status,
        toStatus: status,
      });

      await notifyRaiser(
        `Ticket ${ticketRow.ticketNumber || ticketRow.id} status updated`,
        `Status changed to ${status.replace(/_/g, " ").toUpperCase()} for "${ticketRow.title}".`
      );

      return NextResponse.json({ ok: true });
    }

  if (action === "comment") {
      const comment = sanitizeComment(payload?.comment);
      if (!comment) {
        return NextResponse.json({ error: "Comment is required" }, { status: 400 });
      }

      await db.insert(ticketActivities).values({
        ticketId,
        authorId: managerId,
        type: "comment",
        message: comment,
      });

      await db
        .update(tickets)
        .set({ updatedAt: now, lastActivityAt: now })
        .where(eq(tickets.id, ticketId));

      await notifyRaiser(
        `Update on Ticket ${ticketRow.ticketNumber || ticketRow.id}`,
        comment
      );

      return NextResponse.json({ ok: true });
    }

  if (action === "allow_member_comment") {
    const hours = Number(payload?.hours) || 48;
    const until = new Date(Date.now() + Math.max(1, hours) * 60 * 60 * 1000);

    // Merge metadata
    let meta = {};
    try { meta = ticketRow.metadata || {}; } catch {}
    meta.memberCommentAllowed = true;
    meta.memberCommentAllowUntil = until.toISOString();

    await db
      .update(tickets)
      .set({ metadata: meta, updatedAt: now, lastActivityAt: now })
      .where(eq(tickets.id, ticketId));

    await db.insert(ticketActivities).values({
      ticketId,
      authorId: managerId,
      type: "system",
      message: `Member reply requested (allowed for ${Math.max(1, hours)}h)`,
      metadata: { memberCommentAllowed: true, until: meta.memberCommentAllowUntil },
    });

    await notifyRaiser(
      `Ticket ${ticketRow.ticketNumber || ticketRow.id} – more info requested`,
      `Please reply with details. Your reply window is open until ${until.toLocaleString()}.`
    );

    return NextResponse.json({ ok: true, until: meta.memberCommentAllowUntil });
  }

  if (action === "revoke_member_comment") {
    // Merge metadata
    let meta = {};
    try { meta = ticketRow.metadata || {}; } catch {}
    meta.memberCommentAllowed = false;
    delete meta.memberCommentAllowUntil;

    await db
      .update(tickets)
      .set({ metadata: meta, updatedAt: now, lastActivityAt: now })
      .where(eq(tickets.id, ticketId));

    await db.insert(ticketActivities).values({
      ticketId,
      authorId: managerId,
      type: "system",
      message: "Member reply window closed",
      metadata: { memberCommentAllowed: false },
    });

    await notifyRaiser(
      `Ticket ${ticketRow.ticketNumber || ticketRow.id} – reply window closed`,
      `Thanks for the information. The member reply window has been closed.`
    );

    return NextResponse.json({ ok: true });
  }

    if (action === "escalate") {
      if (ticketRow.escalated) {
        return NextResponse.json({ error: "Ticket already escalated" }, { status: 409 });
      }

      const toUserId = Number(payload?.assigneeId || payload?.toUserId);
      if (!toUserId) {
        return NextResponse.json({ error: "Escalation target required" }, { status: 400 });
      }

      const [target] = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.id, toUserId))
        .limit(1);

      if (!target) {
        return NextResponse.json({ error: "Escalation target not found" }, { status: 404 });
      }

      const note = sanitizeNote(payload?.note, 2000);

      const [matter] = await db
        .insert(escalationsMatters)
        .values({
          title: `[${ticketRow.ticketNumber || formatTicketNumber(ticketRow.id)}] ${ticketRow.title}`.slice(0, 200),
          description: note || ticketRow.description || null,
          createdById: managerId,
          currentAssigneeId: toUserId,
          ticketId,
          status: "ESCALATED",
          level: 1,
        })
        .returning({ id: escalationsMatters.id });

      await db.insert(escalationsSteps).values({
        matterId: matter.id,
        level: 1,
        action: "CREATED",
        fromUserId: managerId,
        toUserId,
        note,
      });

      const memberValues = [];
      if (ticketRow.createdById) {
        memberValues.push({ matterId: matter.id, userId: ticketRow.createdById });
      }
      if (managerId !== ticketRow.createdById) {
        memberValues.push({ matterId: matter.id, userId: managerId });
      }
      if (memberValues.length) {
        await db
          .insert(escalationsMatterMembers)
          .values(memberValues)
          .onConflictDoNothing({
            target: [escalationsMatterMembers.matterId, escalationsMatterMembers.userId],
          });
      }

      await db.update(tickets).set({
        status: "escalated",
        escalated: true,
        updatedAt: now,
        lastActivityAt: now,
      }).where(eq(tickets.id, ticketId));

      await db.insert(ticketActivities).values({
        ticketId,
        authorId: managerId,
        type: "status_change",
        message: `Escalated to ${target.name}`,
        fromStatus: ticketRow.status,
        toStatus: "escalated",
        metadata: { escalationId: matter.id, toUserId },
      });

      await notifyRaiser(
        `Ticket ${ticketRow.ticketNumber || ticketRow.id} escalated`,
        `Your ticket has been escalated to ${target.name}.`
      );

      return NextResponse.json({ ok: true, escalationId: matter.id });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.error("[managers/tickets/:id] PATCH error", error);
    return NextResponse.json({ error: "Failed to update ticket" }, { status: 500 });
  }
}
