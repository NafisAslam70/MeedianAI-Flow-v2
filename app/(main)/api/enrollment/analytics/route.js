import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  enrollmentGuardians,
  enrollmentGuardianInteractions,
  enrollmentAnalytics,
} from "@/lib/schema";
import { and, avg, count, eq, gte, lte, sql } from "drizzle-orm";

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user?.role || !["admin", "team_manager"].includes(session.user.role)) {
      return unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "monthly";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const now = new Date();
    let dateFrom;
    let dateTo;

    if (startDate && endDate) {
      dateFrom = new Date(startDate);
      dateTo = new Date(endDate);
    } else {
      dateTo = now;
      dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const totalGuardians = await db.select({ count: count() }).from(enrollmentGuardians);

    const highInterestGuardians = await db
      .select({ count: count() })
      .from(enrollmentGuardians)
      .where(eq(enrollmentGuardians.status, "high_interest"));

    const boardingInterested = await db
      .select({ count: count() })
      .from(enrollmentGuardians)
      .where(sql`interests->>'boarding_interest' = 'yes'`);

    const avgEngagement = await db
      .select({ avg: avg(enrollmentGuardians.engagementScore) })
      .from(enrollmentGuardians);

    const recentInteractions = await db
      .select({
        count: count(),
        date: sql`DATE(${enrollmentGuardianInteractions.createdAt})`,
      })
      .from(enrollmentGuardianInteractions)
      .where(
        and(
          gte(enrollmentGuardianInteractions.createdAt, dateFrom),
          lte(enrollmentGuardianInteractions.createdAt, dateTo)
        )
      )
      .groupBy(sql`DATE(${enrollmentGuardianInteractions.createdAt})`)
      .orderBy(sql`DATE(${enrollmentGuardianInteractions.createdAt})`);

    const interactionTypes = await db
      .select({
        type: enrollmentGuardianInteractions.type,
        count: count(),
      })
      .from(enrollmentGuardianInteractions)
      .where(
        and(
          gte(enrollmentGuardianInteractions.createdAt, dateFrom),
          lte(enrollmentGuardianInteractions.createdAt, dateTo)
        )
      )
      .groupBy(enrollmentGuardianInteractions.type);

    const statusDistribution = await db
      .select({
        status: enrollmentGuardians.status,
        count: count(),
      })
      .from(enrollmentGuardians)
      .groupBy(enrollmentGuardians.status);

    const sourceBreakdown = await db
      .select({
        source: enrollmentGuardians.source,
        count: count(),
      })
      .from(enrollmentGuardians)
      .where(sql`${enrollmentGuardians.source} is not null`)
      .groupBy(enrollmentGuardians.source);

    const locationDistribution = await db
      .select({
        location: enrollmentGuardians.location,
        count: count(),
      })
      .from(enrollmentGuardians)
      .groupBy(enrollmentGuardians.location)
      .orderBy(sql`count(*) DESC`)
      .limit(10);

    const engagementTrends = await db
      .select({
        date: sql`DATE(${enrollmentGuardians.updatedAt})`,
        avgScore: avg(enrollmentGuardians.engagementScore),
        count: count(),
      })
      .from(enrollmentGuardians)
      .where(
        and(
          gte(enrollmentGuardians.updatedAt, dateFrom),
          lte(enrollmentGuardians.updatedAt, dateTo)
        )
      )
      .groupBy(sql`DATE(${enrollmentGuardians.updatedAt})`)
      .orderBy(sql`DATE(${enrollmentGuardians.updatedAt})`);

    const topRegions = await db
      .select({
        location: enrollmentGuardians.location,
        totalGuardians: count(),
        highInterest: sql`COUNT(CASE WHEN status = 'high_interest' THEN 1 END)`,
        avgEngagement: avg(enrollmentGuardians.engagementScore),
      })
      .from(enrollmentGuardians)
      .groupBy(enrollmentGuardians.location)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(5);

    const conversionMetrics = await db
      .select({
        totalLeads: sql`COUNT(*)`,
        nurturing: sql`COUNT(CASE WHEN status = 'nurturing' THEN 1 END)`,
        highInterest: sql`COUNT(CASE WHEN status = 'high_interest' THEN 1 END)`,
        enrolled: sql`COUNT(CASE WHEN status = 'enrolled' THEN 1 END)`,
      })
      .from(enrollmentGuardians);

    const recentActivity = await db
      .select({
        id: enrollmentGuardianInteractions.id,
        type: enrollmentGuardianInteractions.type,
        content: enrollmentGuardianInteractions.content,
        createdAt: enrollmentGuardianInteractions.createdAt,
        guardianName: enrollmentGuardians.name,
        guardianId: enrollmentGuardians.id,
      })
      .from(enrollmentGuardianInteractions)
      .leftJoin(
        enrollmentGuardians,
        eq(enrollmentGuardianInteractions.guardianId, enrollmentGuardians.id)
      )
      .orderBy(sql`${enrollmentGuardianInteractions.createdAt} DESC`)
      .limit(10);

    const totalLeads = Number(conversionMetrics[0]?.totalLeads || 0);
    const nurturing = Number(conversionMetrics[0]?.nurturing || 0);
    const highInterest = Number(conversionMetrics[0]?.highInterest || 0);
    const enrolled = Number(conversionMetrics[0]?.enrolled || 0);
    const safeRate = (value) => (totalLeads ? Math.round((value / totalLeads) * 100) : 0);

    return NextResponse.json({
      overview: {
        totalGuardians: Number(totalGuardians[0]?.count || 0),
        highInterestGuardians: Number(highInterestGuardians[0]?.count || 0),
        boardingInterested: Number(boardingInterested[0]?.count || 0),
        avgEngagement: Math.round(Number(avgEngagement[0]?.avg || 0)),
      },
      trends: {
        interactionTrends: recentInteractions.map((item) => ({
          date: item.date,
          interactions: item.count,
        })),
        engagementTrends: engagementTrends.map((item) => ({
          date: item.date,
          avgScore: Math.round(Number(item.avgScore || 0)),
          count: item.count,
        })),
      },
      distributions: {
        status: statusDistribution.map((item) => ({
          status: item.status,
          count: item.count,
        })),
        interactionTypes: interactionTypes.map((item) => ({
          type: item.type,
          count: item.count,
        })),
        sources: sourceBreakdown.map((item) => ({
          source: item.source || "Unknown",
          count: item.count,
        })),
        locations: locationDistribution.map((item) => ({
          location: item.location,
          count: item.count,
        })),
      },
      regions: {
        topPerforming: topRegions.map((item) => ({
          location: item.location,
          totalGuardians: item.totalGuardians,
          highInterest: item.highInterest,
          avgEngagement: Math.round(Number(item.avgEngagement || 0)),
        })),
      },
      conversion: {
        totalLeads,
        nurturingRate: safeRate(nurturing),
        interestRate: safeRate(highInterest),
        enrollmentRate: safeRate(enrolled),
      },
      recentActivity: recentActivity.map((item) => ({
        id: item.id,
        type: item.type,
        content: item.content || `${item.type} interaction`,
        createdAt: item.createdAt,
        guardian: {
          id: item.guardianId,
          name: item.guardianName,
        },
      })),
      period,
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.role || !["admin", "team_manager"].includes(session.user.role)) {
      return unauthorized();
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const eventType = typeof body?.eventType === "string" ? body.eventType.trim() : "";
    const eventData = body?.eventData ?? null;
    const guardianId = Number(body?.guardianId);

    if (!eventType) {
      return NextResponse.json({ error: "eventType is required" }, { status: 400 });
    }

    const [analyticsEntry] = await db
      .insert(enrollmentAnalytics)
      .values({
        date: new Date(),
        period: "daily",
        eventType,
        eventData: eventData || undefined,
        guardianId: Number.isFinite(guardianId) ? guardianId : null,
        createdAt: new Date(),
      })
      .returning();

    return NextResponse.json({ success: true, analytics: analyticsEntry });
  } catch (error) {
    console.error("Error storing analytics:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
