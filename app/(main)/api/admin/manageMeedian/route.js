import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, appState, routineTasks } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function GET(req) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    console.error("Unauthorized access attempt:", { session });
    return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const section = searchParams.get("section");
  const userId = searchParams.get("userId");

  try {
    if (section === "team") {
      console.log("Fetching users from database...");
      const allUsers = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          type: users.type,
        })
        .from(users)
        .where(eq(users.role, "member"));
      console.log("Users fetched:", allUsers.length);
      if (allUsers.length === 0) {
        console.warn("No users found in the database with role 'member'");
      }
      return NextResponse.json({ users: allUsers });
    }

    if (section === "appState") {
      const state = await db.select().from(appState).limit(1);
      const defaultState = state[0] || {
        dayOpenedAt: new Date("1970-01-01T08:00:00Z"),
        dayClosedAt: new Date("1970-01-01T20:00:00Z"),
        closingWindowStart: new Date("1970-01-01T19:30:00Z"),
        closingWindowEnd: new Date("1970-01-01T20:00:00Z"),
      };
      const appStateData = {
        residential: {
          dayOpenedAt: defaultState.dayOpenedAt.toISOString().slice(11, 16),
          dayClosedAt: defaultState.dayClosedAt.toISOString().slice(11, 16),
          closingWindowStart: "19:30",
          closingWindowEnd: "20:00",
        },
        non_residential: {
          dayOpenedAt: "09:00",
          dayClosedAt: "21:00",
          closingWindowStart: "12:00",
          closingWindowEnd: "12:30",
        },
        semi_residential: {
          dayOpenedAt: "08:30",
          dayClosedAt: "20:30",
          closingWindowStart: "17:30",
          closingWindowEnd: "18:00",
        },
      };
      console.log("App state fetched:", appStateData);
      return NextResponse.json({ appState: appStateData });
    }

    if (section === "routineTasks") {
      console.log("Fetching routine tasks...", { userId });
      const query = db
        .select({
          id: routineTasks.id,
          description: routineTasks.description,
          memberId: routineTasks.memberId,
        })
        .from(routineTasks)
        .orderBy(routineTasks.id);
      const tasks = userId
        ? await query.where(eq(routineTasks.memberId, parseInt(userId)))
        : await query;
      console.log("Routine tasks fetched:", tasks.length);
      return NextResponse.json({ tasks });
    }

    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  } catch (error) {
    console.error(`Error fetching ${section}:`, error);
    return NextResponse.json({ error: `Failed to fetch ${section}: ${error.message}` }, { status: 500 });
  }
}

export async function POST(req) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    console.error("Unauthorized POST attempt:", { session });
    return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const section = searchParams.get("section");

  try {
    if (section === "routineTasks") {
      const { description, memberId } = await req.json();
      if (!description || !memberId) {
        return NextResponse.json({ error: "Description and member ID are required" }, { status: 400 });
      }
      const [newTask] = await db
        .insert(routineTasks)
        .values({ description, memberId: parseInt(memberId) })
        .returning({
          id: routineTasks.id,
          description: routineTasks.description,
          memberId: routineTasks.memberId,
        });
      console.log("New routine task added:", newTask);
      return NextResponse.json({ task: newTask });
    }

    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  } catch (error) {
    console.error(`Error adding ${section}:`, error);
    return NextResponse.json({ error: `Failed to add ${section}: ${error.message}` }, { status: 500 });
  }
}

export async function PATCH(req) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    console.error("Unauthorized PATCH attempt:", { session });
    return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const section = searchParams.get("section");

  try {
    if (section === "team") {
      const { updates } = await req.json();
      if (!Array.isArray(updates) || updates.length === 0) {
        return NextResponse.json({ error: "Invalid or empty updates" }, { status: 400 });
      }

      for (const u of updates) {
        if (
          !u.id ||
          !["residential", "non_residential", "semi_residential"].includes(u.type)
        ) {
          return NextResponse.json({ error: "Invalid user ID or type" }, { status: 400 });
        }
        await db.update(users).set({ type: u.type }).where(eq(users.id, u.id));
      }
      console.log("Team updates applied:", updates.length);
      return NextResponse.json({ message: "Team updated successfully" });
    }

    if (section === "appState") {
      const { appState: newState } = await req.json();
      const [updated] = await db
        .update(appState)
        .set({
          dayOpenedAt: new Date(`1970-01-01T${newState.residential.dayOpenedAt}:00Z`),
          dayClosedAt: new Date(`1970-01-01T${newState.residential.dayClosedAt}:00Z`),
          closingWindowStart: new Date(`1970-01-01T${newState.residential.closingWindowStart}:00Z`),
          closingWindowEnd: new Date(`1970-01-01T${newState.residential.closingWindowEnd}:00Z`),
        })
        .returning();
      console.log("App state updated:", updated);
      return NextResponse.json({ message: "App state updated successfully" });
    }

    if (section === "routineTasks") {
      const { tasks } = await req.json();
      if (!Array.isArray(tasks) || tasks.length === 0) {
        return NextResponse.json({ error: "Invalid or empty tasks" }, { status: 400 });
      }

      for (const task of tasks) {
        if (!task.id || !task.memberId) {
          return NextResponse.json({ error: "Invalid task ID or member ID" }, { status: 400 });
        }
        await db
          .update(routineTasks)
          .set({ memberId: task.memberId, description: task.description })
          .where(eq(routineTasks.id, task.id));
      }
      console.log("Routine tasks updated:", tasks.length);
      return NextResponse.json({ message: "Routine tasks updated successfully" });
    }

    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  } catch (error) {
    console.error(`Error updating ${section}:`, error);
    return NextResponse.json({ error: `Failed to update ${section}: ${error.message}` }, { status: 500 });
  }
}