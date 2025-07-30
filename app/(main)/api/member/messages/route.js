import { NextResponse }  from "next/server";
import { db }            from "@/lib/db";
import { messages, users } from "@/lib/schema";
import { auth }          from "@/lib/auth";
import { eq, or }        from "drizzle-orm";

/* roles allowed here */
const allow = (role) => ["admin", "member"].includes(role);

/* --------------------- GET (my own inbox) --------------------- */
export async function GET() {
  try {
    const session = await auth();
    if (!session || !allow(session.user.role))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const me = parseInt(session.user.id);

    const rows = await db
      .select({
        id:          messages.id,
        senderId:    messages.senderId,
        senderName:  users.name,
        recipientId: messages.recipientId,
        content:     messages.content,
        createdAt:   messages.createdAt,
        status:      messages.status,
      })
      .from(messages)
      .leftJoin(users, eq(users.id, messages.senderId))
      .where(or(eq(messages.senderId, me), eq(messages.recipientId, me)))
      .orderBy(messages.createdAt);

    return NextResponse.json({ messages: rows });
  } catch (err) {
    console.error("GET /member/messages:", err);
    return NextResponse.json(
      { error: `Failed to fetch messages: ${err.message}` },
      { status: 500 }
    );
  }
}

/* --------------------- POST (send) ----------------------------- */
export async function POST(req) {
  try {
    const session = await auth();
    if (!session || !allow(session.user.role))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const senderId = parseInt(session.user.id);
    const { recipientId, content } = await req.json();

    if (!recipientId || !content?.trim())
      return NextResponse.json(
        { error: "recipientId and content required" },
        { status: 400 }
      );

    const [exists] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, parseInt(recipientId)));
    if (!exists)
      return NextResponse.json({ error: "Recipient not found" }, { status: 404 });

    const [saved] = await db
      .insert(messages)
      .values({
        senderId,
        recipientId: parseInt(recipientId),
        content,
        createdAt: new Date(),
        status: "sent",
      })
      .returning();

    return NextResponse.json({ message: saved });
  } catch (err) {
    console.error("POST /member/messages:", err);
    return NextResponse.json(
      { error: `Failed to send message: ${err.message}` },
      { status: 500 }
    );
  }
}
