import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { messages, nonMeeDianMessages, users } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(req) {
  try {
    const session = await auth();
    if (
      !session ||
      !session.user ||
      !["admin", "team_manager"].includes(session.user.role)
    ) {
      console.error("Unauthorized access attempt:", { session });
      return NextResponse.json(
        { error: "Unauthorized: Admin or Team Manager access required" },
        { status: 401 }
      );
    }
    const userId = parseInt(session.user.id);

    // Fetch Meedian messages
    const meedianMessages = await db
      .select({
        id: messages.id,
        recipientId: messages.recipientId,
        recipientName: users.name,
        recipientRole: users.role,
        subject: messages.subject,
        message: messages.message,
        note: messages.note,
        contact: messages.contact,
        messageType: messages.messageType,
        status: messages.status,
        createdAt: messages.createdAt,
        content: messages.content,
      })
      .from(messages)
      .leftJoin(users, eq(messages.recipientId, users.id))
      .where(eq(messages.senderId, userId))
      .orderBy(desc(messages.createdAt));

    // Fetch non-Meedian messages
    const nonMeedianMessagesData = await db
      .select({
        id: nonMeeDianMessages.id,
        recipientId: null,
        recipientName: nonMeeDianMessages.customName,
        recipientRole: "N/A",
        subject: nonMeeDianMessages.subject,
        message: nonMeeDianMessages.message,
        note: nonMeeDianMessages.note,
        contact: nonMeeDianMessages.contact,
        messageType: "direct",
        status: nonMeeDianMessages.status,
        createdAt: nonMeeDianMessages.createdAt,
        customWhatsappNumber: nonMeeDianMessages.customWhatsappNumber,
      })
      .from(nonMeeDianMessages)
      .where(eq(nonMeeDianMessages.senderId, userId))
      .orderBy(desc(nonMeeDianMessages.createdAt));

    // Log raw data for debugging
    console.log("Raw meedianMessages:", JSON.stringify(meedianMessages, null, 2));
    console.log("Raw nonMeedianMessagesData:", JSON.stringify(nonMeedianMessagesData, null, 2));

    // Process messages
    const allMessages = [...meedianMessages, ...nonMeedianMessagesData]
      .map((msg, index) => {
        try {
          // Ensure msg is a valid object
          if (!msg || typeof msg !== "object") {
            console.warn(`Invalid message at index ${index}:`, msg);
            return null;
          }

          // Use new fields if available, otherwise parse content
          const subject = msg.subject || (msg.content && typeof msg.content === "string"
            ? msg.content.match(/Subject: (.*?)\. Message:/)?.[1] || "N/A"
            : "N/A");
          const messageContent = msg.message || (msg.content && typeof msg.content === "string"
            ? msg.content.match(/Message: (.*?)(?:\. Note:|$)/)?.[1] || msg.content
            : "No message content available");
          const note = msg.note || (msg.content && typeof msg.content === "string"
            ? msg.content.match(/\. Note: (.*?)\. If you need/)?.[1] || ""
            : "");
          const contact = msg.contact || (msg.content && typeof msg.content === "string"
            ? msg.content.match(/contact (.*?)\. Sent on/)?.[1] || "N/A"
            : "N/A");

          return {
            id: msg.id || `temp-id-${index}`,
            recipientId: msg.recipientId || null,
            recipientName: msg.recipientName || "Unknown",
            recipientRole: msg.recipientRole || "N/A",
            subject,
            message: messageContent,
            note,
            contact,
            type: msg.messageType || "direct",
            status: msg.status || "sent",
            createdAt: msg.createdAt || new Date(),
            recipientCategory: msg.recipientId ? "meedian_family" : "non_meedian",
            customWhatsappNumber: msg.customWhatsappNumber || null,
          };
        } catch (err) {
          console.error(`Error processing message at index ${index}:`, err, msg);
          return null;
        }
      })
      .filter(msg => msg !== null); // Remove invalid messages

    console.log("Processed allMessages:", { userId, count: allMessages.length });
    return NextResponse.json({ messages: allMessages });
  } catch (error) {
    console.error("Error fetching sent messages:", error);
    return NextResponse.json(
      { error: `Failed to fetch sent messages: ${error.message}` },
      { status: 500 }
    );
  }
}