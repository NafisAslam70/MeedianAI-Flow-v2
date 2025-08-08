// import { NextResponse } from "next/server";
// import { db } from "@/lib/db";
// import { users } from "@/lib/schema";
// import { auth } from "@/lib/auth";
// import { ne, eq } from "drizzle-orm";

// export async function GET(req) {
//   try {
//     const session = await auth();
//     if (!session || !session.user || !["admin", "team_manager", "member"].includes(session.user.role)) {
//       console.error("Unauthorized access attempt:", { session });
//       return NextResponse.json({ error: "Unauthorized: Admin, Team Manager, or Member access required" }, { status: 401 });
//     }

//     const userId = parseInt(session.user.id);

//     const availableUsers = await db
//       .select({
//         id: users.id,
//         name: users.name,
//         role: users.role,
//         type: users.type,
//         team_manager_type: users.team_manager_type,
//       })
//       .from(users)
//       .where(ne(users.id, userId));

//     console.log("Users fetched for messaging:", availableUsers.length, { userId });

//     return NextResponse.json({ users: availableUsers });
//   } catch (error) {
//     console.error("Error fetching users:", error);
//     return NextResponse.json({ error: `Failed to fetch users: ${error.message}` }, { status: 500 });
//   }
// }
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { ne, eq } from "drizzle-orm";

export async function GET(req) {
  try {
    const session = await auth();
    if (
      !session ||
      !session.user ||
      !["admin", "team_manager", "member"].includes(session.user.role)
    ) {
      console.error("Unauthorized access attempt:", { session });
      return NextResponse.json({ error: "Unauthorized: Admin, Team Manager, or Member access required" }, { status: 401 });
    }

    // No exclusion! Return all users:
    const availableUsers = await db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        type: users.type,
        team_manager_type: users.team_manager_type,
      })
      .from(users);

    console.log("Users fetched for messaging:", availableUsers.length);

    return NextResponse.json({ users: availableUsers });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: `Failed to fetch users: ${error.message}` }, { status: 500 });
  }
}
