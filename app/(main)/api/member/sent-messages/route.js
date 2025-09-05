import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { directWhatsappMessages, users, messages, nonMeeDianMessages } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";

// Fetch sent Direct WhatsApp messages grouped as Meedian vs Non-Meedian
export async function GET(req) {
  try {
    const session = await auth();
    if (!session || !session.user || !["admin", "team_manager"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Unauthorized: Admin or Team Manager access required" },
        { status: 401 }
      );
    }

    const userId = Number(session.user.id);
    const { searchParams } = new URL(req.url);
    const mode = (searchParams.get("mode") || "all").toLowerCase(); // all | direct | legacy | custom

    // Query the consolidated table. We persist recipientName/number at send-time,
    // so a join is optional; still fetch role for existing recipients when possible.
    // Helper to safely parse legacy combined content
    const parseFromContent = (content) => {
      if (typeof content !== "string") return { subject: "N/A", message: "", note: "", contact: "" };
      const subject = content.match(/Subject: (.*?)\. Message:/)?.[1] || "N/A";
      const message = content.match(/Message: (.*?)(?:\. Note:|$)/)?.[1] || content;
      const note = content.match(/\. Note: (.*?)\. If you need/)?.[1] || "";
      const contact = content.match(/contact (.*?)\. Sent on/)?.[1] || "";
      return { subject, message, note, contact };
    };

    // 1) Consolidated
    let consolidated = [];
    try {
      const rows = await db
        .select({
          id: directWhatsappMessages.id,
          senderId: directWhatsappMessages.senderId,
          recipientType: directWhatsappMessages.recipientType,
          recipientUserId: directWhatsappMessages.recipientUserId,
          recipientName: directWhatsappMessages.recipientName,
          recipientWhatsappNumber: directWhatsappMessages.recipientWhatsappNumber,
          subject: directWhatsappMessages.subject,
          message: directWhatsappMessages.message,
          note: directWhatsappMessages.note,
          contact: directWhatsappMessages.contact,
          status: directWhatsappMessages.status,
          createdAt: directWhatsappMessages.createdAt,
          userRole: users.role,
          userName: users.name,
        })
        .from(directWhatsappMessages)
        .leftJoin(users, eq(directWhatsappMessages.recipientUserId, users.id))
        .where(eq(directWhatsappMessages.senderId, userId))
        .orderBy(desc(directWhatsappMessages.createdAt));

      consolidated = rows.map((r, i) => ({
        id: r.id ?? `dwm-${i}`,
        recipientId: r.recipientUserId || null,
        recipientName: r.recipientName || r.userName || "Unknown",
        recipientRole: r.userRole || "N/A",
        subject: r.subject || "N/A",
        message: r.message || "",
        note: r.note || "",
        contact: r.contact || "",
        type: "direct",
        status: r.status || "sent",
        createdAt: r.createdAt || new Date(),
        recipientCategory: r.recipientType === "existing" ? "meedian_family" : "non_meedian",
        customWhatsappNumber: r.recipientType === "custom" ? r.recipientWhatsappNumber : null,
        source: "direct",
      }));
    } catch (e) {
      console.warn("direct_whatsapp_messages fetch failed, falling back to legacy only:", e?.message || e);
    }

    // 2) Legacy: meedian (existing users)
    let legacyMeedian = [];
    try {
      const rows = await db
        .select({
          id: messages.id,
          recipientId: messages.recipientId,
          subject: messages.subject,
          message: messages.message,
          note: messages.note,
          contact: messages.contact,
          status: messages.status,
          createdAt: messages.createdAt,
          content: messages.content,
          userName: users.name,
          userRole: users.role,
        })
        .from(messages)
        .leftJoin(users, eq(messages.recipientId, users.id))
        .where(eq(messages.senderId, userId))
        .orderBy(desc(messages.createdAt));

      legacyMeedian = rows.map((r, i) => {
        const parsed = parseFromContent(r.content);
        return {
          id: r.id ?? `msg-${i}`,
          recipientId: r.recipientId || null,
          recipientName: r.userName || "Unknown",
          recipientRole: r.userRole || "N/A",
          subject: r.subject || parsed.subject || "N/A",
          message: r.message || parsed.message || "",
          note: r.note || parsed.note || "",
          contact: r.contact || parsed.contact || "",
          type: "direct",
          status: r.status || "sent",
          createdAt: r.createdAt || new Date(),
          recipientCategory: "meedian_family",
          customWhatsappNumber: null,
          source: "legacy",
        };
      });
    } catch (e) {
      console.warn("messages (legacy) fetch failed:", e?.message || e);
    }

    // 3) Legacy: non-meedian (custom recipients)
    let legacyNon = [];
    try {
      const rows = await db
        .select({
          id: nonMeeDianMessages.id,
          customName: nonMeeDianMessages.customName,
          customWhatsappNumber: nonMeeDianMessages.customWhatsappNumber,
          subject: nonMeeDianMessages.subject,
          message: nonMeeDianMessages.message,
          note: nonMeeDianMessages.note,
          contact: nonMeeDianMessages.contact,
          status: nonMeeDianMessages.status,
          createdAt: nonMeeDianMessages.createdAt,
        })
        .from(nonMeeDianMessages)
        .where(eq(nonMeeDianMessages.senderId, userId))
        .orderBy(desc(nonMeeDianMessages.createdAt));

      legacyNon = rows.map((r, i) => ({
        id: r.id ?? `nmm-${i}`,
        recipientId: null,
        recipientName: r.customName || "Unknown",
        recipientRole: "N/A",
        subject: r.subject || "N/A",
        message: r.message || "",
        note: r.note || "",
        contact: r.contact || "",
        type: "direct",
        status: r.status || "sent",
        createdAt: r.createdAt || new Date(),
        recipientCategory: "non_meedian",
        customWhatsappNumber: r.customWhatsappNumber || null,
        source: "legacy_non",
      }));
    } catch (e) {
      console.warn("non_meedian_messages (legacy) fetch failed:", e?.message || e);
    }

    // Select set by mode, then sort desc by createdAt
    let selected;
    if (mode === "custom") {
      // Only consolidated rows to custom recipients (non-Meedian)
      selected = consolidated.filter((m) => m.recipientCategory === "non_meedian");
    } else if (mode === "direct") {
      selected = consolidated;
    } else if (mode === "legacy") {
      selected = [...legacyMeedian, ...legacyNon];
    } else {
      selected = [...consolidated, ...legacyMeedian, ...legacyNon];
    }

    const all = selected.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({ messages: all });
  } catch (error) {
    console.error("Error fetching sent messages (direct_whatsapp_messages):", error);
    return NextResponse.json(
      { error: `Failed to fetch sent messages: ${error.message}` },
      { status: 500 }
    );
  }
}
