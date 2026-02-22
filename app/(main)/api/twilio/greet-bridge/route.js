const xmlEscape = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const build = (agent, say, record) => {
  const safeAgent = (agent || "").trim();
  if (!safeAgent) return null;
  const callerId = process.env.TWILIO_CALLER_ID || "";
  const safeSay = xmlEscape(say || "Please stay connected while we connect you.");
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${safeSay}</Say>
  <Dial${callerId ? ` callerId="${callerId}"` : ""}${record ? ' record="record-from-answer"' : ""}>
    <Number>${xmlEscape(safeAgent)}</Number>
  </Dial>
</Response>`;
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const xml = build(
    searchParams.get("agent"),
    searchParams.get("say"),
    searchParams.get("record") === "1"
  );
  if (!xml) return new Response("Missing agent", { status: 400 });
  return new Response(xml, { status: 200, headers: { "Content-Type": "text/xml" } });
}

export async function POST(request) {
  const { searchParams } = new URL(request.url);
  let agent = searchParams.get("agent") || "";
  let say = searchParams.get("say") || "";
  let record = searchParams.get("record") === "1";
  if (!agent) {
    try {
      const form = await request.formData();
      agent = form.get("agent") || form.get("Agent") || "";
      if (!say) say = form.get("say") || "";
      if (!record) record = (form.get("record") || "") === "1";
    } catch {}
  }
  const xml = build(agent, say, record);
  if (!xml) return new Response("Missing agent", { status: 400 });
  return new Response(xml, { status: 200, headers: { "Content-Type": "text/xml" } });
}
