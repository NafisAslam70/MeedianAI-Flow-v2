import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  managerSectionGrants,
  recruitmentMetaPrograms,
  recruitmentMetaStages,
  recruitmentMetaCountryCodes,
  recruitmentMetaLocations,
  recruitmentCandidates,
  recruitmentPipelineStages,
  recruitmentPipelineFinal,
  recruitmentCommunicationLog,
  recruitmentProgramRequirements,
  mspCodes,
  mspCodeAssignments,
  mriPrograms,
  recruitmentBench,
  recruitmentBenchPushes,
} from "@/lib/schema";
import { and, desc, eq, gte, inArray, isNull, ne, or, sql } from "drizzle-orm";

const CANDIDATE_STATUS_OPTIONS = ["Active", "Inactive", "Withdrawn"];
const FINAL_STATUS_OPTIONS = ["SELECTED", "REJECTED", "OFFER", "ACCEPTED", "JOINED", "ON_HOLD"];
const COMM_METHOD_OPTIONS = ["Call", "WhatsApp", "Email", "SMS", "In-Person", "Video Call"];
const COMM_OUTCOME_OPTIONS = ["Interested", "Not Interested", "Will Call Back", "Pending", "Callback Required"];

const toDateOnly = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
};

const parseBool = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  const raw = String(value).trim().toLowerCase();
  if (["true", "1", "yes"].includes(raw)) return true;
  if (["false", "0", "no"].includes(raw)) return false;
  return fallback;
};

const formatFullPhone = (countryCode, phoneNumber) => {
  const code = String(countryCode || "").trim();
  const phone = String(phoneNumber || "").trim();
  if (!code || !phone) return null;
  return `${code}${phone}`;
};

const splitName = (fullName) => {
  const parts = String(fullName || "").trim().split(/\s+/);
  if (!parts.length) return { first: "", last: "" };
  const first = parts.shift();
  const last = parts.join(" ") || null;
  return { first, last };
};

const isVacantMspCode = async (mspCodeId) => {
  if (!mspCodeId) return true;
  const isoDate = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select({ id: mspCodeAssignments.id })
    .from(mspCodeAssignments)
    .where(
      and(
        eq(mspCodeAssignments.mspCodeId, mspCodeId),
        eq(mspCodeAssignments.active, true),
        or(isNull(mspCodeAssignments.endDate), gte(mspCodeAssignments.endDate, isoDate))
      )
    );
  return rows.length === 0;
};

const fetchProgramCode = async (programId) => {
  if (!programId) return null;
  const [row] = await db
    .select({ programCode: recruitmentMetaPrograms.programCode })
    .from(recruitmentMetaPrograms)
    .where(eq(recruitmentMetaPrograms.id, programId));
  return row?.programCode || null;
};

const isCodeTakenByCandidate = async (mspCodeId, excludeCandidateId = null) => {
  if (!mspCodeId) return false;
  const condition = excludeCandidateId
    ? and(eq(recruitmentCandidates.mspCodeId, mspCodeId), ne(recruitmentCandidates.id, excludeCandidateId))
    : eq(recruitmentCandidates.mspCodeId, mspCodeId);
  const rows = await db
    .select({ id: recruitmentCandidates.id })
    .from(recruitmentCandidates)
    .where(condition);
  return rows.length > 0;
};

const ensureGlobalLocation = async () => {
  const name = "All Locations";
  const [existing] = await db
    .select({ id: recruitmentMetaLocations.id })
    .from(recruitmentMetaLocations)
    .where(eq(recruitmentMetaLocations.locationName, name));
  if (existing?.id) return existing.id;
  const [inserted] = await db
    .insert(recruitmentMetaLocations)
    .values({
      locationName: name,
      city: "All",
      state: "All",
      country: "NA",
      isActive: true,
    })
    .returning({ id: recruitmentMetaLocations.id });
  return inserted.id;
};

const getDefaultCountryCodeId = async () => {
  const [row] = await db
    .select({ id: recruitmentMetaCountryCodes.id })
    .from(recruitmentMetaCountryCodes)
    .where(eq(recruitmentMetaCountryCodes.isDefault, true));
  if (row?.id) return row.id;
  const [first] = await db.select({ id: recruitmentMetaCountryCodes.id }).from(recruitmentMetaCountryCodes).limit(1);
  return first?.id || null;
};

const requireRecruitmentAccess = async (session, write = false) => {
  if (!session?.user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (session.user.role === "admin") return { ok: true, canWrite: true };
  if (session.user.role !== "team_manager") {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const grants = await db
    .select({ id: managerSectionGrants.id, canWrite: managerSectionGrants.canWrite })
    .from(managerSectionGrants)
    .where(and(eq(managerSectionGrants.userId, Number(session.user.id)), eq(managerSectionGrants.section, "recruitmentPro")));
  const canWrite = grants.some((row) => row && row.canWrite !== false);
  if (!grants.length) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (write && !canWrite) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, canWrite };
};

const getSection = (req) => {
  const { searchParams } = new URL(req.url);
  return String(searchParams.get("section") || "").trim();
};

export async function GET(req) {
  const session = await auth();
  const access = await requireRecruitmentAccess(session, false);
  if (!access.ok) return access.response;

  const { searchParams } = new URL(req.url);
  const section = String(searchParams.get("section") || "").trim();
  const activeOnly = String(searchParams.get("activeOnly") || "").toLowerCase() === "true";

  if (!section) {
    return NextResponse.json({ error: "Missing section" }, { status: 400 });
  }

  if (section === "metaPrograms") {
    // Sync programs from Program Design (mriPrograms) into recruitment meta
    const designPrograms = await db
      .select({
        programKey: mriPrograms.programKey,
        name: mriPrograms.name,
        id: mriPrograms.id,
      })
      .from(mriPrograms);

    const existing = await db.select().from(recruitmentMetaPrograms);
    const existingByCode = new Map(existing.map((p) => [p.programCode, p]));

    const toInsert = designPrograms
      .filter((p) => p.programKey && !existingByCode.has(p.programKey))
      .map((p) => ({
        programCode: p.programKey,
        programName: p.name || p.programKey,
        description: "Synced from Program Design",
        isActive: true,
      }));

    if (toInsert.length) {
      await db.insert(recruitmentMetaPrograms).values(toInsert);
    }

    let query = db.select().from(recruitmentMetaPrograms);
    if (activeOnly) query = query.where(eq(recruitmentMetaPrograms.isActive, true));
    const programs = await query.orderBy(recruitmentMetaPrograms.programCode);
    return NextResponse.json({ programs }, { status: 200, from: "programDesign" });
  }

  if (section === "metaStages") {
    let query = db.select().from(recruitmentMetaStages);
    if (activeOnly) query = query.where(eq(recruitmentMetaStages.isActive, true));
    const stages = await query.orderBy(recruitmentMetaStages.stageOrder);
    return NextResponse.json({ stages }, { status: 200 });
  }

  if (section === "metaCountryCodes") {
    let query = db.select().from(recruitmentMetaCountryCodes);
    if (activeOnly) query = query.where(eq(recruitmentMetaCountryCodes.isActive, true));
    const codes = await query.orderBy(recruitmentMetaCountryCodes.countryName);
    return NextResponse.json({ codes }, { status: 200 });
  }

  if (section === "metaLocations") {
    let query = db.select().from(recruitmentMetaLocations);
    if (activeOnly) query = query.where(eq(recruitmentMetaLocations.isActive, true));
    const locations = await query.orderBy(recruitmentMetaLocations.locationName);
    return NextResponse.json({ locations }, { status: 200 });
  }

  if (section === "candidates") {
    const rows = await db
      .select({
        id: recruitmentCandidates.id,
        srNo: recruitmentCandidates.srNo,
        firstName: recruitmentCandidates.firstName,
        lastName: recruitmentCandidates.lastName,
        email: recruitmentCandidates.email,
        countryCodeId: recruitmentCandidates.countryCodeId,
        countryCode: recruitmentMetaCountryCodes.countryCode,
        phoneNumber: recruitmentCandidates.phoneNumber,
        fullPhone: recruitmentCandidates.fullPhone,
        programId: recruitmentCandidates.programId,
        programCode: recruitmentMetaPrograms.programCode,
        programName: recruitmentMetaPrograms.programName,
        mspCodeId: recruitmentCandidates.mspCodeId,
        mspCode: mspCodes.code,
        mspCodeTitle: mspCodes.title,
        mspFamily: mspCodes.familyKey,
        mspTrack: mspCodes.track,
        mspProgram: mspCodes.program,
        requirementId: recruitmentCandidates.requirementId,
        requirementName: recruitmentProgramRequirements.requirementName,
        locationId: recruitmentCandidates.locationId,
        locationName: recruitmentMetaLocations.locationName,
        appliedYear: recruitmentCandidates.appliedYear,
        resumeUrl: recruitmentCandidates.resumeUrl,
        candidateStatus: recruitmentCandidates.candidateStatus,
        createdAt: recruitmentCandidates.createdAt,
        updatedAt: recruitmentCandidates.updatedAt,
      })
      .from(recruitmentCandidates)
      .leftJoin(recruitmentMetaPrograms, eq(recruitmentCandidates.programId, recruitmentMetaPrograms.id))
      .leftJoin(mspCodes, eq(recruitmentCandidates.mspCodeId, mspCodes.id))
      .leftJoin(recruitmentProgramRequirements, eq(recruitmentCandidates.requirementId, recruitmentProgramRequirements.id))
      .leftJoin(recruitmentMetaLocations, eq(recruitmentCandidates.locationId, recruitmentMetaLocations.id))
      .leftJoin(recruitmentMetaCountryCodes, eq(recruitmentCandidates.countryCodeId, recruitmentMetaCountryCodes.id))
      .orderBy(desc(recruitmentCandidates.createdAt));

    return NextResponse.json(
      {
        candidates: rows,
        candidateStatusOptions: CANDIDATE_STATUS_OPTIONS,
      },
      { status: 200 }
    );
  }

  if (section === "pipeline") {
    const stages = await db
      .select({
        id: recruitmentMetaStages.id,
        stageCode: recruitmentMetaStages.stageCode,
        stageName: recruitmentMetaStages.stageName,
        stageOrder: recruitmentMetaStages.stageOrder,
        isActive: recruitmentMetaStages.isActive,
      })
      .from(recruitmentMetaStages)
      .orderBy(recruitmentMetaStages.stageOrder);

    const candidates = await db
      .select({
        id: recruitmentCandidates.id,
        srNo: recruitmentCandidates.srNo,
        firstName: recruitmentCandidates.firstName,
        lastName: recruitmentCandidates.lastName,
        email: recruitmentCandidates.email,
        programId: recruitmentCandidates.programId,
        programCode: recruitmentMetaPrograms.programCode,
        programName: recruitmentMetaPrograms.programName,
        mspCodeId: recruitmentCandidates.mspCodeId,
        mspCode: mspCodes.code,
        mspCodeTitle: mspCodes.title,
        requirementId: recruitmentCandidates.requirementId,
        requirementName: recruitmentProgramRequirements.requirementName,
        locationId: recruitmentCandidates.locationId,
        locationName: recruitmentMetaLocations.locationName,
        fullPhone: recruitmentCandidates.fullPhone,
        candidateStatus: recruitmentCandidates.candidateStatus,
      })
      .from(recruitmentCandidates)
      .leftJoin(recruitmentMetaPrograms, eq(recruitmentCandidates.programId, recruitmentMetaPrograms.id))
      .leftJoin(mspCodes, eq(recruitmentCandidates.mspCodeId, mspCodes.id))
      .leftJoin(recruitmentProgramRequirements, eq(recruitmentCandidates.requirementId, recruitmentProgramRequirements.id))
      .leftJoin(recruitmentMetaLocations, eq(recruitmentCandidates.locationId, recruitmentMetaLocations.id))
      .orderBy(recruitmentCandidates.srNo);

    const candidateIds = candidates.map((c) => c.id).filter(Boolean);
    let stageRows = [];
    let finalRows = [];
    let commRows = [];
    if (candidateIds.length) {
      stageRows = await db
        .select({
          id: recruitmentPipelineStages.id,
          candidateId: recruitmentPipelineStages.candidateId,
          stageId: recruitmentPipelineStages.stageId,
          stageName: recruitmentMetaStages.stageName,
          stageOrder: recruitmentMetaStages.stageOrder,
          completedDate: recruitmentPipelineStages.completedDate,
          notes: recruitmentPipelineStages.notes,
          stageCompleted: recruitmentPipelineStages.stageCompleted,
        })
        .from(recruitmentPipelineStages)
        .leftJoin(recruitmentMetaStages, eq(recruitmentPipelineStages.stageId, recruitmentMetaStages.id))
        .where(inArray(recruitmentPipelineStages.candidateId, candidateIds));

      finalRows = await db
        .select({
          id: recruitmentPipelineFinal.id,
          candidateId: recruitmentPipelineFinal.candidateId,
          finalStatus: recruitmentPipelineFinal.finalStatus,
          finalDate: recruitmentPipelineFinal.finalDate,
          joiningDate: recruitmentPipelineFinal.joiningDate,
          notes: recruitmentPipelineFinal.notes,
        })
        .from(recruitmentPipelineFinal)
        .where(inArray(recruitmentPipelineFinal.candidateId, candidateIds));

      commRows = await db
        .select({
          id: recruitmentCommunicationLog.id,
          candidateId: recruitmentCommunicationLog.candidateId,
          stageId: recruitmentCommunicationLog.stageId,
          stageOrder: recruitmentMetaStages.stageOrder,
          communicationDate: recruitmentCommunicationLog.communicationDate,
          communicationMethod: recruitmentCommunicationLog.communicationMethod,
          subject: recruitmentCommunicationLog.subject,
          outcome: recruitmentCommunicationLog.outcome,
          followUpDate: recruitmentCommunicationLog.followUpDate,
          notes: recruitmentCommunicationLog.notes,
        })
        .from(recruitmentCommunicationLog)
        .leftJoin(recruitmentMetaStages, eq(recruitmentCommunicationLog.stageId, recruitmentMetaStages.id))
        .where(inArray(recruitmentCommunicationLog.candidateId, candidateIds));
    }

    const finalMap = new Map(finalRows.map((row) => [row.candidateId, row]));
    const stageMap = new Map();
    for (const row of stageRows) {
      if (!row.stageOrder || row.stageOrder > 4) continue;
      const key = `${row.candidateId}|${row.stageOrder}`;
      const existing = stageMap.get(key);
      if (!existing) {
        stageMap.set(key, row);
      } else if (row.completedDate && (!existing.completedDate || row.completedDate > existing.completedDate)) {
        stageMap.set(key, row);
      }
    }

    const commMap = new Map();
    for (const row of commRows) {
      if (!row.stageOrder || row.stageOrder > 4) continue;
      const key = `${row.candidateId}|${row.stageOrder}`;
      const existing = commMap.get(key);
      const rowDate = row.communicationDate ? new Date(row.communicationDate).getTime() : 0;
      const existingDate = existing?.communicationDate ? new Date(existing.communicationDate).getTime() : 0;
      if (!existing || rowDate >= existingDate) {
        commMap.set(key, row);
      }
    }

    const rows = candidates.map((c) => {
      const stage1 = stageMap.get(`${c.id}|1`) || null;
      const stage2 = stageMap.get(`${c.id}|2`) || null;
      const stage3 = stageMap.get(`${c.id}|3`) || null;
      const stage4 = stageMap.get(`${c.id}|4`) || null;
      const final = finalMap.get(c.id) || null;
      const comm = {
        stage1: commMap.get(`${c.id}|1`) || null,
        stage2: commMap.get(`${c.id}|2`) || null,
        stage3: commMap.get(`${c.id}|3`) || null,
        stage4: commMap.get(`${c.id}|4`) || null,
      };
      return {
        ...c,
        stage1,
        stage2,
        stage3,
        stage4,
        final,
        comm,
      };
    });

    return NextResponse.json(
      {
        rows,
        stages,
        stageOptions: stages.filter((s) => s.stageOrder && s.stageOrder <= 4),
        finalStatusOptions: FINAL_STATUS_OPTIONS,
      },
      { status: 200 }
    );
  }

  if (section === "communicationLog") {
    const rows = await db
      .select({
        id: recruitmentCommunicationLog.id,
        candidateId: recruitmentCommunicationLog.candidateId,
        stageId: recruitmentCommunicationLog.stageId,
        stageOrder: recruitmentMetaStages.stageOrder,
        communicationDate: recruitmentCommunicationLog.communicationDate,
        communicationMethod: recruitmentCommunicationLog.communicationMethod,
        subject: recruitmentCommunicationLog.subject,
        outcome: recruitmentCommunicationLog.outcome,
        followUpDate: recruitmentCommunicationLog.followUpDate,
        notes: recruitmentCommunicationLog.notes,
        createdBy: recruitmentCommunicationLog.createdBy,
      })
      .from(recruitmentCommunicationLog)
      .leftJoin(recruitmentMetaStages, eq(recruitmentCommunicationLog.stageId, recruitmentMetaStages.id))
      .orderBy(desc(recruitmentCommunicationLog.communicationDate), desc(recruitmentCommunicationLog.id));

    return NextResponse.json(
      {
        entries: rows,
        methodOptions: COMM_METHOD_OPTIONS,
        outcomeOptions: COMM_OUTCOME_OPTIONS,
      },
      { status: 200 }
    );
  }

  if (section === "programRequirements") {
    const rows = await db
      .select({
        id: recruitmentProgramRequirements.id,
        programId: recruitmentProgramRequirements.programId,
        programCode: recruitmentMetaPrograms.programCode,
        programName: recruitmentMetaPrograms.programName,
        locationId: recruitmentProgramRequirements.locationId,
        locationName: recruitmentMetaLocations.locationName,
        requirementName: recruitmentProgramRequirements.requirementName,
        requiredCount: recruitmentProgramRequirements.requiredCount,
        filledCount: recruitmentProgramRequirements.filledCount,
        notes: recruitmentProgramRequirements.notes,
      })
      .from(recruitmentProgramRequirements)
      .leftJoin(recruitmentMetaPrograms, eq(recruitmentProgramRequirements.programId, recruitmentMetaPrograms.id))
      .leftJoin(recruitmentMetaLocations, eq(recruitmentProgramRequirements.locationId, recruitmentMetaLocations.id))
      .orderBy(recruitmentMetaPrograms.programCode, recruitmentMetaLocations.locationName);

    return NextResponse.json({ requirements: rows }, { status: 200 });
  }

  if (section === "bench") {
    const q = db
      .select({
        id: recruitmentBench.id,
        fullName: recruitmentBench.fullName,
        phone: recruitmentBench.phone,
        location: recruitmentBench.location,
        appliedFor: recruitmentBench.appliedFor,
        appliedDate: recruitmentBench.appliedDate,
        linkUrl: recruitmentBench.linkUrl,
        notes: recruitmentBench.notes,
        source: recruitmentBench.source,
        createdAt: recruitmentBench.createdAt,
        updatedAt: recruitmentBench.updatedAt,
        pushCount: sql`(SELECT count(*) FROM recruitment_bench_pushes pb WHERE pb.bench_id = recruitment_bench.id)`,
        lastPushedAt: sql`(SELECT max(pb.pushed_at) FROM recruitment_bench_pushes pb WHERE pb.bench_id = recruitment_bench.id)`,
        lastRequirementName: sql`(SELECT rpr.requirement_name FROM recruitment_bench_pushes pb JOIN recruitment_program_requirements rpr ON pb.requirement_id = rpr.id WHERE pb.bench_id = recruitment_bench.id ORDER BY pb.pushed_at DESC NULLS LAST LIMIT 1)`,
        lastRequirementId: sql`(SELECT pb.requirement_id FROM recruitment_bench_pushes pb WHERE pb.bench_id = recruitment_bench.id ORDER BY pb.pushed_at DESC NULLS LAST LIMIT 1)`,
      })
      .from(recruitmentBench)
      .orderBy(desc(recruitmentBench.createdAt));
    const rows = await q;
    return NextResponse.json({ bench: rows }, { status: 200 });
  }

  if (section === "vacantMspCodes") {
    const isoDate = new Date().toISOString().slice(0, 10);
    const codes = await db
      .select({
        id: mspCodes.id,
        code: mspCodes.code,
        program: mspCodes.program,
        familyKey: mspCodes.familyKey,
        track: mspCodes.track,
        title: mspCodes.title,
        parentSlice: mspCodes.parentSlice,
        active: mspCodes.active,
      })
      .from(mspCodes)
      .where(eq(mspCodes.active, true))
      .orderBy(mspCodes.code);

    const assignments = await db
      .select({
        id: mspCodeAssignments.id,
        mspCodeId: mspCodeAssignments.mspCodeId,
      })
      .from(mspCodeAssignments)
      .where(
        and(
          eq(mspCodeAssignments.active, true),
          or(isNull(mspCodeAssignments.endDate), gte(mspCodeAssignments.endDate, isoDate))
        )
      );

    const activeMap = new Map();
    for (const a of assignments) {
      activeMap.set(a.mspCodeId, (activeMap.get(a.mspCodeId) || 0) + 1);
    }

    const candidateCodes = await db
      .select({ mspCodeId: recruitmentCandidates.mspCodeId })
      .from(recruitmentCandidates);
    const candidateSet = new Set(candidateCodes.map((row) => row.mspCodeId).filter(Boolean));

    const vacant = codes.filter((c) => !activeMap.get(c.id) && !candidateSet.has(c.id));
    return NextResponse.json({ vacantCodes: vacant }, { status: 200 });
  }

  if (section === "dashboard") {
    const candidates = await db.select({ id: recruitmentCandidates.id }).from(recruitmentCandidates);
    const candidateIds = candidates.map((c) => c.id);
    const stageRows = candidateIds.length
      ? await db
          .select({
            candidateId: recruitmentPipelineStages.candidateId,
            stageOrder: recruitmentMetaStages.stageOrder,
          })
          .from(recruitmentPipelineStages)
          .leftJoin(recruitmentMetaStages, eq(recruitmentPipelineStages.stageId, recruitmentMetaStages.id))
          .where(inArray(recruitmentPipelineStages.candidateId, candidateIds))
      : [];

    const finals = candidateIds.length
      ? await db
          .select({
            candidateId: recruitmentPipelineFinal.candidateId,
            finalStatus: recruitmentPipelineFinal.finalStatus,
          })
          .from(recruitmentPipelineFinal)
          .where(inArray(recruitmentPipelineFinal.candidateId, candidateIds))
      : [];

    const stageCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const row of stageRows) {
      if (row.stageOrder && row.stageOrder >= 1 && row.stageOrder <= 4) {
        stageCounts[row.stageOrder] += 1;
      }
    }

    const finalCounts = FINAL_STATUS_OPTIONS.reduce((acc, key) => {
      acc[key] = 0;
      return acc;
    }, {});
    for (const row of finals) {
      if (row.finalStatus && finalCounts[row.finalStatus] !== undefined) {
        finalCounts[row.finalStatus] += 1;
      }
    }

    const totalCandidates = candidates.length;
    const s1 = stageCounts[1] || 0;
    const s2 = stageCounts[2] || 0;
    const s3 = stageCounts[3] || 0;
    const s4 = stageCounts[4] || 0;
    const selected = finalCounts.SELECTED || 0;

    const pct = (num, den) => (den ? Math.round((num / den) * 1000) / 10 : 0);

    return NextResponse.json(
      {
        totalCandidates,
        stageCounts: { stage1: s1, stage2: s2, stage3: s3, stage4: s4 },
        finalCounts,
        conversionRates: {
          s1ToS2: pct(s2, s1),
          s2ToS3: pct(s3, s2),
          s3ToS4: pct(s4, s3),
          overallSuccess: pct(selected, totalCandidates),
        },
      },
      { status: 200 }
    );
  }

  return NextResponse.json({ error: "Unknown section" }, { status: 400 });
}

export async function POST(req) {
  const session = await auth();
  const access = await requireRecruitmentAccess(session, true);
  if (!access.ok) return access.response;

  const section = getSection(req);
  if (!section) return NextResponse.json({ error: "Missing section" }, { status: 400 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (section === "metaPrograms") {
    const programCode = String(body?.programCode || "").trim();
    const programName = String(body?.programName || "").trim();
    const description = String(body?.description || "").trim() || null;
    const isActive = parseBool(body?.isActive, true);
    if (!programCode || !programName) {
      return NextResponse.json({ error: "programCode and programName are required" }, { status: 400 });
    }
    const [row] = await db
      .insert(recruitmentMetaPrograms)
      .values({ programCode, programName, description, isActive })
      .returning();
    return NextResponse.json({ program: row }, { status: 201 });
  }

  if (section === "metaStages") {
    const stageCode = String(body?.stageCode || "").trim();
    const stageName = String(body?.stageName || "").trim();
    const description = String(body?.description || "").trim() || null;
    const stageOrder = Number(body?.stageOrder);
    const isActive = parseBool(body?.isActive, true);
    if (!stageCode || !stageName || !Number.isFinite(stageOrder)) {
      return NextResponse.json({ error: "stageCode, stageName, stageOrder are required" }, { status: 400 });
    }
    const [row] = await db
      .insert(recruitmentMetaStages)
      .values({ stageCode, stageName, description, stageOrder, isActive })
      .returning();
    return NextResponse.json({ stage: row }, { status: 201 });
  }

  if (section === "metaCountryCodes") {
    const countryName = String(body?.countryName || "").trim();
    const countryCode = String(body?.countryCode || "").trim();
    const isActive = parseBool(body?.isActive, true);
    const isDefault = parseBool(body?.isDefault, false);
    if (!countryName || !countryCode || !countryCode.startsWith("+")) {
      return NextResponse.json({ error: "Valid countryName and countryCode are required" }, { status: 400 });
    }
    const [row] = await db
      .insert(recruitmentMetaCountryCodes)
      .values({ countryName, countryCode, isActive, isDefault })
      .returning();
    if (isDefault) {
      await db
        .update(recruitmentMetaCountryCodes)
        .set({ isDefault: false })
        .where(and(ne(recruitmentMetaCountryCodes.id, row.id), eq(recruitmentMetaCountryCodes.isDefault, true)));
    }
    return NextResponse.json({ code: row }, { status: 201 });
  }

  if (section === "metaLocations") {
    const locationName = String(body?.locationName || "").trim();
    const city = String(body?.city || "").trim();
    const state = String(body?.state || "").trim() || null;
    const country = String(body?.country || "").trim() || "India";
    const isActive = parseBool(body?.isActive, true);
    if (!locationName || !city) {
      return NextResponse.json({ error: "locationName and city are required" }, { status: 400 });
    }
    const [row] = await db
      .insert(recruitmentMetaLocations)
      .values({ locationName, city, state, country, isActive })
      .returning();
    return NextResponse.json({ location: row }, { status: 201 });
  }

  if (section === "candidates") {
    const firstName = String(body?.firstName || "").trim();
    const lastName = String(body?.lastName || "").trim() || null;
    const email = String(body?.email || "").trim();
    const countryCodeId = Number(body?.countryCodeId);
    const phoneNumber = String(body?.phoneNumber || "").trim();
    const programId = Number(body?.programId);
    const mspCodeId = body?.mspCodeId ? Number(body.mspCodeId) : null;
    const requirementId = body?.requirementId ? Number(body.requirementId) : null;
    const locationId = Number(body?.locationId);
    const appliedYear = Number.isFinite(Number(body?.appliedYear)) ? Number(body.appliedYear) : null;
    const resumeUrl = String(body?.resumeUrl || "").trim() || null;
    const candidateStatus = String(body?.candidateStatus || "Active").trim();
    if (!firstName || !email || !countryCodeId || !phoneNumber || !programId || !locationId || !requirementId) {
      return NextResponse.json({ error: "Missing required candidate fields" }, { status: 400 });
    }

    const [{ maxSr }] = await db
      .select({ maxSr: sql`COALESCE(max(${recruitmentCandidates.srNo}), 0)` })
      .from(recruitmentCandidates);
    const srNo = Number(body?.srNo) || (Number(maxSr) || 0) + 1;

    const [codeRow] = await db
      .select({ countryCode: recruitmentMetaCountryCodes.countryCode })
      .from(recruitmentMetaCountryCodes)
      .where(eq(recruitmentMetaCountryCodes.id, countryCodeId));

    const fullPhone = formatFullPhone(codeRow?.countryCode, phoneNumber);

    if (mspCodeId) {
      const [codeRowInfo] = await db
        .select({ id: mspCodes.id, program: mspCodes.program, active: mspCodes.active })
        .from(mspCodes)
        .where(eq(mspCodes.id, mspCodeId));
      if (!codeRowInfo || !codeRowInfo.active) {
        return NextResponse.json({ error: "Invalid MSP code" }, { status: 400 });
      }
      const programCode = await fetchProgramCode(programId);
      if (programCode && String(codeRowInfo.program).toUpperCase() !== String(programCode).toUpperCase()) {
        return NextResponse.json({ error: "MSP code does not match selected program" }, { status: 400 });
      }
      const vacant = await isVacantMspCode(mspCodeId);
      if (!vacant) {
        return NextResponse.json({ error: "MSP code is not vacant" }, { status: 400 });
      }
      const taken = await isCodeTakenByCandidate(mspCodeId);
      if (taken) {
        return NextResponse.json({ error: "MSP code is already assigned to another candidate" }, { status: 400 });
      }
    }

    const [row] = await db
      .insert(recruitmentCandidates)
      .values({
        srNo,
        firstName,
        lastName,
        email,
        countryCodeId,
        phoneNumber,
        fullPhone,
        programId,
        mspCodeId,
        requirementId,
        locationId,
        appliedYear,
        resumeUrl,
        candidateStatus,
      })
      .returning();

    return NextResponse.json({ candidate: row }, { status: 201 });
  }

  if (section === "candidates" && req.method === "PUT") {
    const id = Number(body?.id);
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const update = {};
    ["firstName", "lastName", "email", "phoneNumber", "appliedYear", "resumeUrl", "candidateStatus"].forEach((key) => {
      if (key in body) update[key] = body[key] === "" ? null : body[key];
    });
    if (body.countryCodeId) update.countryCodeId = Number(body.countryCodeId);
    if (body.programId) update.programId = Number(body.programId);
    if ("mspCodeId" in body) update.mspCodeId = body.mspCodeId ? Number(body.mspCodeId) : null;
    if ("requirementId" in body) update.requirementId = body.requirementId ? Number(body.requirementId) : null;
    if (body.locationId) update.locationId = Number(body.locationId);
    await db.update(recruitmentCandidates).set(update).where(eq(recruitmentCandidates.id, id));
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (section === "pipeline") {
    const candidateId = Number(body?.candidateId);
    const stageOrder = Number(body?.stageOrder);
    const stageId = body?.stageId ? Number(body.stageId) : null;
    const completedDate = toDateOnly(body?.completedDate);
    const notes = String(body?.notes || "").trim() || null;

    if (!candidateId || !Number.isFinite(stageOrder) || stageOrder < 1 || stageOrder > 4) {
      return NextResponse.json({ error: "candidateId and stageOrder (1-4) are required" }, { status: 400 });
    }

    const existing = await db
      .select({ id: recruitmentPipelineStages.id, stageId: recruitmentPipelineStages.stageId })
      .from(recruitmentPipelineStages)
      .leftJoin(recruitmentMetaStages, eq(recruitmentPipelineStages.stageId, recruitmentMetaStages.id))
      .where(
        and(
          eq(recruitmentPipelineStages.candidateId, candidateId),
          eq(recruitmentMetaStages.stageOrder, stageOrder)
        )
      );

    if (!stageId) {
      if (existing.length) {
        await db.delete(recruitmentPipelineStages).where(inArray(recruitmentPipelineStages.id, existing.map((r) => r.id)));
      }
      return NextResponse.json({ cleared: true }, { status: 200 });
    }

    const [stageRow] = await db
      .select({ stageOrder: recruitmentMetaStages.stageOrder })
      .from(recruitmentMetaStages)
      .where(eq(recruitmentMetaStages.id, stageId));

    if (!stageRow || stageRow.stageOrder !== stageOrder) {
      return NextResponse.json({ error: "Stage does not match the selected stage slot" }, { status: 400 });
    }

    if (existing.length) {
      await db.delete(recruitmentPipelineStages).where(inArray(recruitmentPipelineStages.id, existing.map((r) => r.id)));
    }

    const [row] = await db
      .insert(recruitmentPipelineStages)
      .values({
        candidateId,
        stageId,
        stageCompleted: !!completedDate,
        completedDate: completedDate || null,
        notes,
        updatedAt: new Date(),
      })
      .returning();

    return NextResponse.json({ stage: row }, { status: 201 });
  }

  if (section === "pipelineFinal") {
    const candidateId = Number(body?.candidateId);
    const finalStatus = String(body?.finalStatus || "").trim();
    const finalDate = toDateOnly(body?.finalDate);
    const joiningDate = toDateOnly(body?.joiningDate);
    const notes = String(body?.notes || "").trim() || null;

    if (!candidateId || !finalStatus || !finalDate) {
      return NextResponse.json({ error: "candidateId, finalStatus, finalDate are required" }, { status: 400 });
    }

    await db
      .insert(recruitmentPipelineFinal)
      .values({ candidateId, finalStatus, finalDate, joiningDate, notes })
      .onConflictDoUpdate({
        target: recruitmentPipelineFinal.candidateId,
        set: { finalStatus, finalDate, joiningDate, notes, updatedAt: new Date() },
      });

    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (section === "communicationLog") {
    const candidateId = Number(body?.candidateId);
    const stageId = Number(body?.stageId);
    const communicationDate = toDateOnly(body?.communicationDate);
    const communicationMethod = String(body?.communicationMethod || "").trim();
    const subject = String(body?.subject || "").trim();
    const outcome = String(body?.outcome || "").trim();
    const followUpDate = toDateOnly(body?.followUpDate);
    const notes = String(body?.notes || "").trim() || null;

    if (!candidateId || !stageId || !communicationDate || !communicationMethod || !subject || !outcome) {
      return NextResponse.json({ error: "candidateId, stageId, communicationDate, method, subject, outcome required" }, { status: 400 });
    }

    const [row] = await db
      .insert(recruitmentCommunicationLog)
      .values({
        candidateId,
        stageId,
        communicationDate,
        communicationMethod,
        subject,
        outcome,
        followUpDate,
        notes,
        createdBy: session.user.id,
      })
      .returning();

    return NextResponse.json({ entry: row }, { status: 201 });
  }

  if (section === "bench") {
    const fullName = String(body?.fullName || "").trim();
    const phone = String(body?.phone || "").trim();
    const benchEmail = String(body?.email || "").trim() || null;
    if (!fullName || !phone) {
      return NextResponse.json({ error: "fullName and phone required" }, { status: 400 });
    }
    const location = String(body?.location || "").trim() || null;
    const appliedFor = String(body?.appliedFor || "").trim() || null;
    const appliedDate = toDateOnly(body?.appliedDate);
    const linkUrl = String(body?.linkUrl || "").trim() || null;
    const notes = String(body?.notes || "").trim() || null;
    const source = String(body?.source || "").trim() || null;

    const [row] = await db
      .insert(recruitmentBench)
      .values({ fullName, phone, location, appliedFor, appliedDate, linkUrl, notes, source, email: benchEmail })
      .returning();

    return NextResponse.json({ bench: row }, { status: 201 });
  }

  if (section === "benchPush") {
    const benchIds = Array.isArray(body?.benchIds) ? body.benchIds.map(Number).filter(Boolean) : [];
    const programId = Number(body?.programId);
    const locationId = body?.locationId ? Number(body.locationId) : await ensureGlobalLocation();
    const countryCodeId = Number(body?.countryCodeId) || (await getDefaultCountryCodeId());
    const candidateStatus = String(body?.candidateStatus || "Active").trim();
    const mspCodeId = body?.mspCodeId ? Number(body.mspCodeId) : null;
    const appliedYear = Number.isFinite(Number(body?.appliedYear)) ? Number(body.appliedYear) : null;
    const emailOverride = String(body?.email || "").trim();
    const requirementId = body?.requirementId ? Number(body.requirementId) : null;

    if (!benchIds.length || !programId || !countryCodeId || !locationId || !requirementId) {
      return NextResponse.json({ error: "benchIds, requirementId, programId, countryCodeId, locationId required" }, { status: 400 });
    }

    const inserted = [];
    for (const benchId of benchIds) {
      const [bench] = await db.select().from(recruitmentBench).where(eq(recruitmentBench.id, benchId));
      if (!bench) continue;
      const { first, last } = splitName(bench.fullName);
      const phoneNumber = bench.phone;
      const email = emailOverride || `${phoneNumber.replace(/\\D/g, "") || benchId}@bench.local`;

      const [codeRow] = await db
        .select({ countryCode: recruitmentMetaCountryCodes.countryCode })
        .from(recruitmentMetaCountryCodes)
        .where(eq(recruitmentMetaCountryCodes.id, countryCodeId));
      const fullPhone = formatFullPhone(codeRow?.countryCode, phoneNumber);

      const [candidate] = await db
        .insert(recruitmentCandidates)
        .values({
          srNo: null,
          firstName: first || bench.fullName,
          lastName: last,
          email,
          countryCodeId,
          phoneNumber,
          fullPhone,
          programId,
          mspCodeId,
          requirementId,
          locationId,
          appliedYear,
          resumeUrl: bench.linkUrl || null,
          candidateStatus,
        })
        .returning();

      await db
        .insert(recruitmentBenchPushes)
        .values({
          benchId,
          candidateId: candidate.id,
          programId,
          mspCodeId,
          locationId,
          requirementId,
          pushedBy: session.user.id,
        });

      inserted.push(candidate);
    }

    return NextResponse.json({ created: inserted.length, candidates: inserted }, { status: 200 });
  }

  if (section === "programRequirements") {
    const programId = Number(body?.programId);
    let locationId = body?.locationId ? Number(body.locationId) : null;
    const requiredCount = Number(body?.requiredCount);
    const filledCount = Number.isFinite(Number(body?.filledCount)) ? Number(body.filledCount) : 0;
    const requirementName = String(body?.requirementName || "").trim() || null;
    const notes = String(body?.notes || "").trim() || null;

    if (!programId || !Number.isFinite(requiredCount)) {
      return NextResponse.json({ error: "programId, requiredCount required" }, { status: 400 });
    }

    if (!locationId) {
      locationId = await ensureGlobalLocation();
    }

    const [row] = await db
      .insert(recruitmentProgramRequirements)
      .values({ programId, locationId, requiredCount, filledCount, notes, requirementName })
      .returning();

    return NextResponse.json({ requirement: row }, { status: 200 });
  }

  return NextResponse.json({ error: "Unknown section" }, { status: 400 });
}

export async function PUT(req) {
  const session = await auth();
  const access = await requireRecruitmentAccess(session, true);
  if (!access.ok) return access.response;

  const section = getSection(req);
  if (!section) return NextResponse.json({ error: "Missing section" }, { status: 400 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = Number(body?.id);
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  if (section === "metaPrograms") {
    const programCode = String(body?.programCode || "").trim();
    const programName = String(body?.programName || "").trim();
    const description = String(body?.description || "").trim() || null;
    const isActive = parseBool(body?.isActive, true);
    const [row] = await db
      .update(recruitmentMetaPrograms)
      .set({ programCode, programName, description, isActive, updatedAt: new Date() })
      .where(eq(recruitmentMetaPrograms.id, id))
      .returning();
    return NextResponse.json({ program: row }, { status: 200 });
  }

  if (section === "metaStages") {
    const stageCode = String(body?.stageCode || "").trim();
    const stageName = String(body?.stageName || "").trim();
    const description = String(body?.description || "").trim() || null;
    const stageOrder = Number(body?.stageOrder);
    const isActive = parseBool(body?.isActive, true);
    const [row] = await db
      .update(recruitmentMetaStages)
      .set({ stageCode, stageName, description, stageOrder, isActive, updatedAt: new Date() })
      .where(eq(recruitmentMetaStages.id, id))
      .returning();
    return NextResponse.json({ stage: row }, { status: 200 });
  }

  if (section === "metaCountryCodes") {
    const countryName = String(body?.countryName || "").trim();
    const countryCode = String(body?.countryCode || "").trim();
    const isActive = parseBool(body?.isActive, true);
    const isDefault = parseBool(body?.isDefault, false);
    const [row] = await db
      .update(recruitmentMetaCountryCodes)
      .set({ countryName, countryCode, isActive, isDefault, updatedAt: new Date() })
      .where(eq(recruitmentMetaCountryCodes.id, id))
      .returning();
    if (isDefault) {
      await db
        .update(recruitmentMetaCountryCodes)
        .set({ isDefault: false })
        .where(and(ne(recruitmentMetaCountryCodes.id, id), eq(recruitmentMetaCountryCodes.isDefault, true)));
    }
    return NextResponse.json({ code: row }, { status: 200 });
  }

  if (section === "metaLocations") {
    const locationName = String(body?.locationName || "").trim();
    const city = String(body?.city || "").trim();
    const state = String(body?.state || "").trim() || null;
    const country = String(body?.country || "").trim() || "India";
    const isActive = parseBool(body?.isActive, true);
    const [row] = await db
      .update(recruitmentMetaLocations)
      .set({ locationName, city, state, country, isActive, updatedAt: new Date() })
      .where(eq(recruitmentMetaLocations.id, id))
      .returning();
    return NextResponse.json({ location: row }, { status: 200 });
  }

  if (section === "candidates") {
    const firstName = String(body?.firstName || "").trim();
    const lastName = String(body?.lastName || "").trim() || null;
    const email = String(body?.email || "").trim();
    const countryCodeId = Number(body?.countryCodeId);
    const phoneNumber = String(body?.phoneNumber || "").trim();
    const programId = Number(body?.programId);
    const mspCodeId = body?.mspCodeId ? Number(body.mspCodeId) : null;
    const locationId = Number(body?.locationId);
    const appliedYear = Number.isFinite(Number(body?.appliedYear)) ? Number(body.appliedYear) : null;
    const resumeUrl = String(body?.resumeUrl || "").trim() || null;
    const candidateStatus = String(body?.candidateStatus || "Active").trim();

    const [codeRow] = await db
      .select({ countryCode: recruitmentMetaCountryCodes.countryCode })
      .from(recruitmentMetaCountryCodes)
      .where(eq(recruitmentMetaCountryCodes.id, countryCodeId));

    const fullPhone = formatFullPhone(codeRow?.countryCode, phoneNumber);

    const [existingCandidate] = await db
      .select({ id: recruitmentCandidates.id, mspCodeId: recruitmentCandidates.mspCodeId })
      .from(recruitmentCandidates)
      .where(eq(recruitmentCandidates.id, id));

    if (mspCodeId) {
      const [codeRowInfo] = await db
        .select({ id: mspCodes.id, program: mspCodes.program, active: mspCodes.active })
        .from(mspCodes)
        .where(eq(mspCodes.id, mspCodeId));
      if (!codeRowInfo || !codeRowInfo.active) {
        return NextResponse.json({ error: "Invalid MSP code" }, { status: 400 });
      }
      const programCode = await fetchProgramCode(programId);
      if (programCode && String(codeRowInfo.program).toUpperCase() !== String(programCode).toUpperCase()) {
        return NextResponse.json({ error: "MSP code does not match selected program" }, { status: 400 });
      }
      if (!existingCandidate || existingCandidate.mspCodeId !== mspCodeId) {
        const vacant = await isVacantMspCode(mspCodeId);
        if (!vacant) {
          return NextResponse.json({ error: "MSP code is not vacant" }, { status: 400 });
        }
      }
      const taken = await isCodeTakenByCandidate(mspCodeId, id);
      if (taken) {
        return NextResponse.json({ error: "MSP code is already assigned to another candidate" }, { status: 400 });
      }
    }

    const [row] = await db
      .update(recruitmentCandidates)
      .set({
        firstName,
        lastName,
        email,
        countryCodeId,
        phoneNumber,
        fullPhone,
        programId,
        mspCodeId,
        locationId,
        appliedYear,
        resumeUrl,
        candidateStatus,
        updatedAt: new Date(),
      })
      .where(eq(recruitmentCandidates.id, id))
      .returning();

    return NextResponse.json({ candidate: row }, { status: 200 });
  }

  if (section === "bench") {
    const fullName = String(body?.fullName || "").trim();
    const phone = String(body?.phone || "").trim();
    if (!fullName || !phone) {
      return NextResponse.json({ error: "fullName and phone required" }, { status: 400 });
    }
    const location = String(body?.location || "").trim() || null;
    const appliedFor = String(body?.appliedFor || "").trim() || null;
    const appliedDate = toDateOnly(body?.appliedDate);
    const linkUrl = String(body?.linkUrl || "").trim() || null;
    const notes = String(body?.notes || "").trim() || null;
    const source = String(body?.source || "").trim() || null;

    const [row] = await db
      .update(recruitmentBench)
      .set({ fullName, phone, email, location, appliedFor, appliedDate, linkUrl, notes, source, updatedAt: new Date() })
      .where(eq(recruitmentBench.id, id))
      .returning();

    return NextResponse.json({ bench: row }, { status: 200 });
  }

  if (section === "communicationLog") {
    const candidateId = Number(body?.candidateId);
    const stageId = Number(body?.stageId);
    const communicationDate = toDateOnly(body?.communicationDate);
    const communicationMethod = String(body?.communicationMethod || "").trim();
    const subject = String(body?.subject || "").trim();
    const outcome = String(body?.outcome || "").trim();
    const followUpDate = toDateOnly(body?.followUpDate);
    const notes = String(body?.notes || "").trim() || null;

    const [row] = await db
      .update(recruitmentCommunicationLog)
      .set({
        candidateId,
        stageId,
        communicationDate,
        communicationMethod,
        subject,
        outcome,
        followUpDate,
        notes,
        updatedAt: new Date(),
      })
      .where(eq(recruitmentCommunicationLog.id, id))
      .returning();

    return NextResponse.json({ entry: row }, { status: 200 });
  }

  if (section === "programRequirements") {
    const requirementId = id;
    const requiredCount = Number(body?.requiredCount);
    const filledCount = Number.isFinite(Number(body?.filledCount)) ? Number(body.filledCount) : 0;
    const requirementName = String(body?.requirementName || "").trim() || null;
    const notes = String(body?.notes || "").trim() || null;
    const locationId = body?.locationId ? Number(body.locationId) : null;
    const programId = body?.programId ? Number(body.programId) : null;

    if (!requirementId || !Number.isFinite(requiredCount)) {
      return NextResponse.json({ error: "id and requiredCount required" }, { status: 400 });
    }

    const [row] = await db
      .update(recruitmentProgramRequirements)
      .set({
        requiredCount,
        filledCount,
        requirementName,
        notes,
        ...(locationId ? { locationId } : {}),
        ...(programId ? { programId } : {}),
        updatedAt: new Date(),
      })
      .where(eq(recruitmentProgramRequirements.id, requirementId))
      .returning();

    return NextResponse.json({ requirement: row }, { status: 200 });
  }

  return NextResponse.json({ error: "Unknown section" }, { status: 400 });
}

export async function DELETE(req) {
  const session = await auth();
  const access = await requireRecruitmentAccess(session, true);
  if (!access.ok) return access.response;

  const section = getSection(req);
  if (!section) return NextResponse.json({ error: "Missing section" }, { status: 400 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = Number(body?.id);
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  if (section === "metaPrograms") {
    await db
      .update(recruitmentMetaPrograms)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(recruitmentMetaPrograms.id, id));
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (section === "metaStages") {
    await db
      .update(recruitmentMetaStages)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(recruitmentMetaStages.id, id));
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (section === "metaCountryCodes") {
    await db
      .update(recruitmentMetaCountryCodes)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(recruitmentMetaCountryCodes.id, id));
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (section === "metaLocations") {
    await db
      .update(recruitmentMetaLocations)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(recruitmentMetaLocations.id, id));
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (section === "candidates") {
    await db.delete(recruitmentCandidates).where(eq(recruitmentCandidates.id, id));
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (section === "bench") {
    await db.delete(recruitmentBench).where(eq(recruitmentBench.id, id));
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (section === "communicationLog") {
    await db.delete(recruitmentCommunicationLog).where(eq(recruitmentCommunicationLog.id, id));
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (section === "programRequirements") {
    await db.delete(recruitmentProgramRequirements).where(eq(recruitmentProgramRequirements.id, id));
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  return NextResponse.json({ error: "Unknown section" }, { status: 400 });
}
