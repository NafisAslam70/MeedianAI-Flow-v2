import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { messages, users } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq, or, and, lte } from "drizzle-orm";

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

/* ──────────────────────────  PUT  ──────────────────────────
   Mark messages addressed TO the current user as 'read'.

   Accepts EITHER:
     { messageId, status: "read" }    → mark ONE message
   or
     { upToId,   status: "read" }     → mark ALL messages whose id ≤ upToId
*/
export async function PUT(req) {
  try {
    const session = await auth();
    if (!session || !["admin", "team_manager", "member"].includes(session.user.role))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = parseInt(session.user.id);
    const { messageId, upToId, status = "read" } = await req.json();

    if (!messageId && !upToId)
      return NextResponse.json(
        { error: "messageId or upToId required" },
        { status: 400 }
      );

    /* -------- build WHERE clause -------- */
    const base = eq(messages.recipientId, userId);       // must be addressed to me
    const filter = messageId
      ? and(base, eq(messages.id, parseInt(messageId)))
      : and(base, lte(messages.id, parseInt(upToId)));

    const updated = await db
      .update(messages)
      .set({ status })
      .where(filter)
      .returning({ id: messages.id });

    return NextResponse.json({ updated });
  } catch (err) {
    console.error("PUT /api/others/chat:", err);
    return NextResponse.json(
      { error: `Failed to update messages: ${err.message}` },
      { status: 500 }
    );
  }
}