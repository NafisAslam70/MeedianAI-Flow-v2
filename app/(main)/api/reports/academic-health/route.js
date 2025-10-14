import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createAcademicHealthReport,
  listAcademicHealthReports,
  getAcademicHealthReportSupportingData,
  ValidationError,
} from "@/lib/academicHealthReports";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ensureSession = async () => {
  const session = await auth();
  if (!session || !session.user) {
    throw new ValidationError("Unauthorized");
  }
  return session;
};

const isManager = (role) => ["admin", "team_manager"].includes(role);

export async function GET(req) {
  try {
    const session = await ensureSession();
    const { searchParams } = new URL(req.url);
    const mode = (searchParams.get("mode") || "").toLowerCase();

    if (mode === "supporting") {
      const assignedParam = searchParams.get("assignedToUserId");
      const reportDate = searchParams.get("reportDate");
      const assignedToUserId = assignedParam ? Number(assignedParam) : Number(session.user.id);

      if (!isManager(session.user.role) && assignedToUserId !== Number(session.user.id)) {
        throw new ValidationError("Unauthorized");
      }

      const payload = await getAcademicHealthReportSupportingData({
        assignedToUserId,
        reportDate,
      });
      return NextResponse.json(payload, { status: 200 });
    }

    const date = searchParams.get("date") || null;
    const status = searchParams.get("status") || null;
    const siteIdParam = searchParams.get("siteId") || null;
    const assignedParam = searchParams.get("assignedToUserId") || null;

    let assignedToUserId = assignedParam ? Number(assignedParam) : null;
    if (!isManager(session.user.role)) {
      assignedToUserId = Number(session.user.id);
    } else if (assignedToUserId && Number.isNaN(Number(assignedToUserId))) {
      assignedToUserId = null;
    }

    const siteId = siteIdParam && !Number.isNaN(Number(siteIdParam)) ? Number(siteIdParam) : null;
    const reports = await listAcademicHealthReports({
      date,
      status: status || null,
      siteId,
      assignedToUserId,
    });
    return NextResponse.json({ reports }, { status: 200 });
  } catch (error) {
    if (error instanceof ValidationError && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message, details: error.details || null }, { status: 400 });
    }
    console.error("GET /api/reports/academic-health error:", error);
    return NextResponse.json({ error: "Failed to load reports" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await ensureSession();
    let body;
    try {
      body = await req.json();
    } catch {
      throw new ValidationError("Invalid JSON body");
    }
    const { reportDate, siteId, assignedToUserId, checkMode } = body || {};

    const actorId = Number(session.user.id);
    const actorRole = session.user.role;
    const targetAssignedId = Number(assignedToUserId || actorId);

    if (!isManager(actorRole) && targetAssignedId !== actorId) {
      throw new ValidationError("Unauthorized to create report for another user");
    }

    const report = await createAcademicHealthReport({
      reportDate,
      siteId,
      assignedToUserId: targetAssignedId,
      checkMode,
      createdByUserId: actorId,
    });
    return NextResponse.json({ report }, { status: 200 });
  } catch (error) {
    if (error instanceof ValidationError && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message, details: error.details || null }, { status: 400 });
    }
    console.error("POST /api/reports/academic-health error:", error);
    return NextResponse.json({ error: "Failed to create report" }, { status: 500 });
  }
}
