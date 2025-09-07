import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { resourceLogs, resources } from "@/lib/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(req, { params }) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = Number(params?.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const { kind, toUserId = null, notes = "", status, building, room } = body || {};
  if (!kind) return NextResponse.json({ error: "kind required" }, { status: 400 });

  const [log] = await db
    .insert(resourceLogs)
    .values({ resourceId: id, kind, byUserId: Number(session.user.id), toUserId, notes })
    .returning();

  // optional: reflect status/location/assignment changes
  const patch = {};
  if (status) patch.status = status;
  if (typeof building === "string") patch.building = building;
  if (typeof room === "string") patch.room = room;
  if (kind === "assign" || kind === "check_out") patch.assignedTo = toUserId || null;
  if (kind === "check_in") patch.assignedTo = null;
  if (Object.keys(patch).length) await db.update(resources).set(patch).where(eq(resources.id, id));

  return NextResponse.json({ log }, { status: 201 });
}

