import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enrollmentGuardians, enrollmentGuardianInteractions } from "@/lib/schema";
import { eq } from "drizzle-orm";

const normalizeWhatsAppNumber = (value) => {
  if (!value) return "";
  return String(value).replace(/^whatsapp:/i, "").trim();
};

export async function POST(request) {
  try {
    const formData = await request.formData();
    const from = normalizeWhatsAppNumber(formData.get("From"));
    const body = formData.get("Body") || "";
    const messageSid =
      formData.get("MessageSid") || formData.get("SmsMessageSid") || formData.get("SmsSid") || null;
    const status = formData.get("MessageStatus") || "received";

    if (!from) {
      return NextResponse.json({ success: true });
    }

    const [guardian] = await db
      .select()
      .from(enrollmentGuardians)
      .where(eq(enrollmentGuardians.whatsapp, from))
      .limit(1);

    if (!guardian) {
      return NextResponse.json({ success: true });
    }

    await db.insert(enrollmentGuardianInteractions).values({
      guardianId: guardian.id,
      type: "whatsapp",
      method: "incoming",
      content: String(body || "").trim() || null,
      whatsappMessageId: messageSid,
      whatsappStatus: status,
      createdAt: new Date(),
    });

    await db
      .update(enrollmentGuardians)
      .set({ lastContact: new Date(), updatedAt: new Date() })
      .where(eq(enrollmentGuardians.id, guardian.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("WhatsApp webhook error:", error);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}
