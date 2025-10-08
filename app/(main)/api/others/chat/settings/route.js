import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { systemFlags } from "@/lib/schema";
import { inArray } from "drizzle-orm";

const FLAG_KEYS = {
  chatMuteAdmin: "chat_mute_allow_admins",
  chatMuteManager: "chat_mute_allow_managers",
  chatMuteMember: "chat_mute_allow_members",
};

const FLAG_DEFAULTS = {
  allowAdmins: true,
  allowManagers: true,
  allowMembers: true,
};

export async function GET() {
  const session = await auth();
  if (!session || !session.user || !["admin", "team_manager", "member"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await db
      .select({ key: systemFlags.key, value: systemFlags.value })
      .from(systemFlags)
      .where(inArray(systemFlags.key, Object.values(FLAG_KEYS)));

    const map = new Map(rows.map((row) => [row.key, row.value]));

    return NextResponse.json(
      {
        allowAdmins: map.has(FLAG_KEYS.chatMuteAdmin)
          ? !!map.get(FLAG_KEYS.chatMuteAdmin)
          : FLAG_DEFAULTS.allowAdmins,
        allowManagers: map.has(FLAG_KEYS.chatMuteManager)
          ? !!map.get(FLAG_KEYS.chatMuteManager)
          : FLAG_DEFAULTS.allowManagers,
        allowMembers: map.has(FLAG_KEYS.chatMuteMember)
          ? !!map.get(FLAG_KEYS.chatMuteMember)
          : FLAG_DEFAULTS.allowMembers,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[chat/settings] GET error:", err);
    return NextResponse.json(
      {
        allowAdmins: FLAG_DEFAULTS.allowAdmins,
        allowManagers: FLAG_DEFAULTS.allowManagers,
        allowMembers: FLAG_DEFAULTS.allowMembers,
        error: "Failed to load chat settings",
      },
      { status: 200 }
    );
  }
}
