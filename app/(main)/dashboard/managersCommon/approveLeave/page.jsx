"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Check, X, Loader2, AlertTriangle, ArrowUpRight } from "lucide-react";

const formatDateDisplay = (value) => {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

const formatDateTimeDisplay = (value) => {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toInputDateValue = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const parseDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeRequest = (request) => {
  if (!request) return null;
  return {
    ...request,
    id: Number(request.id),
    userId: request.userId != null ? Number(request.userId) : null,
    submittedTo: request.submittedTo != null ? Number(request.submittedTo) : null,
    transferTo: request.transferTo != null ? Number(request.transferTo) : null,
    escalationMatterId: request.escalationMatterId != null ? Number(request.escalationMatterId) : null,
    startDate: parseDate(request.startDate),
    endDate: parseDate(request.endDate),
    approvedStartDate: parseDate(request.approvedStartDate),
    approvedEndDate: parseDate(request.approvedEndDate),
    createdAt: parseDate(request.createdAt),
    approvedAt: parseDate(request.approvedAt),
  };
};

const normalizeUser = (user) => ({
  id: Number(user.id),
  name: user.name || `User #${user.id}`,
  role: user.role || "member",
});

export default function ApproveLeave() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [leaveRequests, setLeaveRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isFetching, setIsFetching] = useState(true);
  const [actionLoading, setActionLoading] = useState(null); // "approve" | "reject" | "escalate" | null

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [approvedStartInput, setApprovedStartInput] = useState("");
  const [approvedEndInput, setApprovedEndInput] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [memberMessage, setMemberMessage] = useState("");
  const [notifyMember, setNotifyMember] = useState(true);
  const [rejectionReason, setRejectionReason] = useState("");
  const [activeActionTab, setActiveActionTab] = useState("approve");

  const [escalationTitle, setEscalationTitle] = useState("");
  const [escalationNote, setEscalationNote] = useState("");
  const [escalationAssignee, setEscalationAssignee] = useState("");
  const [escalationDecisionNote, setEscalationDecisionNote] = useState("");
  const [escalationNotifyMember, setEscalationNotifyMember] = useState(false);
  const [escalationMemberMessage, setEscalationMemberMessage] = useState("");

  const eligibleEscalationAssignees = useMemo(
    () =>
      users
        .filter((user) => ["admin", "team_manager"].includes(user.role))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [users]
  );

  const updateRequestInState = (updated) => {
    const normalized = normalizeRequest(updated);
    if (!normalized) return;
    setLeaveRequests((prev) => prev.map((item) => (item.id === normalized.id ? normalized : item)));
    setSelectedRequest((prev) => (prev && prev.id === normalized.id ? normalized : prev));
  };

  const refreshLeaveRequests = async () => {
    setIsFetching(true);
    try {
      const response = await fetch("/api/managersCommon/approve-leave-request", {
        credentials: "include",
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to fetch leave requests");
      }
      const data = await response.json();
      const normalized = (data.requests || []).map(normalizeRequest);
      setLeaveRequests(normalized);
      setSelectedRequest((prev) => {
        if (!prev) return prev;
        const match = normalized.find((item) => item.id === prev.id);
        return match || prev;
      });
    } catch (err) {
      setError(err.message || "Unable to load leave requests.");
      setTimeout(() => setError(""), 4000);
    } finally {
      setIsFetching(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/member/users", { credentials: "include" });
      if (!response.ok) return;
      const data = await response.json();
      const normalized = Array.isArray(data.users) ? data.users.map(normalizeUser) : [];
      setUsers(normalized);
    } catch {
      // fail soft; escalation form will still work with manual entry
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      refreshLeaveRequests();
      fetchUsers();
    }
  }, [status]);

  useEffect(() => {
    if (!selectedRequest) return;
    setApprovedStartInput(
      toInputDateValue(selectedRequest.approvedStartDate || selectedRequest.startDate)
    );
    setApprovedEndInput(
      toInputDateValue(selectedRequest.approvedEndDate || selectedRequest.endDate)
    );
    setDecisionNote(selectedRequest.decisionNote || "");
    setMemberMessage(selectedRequest.memberMessage || "");
    setNotifyMember(true);
    setRejectionReason(selectedRequest.rejectionReason || "");
    setEscalationDecisionNote(selectedRequest.decisionNote || "");
    setEscalationMemberMessage("");
    setEscalationNotifyMember(false);
    setActiveActionTab("approve");
    const defaultTitle = selectedRequest.userName
      ? `Leave escalation: ${selectedRequest.userName}`
      : "Leave escalation";
    setEscalationTitle(defaultTitle);
    setEscalationNote(
      `Please review the leave request for ${
        selectedRequest.userName || "the member"
      } (${formatDateDisplay(selectedRequest.startDate)} → ${formatDateDisplay(
        selectedRequest.endDate
      )}).`
    );
    setEscalationAssignee("");
  }, [selectedRequest]);

  if (status === "loading") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 flex items-center justify-center bg-gray-50"
      >
        <motion.div className="text-xl font-semibold text-gray-600">Loading...</motion.div>
      </motion.div>
    );
  }

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  const handleBack = () => {
    router.push("/dashboard/managersCommon");
  };

  const closeReviewModal = () => {
    setShowReviewModal(false);
    setTimeout(() => setSelectedRequest(null), 200);
  };

  const handleApprove = async () => {
    if (!selectedRequest || selectedRequest.status !== "pending") return;
    if (!approvedStartInput || !approvedEndInput) {
      setError("Please select the approved start and end dates.");
      setTimeout(() => setError(""), 3000);
      return;
    }
    setActionLoading("approve");
    setError("");
    try {
      const response = await fetch("/api/managersCommon/approve-leave-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          requestId: selectedRequest.id,
          action: "approve",
          approvedStartDate: approvedStartInput,
          approvedEndDate: approvedEndInput,
          decisionNote,
          memberMessage,
          notifyMember,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to approve leave request");
      }
      updateRequestInState(data.request);
      setSuccess(data.message || "Leave request approved.");
      setTimeout(() => setSuccess(""), 2500);
      closeReviewModal();
    } catch (err) {
      setError(err.message || "Failed to approve leave request.");
      setTimeout(() => setError(""), 4000);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest || selectedRequest.status !== "pending") return;
    if (!rejectionReason.trim()) {
      setError("Please provide a reason for rejection.");
      setTimeout(() => setError(""), 3000);
      return;
    }
    setActionLoading("reject");
    setError("");
    try {
      const response = await fetch("/api/managersCommon/approve-leave-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          requestId: selectedRequest.id,
          action: "reject",
          rejectionReason,
          decisionNote,
          memberMessage,
          notifyMember,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to reject leave request");
      }
      updateRequestInState(data.request);
      setSuccess(data.message || "Leave request rejected.");
      setTimeout(() => setSuccess(""), 2500);
      closeReviewModal();
    } catch (err) {
      setError(err.message || "Failed to reject leave request.");
      setTimeout(() => setError(""), 4000);
    } finally {
      setActionLoading(null);
    }
  };

  const handleEscalate = async () => {
    if (!selectedRequest || selectedRequest.status !== "pending") return;
    if (!escalationTitle.trim()) {
      setError("Escalation needs a title.");
      setTimeout(() => setError(""), 3000);
      return;
    }
    if (!escalationAssignee) {
      setError("Please choose an escalation owner (L1).");
      setTimeout(() => setError(""), 3000);
      return;
    }

    setActionLoading("escalate");
    setError("");
    try {
      const involvedUserIds = Array.from(
        new Set([selectedRequest.userId, selectedRequest.submittedTo].filter(Boolean))
      );

      const escalateResponse = await fetch("/api/managersCommon/escalations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: escalationTitle.trim(),
          description: escalationNote.trim() || null,
          l1AssigneeId: Number(escalationAssignee),
          involvedUserIds,
        }),
      });
      const escalationData = await escalateResponse.json();
      if (!escalateResponse.ok) {
        throw new Error(escalationData.error || "Failed to create escalation matter.");
      }

      const attachResponse = await fetch("/api/managersCommon/approve-leave-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          requestId: selectedRequest.id,
          action: "attachEscalation",
          matterId: escalationData.id,
          decisionNote: escalationDecisionNote,
          memberMessage: escalationMemberMessage,
          notifyMember: escalationNotifyMember,
        }),
      });
      const attachData = await attachResponse.json();
      if (!attachResponse.ok) {
        throw new Error(attachData.error || "Failed to link escalation to the leave request.");
      }

      updateRequestInState(attachData.request);
      setSuccess("Escalation created and linked successfully.");
      setTimeout(() => setSuccess(""), 2500);
      closeReviewModal();
    } catch (err) {
      setError(err.message || "Failed to escalate this leave request.");
      setTimeout(() => setError(""), 4000);
    } finally {
      setActionLoading(null);
    }
  };

  const pendingCount = leaveRequests.filter((req) => req.status === "pending").length;
  const isSelectedRequestActionable = selectedRequest?.status === "pending";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 p-8 flex items-center justify-center"
    >
      <div className="w-full h-full bg-white rounded-2xl shadow-2xl p-8 flex flex-col gap-8 overflow-y-auto">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleBack}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 text-sm shadow-md transition-all duration-200"
            >
              Back
            </motion.button>
            <div>
              <h1 className="text-3xl font-bold text-indigo-800 flex items-center gap-2">
                <FileText className="w-6 h-6" />
                Leave Requests
              </h1>
              <p className="text-sm text-gray-500">
                {pendingCount} pending • {leaveRequests.length} total
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 w-full">
          {isFetching ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
          ) : leaveRequests.length === 0 ? (
            <p className="text-gray-600 text-center">No leave requests found.</p>
          ) : (
            <div className="w-full">
              <div className="hidden xl:flex gap-4">
                <div className="w-[45%] max-h-[70vh] overflow-y-auto rounded-2xl border border-indigo-100 bg-white/90 shadow-sm">
                  <div className="sticky top-0 z-10 bg-white/95 border-b border-indigo-100 px-4 py-3">
                    <h2 className="text-sm font-semibold text-indigo-900 uppercase tracking-wide">
                      Requests
                    </h2>
                  </div>
                  <ul className="divide-y divide-gray-100">
                    {leaveRequests.map((request) => {
                      const requestedRange = `${formatDateDisplay(request.startDate)} → ${formatDateDisplay(
                        request.endDate
                      )}`;
                      const approvedRange =
                        request.approvedStartDate && request.approvedEndDate
                          ? `${formatDateDisplay(request.approvedStartDate)} → ${formatDateDisplay(
                              request.approvedEndDate
                            )}`
                          : "—";
                      const isSelected = selectedRequest?.id === request.id;
                      const categoryKey = request.category || "personal";
                      const categoryLabel = categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1);
                      const clTag = request.convertToCl ? " • CL" : "";
                      return (
                        <li
                          key={request.id}
                          className={`px-4 py-4 transition cursor-pointer ${
                            isSelected ? "bg-indigo-50/80" : "hover:bg-indigo-50/60"
                          }`}
                          onClick={() => {
                            setSelectedRequest(request);
                            setShowReviewModal(true);
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{request.userName}</p>
                              <p className="text-xs text-gray-500">
                                Requested {requestedRange}
                                {approvedRange !== "—" && (
                                  <>
                                    {" · "}
                                    <span className="text-teal-600">Approved {approvedRange}</span>
                                  </>
                                )}
                              </p>
                              <p className="mt-1 text-xs text-gray-500 line-clamp-2">{request.reason}</p>
                              <p className="mt-1 text-[11px] text-indigo-600">
                                {categoryLabel}{clTag}
                              </p>
                            </div>
                            <span
                              className={`px-2 py-1 rounded-full text-[11px] font-semibold capitalize ${
                                request.status === "approved"
                                  ? "bg-green-100 text-green-700"
                                  : request.status === "rejected"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-yellow-100 text-yellow-700"
                              }`}
                            >
                              {request.status}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="flex-1 rounded-2xl border border-indigo-100 bg-white/95 shadow-sm">
                  {selectedRequest ? (
                    <div className="h-full flex flex-col">
                      <div className="flex items-center justify-between border-b border-indigo-100 px-6 py-4">
                        <div>
                          <h2 className="text-lg font-semibold text-gray-900">
                            {selectedRequest.userName}
                          </h2>
                          <p className="text-xs text-gray-500">
                            Requested {formatDateDisplay(selectedRequest.startDate)} →{" "}
                            {formatDateDisplay(selectedRequest.endDate)}
                          </p>
                        </div>
                        <motion.button
                          whileHover={{ scale: selectedRequest.status === "pending" ? 1.05 : 1 }}
                          whileTap={{ scale: selectedRequest.status === "pending" ? 0.95 : 1 }}
                          onClick={() => {
                            if (selectedRequest.status === "pending") {
                              setShowReviewModal(true);
                            }
                          }}
                          disabled={selectedRequest.status !== "pending"}
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                            selectedRequest.status === "pending"
                              ? "bg-indigo-600 text-white hover:bg-indigo-700"
                              : "bg-gray-200 text-gray-600 cursor-not-allowed"
                          }`}
                        >
                          {selectedRequest.status === "pending" ? "Review / Decide" : "View Details"}
                          <ArrowUpRight className="w-4 h-4" />
                        </motion.button>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-6 py-4 overflow-y-auto">
                        <div className="space-y-3">
                          <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4">
                            <p className="text-xs font-semibold uppercase text-gray-500">
                              Reason
                            </p>
                            <p className="text-sm text-gray-800 mt-1 whitespace-pre-wrap">
                              {selectedRequest.reason || "—"}
                            </p>
                          </div>
                          <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4">
                            <p className="text-xs font-semibold uppercase text-gray-500">
                              Proof
                            </p>
                            <p className="text-sm text-gray-800 mt-1">
                              {selectedRequest.proof ? (
                                <a
                                  href={selectedRequest.proof}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-teal-600 hover:text-teal-700 underline"
                                >
                                  View document
                                </a>
                              ) : (
                                "None"
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4">
                            <p className="text-xs font-semibold uppercase text-gray-500">
                              Supervisor
                            </p>
                            <p className="text-sm text-gray-800 mt-1">
                              {selectedRequest.supervisorName || "—"}
                            </p>
                          </div>
                          <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4">
                            <p className="text-xs font-semibold uppercase text-gray-500">
                              Escalation
                            </p>
                            <p className="text-sm text-gray-800 mt-1">
                              {selectedRequest.escalationMatterId ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    router.push(
                                      `/dashboard/managersCommon/escalations?matterId=${selectedRequest.escalationMatterId}`
                                    )
                                  }
                                  className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 underline"
                                >
                                  Matter #{selectedRequest.escalationMatterId}
                                  <ArrowUpRight className="w-3 h-3" />
                                </button>
                              ) : (
                                "None"
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-sm text-gray-500">
                      Select a request to review details.
                    </div>
                  )}
                </div>
              </div>
              <div className="xl:hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-gray-700">
                    <thead className="text-xs uppercase bg-gray-50">
                      <tr>
                        <th className="px-4 py-3">Requester</th>
                        <th className="px-4 py-3">Requested</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaveRequests.map((request) => {
                        const requestedRange = `${formatDateDisplay(request.startDate)} → ${formatDateDisplay(
                          request.endDate
                        )}`;
                        return (
                          <tr key={request.id} className="border-b hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-semibold text-gray-900">{request.userName}</div>
                              <div className="text-xs text-gray-500">
                                Created {formatDateTimeDisplay(request.createdAt)}
                              </div>
                            </td>
                            <td className="px-4 py-3">{requestedRange}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                                  request.status === "approved"
                                    ? "bg-green-100 text-green-800"
                                    : request.status === "rejected"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-yellow-100 text-yellow-800"
                                }`}
                              >
                                {request.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <motion.button
                                whileHover={{ scale: request.status === "pending" ? 1.05 : 1 }}
                                whileTap={{ scale: request.status === "pending" ? 0.95 : 1 }}
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setShowReviewModal(true);
                                }}
                                className={`px-3 py-1.5 rounded-md text-xs transition-all duration-200 ${
                                  request.status === "pending"
                                    ? "bg-indigo-600 text-white hover:bg-indigo-700"
                                    : "bg-gray-200 text-gray-600 cursor-default"
                                }`}
                              >
                                {request.status === "pending" ? "Review" : "View"}
                              </motion.button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        <AnimatePresence>
          {showReviewModal && selectedRequest && (
            <motion.div
              key="review-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/65 flex items-center justify-center p-4 md:p-8 z-50"
            >
              <motion.div
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto border border-indigo-100/70 p-6 md:p-8 space-y-6"
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-bold text-gray-900">
                      {selectedRequest.userName}
                    </h2>
                    <p className="text-sm text-gray-500">
                      Requested {formatDateDisplay(selectedRequest.startDate)} →{" "}
                      {formatDateDisplay(selectedRequest.endDate)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { key: "approve", label: "Approve", Icon: Check, tone: "green" },
                      { key: "reject", label: "Reject", Icon: X, tone: "red" },
                      { key: "escalate", label: "Escalate", Icon: ArrowUpRight, tone: "indigo" },
                    ].map(({ key, label, Icon, tone }) => {
                      const isActive = activeActionTab === key;
                      const toneClasses = {
                        green: isActive
                          ? "bg-green-100 text-green-700 border-green-200 shadow-sm"
                          : "bg-white text-green-600 border-transparent hover:bg-green-50",
                        red: isActive
                          ? "bg-red-100 text-red-700 border-red-200 shadow-sm"
                          : "bg-white text-red-600 border-transparent hover:bg-red-50",
                        indigo: isActive
                          ? "bg-indigo-100 text-indigo-700 border-indigo-200 shadow-sm"
                          : "bg-white text-indigo-600 border-transparent hover:bg-indigo-50",
                      }[tone];
                      return (
                        <button
                          type="button"
                          key={key}
                          onClick={() => isSelectedRequestActionable && setActiveActionTab(key)}
                          disabled={!isSelectedRequestActionable}
                          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition ${toneClasses} ${
                            !isSelectedRequestActionable ? "opacity-60 cursor-not-allowed" : ""
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {label}
                        </button>
                      );
                    })}
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={closeReviewModal}
                      className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50"
                    >
                      Close
                    </motion.button>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                  <div className="space-y-4">
                    <div className="p-5 border border-indigo-100 rounded-2xl bg-indigo-50/40">
                      <h3 className="text-sm font-semibold text-indigo-900 mb-2">Request summary</h3>
                      <dl className="text-sm text-gray-700 space-y-2">
                      <div>
                        <dt className="font-medium text-gray-900">Reason</dt>
                        <dd>{selectedRequest.reason || "—"}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-gray-900">Category</dt>
                        <dd className="capitalize">{selectedRequest.category || "personal"}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-gray-900">Supervisor</dt>
                        <dd>{selectedRequest.supervisorName || "—"}</dd>
                      </div>
                      <div>
                          <dt className="font-medium text-gray-900">Current status</dt>
                          <dd className="capitalize">{selectedRequest.status}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-gray-900">Decision note</dt>
                          <dd>{selectedRequest.decisionNote || "—"}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-gray-900">Rejection reason</dt>
                          <dd>{selectedRequest.rejectionReason || "—"}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-gray-900">Approved at</dt>
                          <dd>{formatDateTimeDisplay(selectedRequest.approvedAt)}</dd>
                        </div>
                      <div>
                        <dt className="font-medium text-gray-900">Member message</dt>
                        <dd>{selectedRequest.memberMessage || "—"}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-gray-900">Converted to CL</dt>
                        <dd>{selectedRequest.convertToCl ? "Yes" : "No"}</dd>
                      </div>
                        <div>
                          <dt className="font-medium text-gray-900">Proof</dt>
                          <dd>
                            {selectedRequest.proof ? (
                              <a
                                href={selectedRequest.proof}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-600 hover:text-indigo-700 underline"
                              >
                                Open document
                              </a>
                            ) : (
                              "—"
                            )}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <div className="p-5 border border-indigo-100 rounded-2xl bg-indigo-50/40">
                      <h3 className="text-sm font-semibold text-indigo-900 mb-2">
                        Approved range (if any)
                      </h3>
                      <p className="text-sm text-gray-700">
                        {selectedRequest.approvedStartDate && selectedRequest.approvedEndDate
                          ? `${formatDateDisplay(selectedRequest.approvedStartDate)} → ${formatDateDisplay(
                              selectedRequest.approvedEndDate
                            )}`
                          : "Not set"}
                      </p>
                      {selectedRequest.escalationMatterId && (
                        <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-700 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <div>
                            Linked to escalation matter #{selectedRequest.escalationMatterId}.{" "}
                            <button
                              type="button"
                              onClick={() =>
                                router.push(
                                  `/dashboard/managersCommon/escalations?matterId=${selectedRequest.escalationMatterId}`
                                )
                              }
                              className="underline font-medium"
                            >
                              View escalation board
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm relative">
                    {!isSelectedRequestActionable ? (
                      <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                        This request was already {selectedRequest.status}. Further actions are locked.
                      </div>
                    ) : activeActionTab === "approve" ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleApprove();
                        }}
                        className="space-y-4"
                      >
                        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                          <Check className="w-4 h-4 text-green-600" />
                          Approve request
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Approved start
                            </label>
                            <input
                              type="date"
                              value={approvedStartInput}
                              onChange={(e) => setApprovedStartInput(e.target.value)}
                              min={toInputDateValue(selectedRequest.startDate)}
                              max={toInputDateValue(selectedRequest.endDate)}
                              className="w-full px-3 py-2 border rounded-lg text-sm"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Approved end
                            </label>
                            <input
                              type="date"
                              value={approvedEndInput}
                              onChange={(e) => setApprovedEndInput(e.target.value)}
                              min={approvedStartInput || toInputDateValue(selectedRequest.startDate)}
                              max={toInputDateValue(selectedRequest.endDate)}
                              className="w-full px-3 py-2 border rounded-lg text-sm"
                              required
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Internal note (optional)
                            </label>
                            <textarea
                              value={decisionNote}
                              onChange={(e) => setDecisionNote(e.target.value)}
                              rows={3}
                              className="w-full px-3 py-2 border rounded-lg text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Message to member (optional)
                            </label>
                            <textarea
                              value={memberMessage}
                              onChange={(e) => setMemberMessage(e.target.value)}
                              rows={3}
                              className="w-full px-3 py-2 border rounded-lg text-sm"
                            />
                          </div>
                        </div>
                        <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                          <input
                            type="checkbox"
                            checked={notifyMember}
                            onChange={(e) => setNotifyMember(e.target.checked)}
                          />
                          Send decision message to member
                        </label>
                        <motion.button
                          type="submit"
                          whileHover={{ scale: actionLoading === "approve" ? 1 : 1.03 }}
                          whileTap={{ scale: actionLoading === "approve" ? 1 : 0.97 }}
                          disabled={actionLoading === "approve"}
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {actionLoading === "approve" ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                          Approve request
                        </motion.button>
                      </form>
                    ) : activeActionTab === "reject" ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleReject();
                        }}
                        className="space-y-4"
                      >
                        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                          <X className="w-4 h-4 text-red-600" />
                          Reject request
                        </h3>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Rejection reason
                          </label>
                          <textarea
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 border rounded-lg text-sm"
                            required
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Internal note (optional)
                            </label>
                            <textarea
                              value={decisionNote}
                              onChange={(e) => setDecisionNote(e.target.value)}
                              rows={2}
                              className="w-full px-3 py-2 border rounded-lg text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Message to member (optional)
                            </label>
                            <textarea
                              value={memberMessage}
                              onChange={(e) => setMemberMessage(e.target.value)}
                              rows={2}
                              className="w-full px-3 py-2 border rounded-lg text-sm"
                            />
                          </div>
                        </div>
                        <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                          <input
                            type="checkbox"
                            checked={notifyMember}
                            onChange={(e) => setNotifyMember(e.target.checked)}
                          />
                          Send decision message to member
                        </label>
                        <motion.button
                          type="submit"
                          whileHover={{ scale: actionLoading === "reject" ? 1 : 1.03 }}
                          whileTap={{ scale: actionLoading === "reject" ? 1 : 0.97 }}
                          disabled={actionLoading === "reject"}
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {actionLoading === "reject" ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <X className="w-4 h-4" />
                          )}
                          Reject request
                        </motion.button>
                      </form>
                    ) : (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleEscalate();
                        }}
                        className="space-y-4"
                      >
                        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                          <ArrowUpRight className="w-4 h-4 text-indigo-600" />
                          Escalate for follow-up
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Escalation title
                            </label>
                            <input
                              type="text"
                              value={escalationTitle}
                              onChange={(e) => setEscalationTitle(e.target.value)}
                              className="w-full px-3 py-2 border rounded-lg text-sm"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Assign to (L1)
                            </label>
                            <select
                              value={escalationAssignee}
                              onChange={(e) => setEscalationAssignee(e.target.value)}
                              className="w-full px-3 py-2 border rounded-lg text-sm"
                              required
                            >
                              <option value="">Select supervisor…</option>
                              {eligibleEscalationAssignees.map((user) => (
                                <option key={user.id} value={user.id}>
                                  {user.name} ({user.role})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Summary for escalation team
                          </label>
                          <textarea
                            value={escalationNote}
                            onChange={(e) => setEscalationNote(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 border rounded-lg text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Internal note (optional)
                            </label>
                            <textarea
                              value={escalationDecisionNote}
                              onChange={(e) => setEscalationDecisionNote(e.target.value)}
                              rows={2}
                              className="w-full px-3 py-2 border rounded-lg text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Message to member (optional)
                            </label>
                            <textarea
                              value={escalationMemberMessage}
                              onChange={(e) => setEscalationMemberMessage(e.target.value)}
                              rows={2}
                              className="w-full px-3 py-2 border rounded-lg text-sm"
                            />
                          </div>
                        </div>
                        <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                          <input
                            type="checkbox"
                            checked={escalationNotifyMember}
                            onChange={(e) => setEscalationNotifyMember(e.target.checked)}
                          />
                          Send escalation note to member
                        </label>
                        <motion.button
                          type="submit"
                          whileHover={{ scale: actionLoading === "escalate" ? 1 : 1.03 }}
                          whileTap={{ scale: actionLoading === "escalate" ? 1 : 0.97 }}
                          disabled={actionLoading === "escalate"}
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {actionLoading === "escalate" ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4" />
                          )}
                          Escalate for resolution
                        </motion.button>
                      </form>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
