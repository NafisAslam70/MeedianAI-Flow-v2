import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  tickets,
  ticketActivities,
  users,
} from "@/lib/schema";
import {
  TICKET_PRIORITY_OPTIONS,
  TICKET_CATEGORY_TREE,
  findCategoryByKey,
  findSubcategory,
  computeTicketSla,
  formatTicketNumber,
} from "@/lib/ticketsConfig";
import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq } from "drizzle-orm";

const PRIORITY_SET = new Set(TICKET_PRIORITY_OPTIONS);

function sanitizeText(value, { maxLength = 500, allowEmpty = false } = {}) {
  if (value === undefined || value === null) {
    return allowEmpty ? "" : null;
  }
  const text = String(value).trim();
  if (!text && !allowEmpty) {
    return null;
  }
  return text.slice(0, maxLength);
}

function normalizeAttachments(input) {
  if (!Array.isArray(input)) return [];
  const safe = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const name = sanitizeText(item.name ?? item.filename ?? "", {
      maxLength: 120,
      allowEmpty: true,
    });
    const url = sanitizeText(item.url ?? item.link ?? "", {
      maxLength: 500,
      allowEmpty: true,
    });
    if (url) {
      safe.push({
        name: name || null,
        url,
      });
    }
  }
  return safe.slice(0, 5);
}

function buildCreationActivity({ priority, queue, categoryLabel, subcategoryLabel }) {
  const summary = [categoryLabel, subcategoryLabel].filter(Boolean).join(" • " );
  return {
    type: "system",
    message: summary ? `Ticket raised (${summary})` : "Ticket raised",
    metadata: {
      priority,
      queue,
    },
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requesterId = Number(session.user.id);
  if (!requesterId) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  try {
    const assigneeAlias = alias(users, "ticket_assignees");
    const rows = await db
      .select({
        id: tickets.id,
        ticketNumber: tickets.ticketNumber,
        title: tickets.title,
        status: tickets.status,
        priority: tickets.priority,
        queue: tickets.queue,
        category: tickets.category,
        subcategory: tickets.subcategory,
        escalated: tickets.escalated,
        slaFirstResponseAt: tickets.slaFirstResponseAt,
        slaResolveBy: tickets.slaResolveBy,
        createdAt: tickets.createdAt,
        updatedAt: tickets.updatedAt,
        lastActivityAt: tickets.lastActivityAt,
        assignedToId: tickets.assignedToId,
        assignedToName: assigneeAlias.name,
      })
      .from(tickets)
      .leftJoin(assigneeAlias, eq(assigneeAlias.id, tickets.assignedToId))
      .where(eq(tickets.createdById, requesterId))
      .orderBy(desc(tickets.createdAt));

    const counts = rows.reduce(
      (acc, row) => {
        acc.total += 1;
        acc.byStatus[row.status] = (acc.byStatus[row.status] || 0) + 1;
        return acc;
      },
      { total: 0, byStatus: {} }
    );

    return NextResponse.json(
      {
        tickets: rows,
        counts,
        categories: TICKET_CATEGORY_TREE,
        priorities: TICKET_PRIORITY_OPTIONS,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[member/tickets] GET error", error);
    return NextResponse.json({ error: "Failed to load tickets" }, { status: 500 });
  }
}

export async function POST(req) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requesterId = Number(session.user.id);
  if (!requesterId) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  try {
    const payload = await req.json();
    const categoryKey = sanitizeText(payload?.categoryKey, { maxLength: 40, allowEmpty: true });
    const subcategoryKey = sanitizeText(payload?.subcategoryKey, {
      maxLength: 40,
      allowEmpty: true,
    });
    const title = sanitizeText(payload?.title, { maxLength: 180 });
    const description = sanitizeText(payload?.description, { maxLength: 2000 });
    // Members cannot set priority; default to normal. Managers can update later.
    const priority = "normal";

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    if (!description) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }

    if (!PRIORITY_SET.has(priority)) {
      return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
    }

    const category = findCategoryByKey(categoryKey) || findCategoryByKey("other");
    const subcategory = findSubcategory(category, subcategoryKey || "");
    const queue = category?.queue || "operations";
    const attachments = normalizeAttachments(payload?.attachments);

    const now = new Date();

    // Determine immediate supervisor (IS) to auto-assign the ticket
    let assignedToId = null;
    try {
      const [me] = await db
        .select({ is: users.immediate_supervisor })
        .from(users)
        .where(eq(users.id, requesterId))
        .limit(1);
      if (me?.is) assignedToId = Number(me.is) || null;
    } catch (_) {
      assignedToId = null;
    }
    const { firstResponseAt, resolveBy } = computeTicketSla(priority, now);

    const placeholderNumber = `TMP-${Date.now()}-${Math.floor(Math.random() * 1e5).toString(36)}`;

    const [created] = await db
      .insert(tickets)
      .values({
        ticketNumber: placeholderNumber,
        createdById: requesterId,
        queue,
        category: category?.label || "Other",
        subcategory: subcategory?.label || null,
        title,
        description,
        priority,
        status: "open",
        escalated: false,
        slaFirstResponseAt: firstResponseAt,
        slaResolveBy: resolveBy,
        lastActivityAt: now,
        assignedToId, // auto-assign to immediate supervisor if available
        attachments,
        metadata: {
          categoryKey: category?.key || "other",
          subcategoryKey: subcategory?.key || null,
          firstResponseHours: firstResponseAt ? Math.round((firstResponseAt - now) / (1000 * 60 * 60)) : null,
          resolveHours: resolveBy ? Math.round((resolveBy - now) / (1000 * 60 * 60)) : null,
          autoAssignedToIS: Boolean(assignedToId),
        },
        createdAt: now,
        updatedAt: now,
      })
      .returning({
        id: tickets.id,
        createdAt: tickets.createdAt,
      });

    if (!created) {
      return NextResponse.json({ error: "Failed to save ticket" }, { status: 500 });
    }

    const finalNumber = formatTicketNumber(created.id, created.createdAt || now);
    await db
      .update(tickets)
      .set({ ticketNumber: finalNumber })
      .where(eq(tickets.id, created.id));

    const activityPayload = buildCreationActivity({
      priority,
      queue,
      categoryLabel: category?.label,
      subcategoryLabel: subcategory?.label,
    });

    await db.insert(ticketActivities).values({
      ticketId: created.id,
      authorId: requesterId,
      type: activityPayload.type,
      message: activityPayload.message,
      metadata: activityPayload.metadata,
    });

    // Log auto-assignment if we assigned to immediate supervisor
    if (assignedToId) {
      await db.insert(ticketActivities).values({
        ticketId: created.id,
        authorId: requesterId,
        type: "assignment",
        message: "Auto-assigned to your immediate supervisor",
        metadata: { toUserId: assignedToId, reason: "immediate_supervisor" },
      });
    }

    const assigneeAlias = alias(users, "ticket_assignees");
    const creatorAlias = alias(users, "ticket_creators");

    const [row] = await db
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
        createdAt: tickets.createdAt,
        updatedAt: tickets.updatedAt,
        lastActivityAt: tickets.lastActivityAt,
        attachments: tickets.attachments,
        metadata: tickets.metadata,
        assignedToId: tickets.assignedToId,
        assignedToName: assigneeAlias.name,
        createdByName: creatorAlias.name,
      })
      .from(tickets)
      .innerJoin(creatorAlias, eq(creatorAlias.id, tickets.createdById))
      .leftJoin(assigneeAlias, eq(assigneeAlias.id, tickets.assignedToId))
      .where(and(eq(tickets.id, created.id), eq(tickets.createdById, requesterId)))
      .limit(1);

    return NextResponse.json({
      ticket: row,
      message: `Ticket ${finalNumber} created successfully`,
    });
  } catch (error) {
    console.error("[member/tickets] POST error", error);
    return NextResponse.json({ error: error.message || "Failed to raise ticket" }, { status: 500 });
  }
}
