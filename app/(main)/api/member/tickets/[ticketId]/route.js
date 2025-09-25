import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tickets, ticketActivities, users, messages } from "@/lib/schema";
import { alias } from "drizzle-orm/pg-core";
import { asc, eq } from "drizzle-orm";
import { sendWhatsappMessage } from "@/lib/whatsapp";
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

    // Notify assignee (if not the commenter) that member added a comment
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
        // In-app
        await createNotifications({
          recipients: [assigneeId],
          type: "task_update",
          title: subject,
          body,
          entityKind: "ticket",
          entityId: ticketId,
          meta: { ticketNumber: full.ticketNumber || String(ticketId), action: "comment" },
        });
        // WhatsApp
        try {
          const [assignee] = await db
            .select({ id: users.id, name: users.name, whatsappNumber: users.whatsapp_number, whatsappEnabled: users.whatsapp_enabled })
            .from(users)
            .where(eq(users.id, assigneeId))
            .limit(1);
          if (assignee?.whatsappEnabled && assignee?.whatsappNumber) {
            await sendWhatsappMessage(assignee.whatsappNumber, {
              recipientName: assignee.name || `User #${assignee.id}`,
              senderName: "Ticket Desk",
              subject,
              message: body,
              dateTime: new Date().toISOString(),
            });
          }
        } catch (_) {}
        // Message audit
        await db.insert(messages).values({
          senderId: requesterId,
          recipientId: assigneeId,
          subject,
          message: body,
          content: body,
          status: "sent",
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
