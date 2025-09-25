import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { systemFlags, managerSectionGrants } from "@/lib/schema";
import { eq, and, inArray } from "drizzle-orm";

const FLAG_KEYS = {
  bypass: "show_day_close_bypass",
  ipr: "show_day_close_ipr",
};

const FLAG_DEFAULTS = {
  showDayCloseBypass: false,
  showIprJourney: true,
};

async function requireAccess({ write = false } = {}) {
  const session = await auth();
  if (!session) {
    return { session: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const role = session.user?.role;
  if (role === "admin") {
    return { session };
  }

  if (role === "team_manager") {
    const [grant] = await db
      .select({ canWrite: managerSectionGrants.canWrite })
      .from(managerSectionGrants)
      .where(
        and(
          eq(managerSectionGrants.userId, Number(session.user.id)),
          eq(managerSectionGrants.section, "randomsLab")
        )
      )
      .limit(1);

    if (!grant) {
      return { session: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }

    if (write && grant.canWrite === false) {
      return { session: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }

    return { session };
  }

  return { session: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
}

export async function GET() {
  const { session, response } = await requireAccess();
  if (!session) return response;

  const rows = await db
    .select({ key: systemFlags.key, value: systemFlags.value })
    .from(systemFlags)
    .where(inArray(systemFlags.key, Object.values(FLAG_KEYS)));

  const map = new Map(rows.map((row) => [row.key, row.value]));

  return NextResponse.json(
    {
      showDayCloseBypass: map.has(FLAG_KEYS.bypass) ? !!map.get(FLAG_KEYS.bypass) : FLAG_DEFAULTS.showDayCloseBypass,
      showIprJourney: map.has(FLAG_KEYS.ipr) ? !!map.get(FLAG_KEYS.ipr) : FLAG_DEFAULTS.showIprJourney,
    },
    { status: 200 }
  );
}

export async function POST(req) {
  const { session, response } = await requireAccess({ write: true });
  if (!session) return response;

  const body = await req.json().catch(() => ({}));

  const updates = [];
  if (body.hasOwnProperty("showDayCloseBypass")) {
    updates.push({ key: FLAG_KEYS.bypass, value: !!body.showDayCloseBypass });
  }
  if (body.hasOwnProperty("showIprJourney")) {
    updates.push({ key: FLAG_KEYS.ipr, value: !!body.showIprJourney });
  }

  if (!updates.length) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const now = new Date();
  for (const update of updates) {
    await db
      .insert(systemFlags)
      .values({ key: update.key, value: update.value, updatedAt: now })
      .onConflictDoUpdate({
        target: systemFlags.key,
        set: { value: update.value, updatedAt: now },
      });
  }

  return NextResponse.json(
    {
      success: true,
      showDayCloseBypass:
        updates.find((item) => item.key === FLAG_KEYS.bypass)?.value ?? undefined,
      showIprJourney: updates.find((item) => item.key === FLAG_KEYS.ipr)?.value ?? undefined,
    },
    { status: 200 }
  );
}
