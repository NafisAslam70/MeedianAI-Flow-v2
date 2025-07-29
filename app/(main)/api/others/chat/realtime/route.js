// app/api/others/chat/realtime/route.js
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { messages, users } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq, or } from "drizzle-orm";
import Pusher from "pusher";

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true,
});

// Same GET and PUT as above
export async function GET(req) { /* ... same as above ... */ }
export async function PUT(req) { /* ... same as above ... */ }

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

    await pusher.trigger(`chat-${recipientId}`, "new-message", newMessage);

    return NextResponse.json({ message: newMessage });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json({ error: `Failed to send message: ${error.message}` }, { status: 500 });
  }
}