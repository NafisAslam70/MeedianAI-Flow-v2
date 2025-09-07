import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { resources, resourceLogs, users, resourceCategories } from "@/lib/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(_req, { params }) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = Number(params?.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const [resRow] = await db.select().from(resources).where(eq(resources.id, id));
  if (!resRow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const logs = await db
    .select({
      id: resourceLogs.id,
      kind: resourceLogs.kind,
      byUserId: resourceLogs.byUserId,
      toUserId: resourceLogs.toUserId,
      notes: resourceLogs.notes,
      createdAt: resourceLogs.createdAt,
    })
    .from(resourceLogs)
    .where(eq(resourceLogs.resourceId, id));

  return NextResponse.json({ resource: resRow, logs });
}

