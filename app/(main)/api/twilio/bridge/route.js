// Twilio will POST/GET this URL from the TwiML App. It may send the number in query ?target
// or in the POST body as "To" (common for Client -> PSTN calls).
const buildResponse = (target) => {
  const safeTarget = (target || "").trim();
  if (!safeTarget) return null;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial record="record-from-answer">
    <Number>${safeTarget}</Number>
  </Dial>
</Response>`;
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("target") || searchParams.get("To") || "";
  const xml = buildResponse(target);
  if (!xml) return new Response("Missing target", { status: 400 });
  return new Response(xml, { status: 200, headers: { "Content-Type": "text/xml" } });
}

export async function POST(request) {
  const { searchParams } = new URL(request.url);
  let target = searchParams.get("target") || searchParams.get("To") || "";
  if (!target) {
    try {
      const form = await request.formData();
      target = form.get("target") || form.get("To") || "";
    } catch {
      // ignore parse errors; will fall through to missing target
    }
  }
  const xml = buildResponse(target);
  if (!xml) return new Response("Missing target", { status: 400 });
  return new Response(xml, { status: 200, headers: { "Content-Type": "text/xml" } });
}
