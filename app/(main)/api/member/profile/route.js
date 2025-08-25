import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, openCloseTimes } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { writeFile, unlink, mkdir } from "fs/promises";
import path from "path";
import bcrypt from "bcrypt";

export async function GET(req) {
  try {
    const session = await auth();
    if (
      !session ||
      !session.user ||
      !["admin", "member", "team_manager"].includes(session.user.role)
    ) {
      console.error("Unauthorized access attempt:", { session });
      return NextResponse.json(
        { error: "Unauthorized: Admin or Member access required" },
        { status: 401 }
      );
    }

    const userId = parseInt(session.user.id);
    const { searchParams } = new URL(req.url);
    const userTypeParam = searchParams.get("userType");

    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        type: users.type,
        whatsapp_number: users.whatsapp_number,
        whatsapp_enabled: users.whatsapp_enabled,
        image: users.image,
        team_manager_type: users.team_manager_type,
        immediate_supervisor: users.immediate_supervisor,
        immediate_supervisor_name: sql`supervisor.name`,
        immediate_supervisor_role: sql`supervisor.role`,
      })
      .from(users)
      .leftJoin(sql`users as supervisor`, eq(users.immediate_supervisor, sql`supervisor.id`))
      .where(eq(users.id, userId));

    if (!user) {
      console.log("User not found for ID:", userId);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const effectiveType = userTypeParam || user.type;
    let times = null;
    if (effectiveType) {
      const [openClose] = await db
        .select({
          dayOpenTime: openCloseTimes.dayOpenTime,
          dayCloseTime: openCloseTimes.dayCloseTime,
          closingWindowStart: openCloseTimes.closingWindowStart,
          closingWindowEnd: openCloseTimes.closingWindowEnd,
        })
        .from(openCloseTimes)
        .where(eq(openCloseTimes.userType, effectiveType));

      if (openClose) {
        times = {
          dayOpenTime: openClose.dayOpenTime,
          dayCloseTime: openClose.dayCloseTime,
          closingWindowStart: openClose.closingWindowStart,
          closingWindowEnd: openClose.closingWindowEnd,
        };
      }
    }

    console.log("User profile fetched:", {
      userId,
      userType: effectiveType,
      times,
      whatsapp_number: user.whatsapp_number,
      immediate_supervisor: user.immediate_supervisor,
    });

    return NextResponse.json({ user, times });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json(
      { error: `Failed to fetch user profile: ${error.message}` },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const name = formData.get("name");
    const whatsapp_number = formData.get("whatsapp_number") || null;
    const whatsapp_enabled = formData.get("whatsapp_enabled") === "true";
    const image = formData.get("image");

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    let imageUrl = session.user.image || null;
    if (image && image instanceof File) {
      const validTypes = ["image/jpeg", "image/png", "image/gif"];
      if (!validTypes.includes(image.type)) {
        return NextResponse.json(
          { error: "Invalid image type. Use JPEG, PNG, or GIF." },
          { status: 400 }
        );
      }
      if (image.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Image size must be less than 5MB" },
          { status: 400 }
        );
      }

      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      try {
        await mkdir(uploadsDir, { recursive: true });
      } catch (err) {
        console.error("Failed to create uploads directory:", err);
        return NextResponse.json(
          { error: "Failed to create uploads directory" },
          { status: 500 }
        );
      }

      if (session.user.image && session.user.image !== "/default-avatar.png") {
        const existingFilePath = path.join(process.cwd(), "public", session.user.image);
        try {
          await unlink(existingFilePath);
        } catch (err) {
          console.warn("Failed to delete existing image file:", err.message);
        }
      }

      const fileName = `${session.user.id}-${Date.now()}${path.extname(image.name)}`;
      const filePath = path.join(process.cwd(), "public", "uploads", fileName);
      const buffer = Buffer.from(await image.arrayBuffer());
      try {
        await writeFile(filePath, buffer);
      } catch (err) {
        console.error("Failed to write image file:", { filePath, error: err.message });
        return NextResponse.json(
          { error: "Failed to save image file" },
          { status: 500 }
        );
      }
      imageUrl = `/uploads/${fileName}`;
    }

    const updateData = {
      name,
      whatsapp_number,
      whatsapp_enabled,
      image: imageUrl,
    };
    console.log("Updating user with data:", updateData);
    let updatedUser;
    try {
      [updatedUser] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, parseInt(session.user.id)))
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          whatsapp_number: users.whatsapp_number,
          whatsapp_enabled: users.whatsapp_enabled,
          image: users.image,
          role: users.role,
          team_manager_type: users.team_manager_type,
        });
    } catch (err) {
      console.error("Database update error:", err);
      return NextResponse.json(
        { error: "Failed to update user in database" },
        { status: 500 }
      );
    }
    console.log("Updated user:", updatedUser);

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: `Failed to update profile: ${error.message}` },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current and new passwords are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    const [user] = await db
      .select({ password: users.password })
      .from(users)
      .where(eq(users.id, parseInt(session.user.id)));

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: "Incorrect current password" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, parseInt(session.user.id)));

    return NextResponse.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Password change error:", error);
    return NextResponse.json(
      { error: "Failed to change password" },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [user] = await db
      .select({ image: users.image })
      .from(users)
      .where(eq(users.id, parseInt(session.user.id)));

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.image && user.image !== "/default-avatar.png") {
      const filePath = path.join(process.cwd(), "public", user.image);
      try {
        await unlink(filePath);
      } catch (err) {
        console.warn("Failed to delete image file:", err.message);
      }
    }

    const [updatedUser] = await db
      .update(users)
      .set({ image: null })
      .where(eq(users.id, parseInt(session.user.id)))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        whatsapp_number: users.whatsapp_number,
        whatsapp_enabled: users.whatsapp_enabled,
        image: users.image,
        role: users.role,
        team_manager_type: users.team_manager_type,
      });

    return NextResponse.json({
      user: updatedUser,
      message: "Profile picture removed",
    });
  } catch (error) {
    console.error("Image deletion error:", error);
    return NextResponse.json(
      { error: "Failed to delete profile picture" },
      { status: 500 }
    );
  }
}