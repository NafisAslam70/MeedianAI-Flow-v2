import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(req) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { signal, userId, recipientId } = await req.json();
    if (!signal || !userId || !recipientId) {
      return NextResponse.json({ error: "Missing signal, userId, or recipientId" }, { status: 400 });
    }

    if (req.socket?.server?.io) {
      req.socket.server.io.to(recipientId.toString()).emit("webrtc-signal", { signal, userId });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error handling WebRTC signal:", error);
    return NextResponse.json({ error: `Failed to handle signal: ${error.message}` }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ signals: [] });
  } catch (error) {
    console.error("Error fetching WebRTC signals:", error);
    return NextResponse.json({ error: `Failed to fetch signals: ${error.message}`, signals: [] }, { status: 500 });
  }
}