import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { messages, users } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq, or } from "drizzle-orm";

export async function GET(req) {
  try {
    const session = await auth();
    if (!session || !session.user || !["admin", "team_manager", "member"].includes(session.user.role)) {
      console.error("Unauthorized access attempt:", { session });
      return NextResponse.json({ error: "Unauthorized: Admin, Team Manager, or Member access required", messages: [] }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId", messages: [] }, { status: 400 });
    }

    const userMessages = await db
      .select({
        id: messages.id,
        senderId: messages.senderId,
        recipientId: messages.recipientId,
        content: messages.content,
        createdAt: messages.createdAt,
        status: messages.status,
      })
      .from(messages)
      .where(
        or(
          eq(messages.senderId, parseInt(userId)),
          eq(messages.recipientId, parseInt(userId))
        )
      )
      .orderBy(messages.createdAt);

    return NextResponse.json({ messages: userMessages || [] });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json({ error: `Failed to fetch messages: ${error.message}`, messages: [] }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session || !session.user || !["admin", "team_manager", "member"].includes(session.user.role)) {
      console.error("Unauthorized access attempt:", { session });
      return NextResponse.json({ error: "Unauthorized: Admin, Team Manager, or Member access required" }, { status: 401 });
    }

    const { userId, recipientId, message } = await req.json();

    if (!userId || !recipientId || !message || message.trim() === "") {
      return NextResponse.json({ error: "Missing userId, recipientId, or message" }, { status: 400 });
    }

    const [recipient] = await db
      .select()
      .from(users)
      .where(eq(users.id, parseInt(recipientId)));
    if (!recipient) {
      return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
    }

    const [newMessage] = await db
      .insert(messages)
      .values({
        senderId: parseInt(userId),
        recipientId: parseInt(recipientId),
        content: message,
        createdAt: new Date(),
        status: "sent",
      })
      .returning({
        id: messages.id,
        senderId: messages.senderId,
        recipientId: messages.recipientId,
        content: messages.content,
        createdAt: messages.createdAt,
        status: messages.status,
      });

    if (req.socket?.server?.io) {
      req.socket.server.io.to(recipientId.toString()).emit("message", newMessage);
    }

    return NextResponse.json({ message: newMessage });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json({ error: `Failed to send message: ${error.message}` }, { status: 500 });
  }
}