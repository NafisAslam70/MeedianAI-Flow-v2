import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { submitAcademicHealthReport, ValidationError } from "@/lib/academicHealthReports";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ensureSession = async () => {
  const session = await auth();
  if (!session || !session.user) {
    throw new ValidationError("Unauthorized");
  }
  return session;
};

export async function POST(req, { params }) {
  try {
    const session = await ensureSession();
    const reportId = Number(params?.reportId);
    if (!reportId || Number.isNaN(reportId)) {
      throw new ValidationError("Invalid report id");
    }

    let body;
    try {
      body = await req.json();
    } catch {
      throw new ValidationError("Invalid JSON body");
    }

    const actorUserId = Number(session.user.id);
    const actorRole = session.user.role;

    const report = await submitAcademicHealthReport(reportId, body, { actorUserId, actorRole });
    return NextResponse.json({ report }, { status: 200 });
  } catch (error) {
    if (error instanceof ValidationError && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message, details: error.details || null }, { status: 400 });
    }
    console.error(`POST /api/reports/academic-health/${params?.reportId}/submit error:`, error);
    return NextResponse.json({ error: "Failed to submit report" }, { status: 500 });
  }
}
