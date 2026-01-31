import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  enrollmentGuardians,
  enrollmentGuardianInteractions,
  enrollmentGuardianChildren,
  enrollmentCommunicationTemplates,
} from "@/lib/schema";
import { desc, eq, inArray, sql } from "drizzle-orm";
import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;
const twilioClient = accountSid && authToken ? twilio(accountSid, authToken) : null;

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const ensureTwilioReady = () => {
  if (!twilioClient || !whatsappNumber) {
    return NextResponse.json({ error: "Twilio WhatsApp is not configured" }, { status: 500 });
  }
  return null;
};

export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user?.role || !["admin", "team_manager"].includes(session.user.role)) {
      return unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "templates") {
      const templates = await db
        .select()
        .from(enrollmentCommunicationTemplates)
        .where(eq(enrollmentCommunicationTemplates.isActive, true))
        .orderBy(enrollmentCommunicationTemplates.category, enrollmentCommunicationTemplates.name);

      return NextResponse.json({ templates });
    }

    if (action === "recent-messages") {
      const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 50)));

      const recentMessages = await db
        .select({
          id: enrollmentGuardianInteractions.id,
          type: enrollmentGuardianInteractions.type,
          content: enrollmentGuardianInteractions.content,
          createdAt: enrollmentGuardianInteractions.createdAt,
          whatsappStatus: enrollmentGuardianInteractions.whatsappStatus,
          guardianName: enrollmentGuardians.name,
          guardianWhatsapp: enrollmentGuardians.whatsapp,
        })
        .from(enrollmentGuardianInteractions)
        .leftJoin(
          enrollmentGuardians,
          eq(enrollmentGuardianInteractions.guardianId, enrollmentGuardians.id)
        )
        .where(eq(enrollmentGuardianInteractions.type, "whatsapp"))
        .orderBy(desc(enrollmentGuardianInteractions.createdAt))
        .limit(limit);

      return NextResponse.json({ messages: recentMessages });
    }

    if (action === "by-guardian") {
      const guardianId = Number(searchParams.get("guardianId"));
      const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 50)));
      if (!Number.isFinite(guardianId)) {
        return NextResponse.json({ error: "guardianId required" }, { status: 400 });
      }

      const interactions = await db
        .select()
        .from(enrollmentGuardianInteractions)
        .where(eq(enrollmentGuardianInteractions.guardianId, guardianId))
        .orderBy(desc(enrollmentGuardianInteractions.createdAt))
        .limit(limit);

      return NextResponse.json({ interactions });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error fetching communications:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.role || !["admin", "team_manager"].includes(session.user.role)) {
      return unauthorized();
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const action = body?.action;

    if (action === "send-message") {
      return await sendWhatsAppMessage(body, session);
    }

    if (action === "send-bulk") {
      return await sendBulkMessages(body, session);
    }

    if (action === "create-template") {
      return await createTemplate(body, session);
    }

    if (action === "log-interaction") {
      return await logInteraction(body, session);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error in communications:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function sendWhatsAppMessage(body, session) {
  const twilioError = ensureTwilioReady();
  if (twilioError) return twilioError;

  const guardianId = Number(body?.guardianId);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const templateId = body?.templateId ? Number(body.templateId) : null;
  const variables = body?.variables || null;
  const directTemplateSid =
    typeof body?.templateSid === "string" ? body.templateSid.trim() : "";
  const directVariables =
    body?.templateVariables && typeof body.templateVariables === "object"
      ? body.templateVariables
      : null;

  if (!Number.isFinite(guardianId)) {
    return NextResponse.json({ error: "Guardian ID required" }, { status: 400 });
  }

  const guardiansResult = await db
    .select()
    .from(enrollmentGuardians)
    .where(eq(enrollmentGuardians.id, guardianId))
    .limit(1);

  if (!guardiansResult.length) {
    return NextResponse.json({ error: "Guardian not found" }, { status: 404 });
  }

  const guardianData = guardiansResult[0];
  const childrenRows = await db
    .select()
    .from(enrollmentGuardianChildren)
    .where(eq(enrollmentGuardianChildren.guardianId, guardianId));
  const childrenNames = childrenRows.map((child) => child.name).filter(Boolean).join(", ");

  if (!guardianData.whatsapp) {
    return NextResponse.json({ error: "Guardian WhatsApp number is missing" }, { status: 400 });
  }
  let messageContent = message;
  let templateSid = directTemplateSid || null;
  let contentVariables = directVariables || {};

  if (!templateSid && templateId) {
    const templates = await db
      .select()
      .from(enrollmentCommunicationTemplates)
      .where(eq(enrollmentCommunicationTemplates.id, templateId))
      .limit(1);

    if (templates.length) {
      const template = templates[0];
      messageContent = template.contentHindi || template.contentEnglish || "";
      templateSid = template.whatsappTemplateId || null;

      const standardVars = {
        guardian_name: guardianData.name,
        children_names: childrenNames,
        location: guardianData.location,
        school_name: "MEED Public School",
      };

      const mergedVars = { ...standardVars, ...(variables || {}) };
      contentVariables = {
        "1": mergedVars.guardian_name || "",
        "2": mergedVars.children_names || "",
        "3": mergedVars.location || "",
        "4": mergedVars.school_name || "",
      };

      Object.keys(mergedVars).forEach((key) => {
        contentVariables[key] = mergedVars[key];
      });

      Object.keys(mergedVars).forEach((key) => {
        if (mergedVars[key] === undefined || mergedVars[key] === null) return;
        messageContent = messageContent.replace(new RegExp(`{{${key}}}`, "g"), mergedVars[key]);
      });
    }
  }

  if (templateId && !templateSid) {
    return NextResponse.json(
      { error: "Selected template is not linked to an approved WhatsApp template." },
      { status: 400 }
    );
  }

  if (!messageContent && !templateSid) {
    return NextResponse.json({ error: "Message content required" }, { status: 400 });
  }

  try {
    const actorId = Number(session.user.id);
    const conductedBy = Number.isFinite(actorId) ? actorId : null;

    const messageParams = {
      from: `whatsapp:${whatsappNumber}`,
      to: `whatsapp:${guardianData.whatsapp}`,
    };

    if (templateSid) {
      messageParams.contentSid = templateSid;
      const safeVariables = {};
      Object.keys(contentVariables || {}).forEach((key) => {
        const value = contentVariables[key];
        safeVariables[key] = value === undefined || value === null ? "" : String(value);
      });
      messageParams.contentVariables = JSON.stringify(safeVariables);
    } else {
      messageParams.body = messageContent;
    }

    const whatsappMessage = await twilioClient.messages.create(messageParams);

    const [interaction] = await db
      .insert(enrollmentGuardianInteractions)
      .values({
        guardianId,
        type: "whatsapp",
        method: "outgoing",
        content: messageContent,
        whatsappMessageId: whatsappMessage.sid,
        whatsappStatus: whatsappMessage.status,
        conductedBy,
        createdAt: new Date(),
      })
      .returning();

    await db
      .update(enrollmentGuardians)
      .set({
        lastContact: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(enrollmentGuardians.id, guardianId));

    return NextResponse.json({
      success: true,
      messageId: whatsappMessage.sid,
      interaction,
    });
  } catch (error) {
    console.error("Twilio error:", error);

    await db.insert(enrollmentGuardianInteractions).values({
      guardianId,
      type: "whatsapp",
      method: "outgoing",
      content: messageContent,
      whatsappStatus: "failed",
      outcome: "negative",
      conductedBy: Number.isFinite(Number(session.user.id)) ? Number(session.user.id) : null,
      createdAt: new Date(),
    });

    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}

async function sendBulkMessages(body, session) {
  const twilioError = ensureTwilioReady();
  if (twilioError) return twilioError;

  const guardianIds = Array.isArray(body?.guardianIds)
    ? body.guardianIds.map((id) => Number(id)).filter((id) => Number.isFinite(id))
    : [];
  const templateId = body?.templateId ? Number(body.templateId) : null;
  const variables = body?.variables || {};

  if (!templateId) {
    return NextResponse.json({ error: "Template ID required for bulk messages" }, { status: 400 });
  }

  if (!guardianIds.length) {
    return NextResponse.json({ error: "Guardian IDs required" }, { status: 400 });
  }

  const templateRows = await db
    .select()
    .from(enrollmentCommunicationTemplates)
    .where(eq(enrollmentCommunicationTemplates.id, templateId))
    .limit(1);

  if (!templateRows.length) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const baseContent = templateRows[0].contentHindi || templateRows[0].contentEnglish || "";
  if (!baseContent) {
    return NextResponse.json({ error: "Template content is empty" }, { status: 400 });
  }

  const guardiansList = await db
    .select()
    .from(enrollmentGuardians)
    .where(inArray(enrollmentGuardians.id, guardianIds))
    .limit(100);

  if (!guardiansList.length) {
    return NextResponse.json({ error: "No guardians found for bulk send" }, { status: 404 });
  }

  const results = {
    successful: 0,
    failed: 0,
    details: [],
  };

  const actorId = Number(session.user.id);
  const conductedBy = Number.isFinite(actorId) ? actorId : null;

  for (const guardian of guardiansList) {
    let messageContent = baseContent;
    try {
      const standardVars = {
        guardian_name: guardian.name,
        children_names: "",
        location: guardian.location,
      };

      const allVars = { ...standardVars, ...variables };
      Object.keys(allVars).forEach((key) => {
        messageContent = messageContent.replace(new RegExp(`{{${key}}}`, "g"), allVars[key]);
      });

      const whatsappMessage = await twilioClient.messages.create({
        body: messageContent,
        from: `whatsapp:${whatsappNumber}`,
        to: `whatsapp:${guardian.whatsapp}`,
      });

      await db.insert(enrollmentGuardianInteractions).values({
        guardianId: guardian.id,
        type: "whatsapp",
        method: "outgoing",
        content: messageContent,
        whatsappMessageId: whatsappMessage.sid,
        whatsappStatus: whatsappMessage.status,
        conductedBy,
        createdAt: new Date(),
      });

      results.successful += 1;
      results.details.push({
        guardianId: guardian.id,
        name: guardian.name,
        status: "sent",
        messageId: whatsappMessage.sid,
      });

      await db
        .update(enrollmentGuardians)
        .set({ lastContact: new Date(), updatedAt: new Date() })
        .where(eq(enrollmentGuardians.id, guardian.id));

      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Failed to send to ${guardian.name}:`, error);

      results.failed += 1;
      results.details.push({
        guardianId: guardian.id,
        name: guardian.name,
        status: "failed",
        error: error.message,
      });

      await db.insert(enrollmentGuardianInteractions).values({
        guardianId: guardian.id,
        type: "whatsapp",
        method: "outgoing",
        content: messageContent,
        whatsappStatus: "failed",
        outcome: "negative",
        conductedBy,
        createdAt: new Date(),
      });
    }
  }

  await db
    .update(enrollmentCommunicationTemplates)
    .set({
      usageCount: sql`${enrollmentCommunicationTemplates.usageCount} + ${results.successful}`,
      lastUsed: new Date(),
    })
    .where(eq(enrollmentCommunicationTemplates.id, templateId));

  return NextResponse.json({
    success: true,
    results,
    totalProcessed: guardiansList.length,
  });
}

async function logInteraction(body, session) {
  let guardianId = Number(body?.guardianId);
  const guardianName = typeof body?.guardianName === "string" ? body.guardianName.trim() : "";
  const guardianWhatsapp = typeof body?.guardianWhatsapp === "string" ? body.guardianWhatsapp.trim() : "";
  const guardianPhone = typeof body?.guardianPhone === "string" ? body.guardianPhone.trim() : "";
  const guardianLocation = typeof body?.guardianLocation === "string" ? body.guardianLocation.trim() : "";
  const type = typeof body?.type === "string" ? body.type.trim() : "";
  const method = typeof body?.method === "string" ? body.method.trim() : null;
  const content = typeof body?.content === "string" ? body.content.trim() : null;
  const duration = typeof body?.duration === "string" ? body.duration.trim() : null;
  const outcome = typeof body?.outcome === "string" ? body.outcome.trim() : null;
  const followUpRequired = Boolean(body?.followUpRequired);
  const followUpDate = body?.followUpDate ? new Date(body.followUpDate) : null;
  const followUpNotes = typeof body?.followUpNotes === "string" ? body.followUpNotes.trim() : null;

  if (!Number.isFinite(guardianId)) {
    // Try to find or create a guardian using phone/whatsapp
    const contact = guardianWhatsapp || guardianPhone;
    if (!contact || !guardianName) {
      return NextResponse.json({ error: "Guardian ID required" }, { status: 400 });
    }

    // Deduplicate by whatsapp (unique)
    const existing = await db
      .select({ id: enrollmentGuardians.id })
      .from(enrollmentGuardians)
      .where(eq(enrollmentGuardians.whatsapp, contact))
      .limit(1);

    if (existing.length) {
      guardianId = existing[0].id;
    } else {
      const [created] = await db
        .insert(enrollmentGuardians)
        .values({
          name: guardianName,
          whatsapp: contact,
          location: guardianLocation || "Unknown",
          status: "ongoing",
          engagementScore: 0,
          lastContact: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: Number(session.user.id),
          source: "ongoing_guardian_auto",
        })
        .returning({ id: enrollmentGuardians.id });
      guardianId = created.id;
    }
  }
  if (!type) {
    return NextResponse.json({ error: "Interaction type required" }, { status: 400 });
  }

  const actorId = Number(session.user.id);
  const conductedBy = Number.isFinite(actorId) ? actorId : null;

  const [interaction] = await db
    .insert(enrollmentGuardianInteractions)
    .values({
      guardianId,
      type,
      method,
      content,
      duration,
      outcome,
      followUpRequired,
      followUpDate,
      followUpNotes,
      conductedBy,
      createdAt: new Date(),
    })
    .returning();

  await db
    .update(enrollmentGuardians)
    .set({
      lastContact: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(enrollmentGuardians.id, guardianId));

  return NextResponse.json({ interaction }, { status: 201 });
}

async function createTemplate(body, session) {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const category = typeof body?.category === "string" ? body.category.trim() : "";
  const contentEnglish = typeof body?.contentEnglish === "string" ? body.contentEnglish.trim() : null;
  const contentHindi = typeof body?.contentHindi === "string" ? body.contentHindi.trim() : null;
  const contentUrdu = typeof body?.contentUrdu === "string" ? body.contentUrdu.trim() : null;
  const hasMediaAttachment = Boolean(body?.hasMediaAttachment);
  const mediaUrl = typeof body?.mediaUrl === "string" ? body.mediaUrl.trim() : null;

  if (!name || !category) {
    return NextResponse.json({ error: "name and category are required" }, { status: 400 });
  }

  const createdBy = Number(session.user.id);
  if (!Number.isFinite(createdBy)) {
    return unauthorized();
  }

  const [newTemplate] = await db
    .insert(enrollmentCommunicationTemplates)
    .values({
      name,
      category,
      contentEnglish,
      contentHindi,
      contentUrdu,
      hasMediaAttachment,
      mediaUrl,
      createdBy,
      createdAt: new Date(),
    })
    .returning();

  return NextResponse.json({ success: true, template: newTemplate });
}
