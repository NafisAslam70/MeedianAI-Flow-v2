import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks } from "@/lib/schema"; // Adjust to your schema
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function GET(req) {
  const session = await auth();
  if (!session || session.user?.role !== "team_manager") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");

    // Query tasks for the team_manager's team
    const taskQuery = db
      .select({
        status: tasks.status,
      })
      .from(tasks)
      .where(eq(tasks.team_manager_type, session.user.team_manager_type || ""));

    const taskList = await taskQuery;

    // Calculate summary
    const totalTasks = taskList.length;
    const completedTasks = taskList.filter((t) => t.status === "done").length;
    const inProgressTasks = taskList.filter((t) => t.status === "in_progress").length;
    const notStartedTasks = taskList.filter((t) => t.status === "not_started").length;

    return NextResponse.json({
      totalTasks,
      completedTasks,
      inProgressTasks,
      notStartedTasks,
    });
  } catch (error) {
    console.error("Error fetching task summary:", error);
    return NextResponse.json({ error: "Failed to fetch task summary" }, { status: 500 });
  }
}