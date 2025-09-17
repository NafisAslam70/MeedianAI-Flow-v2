import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { systemFlags, managerSectionGrants } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

const FLAG_KEY = "show_day_close_bypass";

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

  const [flagRow] = await db
    .select({ value: systemFlags.value })
    .from(systemFlags)
    .where(eq(systemFlags.key, FLAG_KEY))
    .limit(1);

  return NextResponse.json({ showDayCloseBypass: !!flagRow?.value }, { status: 200 });
}

export async function POST(req) {
  const { session, response } = await requireAccess({ write: true });
  if (!session) return response;

  const body = await req.json().catch(() => null);
  const showDayCloseBypass = !!body?.showDayCloseBypass;

  await db
    .insert(systemFlags)
    .values({ key: FLAG_KEY, value: showDayCloseBypass, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: systemFlags.key,
      set: { value: showDayCloseBypass, updatedAt: new Date() },
    });

  return NextResponse.json({ success: true, showDayCloseBypass }, { status: 200 });
}
