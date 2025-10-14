import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { approveAcademicHealthReport, ValidationError } from "@/lib/academicHealthReports";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ensureSession = async () => {
  const session = await auth();
  if (!session || !session.user) {
    throw new ValidationError("Unauthorized");
  }
  return session;
};

export async function POST(_req, { params }) {
  try {
    const session = await ensureSession();
    const reportId = Number(params?.reportId);
    if (!reportId || Number.isNaN(reportId)) {
      throw new ValidationError("Invalid report id");
    }
    const report = await approveAcademicHealthReport(reportId, { actorRole: session.user.role });
    return NextResponse.json({ report }, { status: 200 });
  } catch (error) {
    if (error instanceof ValidationError && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message, details: error.details || null }, { status: 400 });
    }
    console.error(`POST /api/reports/academic-health/${params?.reportId}/approve error:`, error);
    return NextResponse.json({ error: "Failed to approve report" }, { status: 500 });
  }
}
