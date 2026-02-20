import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let payload = {};
    if (contentType.includes("application/json")) {
      payload = await request.json().catch(() => ({}));
    } else {
      const form = await request.formData();
      payload = Object.fromEntries(form.entries());
    }

    // For now, just log; integrate with your DB/interaction log if needed
    console.log("Exotel status callback:", payload);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Exotel status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
