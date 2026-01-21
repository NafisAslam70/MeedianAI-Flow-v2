import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

const twilioClient = accountSid && authToken ? twilio(accountSid, authToken) : null;

function ensureClient() {
  if (!twilioClient) {
    throw new Error("Twilio credentials are not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)");
  }
  if (!process.env.TWILIO_WHATSAPP_NUMBER) {
    throw new Error("TWILIO_WHATSAPP_NUMBER is not configured");
  }
}

export async function sendWhatsappMessage(toNumber, content, recipient) {
  if (!toNumber) return null;
  if (recipient && recipient.whatsapp_enabled === false) return null;

  ensureClient();

  const formattedToNumber = toNumber.startsWith("+") ? toNumber : `+${toNumber}`;
  // Compose a readable body (plain text mode only)
  const subject = content.subject ? `*${content.subject}*\n` : "";
  const body = `${subject}${content.message || ""}`.trim() || "Notification";
  return twilioClient.messages.create({
    from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
    to: `whatsapp:${formattedToNumber}`,
    body,
  });
}

export async function sendWhatsappTemplate(toNumber, contentSid, variables, recipient) {
  if (!toNumber) return null;
  if (recipient && recipient.whatsapp_enabled === false) return null;

  ensureClient();
  if (!contentSid) {
    throw new Error("WhatsApp template SID is not configured");
  }

  const formattedToNumber = toNumber.startsWith("+") ? toNumber : `+${toNumber}`;
  const normalized = {};
  for (const [key, value] of Object.entries(variables || {})) {
    const text = value === null || value === undefined ? "" : String(value);
    const cleaned = text === "undefined" || text === "null" ? "" : text;
    normalized[String(key)] = cleaned.trim() ? cleaned : " ";
  }
  const contentVariables = JSON.stringify(normalized);
  try {
    const roundTrip = JSON.parse(contentVariables);
    if (!roundTrip || typeof roundTrip !== "object") {
      throw new Error("contentVariables not an object");
    }
  } catch (err) {
    throw new Error(`contentVariables JSON invalid: ${err?.message || err}`);
  }

  return twilioClient.messages.create({
    from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
    to: `whatsapp:${formattedToNumber}`,
    contentSid,
    contentVariables,
  });
}

// Explicit helper to always send body text (no template)
export async function sendWhatsappBody(toNumber, body) {
  ensureClient();
  if (!toNumber) return null;
  const formattedToNumber = toNumber.startsWith("+") ? toNumber : `+${toNumber}`;
  const text = (body || "").toString().trim() || "Notification";
  return twilioClient.messages.create({
    from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
    to: `whatsapp:${formattedToNumber}`,
    body: text,
  });
}
