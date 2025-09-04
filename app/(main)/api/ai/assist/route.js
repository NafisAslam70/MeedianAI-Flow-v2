import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const last = messages[messages.length - 1]?.content?.toLowerCase?.() || "";

    // Lightweight built-in intents
    if (/(current\s*mrn|what'?s\s*my\s*mrn|my\s*rituals\s*right\s*now)/i.test(last)) {
      // Proxy to existing endpoint for current MRN
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/member/meRightNow?action=current`, {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        credentials: "include",
      }).catch(() => null);
      const data = await res?.json().catch(() => ({}));
      const cur = data?.current;
      if (!cur) {
        return NextResponse.json({ reply: "You are currently in Rest and Recover (no active MRN)." });
      }
      const title = cur.itemTitle || "MRN";
      const since = cur.startedAt ? new Date(cur.startedAt).toLocaleTimeString() : "recently";
      return NextResponse.json({ reply: `Your current MRN is: ${title} (since ${since}).` });
    }

    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
    }

    const role = session.user.role;
    const system = [
      "You are DELU-GPT, a concise, role-aware assistant inside Meedian Flow.",
      "Speak briefly. Offer actionable steps.",
      "Capabilities by role:",
      "- member: help with current MRN, MRIs, day-close, routines.",
      "- team_manager: help with assigning tasks, routine trackers, approvals.",
      "- admin: help with adding users and configuration guidance.",
      "If the user asks for actions requiring UI, explain where to click in the app.",
    ].join(" \n");

    const payload = {
      model: OPENAI_CHAT_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "system", content: `User role: ${role}` },
        ...messages.map((m) => ({ role: m.role, content: String(m.content || "") })),
      ],
      temperature: 0.3,
    };

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      throw new Error(`OpenAI error ${aiRes.status}: ${txt}`);
    }
    const json = await aiRes.json();
    const reply = json?.choices?.[0]?.message?.content || "Sorry, I couldn't draft a reply.";
    return NextResponse.json({ reply });
  } catch (e) {
    console.error("assist error", e);
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}

