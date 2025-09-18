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

const DEFAULT_CONTENT_SID = "HXb8745d2932e4f80f72b0733021f10106";

export async function sendWhatsappMessage(toNumber, content, recipient) {
  if (!toNumber) return null;
  if (recipient && recipient.whatsapp_enabled === false) return null;

  ensureClient();

  const formattedToNumber = toNumber.startsWith("+") ? toNumber : `+${toNumber}`;
  const templateSid = process.env.TWILIO_WHATSAPP_CONTENT_SID || DEFAULT_CONTENT_SID;

  return twilioClient.messages.create({
    from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
    to: `whatsapp:${formattedToNumber}`,
    contentSid: templateSid,
    contentVariables: JSON.stringify({
      1: content.recipientName || "User",
      2: content.senderName || "System",
      3: content.subject || "No Subject",
      4: content.message || "",
      5: content.note || "",
      6: content.contact || "",
      7: content.dateTime || new Date().toISOString(),
    }),
  });
}
