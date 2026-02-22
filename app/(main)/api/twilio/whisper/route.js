const xmlEscape = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const build = (say) => {
  const text = (say || "").trim() || "Please stay connected while we connect you.";
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${xmlEscape(text)}</Say>
  <Pause length="1"/>
</Response>`;
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const xml = build(searchParams.get("say") || "");
  return new Response(xml, { status: 200, headers: { "Content-Type": "text/xml" } });
}

export async function POST(request) {
  const { searchParams } = new URL(request.url);
  let say = searchParams.get("say") || "";
  if (!say) {
    try {
      const form = await request.formData();
      say = form.get("say") || "";
    } catch {}
  }
  const xml = build(say);
  return new Response(xml, { status: 200, headers: { "Content-Type": "text/xml" } });
}

