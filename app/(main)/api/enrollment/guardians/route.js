import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  enrollmentGuardians,
  enrollmentGuardianChildren,
  enrollmentGuardianInteractions,
} from "@/lib/schema";
import { and, desc, eq, ilike, or } from "drizzle-orm";

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user?.role || !["admin", "team_manager"].includes(session.user.role)) {
      return unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || "").trim();
    const status = searchParams.get("status") || "all";
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") || 50)));
    const offset = (page - 1) * limit;

    const filters = [];
    if (search) {
      filters.push(
        or(
          ilike(enrollmentGuardians.name, `%${search}%`),
          ilike(enrollmentGuardians.location, `%${search}%`),
          ilike(enrollmentGuardians.whatsapp, `%${search}%`)
        )
      );
    }
    if (status !== "all") {
      filters.push(eq(enrollmentGuardians.status, status));
    }

    let query = db.select().from(enrollmentGuardians);
    if (filters.length) {
      query = query.where(and(...filters));
    }

    const guardiansList = await query
      .orderBy(desc(enrollmentGuardians.lastContact))
      .limit(limit)
      .offset(offset);

    const enrichedGuardians = await Promise.all(
      guardiansList.map(async (guardian) => {
        const children = await db
          .select()
          .from(enrollmentGuardianChildren)
          .where(eq(enrollmentGuardianChildren.guardianId, guardian.id));

        const interactions = await db
          .select()
          .from(enrollmentGuardianInteractions)
          .where(eq(enrollmentGuardianInteractions.guardianId, guardian.id))
          .orderBy(desc(enrollmentGuardianInteractions.createdAt))
          .limit(10);

        return {
          ...guardian,
          children,
          interactions,
        };
      })
    );

    return NextResponse.json({
      guardians: enrichedGuardians,
      pagination: {
        page,
        limit,
        total: guardiansList.length,
      },
    });
  } catch (error) {
    console.error("Error fetching guardians:", error);
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

    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const whatsapp = typeof body?.whatsapp === "string" ? body.whatsapp.trim() : "";
    const location = typeof body?.location === "string" ? body.location.trim() : "";
    const interests = body?.interests ?? null;
    const notes = typeof body?.notes === "string" ? body.notes.trim() : null;
    const children = Array.isArray(body?.children) ? body.children : [];

    if (!name || !whatsapp || !location) {
      return NextResponse.json(
        { error: "name, whatsapp, and location are required" },
        { status: 400 }
      );
    }

    const createdBy = Number(session.user.id);
    if (!Number.isFinite(createdBy)) {
      return unauthorized();
    }

    const [newGuardian] = await db
      .insert(enrollmentGuardians)
      .values({
        name,
        whatsapp,
        location,
        interests: interests || undefined,
        notes: notes || null,
        status: "new_lead",
        engagementScore: 0,
        lastContact: new Date(),
        createdBy,
        updatedAt: new Date(),
      })
      .returning();

    if (!newGuardian) {
      return NextResponse.json({ error: "Failed to create guardian" }, { status: 500 });
    }

    if (children.length) {
      const childRows = children
        .map((child) => {
          const childName = typeof child?.name === "string" ? child.name.trim() : "";
          if (!childName) return null;
          return {
            guardianId: newGuardian.id,
            name: childName,
            age: typeof child?.age === "number" ? child.age : null,
            currentSchool: typeof child?.currentSchool === "string" ? child.currentSchool.trim() : null,
            grade: typeof child?.grade === "string" ? child.grade.trim() : null,
            createdAt: new Date(),
          };
        })
        .filter(Boolean);

      if (childRows.length) {
        await db.insert(enrollmentGuardianChildren).values(childRows);
      }
    }

    return NextResponse.json({ guardian: newGuardian }, { status: 201 });
  } catch (error) {
    console.error("Error creating guardian:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const session = await auth();
    if (!session?.user?.role || !["admin", "team_manager"].includes(session.user.role)) {
      return unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const guardianId = Number(searchParams.get("id"));
    if (!Number.isFinite(guardianId)) {
      return NextResponse.json({ error: "Guardian ID required" }, { status: 400 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { id, createdBy, createdAt, ...rest } = body || {};
    const updateData = {
      ...rest,
      updatedAt: new Date(),
    };

    const [updatedGuardian] = await db
      .update(enrollmentGuardians)
      .set(updateData)
      .where(eq(enrollmentGuardians.id, guardianId))
      .returning();

    if (!updatedGuardian) {
      return NextResponse.json({ error: "Guardian not found" }, { status: 404 });
    }

    return NextResponse.json({ guardian: updatedGuardian });
  } catch (error) {
    console.error("Error updating guardian:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
