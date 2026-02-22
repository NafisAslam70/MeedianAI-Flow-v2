// Twilio will POST/GET this URL from the TwiML App. It may send the number in query ?target
// or in the POST body as "To" (common for Client -> PSTN calls).
const xmlEscape = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const buildResponse = (target, whisper) => {
  const safeTarget = (target || "").trim();
  if (!safeTarget) return null;
  const callerId = process.env.TWILIO_CALLER_ID || "";
  const ringTone = process.env.TWILIO_GREET_RINGTONE || "in";
  const baseUrl =
    process.env.TWILIO_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_FRONTEND_URL ||
    process.env.NEXTAUTH_URL ||
    "";
  const normalizedBase = baseUrl.replace(/\/$/, "");
  const whisperUrl =
    whisper && normalizedBase.startsWith("https://")
      ? `${normalizedBase}/api/twilio/whisper?say=${encodeURIComponent(whisper)}`
      : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial answerOnBridge="true"${callerId ? ` callerId="${callerId}"` : ""}${ringTone ? ` ringTone="${xmlEscape(ringTone)}"` : ""}>
    <Number${whisperUrl ? ` url="${xmlEscape(whisperUrl)}"` : ""}>${xmlEscape(safeTarget)}</Number>
  </Dial>
</Response>`;
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("target") || searchParams.get("To") || "";
  const whisper = searchParams.get("whisper") || "";
  const xml = buildResponse(target, whisper);
  if (!xml) return new Response("Missing target", { status: 400 });
  return new Response(xml, { status: 200, headers: { "Content-Type": "text/xml" } });
}

export async function POST(request) {
  const { searchParams } = new URL(request.url);
  let target = searchParams.get("target") || searchParams.get("To") || "";
  let whisper = searchParams.get("whisper") || "";
  if (!target) {
    try {
      const form = await request.formData();
      target = form.get("target") || form.get("To") || "";
      if (!whisper) whisper = form.get("whisper") || "";
    } catch {
      // ignore parse errors; will fall through to missing target
    }
  }
  const xml = buildResponse(target, whisper);
  if (!xml) return new Response("Missing target", { status: 400 });
  return new Response(xml, { status: 200, headers: { "Content-Type": "text/xml" } });
}
