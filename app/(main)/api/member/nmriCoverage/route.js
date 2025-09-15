import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { dailySlots, slotWeeklyRoles, slotRoleAssignments, users } from "@/lib/schema";
import { eq, and, inArray } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const session = await auth();
  if (!session || !["member", "team_manager", "admin"].includes(session.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const dateStr = String(searchParams.get("date") || new Date().toISOString().slice(0, 10));
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
    const weekday = d.getDay(); // 0=Sun .. 6=Sat

    const slots = await db
      .select({ id: dailySlots.id, name: dailySlots.name, startTime: dailySlots.startTime, endTime: dailySlots.endTime, isHighGathering: dailySlots.isHighGathering })
      .from(dailySlots)
      .orderBy(dailySlots.id);

    const roleRows = await db
      .select({ id: slotWeeklyRoles.id, slotId: slotWeeklyRoles.slotId, weekday: slotWeeklyRoles.weekday, role: slotWeeklyRoles.role, requiredCount: slotWeeklyRoles.requiredCount, active: slotWeeklyRoles.active })
      .from(slotWeeklyRoles)
      .where(eq(slotWeeklyRoles.weekday, weekday));

    const roleIds = roleRows.map(r => r.id);
    let assignRows = [];
    if (roleIds.length) {
      assignRows = await db
        .select({ id: slotRoleAssignments.id, slotWeeklyRoleId: slotRoleAssignments.slotWeeklyRoleId, userId: slotRoleAssignments.userId, startDate: slotRoleAssignments.startDate, endDate: slotRoleAssignments.endDate, active: slotRoleAssignments.active })
        .from(slotRoleAssignments)
        .where(and(inArray(slotRoleAssignments.slotWeeklyRoleId, roleIds)));
    }
    const userMap = new Map((await db.select({ id: users.id, name: users.name, role: users.role, type: users.type }).from(users)).map(u => [u.id, u]));

    const isActiveOnDate = (row) => {
      if (!row.active) return false;
      const s = row.startDate ? new Date(row.startDate) : null;
      const e = row.endDate ? new Date(row.endDate) : null;
      if (s && d < new Date(s.toISOString().slice(0,10))) return false;
      if (e && d > new Date(e.toISOString().slice(0,10))) return false;
      return true;
    };

    const rolesBySlot = new Map();
    roleRows.forEach(r => {
      if (!rolesBySlot.has(r.slotId)) rolesBySlot.set(r.slotId, []);
      rolesBySlot.get(r.slotId).push({ ...r, members: [] });
    });
    const roleIndex = new Map();
    rolesBySlot.forEach(list => list.forEach(rr => roleIndex.set(rr.id, rr)));
    assignRows.forEach(a => {
      if (!isActiveOnDate(a)) return;
      const rr = roleIndex.get(a.slotWeeklyRoleId);
      if (rr) rr.members.push({ id: a.id, userId: a.userId, user: userMap.get(a.userId) || null });
    });

    const data = slots.map(s => ({ slot: s, roles: (rolesBySlot.get(s.id) || []).sort((a,b)=> a.role.localeCompare(b.role)) }));
    return NextResponse.json({ date: dateStr, weekday, coverage: data }, { status: 200 });
  } catch (err) {
    console.error("GET /api/member/nmriCoverage error:", err);
    return NextResponse.json({ error: "Failed to load coverage" }, { status: 500 });
  }
}

