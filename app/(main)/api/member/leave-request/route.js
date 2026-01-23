import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, leaveRequests, messages, systemFlags } from "@/lib/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { writeFile } from "fs/promises";
import path from "path";

const LEAVE_PROOF_FLAG_KEY = "leave_proof_required";
const LEAVE_NOTICE_ANYTIME_KEY = "leave_notice_anytime";
const LEAVE_NOTICE_ONE_DAY_KEY = "leave_notice_one_day";

async function isProofRequired() {
  try {
    const [row] = await db
      .select({ value: systemFlags.value })
      .from(systemFlags)
      .where(eq(systemFlags.key, LEAVE_PROOF_FLAG_KEY))
      .limit(1);
    return row ? !!row.value : false;
  } catch (err) {
    console.error("Failed to read leave proof flag:", err);
    return false;
  }
}

async function getLeaveNoticePolicy() {
  try {
    const rows = await db
      .select({ key: systemFlags.key, value: systemFlags.value })
      .from(systemFlags)
      .where(inArray(systemFlags.key, [LEAVE_NOTICE_ANYTIME_KEY, LEAVE_NOTICE_ONE_DAY_KEY]));
    const map = new Map(rows.map((row) => [row.key, row.value]));
    const allowAnytime = map.has(LEAVE_NOTICE_ANYTIME_KEY) ? !!map.get(LEAVE_NOTICE_ANYTIME_KEY) : false;
    const oneDay = map.has(LEAVE_NOTICE_ONE_DAY_KEY) ? !!map.get(LEAVE_NOTICE_ONE_DAY_KEY) : false;
    const minNoticeDays = allowAnytime ? 0 : oneDay ? 1 : 2;
    return { allowAnytime, minNoticeDays };
  } catch (err) {
    console.error("Failed to read leave notice policy:", err);
    return { allowAnytime: false, minNoticeDays: 2 };
  }
}

export async function GET(req) {
  const session = await auth();
  console.log("Session in /api/member/leave-request:", { session });

  if (!session || !session.user || !["admin", "team_manager", "member"].includes(session.user.role)) {
    console.error("Unauthorized access attempt:", { session });
    return NextResponse.json(
      { error: "Unauthorized: Valid session and role required" },
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const requests = await db
      .select({
        id: leaveRequests.id,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        reason: leaveRequests.reason,
        proof: leaveRequests.proof,
        status: leaveRequests.status,
        submittedTo: leaveRequests.submittedTo,
        transferTo: leaveRequests.transferTo,
        createdAt: leaveRequests.createdAt,
        approvedAt: leaveRequests.approvedAt,
        supervisorName: users.name,
        approvedStartDate: leaveRequests.approvedStartDate,
        approvedEndDate: leaveRequests.approvedEndDate,
        decisionNote: leaveRequests.decisionNote,
        memberMessage: leaveRequests.memberMessage,
        rejectionReason: leaveRequests.rejectionReason,
        escalationMatterId: leaveRequests.escalationMatterId,
        category: leaveRequests.category,
        convertToCl: leaveRequests.convertToCl,
      })
      .from(leaveRequests)
      .leftJoin(users, eq(leaveRequests.submittedTo, users.id))
      .where(eq(leaveRequests.userId, parseInt(session.user.id)))
      .orderBy(desc(leaveRequests.createdAt));

    console.log("Fetched leave requests for user:", { userId: session.user.id, count: requests.length });
    return NextResponse.json(
      {
        requests,
        config: {
          proofRequired: await isProofRequired(),
          noticePolicy: await getLeaveNoticePolicy(),
        },
      },
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching leave requests:", error);
    return NextResponse.json(
      { error: `Failed to fetch leave requests: ${error.message}` },
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function POST(req) {
  const session = await auth();
  if (!session || !["admin", "team_manager", "member"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const startDate = formData.get("startDate");
    const endDate = formData.get("endDate");
    const reason = formData.get("reason");
    const proof = formData.get("proof");
    const transferTo = formData.get("transferTo");
    const category = String(formData.get("category") || "").toLowerCase();
    const convertToCl = formData.get("convertToCl") === "true";

    // Validate required fields
    if (!startDate || !endDate || !reason) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const allowedCategories = ["health", "event", "break", "personal"];
    const resolvedCategory = allowedCategories.includes(category) ? category : "personal";

    const proofRequired = await isProofRequired();
    const noticePolicy = await getLeaveNoticePolicy();

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }

    // Fetch user's immediate supervisor
    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        immediate_supervisor: users.immediate_supervisor,
      })
      .from(users)
      .where(eq(users.id, parseInt(session.user.id)));
    if (!user.immediate_supervisor) {
      return NextResponse.json({ error: "No immediate supervisor assigned" }, { status: 400 });
    }

    // Fetch supervisor's name for notification
    const [supervisor] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, user.immediate_supervisor));

    // Validate transferTo for team_manager
    let transferToId = null;
    if (session.user.role === "team_manager" && transferTo) {
      const [transferUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, parseInt(transferTo)));
      if (!transferUser) {
        return NextResponse.json({ error: "Invalid transfer user" }, { status: 400 });
      }
      transferToId = parseInt(transferTo);
    }

    // Handle proof file upload
    let proofUrl = null;
    if (proof && proof instanceof File) {
      const validTypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/jpeg", "image/png"];
      if (!validTypes.includes(proof.type)) {
        return NextResponse.json({ error: "Invalid file type. Use PDF, DOC, DOCX, JPG, or PNG." }, { status: 400 });
      }
      if (proof.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: "File size must be less than 5MB" }, { status: 400 });
      }

      const fileName = `${session.user.id}-${Date.now()}${path.extname(proof.name)}`;
      const filePath = path.join(process.cwd(), "public", "uploads", "leave-proofs", fileName);
      const buffer = Buffer.from(await proof.arrayBuffer());
      await writeFile(filePath, buffer);
      proofUrl = `/uploads/leave-proofs/${fileName}`;
    } else if (proofRequired) {
      return NextResponse.json({ error: "Supporting document is required for leave requests." }, { status: 400 });
    }

    // Additional business rules
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDay = new Date(start);
    startDay.setHours(0, 0, 0, 0);
    const diffMs = startDay.getTime() - today.getTime();
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    if (resolvedCategory === "health") {
      if (diffDays < 0 || diffDays > 1) {
        return NextResponse.json(
          { error: "Health leave can only be applied for today or tomorrow." },
          { status: 400 }
        );
      }
    } else {
      if (!noticePolicy.allowAnytime && diffDays < noticePolicy.minNoticeDays) {
        const dayLabel = noticePolicy.minNoticeDays === 1 ? "1 day" : `${noticePolicy.minNoticeDays} days`;
        return NextResponse.json(
          { error: `This leave type must be applied at least ${dayLabel} in advance.` },
          { status: 400 }
        );
      }
    }

    // Monthly limits
    const startMonth = startDay.getMonth();
    const startYear = startDay.getFullYear();

    const existingLeaves = await db
      .select({
        id: leaveRequests.id,
        category: leaveRequests.category,
        convertToCl: leaveRequests.convertToCl,
        status: leaveRequests.status,
        startDate: leaveRequests.startDate,
      })
      .from(leaveRequests)
      .where(eq(leaveRequests.userId, parseInt(session.user.id)));

    const relevantLeaves = Array.isArray(existingLeaves) ? existingLeaves : [];

    const clLeavesThisMonth = relevantLeaves.filter((leave) => {
      if (!leave.startDate) return false;
      const leaveDate = new Date(leave.startDate);
      return (
        leave.convertToCl &&
        leaveDate.getMonth() === startMonth &&
        leaveDate.getFullYear() === startYear &&
        leave.status !== "rejected"
      );
    }).length;

    if (convertToCl && clLeavesThisMonth >= 1) {
      return NextResponse.json(
        { error: "You have already converted a leave to CL this month." },
        { status: 400 }
      );
    }

    // Insert leave request
    const [newRequest] = await db
      .insert(leaveRequests)
      .values({
        userId: parseInt(session.user.id),
        startDate: start,
        endDate: end,
        reason,
        proof: proofUrl,
        transferTo: transferToId,
        submittedTo: user.immediate_supervisor,
        status: "pending",
        category: resolvedCategory,
        convertToCl,
      })
      .returning();

    // Send notification to the requester
    await db
      .insert(messages)
      .values({
        senderId: parseInt(session.user.id),
        recipientId: parseInt(session.user.id),
        content: `Your leave request from ${startDate} to ${endDate} has been submitted and is pending approval by ${supervisor.name}.`,
        status: "sent",
      });

    // Send notification to the immediate supervisor
    await db
      .insert(messages)
      .values({
        senderId: parseInt(session.user.id),
        recipientId: user.immediate_supervisor,
        content: `New leave request submitted by ${user.name} from ${startDate} to ${endDate}. Please review and approve or reject.`,
        status: "sent",
      });

    return NextResponse.json({ request: newRequest, message: "Leave request submitted successfully" }, { status: 201 });
  } catch (error) {
    console.error("Error submitting leave request:", error);
    return NextResponse.json({ error: `Failed to submit leave request: ${error.message}` }, { status: 500 });
  }
}
