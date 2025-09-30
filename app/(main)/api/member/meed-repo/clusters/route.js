import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  meedRepoClusters,
  meedRepoClusterItems,
  meedRepoClusterVisibilityEnum,
} from "@/lib/schema";
import { asc, eq, inArray } from "drizzle-orm";

const VISIBILITY_VALUES = Array.from(meedRepoClusterVisibilityEnum.enumValues || []);

const visibilityAccess = {
  admin: new Set(["admins_only", "managers_only", "admins_and_managers", "everyone"]),
  team_manager: new Set(["managers_only", "admins_and_managers", "everyone"]),
  member: new Set(["everyone"]),
};

const defaultVisibility = "admins_and_managers";

function resolveAllowedVisibilities(role) {
  if (!role || !visibilityAccess[role]) return visibilityAccess.member;
  if (role === "admin") return null; // admin can see all
  return visibilityAccess[role];
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const role = session.user?.role || "member";
    const allowed = resolveAllowedVisibilities(role);

    let query = db
      .select({
        id: meedRepoClusters.id,
        name: meedRepoClusters.name,
        description: meedRepoClusters.description,
        visibility: meedRepoClusters.visibility,
        createdAt: meedRepoClusters.createdAt,
        updatedAt: meedRepoClusters.updatedAt,
      })
      .from(meedRepoClusters)
      .orderBy(asc(meedRepoClusters.createdAt));

    if (allowed) {
      query = query.where(inArray(meedRepoClusters.visibility, Array.from(allowed)));
    }

    const clusters = await query;
    const clusterIds = clusters.map((c) => c.id);

    const items = clusterIds.length
      ? await db
          .select({
            clusterId: meedRepoClusterItems.clusterId,
            postId: meedRepoClusterItems.postId,
          })
          .from(meedRepoClusterItems)
          .where(inArray(meedRepoClusterItems.clusterId, clusterIds))
          .orderBy(
            asc(meedRepoClusterItems.clusterId),
            asc(meedRepoClusterItems.position),
            asc(meedRepoClusterItems.assignedAt)
          )
      : [];

    const grouped = clusterIds.reduce((acc, id) => {
      acc[id] = [];
      return acc;
    }, {});
    for (const item of items) {
      if (!grouped[item.clusterId]) grouped[item.clusterId] = [];
      grouped[item.clusterId].push(item.postId);
    }

    return NextResponse.json({
      clusters: clusters.map((c) => ({
        ...c,
        postIds: grouped[c.id] || [],
      })),
      visibilityOptions: VISIBILITY_VALUES,
    });
  } catch (error) {
    console.error("meed-repo clusters GET error", error);
    return NextResponse.json({ error: "Failed to load clusters" }, { status: 500 });
  }
}

export async function POST(req) {
  const session = await auth();
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const rawName = body?.name;
    const rawVisibility = body?.visibility;
    const rawDescription = body?.description;

    const name = typeof rawName === "string" ? rawName.trim() : "";
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const visibility = VISIBILITY_VALUES.includes(rawVisibility) ? rawVisibility : defaultVisibility;
    const description = typeof rawDescription === "string" && rawDescription.trim().length
      ? rawDescription.trim()
      : null;

    const [created] = await db
      .insert(meedRepoClusters)
      .values({
        name,
        description,
        visibility,
        createdBy: Number(session.user.id),
      })
      .returning({
        id: meedRepoClusters.id,
        name: meedRepoClusters.name,
        description: meedRepoClusters.description,
        visibility: meedRepoClusters.visibility,
        createdAt: meedRepoClusters.createdAt,
        updatedAt: meedRepoClusters.updatedAt,
      });

    return NextResponse.json({ cluster: { ...created, postIds: [] } }, { status: 201 });
  } catch (error) {
    console.error("meed-repo clusters POST error", error);
    return NextResponse.json({ error: "Failed to create cluster" }, { status: 500 });
  }
}

export async function PATCH(req) {
  const session = await auth();
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const action = body?.action;

    if (!action) return NextResponse.json({ error: "Missing action" }, { status: 400 });

    if (action === "update") {
      const clusterId = Number(body?.clusterId);
      if (!clusterId) return NextResponse.json({ error: "Invalid cluster" }, { status: 400 });

      const updates = {};
      if (typeof body?.name === "string") {
        const trimmed = body.name.trim();
        if (!trimmed) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
        updates.name = trimmed;
      }
      if (typeof body?.description === "string") {
        updates.description = body.description.trim().length ? body.description.trim() : null;
      }
      if (body?.visibility) {
        if (!VISIBILITY_VALUES.includes(body.visibility)) {
          return NextResponse.json({ error: "Invalid visibility" }, { status: 400 });
        }
        updates.visibility = body.visibility;
      }

      if (!Object.keys(updates).length) {
        return NextResponse.json({ error: "No updates provided" }, { status: 400 });
      }

      updates.updatedAt = new Date();

      await db.update(meedRepoClusters).set(updates).where(eq(meedRepoClusters.id, clusterId));
      return NextResponse.json({ ok: true });
    }

    if (action === "sync") {
      const clusters = Array.isArray(body?.clusters) ? body.clusters : null;
      if (!clusters) return NextResponse.json({ error: "clusters must be an array" }, { status: 400 });

      const clusterIdSet = new Set();
      const seenPostIds = new Set();

      for (const entry of clusters) {
        const clusterId = Number(entry?.id);
        if (!clusterId) return NextResponse.json({ error: "Invalid cluster id" }, { status: 400 });
        if (clusterIdSet.has(clusterId)) return NextResponse.json({ error: "Duplicate cluster id" }, { status: 400 });
        clusterIdSet.add(clusterId);

        if (Array.isArray(entry?.postIds)) {
          for (const pid of entry.postIds) {
            const postId = Number(pid);
            if (!postId) return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
            if (seenPostIds.has(postId)) return NextResponse.json({ error: "Duplicate post assignment" }, { status: 400 });
            seenPostIds.add(postId);
          }
        }
      }

      const existing = await db.select({ id: meedRepoClusters.id }).from(meedRepoClusters);
      const existingIds = new Set(existing.map((c) => c.id));
      if (existingIds.size !== clusterIdSet.size || Array.from(existingIds).some((id) => !clusterIdSet.has(id))) {
        return NextResponse.json({ error: "Sync payload must include all clusters" }, { status: 400 });
      }

      const normalizedEntries = clusters.map((entry) => ({
        id: Number(entry.id),
        postIds: Array.isArray(entry.postIds)
          ? entry.postIds.map((pid) => Number(pid)).filter((pid) => pid > 0)
          : [],
      }));

      const clusterIdList = normalizedEntries.map((entry) => entry.id);

      if (clusterIdList.length) {
        await db
          .delete(meedRepoClusterItems)
          .where(inArray(meedRepoClusterItems.clusterId, clusterIdList));
      }

      const rowsToInsert = normalizedEntries.flatMap((entry) =>
        entry.postIds.map((postId, index) => ({
          clusterId: entry.id,
          postId,
          position: index,
          assignedBy: Number(session.user.id),
        }))
      );

      if (rowsToInsert.length) {
        await db.insert(meedRepoClusterItems).values(rowsToInsert);
      }

      const now = new Date();
      for (const entry of normalizedEntries) {
        await db
          .update(meedRepoClusters)
          .set({ updatedAt: now })
          .where(eq(meedRepoClusters.id, entry.id));
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("meed-repo clusters PATCH error", error);
    return NextResponse.json({ error: "Failed to update clusters" }, { status: 500 });
  }
}
