// app/api/member/messages/realtime/route.js
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

// Same GET as above
export async function GET(req) { /* ... same as above ... */ }

export async function POST(req) {
  try {
    const session = await auth();
    if (!session || !session.user || !["admin", "member"].includes(session.user.role)) {
      console.error("Unauthorized access attempt:", { session });
      return NextResponse.json({ error: "Unauthorized: Admin or Member access required" }, { status: 401 });
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

    await pusher.trigger(`chat-${recipientId}`, "new-message", newMessage);

    console.log("Message sent:", { messageId: newMessage.id, senderId: userId, recipientId });

    return NextResponse.json({ message: newMessage });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json({ error: `Failed to send message: ${error.message}` }, { status: 500 });
  }
}