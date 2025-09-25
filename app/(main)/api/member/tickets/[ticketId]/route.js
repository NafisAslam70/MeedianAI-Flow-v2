import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tickets, ticketActivities, users } from "@/lib/schema";
import { alias } from "drizzle-orm/pg-core";
import { asc, eq } from "drizzle-orm";
import { createNotifications } from "@/lib/notify";

const MEMBER_ACCESS_ROLES = new Set(["admin", "team_manager"]);

export async function GET(_req, { params }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requesterId = Number(session.user.id);
  if (!requesterId) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  const ticketId = Number(params?.ticketId);
  if (!ticketId) {
    return NextResponse.json({ error: "Invalid ticket id" }, { status: 400 });
  }

  try {
    const creatorAlias = alias(users, "ticket_creator");
    const assigneeAlias = alias(users, "ticket_assignee");

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
        slaFirstResponseAt: tickets.slaFirstResponseAt,
        slaResolveBy: tickets.slaResolveBy,
        firstResponseAt: tickets.firstResponseAt,
        resolvedAt: tickets.resolvedAt,
        closedAt: tickets.closedAt,
        reopenedAt: tickets.reopenedAt,
        createdAt: tickets.createdAt,
        updatedAt: tickets.updatedAt,
        lastActivityAt: tickets.lastActivityAt,
        attachments: tickets.attachments,
        metadata: tickets.metadata,
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

    const isOwner = ticketRow.createdById === requesterId;
    const isAssigned = ticketRow.assignedToId === requesterId;
    const isPrivileged = MEMBER_ACCESS_ROLES.has(session.user.role);
    if (!isOwner && !isAssigned && !isPrivileged) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    // Owner commenting can be temporarily allowed by managers
    let ownerCanComment = false;
    try {
      const meta = ticketRow.metadata || {};
      if (meta.memberCommentAllowed) {
        if (!meta.memberCommentAllowUntil) ownerCanComment = true;
        else ownerCanComment = new Date(meta.memberCommentAllowUntil) > new Date();
      }
    } catch {}

    return NextResponse.json({
      ticket: ticketRow,
      activities,
      canComment: isPrivileged || isAssigned || (isOwner && ownerCanComment),
    });
  } catch (error) {
    console.error("[member/tickets/:id] GET error", error);
    return NextResponse.json({ error: "Failed to load ticket" }, { status: 500 });
  }
}

function sanitizeComment(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, 1000);
}

export async function POST(req, { params }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requesterId = Number(session.user.id);
  if (!requesterId) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  const ticketId = Number(params?.ticketId);
  if (!ticketId) {
    return NextResponse.json({ error: "Invalid ticket id" }, { status: 400 });
  }

  try {
    const [ticketRow] = await db
      .select({ createdById: tickets.createdById, assignedToId: tickets.assignedToId, status: tickets.status, metadata: tickets.metadata })
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticketRow) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const isOwner = ticketRow.createdById === requesterId;
    const isAssigned = ticketRow.assignedToId === requesterId;
    const isPrivileged = MEMBER_ACCESS_ROLES.has(session.user.role);
    let ownerCanComment = false;
    try {
      const meta = ticketRow.metadata || {};
      if (meta.memberCommentAllowed) {
        if (!meta.memberCommentAllowUntil) ownerCanComment = true;
        else ownerCanComment = new Date(meta.memberCommentAllowUntil) > new Date();
      }
    } catch {}
    if (!(isPrivileged || isAssigned || (isOwner && ownerCanComment))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const payload = await req.json();
    const comment = sanitizeComment(payload?.comment);
    if (!comment) {
      return NextResponse.json({ error: "Comment is required" }, { status: 400 });
    }

    const now = new Date();

    if ((row.status || '').toLowerCase() === 'closed') {
      return NextResponse.json({ error: 'Ticket is closed; no further updates allowed' }, { status: 400 });
    }

    await db.insert(ticketActivities).values({
      ticketId,
      authorId: requesterId,
      type: "comment",
      message: comment,
    });

    await db
      .update(tickets)
      .set({ lastActivityAt: now, updatedAt: now })
      .where(eq(tickets.id, ticketId));

    // Notify assignee (if not the commenter) that member added a comment (in-app only)
    try {
      const [full] = await db
        .select({ assignedToId: tickets.assignedToId, title: tickets.title, ticketNumber: tickets.ticketNumber })
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .limit(1);
      const assigneeId = full?.assignedToId;
      if (assigneeId && assigneeId !== requesterId) {
        const subject = `Update on Ticket ${full.ticketNumber || ticketId}`;
        const body = comment;
        // In-app only
        await createNotifications({
          recipients: [assigneeId],
          type: "task_update",
          title: subject,
          body,
          entityKind: "ticket",
          entityId: ticketId,
          meta: { ticketNumber: full.ticketNumber || String(ticketId), action: "comment" },
        });
      }
    } catch (e) {
      console.error("[member/tickets/:id] comment notify error", e);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[member/tickets/:id] POST error", error);
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requesterId = Number(session.user.id);
  if (!requesterId) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  const ticketId = Number(params?.ticketId);
  if (!ticketId) {
    return NextResponse.json({ error: "Invalid ticket id" }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").toLowerCase();
    if (!action) return NextResponse.json({ error: "Action is required" }, { status: 400 });

    const [row] = await db
      .select({ assignedToId: tickets.assignedToId, status: tickets.status, title: tickets.title, ticketNumber: tickets.ticketNumber })
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);
    if (!row) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

    const isAssigned = row.assignedToId === requesterId;
    if (!isAssigned) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const now = new Date();

    if (action === "status") {
      const status = String(body?.status || "").toLowerCase();
      if (status !== "in_progress") {
        return NextResponse.json({ error: "Only in_progress allowed for assignees" }, { status: 400 });
      }

      await db.update(tickets).set({ status, updatedAt: now, lastActivityAt: now }).where(eq(tickets.id, ticketId));
      await db.insert(ticketActivities).values({
        ticketId,
        authorId: requesterId,
        type: "status_change",
        message: `Status changed to ${status.toUpperCase()}`,
        fromStatus: row.status,
        toStatus: status,
      });

      return NextResponse.json({ ok: true });
    }

    if (action === "request_resolution") {
      // Mark that the assignee is requesting resolution; do not change status
      const meta = { resolutionRequested: true, resolutionRequestedAt: now.toISOString(), requestedBy: requesterId };
      // Merge metadata with existing
      const [current] = await db.select({ metadata: tickets.metadata }).from(tickets).where(eq(tickets.id, ticketId)).limit(1);
      const merged = { ...(current?.metadata || {}), ...meta };
      await db.update(tickets).set({ metadata: merged, updatedAt: now, lastActivityAt: now }).where(eq(tickets.id, ticketId));
      await db.insert(ticketActivities).values({
        ticketId,
        authorId: requesterId,
        type: "status_change",
        message: `Assignee requested resolution`,
        toStatus: "resolved",
      });

      // Notify the assignee's immediate supervisor (manager) to approve
      try {
        const [assignee] = await db
          .select({ is: users.immediate_supervisor, name: users.name })
          .from(users)
          .where(eq(users.id, requesterId))
          .limit(1);
        const supervisorId = assignee?.is ? Number(assignee.is) : null;
        if (supervisorId) {
          await createNotifications({
            recipients: [supervisorId],
            type: "task_update",
            title: `Resolution requested: ${row.ticketNumber || ticketId}`,
            body: `"${row.title}" – assignee requested resolution. Please review and resolve if appropriate.`,
            entityKind: "ticket",
            entityId: ticketId,
            meta: { ticketNumber: row.ticketNumber || String(ticketId), action: "resolution_requested", requestedBy: requesterId },
          });
        }
      } catch {}

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.error("[member/tickets/:id] PATCH error", error);
    return NextResponse.json({ error: "Failed to update ticket" }, { status: 500 });
  }
}
