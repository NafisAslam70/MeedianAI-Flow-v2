import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enrollmentGuardianInteractions } from "@/lib/schema";
import { eq } from "drizzle-orm";

const normalizeSid = (value) => {
  if (!value) return "";
  return String(value).trim();
};

export async function POST(request) {
  try {
    const formData = await request.formData();
    const messageSid =
      normalizeSid(formData.get("MessageSid")) ||
      normalizeSid(formData.get("SmsMessageSid")) ||
      normalizeSid(formData.get("SmsSid"));
    const status = String(formData.get("MessageStatus") || "").trim();

    if (!messageSid || !status) {
      return NextResponse.json({ success: true });
    }

    await db
      .update(enrollmentGuardianInteractions)
      .set({ whatsappStatus: status })
      .where(eq(enrollmentGuardianInteractions.whatsappMessageId, messageSid));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("WhatsApp status callback error:", error);
    return NextResponse.json({ error: "Status callback error" }, { status: 500 });
  }
}
