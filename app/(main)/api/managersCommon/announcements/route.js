import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { announcements, users } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session || !["admin", "team_manager", "member"].includes(session.user?.role)) {
    console.error("Unauthorized access attempt:", { user: session?.user });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const announcementData = await db
      .select({
        id: announcements.id,
        target: announcements.target,
        program: announcements.program,
        programTitle: announcements.programTitle,
        content: announcements.content,
        attachments: announcements.attachments,
        createdAt: announcements.createdAt,
        createdBy: announcements.createdBy,
        createdByName: users.name,
      })
      .from(announcements)
      .leftJoin(users, eq(announcements.createdBy, users.id))
      .orderBy(announcements.createdAt.desc());

    console.log("Fetched announcements:", announcementData);
    return NextResponse.json({ announcements: announcementData }, { status: 200 });
  } catch (error) {
    console.error("Error fetching announcements:", error);
    return NextResponse.json({ error: `Failed to fetch announcements: ${error.message}` }, { status: 500 });
  }
}

export async function POST(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager"].includes(session.user?.role)) {
    console.error("Unauthorized access attempt:", { user: session?.user });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { target, program, programTitle, content, attachments } = await req.json();

    if (!target || !["team_members", "students", "all"].includes(target)) {
      return NextResponse.json({ error: "Invalid or missing target audience" }, { status: 400 });
    }
    if (!program || !["MSP", "MSP-E", "MHCP", "MNP", "MGHP", "MAP", "M4E", "Other"].includes(program)) {
      return NextResponse.json({ error: "Invalid or missing program" }, { status: 400 });
    }
    if (program === "Other" && !programTitle) {
      return NextResponse.json({ error: "Program title is required for 'Other' program" }, { status: 400 });
    }
    if (!content || content.trim() === "") {
      return NextResponse.json({ error: "Announcement content is required" }, { status: 400 });
    }
    if (!Array.isArray(attachments)) {
      return NextResponse.json({ error: "Attachments must be an array" }, { status: 400 });
    }
    for (const url of attachments) {
      if (!/^https?:\/\/[^\s]+$/.test(url)) {
        return NextResponse.json({ error: `Invalid attachment URL: ${url}` }, { status: 400 });
      }
    }

    const [newAnnouncement] = await db
      .insert(announcements)
      .values({
        createdBy: session.user.id,
        target,
        program,
        programTitle: program === "Other" ? programTitle : null,
        content,
        attachments,
        createdAt: new Date(),
      })
      .returning({
        id: announcements.id,
        target: announcements.target,
        program: announcements.program,
        programTitle: announcements.programTitle,
        content: announcements.content,
        attachments: announcements.attachments,
        createdAt: announcements.createdAt,
      });

    console.log("Posted announcement:", newAnnouncement);
    return NextResponse.json({ announcement: newAnnouncement, message: "Announcement posted successfully" }, { status: 201 });
  } catch (error) {
    console.error("Error posting announcement:", error);
    return NextResponse.json({ error: `Failed to post announcement: ${error.message}` }, { status: 500 });
  }
}