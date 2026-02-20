import { NextResponse } from "next/server";

const REQUIRED_ENV = ["EXOTEL_ACCOUNT_SID", "EXOTEL_API_KEY", "EXOTEL_API_TOKEN", "EXOTEL_VIRTUAL_NUMBER"];

export async function POST(request) {
  try {
    for (const key of REQUIRED_ENV) {
      if (!process.env[key]) {
        return NextResponse.json({ error: `Missing env var ${key}` }, { status: 500 });
      }
    }

    const body = await request.json().catch(() => ({}));
    const from = typeof body?.from === "string" ? body.from.trim() : "";
    const to = typeof body?.to === "string" ? body.to.trim() : "";

    if (!from || !to) {
      return NextResponse.json({ error: "from and to are required" }, { status: 400 });
    }

    const accountSid = process.env.EXOTEL_ACCOUNT_SID;
    const apiKey = process.env.EXOTEL_API_KEY;
    const apiToken = process.env.EXOTEL_API_TOKEN;
    const callerId = process.env.EXOTEL_VIRTUAL_NUMBER;
    const subdomain = process.env.EXOTEL_SUBDOMAIN || "api.exotel.com";

    const params = new URLSearchParams();
    params.append("From", from);
    params.append("To", to);
    params.append("CallerId", callerId);
    // Optional: if you have a flow URL, include it via env
    if (process.env.EXOTEL_FLOW_URL) params.append("Url", process.env.EXOTEL_FLOW_URL);

    const resp = await fetch(`https://${subdomain}/v1/Accounts/${accountSid}/Calls/connect`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${apiKey}:${apiToken}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return NextResponse.json(
        { error: data?.RestException?.Message || "Failed to start call", detail: data },
        { status: resp.status }
      );
    }

    return NextResponse.json(
      {
        callSid: data?.Call?.Sid || data?.CallSid,
        status: data?.Call?.Status || data?.CallStatus || "initiated",
        raw: data,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Exotel start error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
