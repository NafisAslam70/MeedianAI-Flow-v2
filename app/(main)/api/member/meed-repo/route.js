import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import { createNotifications } from "@/lib/notify";
import { auth } from "@/lib/auth";
import {
  users,
  meedRepoPosts,
  meedRepoAttachments,
  meedRepoStatusEnum,
  assignedTaskStatus,
} from "@/lib/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

/* ============================== GET ============================== */
export async function GET(req) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const url = new URL(req.url);
    const mineOnly = url.searchParams.get("mine") === "1";
    const status = url.searchParams.get("status");
    const userFilter = url.searchParams.get("userId");

    const isManager = ["admin", "team_manager"].includes(session.user?.role || "");

    let where = [];
    if (!isManager || mineOnly) where.push(eq(meedRepoPosts.userId, Number(session.user.id)));
    if (status) where.push(eq(meedRepoPosts.status, status));
    if (isManager && userFilter) where.push(eq(meedRepoPosts.userId, Number(userFilter)));

    const posts = await db
      .select({
        id: meedRepoPosts.id,
        userId: meedRepoPosts.userId,
        taskId: meedRepoPosts.taskId,
        title: meedRepoPosts.title,
        content: meedRepoPosts.content,
        tags: meedRepoPosts.tags,
        status: meedRepoPosts.status,
        verifiedBy: meedRepoPosts.verifiedBy,
        verifiedAt: meedRepoPosts.verifiedAt,
        archivedAt: meedRepoPosts.archivedAt,
        createdAt: meedRepoPosts.createdAt,
        updatedAt: meedRepoPosts.updatedAt,
      })
      .from(meedRepoPosts)
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(meedRepoPosts.createdAt));

    const postIds = posts.map((p) => p.id);
    const atts = postIds.length
      ? await db
          .select({
            id: meedRepoAttachments.id,
            postId: meedRepoAttachments.postId,
            title: meedRepoAttachments.title,
            url: meedRepoAttachments.url,
            mimeType: meedRepoAttachments.mimeType,
          })
          .from(meedRepoAttachments)
          .where(inArray(meedRepoAttachments.postId, postIds))
      : [];

    const grouped = posts.map((p) => ({
      ...p,
      attachments: atts.filter((a) => a.postId === p.id),
    }));

    return NextResponse.json({ posts: grouped }, { status: 200 });
  } catch (e) {
    console.error("meed-repo GET error", e);
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
  }
}

/* ============================== POST ============================== */
export async function POST(req) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const { title, content, tags = [], attachments = [], status = "submitted", taskId } = body || {};
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

    // Validate task link: ensure the user is an assignee if taskId provided
    let validTaskLink = null;
    if (taskId) {
      const rows = await db
        .select({ id: assignedTaskStatus.id })
        .from(assignedTaskStatus)
        .where(and(eq(assignedTaskStatus.taskId, Number(taskId)), eq(assignedTaskStatus.memberId, Number(session.user.id))));
      if (rows.length) validTaskLink = Number(taskId);
      else return NextResponse.json({ error: "Invalid task link" }, { status: 400 });
    }

    const allowedStatuses = new Set(["draft", "submitted", "approved"]);
    const safeStatus = allowedStatuses.has(status) ? status : "submitted";

    const values = {
      userId: Number(session.user.id),
      title: String(title).trim(),
      content: content || null,
      tags: Array.isArray(tags) ? JSON.stringify(tags) : JSON.stringify([]),
      status: safeStatus,
    };
    if (validTaskLink) values.taskId = validTaskLink;
    let post;
    try {
      [post] = await db.insert(meedRepoPosts).values(values).returning();
    } catch (err) {
      // Fallback for environments where the DB hasn’t been migrated to include task_id yet
      // Insert only known-safe columns via raw SQL
      try {
        const rows = await db.execute(sql`
          insert into meed_repo_posts (user_id, title, content, tags, status)
          values (${Number(session.user.id)}, ${String(title).trim()}, ${content || null}::text, ${JSON.stringify(Array.isArray(tags) ? tags : [])}::jsonb, ${safeStatus})
          returning id
        `);
        const insertedId = rows?.rows?.[0]?.id ?? rows?.[0]?.id;
        post = { id: insertedId };
      } catch (e2) {
        console.error("Fallback insert failed", e2);
        throw err; // bubble original error
      }
    }

    if (Array.isArray(attachments) && attachments.length) {
      const rows = attachments
        .filter((a) => a && a.url)
        .map((a) => ({ postId: post.id, title: a.title || null, url: a.url, mimeType: a.mimeType || null }));
      if (rows.length) await db.insert(meedRepoAttachments).values(rows);
    }

    // Notify managers when a post is submitted for verification
    try {
      if (safeStatus === "submitted") {
        const mgrs = await db.query.users.findMany({
          where: (u, { inArray }) => inArray(u.role, ["admin", "team_manager"]),
          columns: { id: true },
        }).catch(async () => {
          // fallback: simple select
          const { users } = await import("@/lib/schema");
          const { inArray } = await import("drizzle-orm");
          return await db.select({ id: users.id }).from(users).where(inArray(users.role, ["admin", "team_manager"]));
        });
        const recipients = (mgrs || []).map((m) => Number(m.id)).filter(Boolean);
        if (recipients.length) {
          await createNotifications({
            recipients,
            type: "repo_submitted",
            title: "Repo post submitted",
            body: `"${String(title).trim()}" submitted for verification`,
            entityKind: "meed_repo_post",
            entityId: post.id,
          });
        }
      }
    } catch {}

    return NextResponse.json({ postId: post.id, message: "Post created" }, { status: 201 });
  } catch (e) {
    console.error("meed-repo POST error", e);
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }
}

/* ============================== PATCH ============================== */
export async function PATCH(req) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isManager = ["admin", "team_manager"].includes(session.user?.role || "");
  try {
    const body = await req.json();
    const { id, action, title, content, tags, attachments, status } = body || {};
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    // Only owners or managers can update; only managers can approve/reject
    const [row] = await db.select().from(meedRepoPosts).where(eq(meedRepoPosts.id, Number(id)));
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const isOwner = Number(row.userId) === Number(session.user.id);
    if (!isOwner && !isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Owner updates (title/content/tags/status:draft|submitted)
    const updates = {};
    if (title !== undefined) updates.title = String(title).trim();
    if (content !== undefined) updates.content = content || null;
    if (tags !== undefined) updates.tags = Array.isArray(tags) ? JSON.stringify(tags) : JSON.stringify([]);
    if (status && ["draft", "submitted"].includes(status) && isOwner) updates.status = status;

    // Manager actions
    if (action === "approve" && isManager) {
      updates.status = "approved";
      updates.verifiedBy = Number(session.user.id);
      updates.verifiedAt = new Date();
      // If linked to a task, verify the member's task status
      if (row.taskId) {
        await db
          .update(assignedTaskStatus)
          .set({ status: "verified", verifiedBy: Number(session.user.id), verifiedAt: new Date() })
          .where(and(eq(assignedTaskStatus.taskId, Number(row.taskId)), eq(assignedTaskStatus.memberId, Number(row.userId))));
      }
    } else if (action === "reject" && isManager) {
      updates.status = "rejected";
      updates.verifiedBy = Number(session.user.id);
      updates.verifiedAt = new Date();
    } else if (action === "archive") {
      updates.status = "archived";
      updates.archivedAt = new Date();
    }

    if (Object.keys(updates).length) {
      await db.update(meedRepoPosts).set(updates).where(eq(meedRepoPosts.id, Number(id)));
    }

    // Replace attachments if provided
    if (Array.isArray(attachments)) {
      await db.delete(meedRepoAttachments).where(eq(meedRepoAttachments.postId, Number(id)));
      const rows = attachments
        .filter((a) => a && a.url)
        .map((a) => ({ postId: Number(id), title: a.title || null, url: a.url, mimeType: a.mimeType || null }));
      if (rows.length) await db.insert(meedRepoAttachments).values(rows);
    }

    return NextResponse.json({ message: "Updated" }, { status: 200 });
  } catch (e) {
    console.error("meed-repo PATCH error", e);
    return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
  }
}
