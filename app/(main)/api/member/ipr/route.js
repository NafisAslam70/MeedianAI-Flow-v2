import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { memberIprScores, users, userMriRoles } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

const ALLOWED_ROLES = ["member", "team_manager", "admin"];

function normalizeDate(dateParam) {
  const date = dateParam ? new Date(dateParam) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

export async function GET(req) {
  try {
    const session = await auth();
    if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requesterRole = session.user.role;
    const requesterId = Number(session.user.id);

    const { searchParams } = new URL(req.url);
    const isoDate = normalizeDate(searchParams.get("date"));
    if (!isoDate) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }

    const summaryScope = (searchParams.get("summary") || "").toLowerCase();

    const evaluatorAlias = alias(users, "ipr_evaluators");
    const targetUserParam = searchParams.get("userId");

    if (summaryScope === "all") {
      const rows = await db
        .select({
          userId: memberIprScores.userId,
          userName: users.name,
          evaluatedFor: memberIprScores.evaluatedFor,
          punctuality: memberIprScores.punctuality,
          academics: memberIprScores.academics,
          obedienceDiscipline: memberIprScores.obedienceDiscipline,
          languagePersonality: memberIprScores.languagePersonality,
          willSkill: memberIprScores.willSkill,
          totalScore: memberIprScores.totalScore,
          evaluatorId: memberIprScores.evaluatorId,
          evaluatorName: evaluatorAlias.name,
          remarks: memberIprScores.remarks,
          metricNotes: memberIprScores.metricNotes,
          updatedAt: memberIprScores.updatedAt,
          createdAt: memberIprScores.createdAt,
        })
        .from(memberIprScores)
        .innerJoin(users, eq(users.id, memberIprScores.userId))
        .leftJoin(evaluatorAlias, eq(evaluatorAlias.id, memberIprScores.evaluatorId))
        .where(eq(memberIprScores.evaluatedFor, isoDate))
        .orderBy(users.name);

      return NextResponse.json({
        scores: rows.map((row) => ({
          userId: row.userId,
          userName: row.userName || `Member #${row.userId}`,
          evaluatedFor: row.evaluatedFor,
          metrics: {
            punctuality: row.punctuality ?? 0,
            academics: row.academics ?? 0,
            obedienceDiscipline: row.obedienceDiscipline ?? 0,
            languagePersonality: row.languagePersonality ?? 0,
            willSkill: row.willSkill ?? 0,
          },
          total: row.totalScore ?? 0,
          evaluator: row.evaluatorId
            ? { id: row.evaluatorId, name: row.evaluatorName || null }
            : null,
          remarks: row.remarks || null,
          metricNotes: row.metricNotes || null,
          updatedAt: row.updatedAt,
          createdAt: row.createdAt,
        })),
      });
    }

    const targetUserId = targetUserParam ? Number(targetUserParam) : requesterId;
    if (Number.isNaN(targetUserId)) {
      return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
    }

    if (targetUserId !== requesterId && !["team_manager", "admin"].includes(requesterRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rows = await db
      .select({
        id: memberIprScores.id,
        evaluatedFor: memberIprScores.evaluatedFor,
        punctuality: memberIprScores.punctuality,
        academics: memberIprScores.academics,
        obedienceDiscipline: memberIprScores.obedienceDiscipline,
        languagePersonality: memberIprScores.languagePersonality,
        willSkill: memberIprScores.willSkill,
        totalScore: memberIprScores.totalScore,
        evaluatorId: memberIprScores.evaluatorId,
        evaluatorName: evaluatorAlias.name,
        remarks: memberIprScores.remarks,
        metricNotes: memberIprScores.metricNotes,
        updatedAt: memberIprScores.updatedAt,
        createdAt: memberIprScores.createdAt,
      })
      .from(memberIprScores)
      .leftJoin(evaluatorAlias, eq(evaluatorAlias.id, memberIprScores.evaluatorId))
      .where(and(eq(memberIprScores.userId, targetUserId), eq(memberIprScores.evaluatedFor, isoDate)))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return NextResponse.json({ ipr: null }, { status: 200 });
    }

    const metrics = {
      punctuality: row.punctuality ?? 0,
      academics: row.academics ?? 0,
      obedienceDiscipline: row.obedienceDiscipline ?? 0,
      languagePersonality: row.languagePersonality ?? 0,
      willSkill: row.willSkill ?? 0,
    };
    const total = row.totalScore || Object.values(metrics).reduce((acc, val) => acc + (Number(val) || 0), 0);

    return NextResponse.json(
      {
        ipr: {
          id: row.id,
          evaluatedFor: row.evaluatedFor,
          metrics,
          total,
          evaluator: row.evaluatorId
            ? { id: row.evaluatorId, name: row.evaluatorName || null }
            : null,
          remarks: row.remarks || null,
          metricNotes: row.metricNotes || null,
          updatedAt: row.updatedAt,
          createdAt: row.createdAt,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/member/ipr error", error);
    return NextResponse.json({ error: "Failed to load IPR" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requesterId = Number(session.user.id);
    if (Number.isNaN(requesterId)) {
      return NextResponse.json({ error: "Invalid session" }, { status: 400 });
    }

    const body = await req.json();
    const isoDate = normalizeDate(body?.date);
    if (!isoDate) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }

    const entries = Array.isArray(body?.entries) ? body.entries : [];
    if (!entries.length) {
      return NextResponse.json({ error: "entries[] required" }, { status: 400 });
    }

    // Ensure requester holds the team_day_close_moderator role
    const moderatorRole = await db
      .select({ id: userMriRoles.id })
      .from(userMriRoles)
      .where(
        and(
          eq(userMriRoles.userId, requesterId),
          eq(userMriRoles.active, true),
          eq(userMriRoles.role, "team_day_close_moderator")
        )
      )
      .limit(1);

    if (!moderatorRole.length && session.user.role !== "admin" && session.user.role !== "team_manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const clamp = (value) => {
      const num = Number(value);
      if (Number.isNaN(num)) return 0;
      return Math.min(10, Math.max(0, Math.round(num)));
    };

    const metricKeys = [
      "punctuality",
      "academics",
      "obedienceDiscipline",
      "languagePersonality",
      "willSkill",
    ];

    const sanitizeNote = (value) => {
      if (value === undefined || value === null) return null;
      const text = String(value).trim();
      if (!text) return null;
      return text.slice(0, 300);
    };

    let sanitizedEntries;
    try {
      sanitizedEntries = entries.map((entry) => {
        const userId = Number(entry?.userId);
        if (!userId) throw new Error("Invalid userId in entries");

        const metrics = metricKeys.reduce((acc, key) => {
          acc[key] = clamp(entry?.metrics?.[key]);
          return acc;
        }, {});

        const metricNotes = metricKeys.reduce((acc, key) => {
          acc[key] = sanitizeNote(entry?.metricNotes?.[key]);
          if (metrics[key] < 10 && !acc[key]) {
            throw new Error(`Reason required for ${key} when score is below 10`);
          }
          return acc;
        }, {});

        const totalScore = metricKeys.reduce((acc, key) => acc + (metrics[key] || 0), 0);
        const remarks = entry?.remarks ? String(entry.remarks).slice(0, 500) : null;

        return { userId, metrics, metricNotes, totalScore, remarks };
      });
    } catch (validationError) {
      return NextResponse.json({ error: validationError.message || "Invalid payload" }, { status: 400 });
    }

    const now = new Date();
    let upserts = 0;

    for (const entry of sanitizedEntries) {
      const { userId, metrics, metricNotes, totalScore, remarks } = entry;
      await db
        .insert(memberIprScores)
        .values({
          userId,
          evaluatedFor: isoDate,
          punctuality: metrics.punctuality,
          academics: metrics.academics,
          obedienceDiscipline: metrics.obedienceDiscipline,
          languagePersonality: metrics.languagePersonality,
          willSkill: metrics.willSkill,
          totalScore,
          evaluatorId: requesterId,
          remarks,
          metricNotes,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [memberIprScores.userId, memberIprScores.evaluatedFor],
          set: {
            punctuality: metrics.punctuality,
            academics: metrics.academics,
            obedienceDiscipline: metrics.obedienceDiscipline,
            languagePersonality: metrics.languagePersonality,
            willSkill: metrics.willSkill,
            totalScore,
            evaluatorId: requesterId,
            remarks,
            metricNotes,
            updatedAt: now,
          },
        });

      upserts += 1;
    }

    return NextResponse.json({ saved: upserts }, { status: 200 });
  } catch (error) {
    console.error("POST /api/member/ipr error", error);
    return NextResponse.json({ error: "Failed to save IPR" }, { status: 500 });
  }
}
