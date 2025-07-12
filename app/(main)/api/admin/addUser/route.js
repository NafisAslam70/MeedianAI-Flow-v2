import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, routineTasks as routineTasksTable, tasks, taskAssignments } from "@/lib/schema";
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
      userId,
      routineTasks: routineTasksInput,
      assignedTasks,
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

      console.log("Received routineTasks:", routineTasksInput);

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
          {
            error: "At least one valid routine task with a non-empty description is required",
          },
          { status: 400 }
        );
      }

      console.log("Filtered validTasks:", validTasks);

      const insertValues = validTasks.map((task, index) => {
        if (!task || !task.description) {
          console.error(`Invalid task at index ${index}:`, task);
          throw new Error(`Invalid task data at index ${index}`);
        }
        return {
          description: task.description.trim(),
          memberId: parsedUserId,
          createdAt: new Date(),
        };
      });

      console.log("Insert values:", insertValues);

      try {
        await db.insert(routineTasksTable).values(insertValues);
      } catch (error) {
        console.error("Bulk insertion failed:", {
          message: error.message,
          stack: error.stack,
          insertValues,
        });

        console.log("Attempting sequential insertion...");
        for (const value of insertValues) {
          try {
            await db.insert(routineTasksTable).values(value);
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
    if (!["admin", "member"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    if (!["residential", "non_residential", "semi_residential"].includes(type)) {
      return NextResponse.json({ error: "Invalid user type" }, { status: 400 });
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
      })
      .returning({ id: users.id, role: users.role });

    let assignedTaskIds = [];
    if (Array.isArray(assignedTasks) && assignedTasks.length > 0) {
      const validAssignedTasks = assignedTasks.filter(
        (task) =>
          task &&
          typeof task === "object" &&
          task.title &&
          typeof task.title === "string" &&
          task.title.length <= 255
      );

      if (validAssignedTasks.length > 0) {
        const insertedTasks = await db
          .insert(tasks)
          .values(
            validAssignedTasks.map((task) => ({
              title: task.title,
              description: task.description || null,
              createdBy: session.user.id,
              createdAt: new Date(),
              taskType: "assigned",
            }))
          )
          .returning({ id: tasks.id });

        await db.insert(taskAssignments).values(
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
