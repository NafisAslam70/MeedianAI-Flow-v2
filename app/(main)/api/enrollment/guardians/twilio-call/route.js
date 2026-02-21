import { NextResponse } from "next/server";

// Initiates a two-leg call: Twilio calls the agent first; on answer, TwiML bridges to guardian.
export async function POST(request) {
  try {
    const required = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_CALLER_ID"];
    for (const key of required) {
      if (!process.env[key]) return NextResponse.json({ error: `Missing ${key}` }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const guardianNumber = typeof body?.guardianNumber === "string" ? body.guardianNumber.trim() : "";
    const agentNumber =
      typeof body?.agentNumber === "string"
        ? body.agentNumber.trim()
        : process.env.NEXT_PUBLIC_DEFAULT_AGENT_NUMBER || "";

    if (!guardianNumber) return NextResponse.json({ error: "guardianNumber required" }, { status: 400 });
    if (!agentNumber) return NextResponse.json({ error: "agentNumber required" }, { status: 400 });

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_CALLER_ID;

    const baseUrl =
      process.env.TWILIO_PUBLIC_BASE_URL ||
      process.env.NEXT_PUBLIC_FRONTEND_URL ||
      process.env.NEXTAUTH_URL;

    if (!baseUrl || !baseUrl.startsWith("https://")) {
      return NextResponse.json(
        { error: "Set TWILIO_PUBLIC_BASE_URL (https) so Twilio can fetch TwiML." },
        { status: 500 }
      );
    }

    const bridgeUrl = `${baseUrl.replace(/\/$/, "")}/api/twilio/bridge?target=${encodeURIComponent(
      guardianNumber
    )}`;

    const params = new URLSearchParams();
    params.append("To", agentNumber);
    params.append("From", from);
    params.append("Url", bridgeUrl);

    const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const text = await resp.text();
    let data = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!resp.ok) {
      const msg = data?.message || data?.error_message || (typeof data?.raw === "string" ? data.raw : "Call failed");
      return NextResponse.json({ error: msg, detail: data }, { status: resp.status });
    }

    return NextResponse.json(
      {
        callSid: data?.sid,
        status: data?.status || "initiated",
        to: agentNumber,
        via: from,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Twilio call error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
