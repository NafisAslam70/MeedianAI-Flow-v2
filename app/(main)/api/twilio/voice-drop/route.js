const xmlEscape = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const build = (say, recordResponse) => {
  const safeSay = xmlEscape(say || "Hello from Meedian. This is an automated call.");
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${safeSay}</Say>
  ${
    recordResponse
      ? '<Record maxLength="30" playBeep="true" timeout="5" />'
      : ""
  }
  <Hangup />
</Response>`;
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const record = searchParams.get("record") === "1";
  const xml = build(searchParams.get("say"), record);
  return new Response(xml, { status: 200, headers: { "Content-Type": "text/xml" } });
}

export async function POST(request) {
  const { searchParams } = new URL(request.url);
  let say = searchParams.get("say") || "";
  let record = searchParams.get("record") === "1";
  try {
    const form = await request.formData();
    if (!say) say = form.get("say") || "";
    if (!record) record = (form.get("record") || "") === "1";
  } catch {}
  const xml = build(say, record);
  return new Response(xml, { status: 200, headers: { "Content-Type": "text/xml" } });
}
