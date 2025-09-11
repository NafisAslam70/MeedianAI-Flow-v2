import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userMriRoles, mriRoleDefs, mriRoleTasks } from "@/lib/schema";
import { and, eq, inArray } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();
    if (!session || !["member", "team_manager", "admin"].includes(session.user?.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = Number(session.user.id);
    // 1) Fetch active roles for this user
    const rolesRows = await db
      .select({ role: userMriRoles.role })
      .from(userMriRoles)
      .where(and(eq(userMriRoles.userId, userId), eq(userMriRoles.active, true)));
    const roleKeys = rolesRows.map((r) => r.role);
    if (!roleKeys.length) return NextResponse.json({ roles: [] }, { status: 200 });

    // 2) Resolve role definitions by roleKey
    const roleDefs = await db
      .select({ id: mriRoleDefs.id, roleKey: mriRoleDefs.roleKey, name: mriRoleDefs.name, category: mriRoleDefs.category, active: mriRoleDefs.active })
      .from(mriRoleDefs)
      .where(inArray(mriRoleDefs.roleKey, roleKeys));
    const defByKey = new Map(roleDefs.map((d) => [d.roleKey, d]));

    const defIds = roleDefs.filter((d) => d.active !== false).map((d) => d.id);
    if (!defIds.length) return NextResponse.json({ roles: [] }, { status: 200 });

    // 3) Fetch active tasks for these role defs
    const tasks = await db
      .select({
        id: mriRoleTasks.id,
        roleDefId: mriRoleTasks.roleDefId,
        title: mriRoleTasks.title,
        description: mriRoleTasks.description,
        submissables: mriRoleTasks.submissables,
        action: mriRoleTasks.action,
        active: mriRoleTasks.active,
        updatedAt: mriRoleTasks.updatedAt,
      })
      .from(mriRoleTasks)
      .where(inArray(mriRoleTasks.roleDefId, defIds));

    // 4) Group by roleKey and parse submissables JSON if possible
    const byRoleKey = {};
    for (const rk of roleKeys) {
      const def = defByKey.get(rk);
      if (!def || def.active === false) continue;
      byRoleKey[rk] = { roleKey: rk, roleName: def.name, tasks: [] };
    }
    for (const t of tasks) {
      const entry = Object.values(byRoleKey).find((r) => r && defByKey.get(r.roleKey)?.id === t.roleDefId);
      if (!entry) continue;
      let subs = null;
      try { subs = t.submissables ? JSON.parse(t.submissables) : null; } catch { subs = t.submissables; }
      entry.tasks.push({ ...t, submissables: subs });
    }

    // Filter out roles with no tasks (optional)
    const rolesOut = Object.values(byRoleKey).filter((r) => r.tasks.length > 0);
    return NextResponse.json({ roles: rolesOut }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

