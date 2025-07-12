import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { messages, users } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq, or } from "drizzle-orm";

export async function GET(req) {
  try {
    const session = await auth();
    if (!session || !session.user || session.user.role !== "member") {
      console.error("Unauthorized access attempt:", { session });
      return NextResponse.json({ error: "Unauthorized: Member access required" }, { status: 401 });
    }

    const userId = parseInt(session.user.id);

    const userMessages = await db
      .select({
        id: messages.id,
        senderId: messages.senderId,
        senderName: users.name,
        recipientId: messages.recipientId,
        content: messages.content,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .leftJoin(users, eq(messages.senderId, users.id))
      .where(
        or(
          eq(messages.senderId, userId),
          eq(messages.recipientId, userId)
        )
      )
      .orderBy(messages.createdAt);

    console.log("Messages fetched:", userMessages.length, { userId });

    return NextResponse.json({ messages: userMessages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json({ error: `Failed to fetch messages: ${error.message}` }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session || !session.user || session.user.role !== "member") {
      console.error("Unauthorized access attempt:", { session });
      return NextResponse.json({ error: "Unauthorized: Member access required" }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const { recipientId, content } = await req.json();

    if (!recipientId || !content || content.trim() === "") {
      return NextResponse.json({ error: "Recipient ID and content are required" }, { status: 400 });
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
        senderId: userId,
        recipientId: parseInt(recipientId),
        content,
        createdAt: new Date(),
      })
      .returning();

    console.log("Message sent:", { messageId: newMessage.id, senderId: userId, recipientId });

    return NextResponse.json({ message: newMessage });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json({ error: `Failed to send message: ${error.message}` }, { status: 500 });
  }
}