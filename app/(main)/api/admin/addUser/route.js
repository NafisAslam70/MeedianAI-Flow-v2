import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, routineTasks, assignedTasks, assignedTaskStatus } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

export async function POST(req) {
  const session = await auth();
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const {
      name,
      email,
      password,
      role,
      type,
      team_manager_type,
      userId,
      routineTasks: routineTasksInput,
      assignedTasks: assignedTasksInput,
      taskOnly,
    } = await req.json();

    // -----------------------
    // Routine Task-Only Mode
    // -----------------------
    if (taskOnly) {
      if (!userId || !Array.isArray(routineTasksInput) || routineTasksInput.length === 0) {
        return NextResponse.json(
          { error: "User ID and at least one routine task are required" },
          { status: 400 }
        );
      }

      const parsedUserId = parseInt(userId, 10);
      if (isNaN(parsedUserId)) {
        return NextResponse.json({ error: "Invalid user ID format" }, { status: 400 });
      }

      const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, parsedUserId));
      if (!user) {
        return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
      }

      const validTasks = routineTasksInput.filter(
        (task) =>
          task &&
          typeof task === "object" &&
          task.description &&
          typeof task.description === "string" &&
          task.description.trim() !== ""
      );

      if (validTasks.length === 0) {
        return NextResponse.json(
          { error: "At least one valid routine task with a non-empty description is required" },
          { status: 400 }
        );
      }

      const insertValues = validTasks.map((task) => ({
        description: task.description.trim(),
        memberId: parsedUserId,
        createdAt: new Date(),
      }));

      try {
        await db.insert(routineTasks).values(insertValues);
      } catch (error) {
        console.error("Bulk insertion failed:", {
          message: error.message,
          stack: error.stack,
          insertValues,
        });

        console.log("Attempting sequential insertion...");
        for (const value of insertValues) {
          try {
            await db.insert(routineTasks).values(value);
          } catch (singleError) {
            console.error(`Failed to insert task: ${value.description}`, {
              message: singleError.message,
              stack: singleError.stack,
            });
            throw new Error(`Failed to insert task: ${value.description}`);
          }
        }
        console.log("Sequential insertion completed successfully");
      }

      return NextResponse.json({ message: "Routine tasks inserted successfully" });
    }

    // -----------------------
    // Full User Creation Flow
    // -----------------------
    if (!name || !email || !password) {
      return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters long" }, { status: 400 });
    }
    if (!["admin", "team_manager", "member"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    if (!["residential", "non_residential", "semi_residential"].includes(type)) {
      return NextResponse.json({ error: "Invalid user type" }, { status: 400 });
    }
    if (role === "team_manager" && !["head_incharge", "coordinator", "accountant", "chief_counsellor", "hostel_incharge", "principal"].includes(team_manager_type)) {
      return NextResponse.json({ error: "Invalid team manager type" }, { status: 400 });
    }

    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()));

    if (existingUser.length > 0) {
      return NextResponse.json({ error: "Email already in use" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [newUser] = await db
      .insert(users)
      .values({
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        role,
        type,
        team_manager_type: role === "team_manager" ? team_manager_type : null,
      })
      .returning({ id: users.id, role: users.role });

    let assignedTaskIds = [];
    if (Array.isArray(assignedTasksInput) && assignedTasksInput.length > 0) {
      const validAssignedTasks = assignedTasksInput.filter(
        (task) =>
          task &&
          typeof task === "object" &&
          task.title &&
          typeof task.title === "string" &&
          task.title.length <= 255
      );

      if (validAssignedTasks.length > 0) {
        const insertedTasks = await db
          .insert(assignedTasks)
          .values(
            validAssignedTasks.map((task) => ({
              title: task.title,
              description: task.description || null,
              createdBy: session.user.id,
              createdAt: new Date(),
              taskType: "assigned",
            }))
          )
          .returning({ id: assignedTasks.id });

        await db.insert(assignedTaskStatus).values(
          insertedTasks.map((task) => ({
            taskId: task.id,
            memberId: newUser.id,
            status: "not_started",
            updatedAt: new Date(),
            assignedDate: new Date(),
          }))
        );

        assignedTaskIds = insertedTasks.map((task) => task.id);
      }
    }

    return NextResponse.json({
      message: `User created successfully as ${newUser.role}`,
      userId: newUser.id,
      role: newUser.role,
      assignedTaskIds,
    });
  } catch (error) {
    console.error("Error processing request:", {
      message: error.message,
      stack: error.stack,
      code: error.code,
    });
    return NextResponse.json({ error: error.message || "Failed to process request" }, { status: 500 });
  }
}