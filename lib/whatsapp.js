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
