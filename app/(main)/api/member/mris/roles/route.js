import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userMriRoles, users } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ roles: [] }, { status: 200 });

    let roles = [];
    try {
      const rows = await db
        .select()
        .from(userMriRoles)
        .where(eq(userMriRoles.userId, Number(session.user.id)));
      roles = rows.map((r) => r.role);
    } catch (_) {
      // table may not exist yet
    }

    if (!roles.length) {
      try {
        const row =
          (
            await db
              .select({ mrisRoles: users.mrisRoles })
              .from(users)
              .where(eq(users.id, Number(session.user.id)))
              .limit(1)
          )[0] || null;
        if (row?.mrisRoles) roles = Array.isArray(row.mrisRoles) ? row.mrisRoles : [];
      } catch (_) {}
    }

    if (!roles.length && Array.isArray(session.user.mris_roles)) roles = session.user.mris_roles;

    return NextResponse.json({ roles });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
