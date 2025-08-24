import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { leaveRequests, messages, users } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";

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
    const query = db
      .select({
        id: leaveRequests.id,
        userId: leaveRequests.userId,
        userName: users.name,
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
      })
      .from(leaveRequests)
      .leftJoin(users, eq(leaveRequests.userId, users.id))
      .orderBy(desc(leaveRequests.createdAt));

    const requests = session.user.role === "admin"
      ? await query
      : await query.where(eq(leaveRequests.submittedTo, parseInt(session.user.id)));

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
    const { requestId, status } = await req.json();
    if (!requestId || !["approved", "rejected"].includes(status)) {
      return NextResponse.json({ error: "Invalid request ID or status" }, { status: 400 });
    }

    // Fetch the leave request and user details
    const [request] = await db
      .select({
        id: leaveRequests.id,
        userId: leaveRequests.userId,
        submittedTo: leaveRequests.submittedTo,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        userName: users.name,
      })
      .from(leaveRequests)
      .leftJoin(users, eq(leaveRequests.userId, users.id))
      .where(eq(leaveRequests.id, requestId));

    if (!request) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    }

    // Allow admins to approve/reject any request, team managers only their own
    if (session.user.role !== "admin" && request.submittedTo !== parseInt(session.user.id)) {
      return NextResponse.json({ error: "Unauthorized: You are not the assigned supervisor" }, { status: 403 });
    }

    // Update the leave request status
    const [updatedRequest] = await db
      .update(leaveRequests)
      .set({
        status,
        approvedBy: parseInt(session.user.id),
        approvedAt: new Date(),
      })
      .where(eq(leaveRequests.id, requestId))
      .returning();

    // Send notification to the requester
    await db
      .insert(messages)
      .values({
        senderId: parseInt(session.user.id),
        recipientId: request.userId,
        content: `Your leave request from ${updatedRequest.startDate.toISOString().split("T")[0]} to ${updatedRequest.endDate.toISOString().split("T")[0]} has been ${status} by ${session.user.name}.`,
        status: "sent",
      });

    // Send notification to the supervisor (self)
    await db
      .insert(messages)
      .values({
        senderId: parseInt(session.user.id),
        recipientId: parseInt(session.user.id),
        content: `You have ${status} the leave request from ${request.userName} for ${updatedRequest.startDate.toISOString().split("T")[0]} to ${updatedRequest.endDate.toISOString().split("T")[0]}.`,
        status: "sent",
      });

    return NextResponse.json({ request: updatedRequest, message: `Leave request ${status} successfully` }, { status: 200 });
  } catch (error) {
    console.error("Error processing leave request:", error);
    return NextResponse.json({ error: `Failed to process leave request: ${error.message}` }, { status: 500 });
  }
}