import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  users,
  messages,
  nonMeeDianMessages,          // ✅ add
  directWhatsappMessages,      // ✅ add (consolidated log)
} from "@/lib/schema";
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
  const formattedToNumber = toNumber.startsWith("+") ? toNumber : `+${toNumber}`;

  try {
    return await twilioClient.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:${formattedToNumber}`,
      contentSid: "HX57c67bff3f94d904a0959d2ae00b061b", // TODO: replace with your actual Content SID
      contentVariables: JSON.stringify({
        1: content.recipientName || "User",
        2: content.senderName ? `${content.senderName} (from Meed Leadership Group)` : "System (from Meed Leadership Group)",
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
      return NextResponse.json(
        { error: "Invalid input: either recipientId or (customName and customWhatsappNumber) are required" },
        { status: 400 }
      );
    }
    if (!subject?.trim() || !message?.trim() || !contact?.trim()) {
      return NextResponse.json(
        { error: "Invalid input: subject, message, and contact are required" },
        { status: 400 }
      );
    }

    // Get sender info
    const [sender] = await db
      .select({ id: users.id, name: users.name, whatsapp_number: users.whatsapp_number })
      .from(users)
      .where(eq(users.id, userId));

    if (!sender) {
      return NextResponse.json({ error: "Sender not found" }, { status: 404 });
    }

    // Resolve recipient
    let recipientData;
    if (isExistingUser) {
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
        id: recipient.id,
        name: recipient.name,
        whatsapp_number: recipient.whatsapp_number,
        whatsapp_enabled: recipient.whatsapp_enabled,
        type: "existing",
      };
    } else {
      // Use custom recipient data
      if (!/^\+?[1-9]\d{1,14}$/.test(customWhatsappNumber.trim())) {
        return NextResponse.json({ error: "Invalid WhatsApp number format" }, { status: 400 });
      }
      recipientData = {
        name: customName.trim(),
        whatsapp_number: customWhatsappNumber.trim(),
        whatsapp_enabled: true, // assume enabled for custom recipients
        type: "custom",
      };
    }

    const now = new Date();
    const compiled = `Hi ${recipientData.name}, ${sender.name} (from Meed Leadership Group) has sent you a new message. Subject: ${subject}. Message: ${message}${note.trim() ? `. Note: ${note.trim()}` : ""}. If you need assistance, please contact ${contact}. Sent on ${now.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}. Please kindly check the MeedianAI portal for more information [https://meedian-ai-flow.vercel.app/]`;

    // ------------------------------------------------------------------
    // Legacy writes (KEEP — so nothing interferes with existing features)
    // ------------------------------------------------------------------
    if (isExistingUser) {
      await db.insert(messages).values({
        senderId: userId,
        recipientId,
        // Fill the structured fields if present in your schema (safe to include)
        subject,
        message,
        note: note || null,
        contact,
        // Keep old combined content string for backward compatibility
        content: compiled,
        createdAt: now,
        status: "sent",
      });
    } else {
      // ✅ NEW: record custom recipients in non_meedian_messages
      await db.insert(nonMeeDianMessages).values({
        senderId: userId,
        customName: recipientData.name,
        customWhatsappNumber: recipientData.whatsapp_number,
        subject,
        message,
        note: note || null,
        contact,
        createdAt: now,
        status: "sent",
      });
    }

    // ------------------------------------------------------------------
    // Consolidated log (NEW) — always write one row for analytics/history
    // ------------------------------------------------------------------
    const [dwmRow] = await db
      .insert(directWhatsappMessages)
      .values({
        senderId: userId,
        recipientType: isExistingUser ? "existing" : "custom",
        recipientUserId: isExistingUser ? recipientData.id : null,
        recipientName: recipientData.name,
        recipientWhatsappNumber: recipientData.whatsapp_number || null,
        subject,
        message,
        note: note || null,
        contact,
        status: "sent",
        createdAt: now,
      })
      .returning({ id: directWhatsappMessages.id });

    // ------------------------------------------------------------------
    // Send WhatsApp (same behavior as before; throws -> 500)
    // If you want to always log SID/failure into consolidated table, we update it here.
    // ------------------------------------------------------------------
    try {
      if (recipientData.whatsapp_enabled && recipientData.whatsapp_number) {
        const tw = await sendWhatsappMessage(
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

        // Save SID in the consolidated table (optional but helpful)
        if (tw?.sid && dwmRow?.id) {
          // drizzle update
          await db
            .update(directWhatsappMessages)
            .set({ twilioSid: tw.sid })
            .where(eq(directWhatsappMessages.id, dwmRow.id));
        }
      }
    } catch (twilioErr) {
      // Mark consolidated row as failed (does not affect legacy behavior)
      if (dwmRow?.id) {
        await db
          .update(directWhatsappMessages)
          .set({
            status: "failed",
            error: `Twilio error: ${twilioErr?.message || String(twilioErr)}`,
          })
          .where(eq(directWhatsappMessages.id, dwmRow.id));
      }
      throw twilioErr; // keep previous response behavior (500)
    }

    return NextResponse.json({ ok: true, message: "Message sent successfully" }, { status: 200 });
  } catch (err) {
    console.error("POST /api/managersCommon/direct-message error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
