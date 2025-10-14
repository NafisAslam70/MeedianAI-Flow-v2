import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getAcademicHealthReportById,
  updateAcademicHealthReport,
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

export async function GET(_req, { params }) {
  try {
    const session = await ensureSession();
    const id = Number(params?.reportId);
    if (!id || Number.isNaN(id)) {
      throw new ValidationError("Invalid report id");
    }

    const report = await getAcademicHealthReportById(id);
    if (!report) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!isManager(session.user.role) && Number(report.assignedToUserId) !== Number(session.user.id)) {
      throw new ValidationError("Unauthorized");
    }

    return NextResponse.json({ report }, { status: 200 });
  } catch (error) {
    if (error instanceof ValidationError && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message, details: error.details || null }, { status: 400 });
    }
    console.error(`GET /api/reports/academic-health/${params?.reportId} error:`, error);
    return NextResponse.json({ error: "Failed to load report" }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const session = await ensureSession();
    const id = Number(params?.reportId);
    if (!id || Number.isNaN(id)) {
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

    const report = await updateAcademicHealthReport(id, body, { actorUserId, actorRole });
    return NextResponse.json({ report }, { status: 200 });
  } catch (error) {
    if (error instanceof ValidationError && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message, details: error.details || null }, { status: 400 });
    }
    console.error(`PATCH /api/reports/academic-health/${params?.reportId} error:`, error);
    return NextResponse.json({ error: "Failed to update report" }, { status: 500 });
  }
}
