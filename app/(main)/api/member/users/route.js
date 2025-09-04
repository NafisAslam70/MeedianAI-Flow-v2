import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, userMriRoles } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function GET(req) {
  try {
    const session = await auth();
    if (
      !session ||
      !session.user ||
      !["admin", "team_manager", "member"].includes(session.user.role)
    ) {
      console.error("Unauthorized access attempt:", { session });
      return NextResponse.json(
        { error: "Unauthorized: Admin, Team Manager, or Member access required" },
        { status: 401 }
      );
    }

    console.log("Raw session.user.id:", session.user.id);
    const userId = parseInt(session.user.id);
    console.log("Parsed userId:", userId);

    // Fetch all users with their basic information
    const availableUsers = await db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        type: users.type,
        team_manager_type: users.team_manager_type,
        image: users.image,
        whatsapp_number: users.whatsapp_number,
        whatsapp_enabled: users.whatsapp_enabled,
        member_scope: users.member_scope,
        immediate_supervisor: users.immediate_supervisor,
      })
      .from(users);

    // Fetch MRI roles for the current user
  const mriRoles = await db
  .select({ role: userMriRoles.role })
  .from(userMriRoles)
  .where(
    and(
      eq(userMriRoles.userId, userId),
      eq(userMriRoles.active, true)
    )
  );

    // Log the fetched data for debugging
    console.log("Users fetched for messaging:", {
      count: availableUsers.length,
      userId,
      currentUser: availableUsers.find((u) => u.id === userId),
      mriRoles: mriRoles.map((r) => r.role),
    });

    // Format users and include MRI roles for the current user
    const formattedUsers = availableUsers.map((user) => ({
      ...user,
      image: user.image || "/default-avatar.png",
      mriRoles: user.id === userId ? mriRoles.map((r) => r.role) || [] : [],
    }));

    return NextResponse.json({ users: formattedUsers });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: `Failed to fetch users: ${error.message}` },
      { status: 500 }
    );
  }
}
