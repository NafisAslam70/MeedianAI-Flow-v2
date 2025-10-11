import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMemberReports, updateMriReportInstance } from "@/lib/mriReports";

export async function GET(req) {
  const session = await auth();
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const date = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);

  try {
    const payload = await getMemberReports({ userId: Number(session.user.id), targetDate: date });
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    console.error("GET /api/member/mri-reports error:", error);
    return NextResponse.json({ error: error.message || "Failed to load MRI reports" }, { status: 500 });
  }
}

export async function POST(req) {
  const session = await auth();
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = Number(session.user.id);
  const role = session.user.role;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { instanceId, payload, action = "draft", confirmationNote } = body || {};

  if (!instanceId || Number.isNaN(Number(instanceId))) {
    return NextResponse.json({ error: "instanceId is required" }, { status: 400 });
  }

  try {
    const instance = await updateMriReportInstance({
      instanceId: Number(instanceId),
      userId,
      role,
      payload,
      action,
      confirmationNote,
    });
    return NextResponse.json({ instance }, { status: 200 });
  } catch (error) {
    console.error("POST /api/member/mri-reports error:", error);
    return NextResponse.json({ error: error.message || "Failed to update report" }, { status: 500 });
  }
}
