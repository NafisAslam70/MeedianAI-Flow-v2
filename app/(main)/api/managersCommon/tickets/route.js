import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tickets, users } from "@/lib/schema";
import { TICKET_PRIORITY_OPTIONS, TICKET_STATUS_FLOW } from "@/lib/ticketsConfig";
import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq, inArray } from "drizzle-orm";

const MANAGER_QUEUE_ACCESS = {
  accountant: ["finance", "operations"],
  hostel_incharge: ["hostel", "facilities", "operations"],
  coordinator: ["academics", "operations"],
  head_incharge: ["operations", "facilities"],
  chief_counsellor: ["operations"],
  principal: ["facilities", "it", "finance", "academics", "hostel", "operations", "other"],
};

const ALL_QUEUES = ["facilities", "it", "finance", "academics", "hostel", "operations", "other"];

function resolveQueuesForManager(sessionUser) {
  if (!sessionUser) return [];
  if (sessionUser.role === "admin") return ALL_QUEUES;
  if (sessionUser.role !== "team_manager") return [];
  const type = sessionUser.team_manager_type;
  const allowed = MANAGER_QUEUE_ACCESS[type];
  return allowed ? Array.from(new Set(allowed)) : ["operations"];
}

function sanitizeFilter(value, allowed) {
  if (!value) return null;
  const normalized = String(value).toLowerCase();
  return allowed && !allowed.includes(normalized) ? null : normalized;
}

export async function GET(req) {
  const session = await auth();
  if (!session?.user || !["admin", "team_manager"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requesterId = Number(session.user.id);
  if (!requesterId) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  const allowedQueues = resolveQueuesForManager(session.user);
  if (session.user.role === "team_manager" && allowedQueues.length === 0) {
    return NextResponse.json({ error: "No queue access configured" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const view = (searchParams.get("view") || "queue").toLowerCase();
  const queueParam = sanitizeFilter(searchParams.get("queue"), ALL_QUEUES);
  const statusParam = sanitizeFilter(searchParams.get("status"), TICKET_STATUS_FLOW);
  const priorityParam = sanitizeFilter(searchParams.get("priority"), TICKET_PRIORITY_OPTIONS);

  const whereClauses = [];

  if (view === "assigned") {
    whereClauses.push(eq(tickets.assignedToId, requesterId));
  } else if (view === "created") {
    whereClauses.push(eq(tickets.createdById, requesterId));
  }

  if (statusParam) {
    whereClauses.push(eq(tickets.status, statusParam));
  }

  if (priorityParam) {
    whereClauses.push(eq(tickets.priority, priorityParam));
  }

  if (queueParam) {
    whereClauses.push(eq(tickets.queue, queueParam));
  } else if (session.user.role === "team_manager" && allowedQueues.length) {
    whereClauses.push(inArray(tickets.queue, allowedQueues));
  }

  const assigneeAlias = alias(users, "ticket_assignee");
  const creatorAlias = alias(users, "ticket_creator");

  try {
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
        createdAt: tickets.createdAt,
        updatedAt: tickets.updatedAt,
        lastActivityAt: tickets.lastActivityAt,
        slaFirstResponseAt: tickets.slaFirstResponseAt,
        slaResolveBy: tickets.slaResolveBy,
        createdById: tickets.createdById,
        createdByName: creatorAlias.name,
        assignedToId: tickets.assignedToId,
        assignedToName: assigneeAlias.name,
      })
      .from(tickets)
      .innerJoin(creatorAlias, eq(creatorAlias.id, tickets.createdById))
      .leftJoin(assigneeAlias, eq(assigneeAlias.id, tickets.assignedToId))
      .where(whereClauses.length ? and(...whereClauses) : undefined)
      .orderBy(desc(tickets.lastActivityAt));

    const queueSummary = rows.reduce((acc, row) => {
      acc[row.queue] = acc[row.queue] || { total: 0, open: 0, escalated: 0 };
      acc[row.queue].total += 1;
      if (row.status !== "closed" && row.status !== "resolved") {
        acc[row.queue].open += 1;
      }
      if (row.escalated) {
        acc[row.queue].escalated += 1;
      }
      return acc;
    }, {});

    const statusSummary = rows.reduce((acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      tickets: rows,
      queues: session.user.role === "admin" ? ALL_QUEUES : allowedQueues,
      statusFlow: TICKET_STATUS_FLOW,
      priorities: TICKET_PRIORITY_OPTIONS,
      queueSummary,
      statusSummary,
    });
  } catch (error) {
    console.error("[managers/tickets] GET error", error);
    return NextResponse.json({ error: "Failed to load tickets" }, { status: 500 });
  }
}
