import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mgcpLeads } from "@/lib/schema";

const logContext = (request, extra = {}) => {
  const ua = request.headers.get("user-agent") || "unknown";
  const referer = request.headers.get("referer") || "none";
  console.warn("[public student-enquiry]", { ua, referer, ...extra });
};

// Public intake endpoint for landing-page enquiries.
// Inserts into mgcp_leads so managers can view them under
// Managerial Club → Student Enquiry (Random Leads).
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const organization = typeof body?.organization === "string" ? body.organization.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const source = typeof body?.source === "string" ? body.source.trim() : "landing-popup";

  // Optional simple shared-secret header: set PUBLIC_ENQUIRY_TOKEN to require it.
  const requiredToken = process.env.PUBLIC_ENQUIRY_TOKEN;
  if (requiredToken) {
    const headerToken = request.headers.get("x-public-token");
    if (!headerToken || headerToken !== requiredToken) {
      logContext(request, { status: "unauthorized", reason: !headerToken ? "missing token" : "token mismatch" });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const notesParts = [];
  if (organization) notesParts.push(`Org: ${organization}`);
  if (email) notesParts.push(`Email: ${email}`);
  if (message) notesParts.push(message);
  const notes = notesParts.length ? notesParts.join(" | ") : null;

  try {
    const [lead] = await db
      .insert(mgcpLeads)
      .values({
        beltId: null,
        guardianId: null,
        name,
        phone: phone || null,
        whatsapp: phone || null,
        location: null,
        source: source || "landing-popup",
        notes,
        category: "Landing Enquiry",
        status: "new",
        createdBy: null,
        createdAt: new Date(),
      })
      .returning();

    logContext(request, { status: "ok", leadId: lead?.id || null, source });
    return NextResponse.json({ ok: true, leadId: lead?.id || null });
  } catch (error) {
    logContext(request, { status: "db-failed", error: error?.message });
    console.error("[public student-enquiry] insert failed", error);
    return NextResponse.json({ error: "Failed to record enquiry" }, { status: 500 });
  }
}
