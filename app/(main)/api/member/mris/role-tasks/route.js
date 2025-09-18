import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, userMriRoles, mriRoleDefs, mriRoleTasks, mriPrograms } from "@/lib/schema";
import { eq, and, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const session = await auth();
  if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    // Get active MRI roles for this user
    const roles = await db
      .select({ role: userMriRoles.role })
      .from(userMriRoles)
      .where(and(eq(userMriRoles.userId, Number(session.user.id)), eq(userMriRoles.active, true)));

    const roleKeys = Array.from(new Set((roles || []).map((r) => String(r.role))));
    if (!roleKeys.length) return NextResponse.json({ roles: [] }, { status: 200 });

    // Map to role definitions
    const roleDefs = await db
      .select({ id: mriRoleDefs.id, roleKey: mriRoleDefs.roleKey, name: mriRoleDefs.name, category: mriRoleDefs.category, subCategory: mriRoleDefs.subCategory })
      .from(mriRoleDefs)
      .where(inArray(mriRoleDefs.roleKey, roleKeys));

    const programs = await db
      .select({ id: mriPrograms.id, programKey: mriPrograms.programKey, name: mriPrograms.name })
      .from(mriPrograms);

    const roleDefIds = roleDefs.map((r) => r.id);
    let tasks = [];
    if (roleDefIds.length) {
      tasks = await db
        .select({
          id: mriRoleTasks.id,
          roleDefId: mriRoleTasks.roleDefId,
          title: mriRoleTasks.title,
          description: mriRoleTasks.description,
          submissables: mriRoleTasks.submissables,
          action: mriRoleTasks.action,
          active: mriRoleTasks.active,
          timeSensitive: mriRoleTasks.timeSensitive,
          execAt: mriRoleTasks.execAt,
          windowStart: mriRoleTasks.windowStart,
          windowEnd: mriRoleTasks.windowEnd,
          recurrence: mriRoleTasks.recurrence,
        })
        .from(mriRoleTasks)
        .where(inArray(mriRoleTasks.roleDefId, roleDefIds));
    }

    const tasksByRoleId = new Map();
    for (const t of tasks) {
      if (!tasksByRoleId.has(t.roleDefId)) tasksByRoleId.set(t.roleDefId, []);
      // Parse submissables JSON if needed
      let subs = t.submissables;
      try {
        const arr = JSON.parse(t.submissables || "null");
        if (Array.isArray(arr)) subs = arr;
      } catch {}
      tasksByRoleId.get(t.roleDefId).push({
        id: t.id,
        title: t.title,
        description: t.description,
        submissables: subs,
        action: t.action,
        active: t.active,
        timeSensitive: t.timeSensitive,
        execAt: t.execAt,
        windowStart: t.windowStart,
        windowEnd: t.windowEnd,
        recurrence: t.recurrence,
      });
    }

    const programByKey = new Map(
      programs.map((p) => [String(p.programKey || "").toUpperCase(), p])
    );

    const deriveProgram = (roleKey, roleName, category, subCategory) => {
      if (String(category || "").toLowerCase() !== "amri") return null;
      const normalizedSub = String(subCategory || "").trim().toUpperCase();
      if (normalizedSub && programByKey.has(normalizedSub)) return programByKey.get(normalizedSub);
      const bucket = new Set();
      const pushCandidates = (value) => {
        if (!value) return;
        const upper = String(value).toUpperCase();
        bucket.add(upper);
        bucket.add(upper.replace(/[^A-Z0-9]/g, ""));
        upper.split(/[^A-Z0-9]+/).forEach((token) => {
          if (token) bucket.add(token);
        });
      };
      pushCandidates(roleKey);
      pushCandidates(roleName);

      if (bucket.has("MHCP1")) bucket.add("MHCP");
      if (bucket.has("MHCP2")) bucket.add("MHCP");

      for (const candidate of bucket) {
        if (programByKey.has(candidate)) return programByKey.get(candidate);
      }
      return null;
    };

    const out = roleDefs.map((r) => {
      const program = deriveProgram(r.roleKey, r.name, r.category, r.subCategory);
      return {
        roleKey: r.roleKey,
        roleName: r.name,
        category: r.category,
        subCategory: r.subCategory,
        program: program
          ? { id: program.id, programKey: program.programKey, name: program.name }
          : null,
        tasks: tasksByRoleId.get(r.id) || [],
      };
    });
    return NextResponse.json({ roles: out }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}
