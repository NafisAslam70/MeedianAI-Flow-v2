import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { leaveRequests, messages, users, escalationsMatters } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

const formatDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
};

export async function GET(req) {
  const session = await auth();
  console.log("Session in /api/managersCommon/approve-leave-request:", { session });

  if (!session || !session.user || !["admin", "team_manager"].includes(session.user.role)) {
    console.error("Unauthorized access attempt:", { session });
    return NextResponse.json(
      { error: "Unauthorized: Admin or Team Manager access required" },
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const requester = alias(users, "leave_requester");
    const supervisor = alias(users, "leave_supervisor");
    const transferTarget = alias(users, "leave_transfer_target");
    const approver = alias(users, "leave_approver");

    let query = db
      .select({
        id: leaveRequests.id,
        userId: leaveRequests.userId,
        userName: requester.name,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        approvedStartDate: leaveRequests.approvedStartDate,
        approvedEndDate: leaveRequests.approvedEndDate,
        reason: leaveRequests.reason,
        proof: leaveRequests.proof,
        status: leaveRequests.status,
        submittedTo: leaveRequests.submittedTo,
        supervisorName: supervisor.name,
        transferTo: leaveRequests.transferTo,
        transferToName: transferTarget.name,
        createdAt: leaveRequests.createdAt,
        approvedAt: leaveRequests.approvedAt,
        approvedBy: leaveRequests.approvedBy,
        approvedByName: approver.name,
        decisionNote: leaveRequests.decisionNote,
        memberMessage: leaveRequests.memberMessage,
        rejectionReason: leaveRequests.rejectionReason,
        escalationMatterId: leaveRequests.escalationMatterId,
        category: leaveRequests.category,
        convertToCl: leaveRequests.convertToCl,
      })
      .from(leaveRequests)
      .leftJoin(requester, eq(leaveRequests.userId, requester.id))
      .leftJoin(supervisor, eq(leaveRequests.submittedTo, supervisor.id))
      .leftJoin(transferTarget, eq(leaveRequests.transferTo, transferTarget.id))
      .leftJoin(approver, eq(leaveRequests.approvedBy, approver.id))
      .orderBy(desc(leaveRequests.createdAt));

    if (session.user.role !== "admin") {
      query = query.where(eq(leaveRequests.submittedTo, parseInt(session.user.id)));
    }

    const requests = await query;

    console.log("Fetched leave requests for user:", { userId: session.user.id, count: requests.length });
    return NextResponse.json(
      { requests },
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
  if (!session || !["admin", "team_manager"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized: Admin or Team Manager access required" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const requestId = Number(body.requestId);
    const inferredAction =
      body.action ||
      (body.status === "approved"
        ? "approve"
        : body.status === "rejected"
        ? "reject"
        : null);

    if (!requestId || !["approve", "reject", "attachEscalation"].includes(inferredAction)) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const requester = alias(users, "leave_requester");
    const supervisor = alias(users, "leave_supervisor");

    const [request] = await db
      .select({
        id: leaveRequests.id,
        userId: leaveRequests.userId,
        userName: requester.name,
        userWhatsapp: requester.whatsapp_number,
        submittedTo: leaveRequests.submittedTo,
        supervisorName: supervisor.name,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        status: leaveRequests.status,
        approvedStartDate: leaveRequests.approvedStartDate,
        approvedEndDate: leaveRequests.approvedEndDate,
        decisionNote: leaveRequests.decisionNote,
        memberMessage: leaveRequests.memberMessage,
        escalationMatterId: leaveRequests.escalationMatterId,
        category: leaveRequests.category,
        convertToCl: leaveRequests.convertToCl,
      })
      .from(leaveRequests)
      .leftJoin(requester, eq(leaveRequests.userId, requester.id))
      .leftJoin(supervisor, eq(leaveRequests.submittedTo, supervisor.id))
      .where(eq(leaveRequests.id, requestId));

    if (!request) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    }

    if (session.user.role !== "admin" && request.submittedTo !== Number(session.user.id)) {
      return NextResponse.json({ error: "Unauthorized: You are not the assigned supervisor" }, { status: 403 });
    }

    const actorId = Number(session.user.id);
    const actorName = session.user.name || "Manager";
    const now = new Date();
    const notifyMemberFlagSupplied = Object.prototype.hasOwnProperty.call(body, "notifyMember");
    const notifyMember = notifyMemberFlagSupplied ? !!body.notifyMember : true; // preserve legacy auto-messages
    const rawDecisionNote = typeof body.decisionNote === "string" ? body.decisionNote.trim() : "";
    const rawMemberMessage = typeof body.memberMessage === "string" ? body.memberMessage.trim() : "";

    if (inferredAction === "approve") {
      const requestedStart = request.startDate instanceof Date ? request.startDate : new Date(request.startDate);
      const requestedEnd = request.endDate instanceof Date ? request.endDate : new Date(request.endDate);

      const approvedStart = body.approvedStartDate ? new Date(body.approvedStartDate) : requestedStart;
      const approvedEnd = body.approvedEndDate ? new Date(body.approvedEndDate) : requestedEnd;

      if (Number.isNaN(approvedStart.getTime()) || Number.isNaN(approvedEnd.getTime())) {
        return NextResponse.json({ error: "Approved date range is invalid" }, { status: 400 });
      }
      if (approvedStart > approvedEnd) {
        return NextResponse.json({ error: "Approved start date cannot be after approved end date" }, { status: 400 });
      }
      if (approvedStart < requestedStart || approvedEnd > requestedEnd) {
        return NextResponse.json({ error: "Approved range must be within the requested dates" }, { status: 400 });
      }

      const [updatedRequest] = await db
        .update(leaveRequests)
        .set({
          status: "approved",
          approvedBy: actorId,
          approvedAt: now,
          approvedStartDate: approvedStart,
          approvedEndDate: approvedEnd,
          decisionNote: rawDecisionNote || null,
          memberMessage: rawMemberMessage || null,
          rejectionReason: null,
        })
        .where(eq(leaveRequests.id, requestId))
        .returning();

      const requestedRange = `${formatDate(requestedStart)} → ${formatDate(requestedEnd)}`;
      const approvedRange = `${formatDate(approvedStart)} → ${formatDate(approvedEnd)}`;
      let composedMessage = `Your leave request (${requestedRange}) has been approved by ${actorName}.`;
      if (requestedRange !== approvedRange) {
        composedMessage += ` Approved for ${approvedRange}.`;
      }
      if (rawMemberMessage) {
        composedMessage += ` ${rawMemberMessage}`;
      }

      if (notifyMember) {
        await db.insert(messages).values({
          senderId: actorId,
          recipientId: request.userId,
          subject: "Leave request approved",
          message: composedMessage,
          content: composedMessage,
          status: "sent",
        });
      }

      await db.insert(messages).values({
        senderId: actorId,
        recipientId: actorId,
        subject: "Leave approval logged",
        message: `Approved leave for ${request.userName} (${requestedRange}).`,
        content: `Approved leave for ${request.userName} (${requestedRange}).`,
        status: "sent",
      });

      return NextResponse.json(
        {
          request: {
            ...updatedRequest,
            userName: request.userName,
            supervisorName: request.supervisorName,
          },
          message: "Leave request approved successfully",
        },
        { status: 200 }
      );
    }

    if (inferredAction === "reject") {
      const rejectionReason = typeof body.rejectionReason === "string" ? body.rejectionReason.trim() : "";
      if (!rejectionReason) {
        return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 });
      }

      const [updatedRequest] = await db
        .update(leaveRequests)
        .set({
          status: "rejected",
          approvedBy: actorId,
          approvedAt: now,
          approvedStartDate: null,
          approvedEndDate: null,
          decisionNote: rawDecisionNote || rejectionReason,
          memberMessage: rawMemberMessage || null,
          rejectionReason,
        })
        .where(eq(leaveRequests.id, requestId))
        .returning();

      const requestedStart = request.startDate instanceof Date ? request.startDate : new Date(request.startDate);
      const requestedEnd = request.endDate instanceof Date ? request.endDate : new Date(request.endDate);
      const requestedRange = `${formatDate(requestedStart)} → ${formatDate(requestedEnd)}`;
      let composedMessage = `Your leave request (${requestedRange}) was rejected by ${actorName}. Reason: ${rejectionReason}.`;
      if (rawMemberMessage) {
        composedMessage += ` ${rawMemberMessage}`;
      }

      if (notifyMember) {
        await db.insert(messages).values({
          senderId: actorId,
          recipientId: request.userId,
          subject: "Leave request rejected",
          message: composedMessage,
          content: composedMessage,
          status: "sent",
        });
      }

      await db.insert(messages).values({
        senderId: actorId,
        recipientId: actorId,
        subject: "Leave rejection logged",
        message: `Rejected leave for ${request.userName} (${requestedRange}).`,
        content: `Rejected leave for ${request.userName} (${requestedRange}).`,
        status: "sent",
      });

      return NextResponse.json(
        {
          request: {
            ...updatedRequest,
            userName: request.userName,
            supervisorName: request.supervisorName,
          },
          message: "Leave request rejected successfully",
        },
        { status: 200 }
      );
    }

    const escalationMatterId = Number(body.matterId || body.escalationMatterId);
    if (!escalationMatterId) {
      return NextResponse.json({ error: "Escalation matter ID is required" }, { status: 400 });
    }

    const [matter] = await db
      .select({ id: escalationsMatters.id })
      .from(escalationsMatters)
      .where(eq(escalationsMatters.id, escalationMatterId))
      .limit(1);

    if (!matter) {
      return NextResponse.json({ error: "Escalation matter not found" }, { status: 404 });
    }

    const [updatedRequest] = await db
      .update(leaveRequests)
      .set({
        escalationMatterId,
        decisionNote: rawDecisionNote || request.decisionNote || null,
        memberMessage: rawMemberMessage || request.memberMessage || null,
      })
      .where(eq(leaveRequests.id, requestId))
      .returning();

    if (notifyMember && rawMemberMessage) {
      await db.insert(messages).values({
        senderId: actorId,
        recipientId: request.userId,
        subject: "Leave request escalated",
        message: rawMemberMessage,
        content: rawMemberMessage,
        status: "sent",
      });
    }

    await db.insert(messages).values({
      senderId: actorId,
      recipientId: actorId,
      subject: "Leave escalation linked",
      message: `Linked leave request from ${request.userName} to escalation matter #${escalationMatterId}.`,
      content: `Linked leave request from ${request.userName} to escalation matter #${escalationMatterId}.`,
      status: "sent",
    });

    return NextResponse.json(
      {
        request: {
          ...updatedRequest,
          userName: request.userName,
          supervisorName: request.supervisorName,
        },
        message: "Escalation attached to leave request",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error processing leave request:", error);
    return NextResponse.json({ error: `Failed to process leave request: ${error.message}` }, { status: 500 });
  }
}
