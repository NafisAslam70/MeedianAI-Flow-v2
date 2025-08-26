import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, messages } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import twilio from "twilio";

/* ------------------------------------------------------------------ */
/* Twilio helper */
/* ------------------------------------------------------------------ */
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function sendWhatsappMessage(toNumber, content, recipient) {
  if (!toNumber || !recipient?.whatsapp_enabled) return;

  // Ensure phone number is in E.164 format
  const formattedToNumber = toNumber.startsWith('+') ? toNumber : `+${toNumber}`;

  try {
    return await twilioClient.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:${formattedToNumber}`,
      contentSid: "HX57c67bff3f94d904a0959d2ae00b061b", // Replace with actual Twilio content SID
      contentVariables: JSON.stringify({
        1: content.recipientName || "User",
        2: content.senderName || "System",
        3: content.subject || "No Subject",
        4: content.message || "No Message",
        5: content.note || "No Note",
        6: content.contact || "Support Team",
        7: content.dateTime || new Date().toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      }),
    });
  } catch (err) {
    console.error("Twilio sendWhatsappMessage error:", err);
    throw new Error(`Failed to send WhatsApp message: ${err.message}`);
  }
}

/* ================================================================== */
/* POST – Send a direct WhatsApp message */
/* ================================================================== */
export async function POST(req) {
  try {
    const session = await auth();
    if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number(session.user.id);
    const { recipientId, customName, customWhatsappNumber, subject, message, note = "", contact } = await req.json();

    // Validate input: either recipientId or (customName and customWhatsappNumber) must be provided
    const isCustomRecipient = !recipientId && customName?.trim() && customWhatsappNumber?.trim();
    const isExistingUser = Number.isInteger(recipientId);
    if (!isExistingUser && !isCustomRecipient) {
      return NextResponse.json({ error: "Invalid input: either recipientId or (customName and customWhatsappNumber) are required" }, { status: 400 });
    }
    if (!subject?.trim() || !message?.trim() || !contact?.trim()) {
      return NextResponse.json({ error: "Invalid input: subject, message, and contact are required" }, { status: 400 });
    }

    // Get sender info
    const [sender] = await db
      .select({ name: users.name, whatsapp_number: users.whatsapp_number })
      .from(users)
      .where(eq(users.id, userId));

    if (!sender) {
      return NextResponse.json({ error: "Sender not found" }, { status: 404 });
    }

    let recipientData;
    if (isExistingUser) {
      // Fetch recipient from database
      const [recipient] = await db
        .select({
          id: users.id,
          name: users.name,
          whatsapp_number: users.whatsapp_number,
          whatsapp_enabled: users.whatsapp_enabled,
        })
        .from(users)
        .where(eq(users.id, recipientId));

      if (!recipient) {
        return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
      }
      recipientData = {
        name: recipient.name,
        whatsapp_number: recipient.whatsapp_number,
        whatsapp_enabled: recipient.whatsapp_enabled,
      };
    } else {
      // Use custom recipient data
      recipientData = {
        name: customName.trim(),
        whatsapp_number: customWhatsappNumber.trim(),
        whatsapp_enabled: true, // Assume enabled for custom recipients
      };
    }

    // Validate phone number format for custom recipients
    if (isCustomRecipient && !/^\+?[1-9]\d{1,14}$/.test(recipientData.whatsapp_number)) {
      return NextResponse.json({ error: "Invalid WhatsApp number format" }, { status: 400 });
    }

    const now = new Date();
    const notification = `Hi ${recipientData.name}, ${sender.name} has sent you a new message. Subject: ${subject}. Message: ${message}${note.trim() ? `. Note: ${note.trim()}` : ""}. If you need assistance, please contact ${contact}. Sent on ${now.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}. Please kindly check the MeedianAI portal for more information [https://meedian-ai-flow.vercel.app/]`;

    // Store message in database (only for existing users)
    if (isExistingUser) {
      await db.insert(messages).values({
        senderId: userId,
        recipientId,
        content: notification,
        createdAt: now,
        status: "sent",
      });
    }

    // Send WhatsApp message if enabled
    if (recipientData.whatsapp_enabled && recipientData.whatsapp_number) {
      await sendWhatsappMessage(
        recipientData.whatsapp_number,
        {
          recipientName: recipientData.name,
          senderName: sender.name,
          subject,
          message,
          note: note.trim() || "",
          contact,
          dateTime: now.toLocaleString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
        recipientData
      );
    }

    return NextResponse.json({ ok: true, message: "Message sent successfully" }, { status: 200 });
  } catch (err) {
    console.error("POST /member/direct-message error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}