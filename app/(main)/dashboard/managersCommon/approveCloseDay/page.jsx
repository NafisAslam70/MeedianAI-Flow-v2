// components/manager/ApproveCloseDay.jsx
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { CheckCircle, XCircle, X, Loader2, AlertCircle, Search } from "lucide-react";
import useSWR, { mutate } from "swr";

import MRIStepView from "./MRIStepView";
import AssignedTasksStepView from "./AssignedTasksStepView";
import RoutineTasksStepView from "./RoutineTasksStepView";
import GeneralLogView from "./GeneralLogView";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  });

export default function ApproveCloseDay() {
  const [requests, setRequests] = useState([]);
  const [historicalRequests, setHistoricalRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [currentViewStep, setCurrentViewStep] = useState(1);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [ISRoutineLog, setISRoutineLog] = useState("");
  const [ISGeneralLog, setISGeneralLog] = useState("");
  const [error, setError] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // "approve" | "reject"
  const [confirmRequestId, setConfirmRequestId] = useState(null);
  const [activeTab, setActiveTab] = useState("pending"); // "pending" | "history"
  const [timeframeFilter, setTimeframeFilter] = useState(""); // "" | "lastDay" | "last15Days" | "lastMonth"
  const [userSearch, setUserSearch] = useState("");

  // Fetch pending requests
  const { data: requestsData, error: requestsError } = useSWR("/api/managersCommon/dayCloseRequests", fetcher);

  // Fetch historical requests with filters
  const historyUrl = `/api/managersCommon/dayCloseRequests?history=true${
    timeframeFilter ? `&timeframe=${timeframeFilter}` : ""
  }${userSearch ? `&userName=${encodeURIComponent(userSearch)}` : ""}`;
  const { data: historyData, error: historyError } = useSWR(historyUrl, fetcher);

  // Fetch users for search dropdown
  const { data: usersData } = useSWR("/api/users", fetcher); // Assume this endpoint returns { users: [{ id, name }, ...] }

  useEffect(() => {
    if (requestsData?.requests) {
      setRequests(requestsData.requests);
    }
    if (requestsError) {
      setError(`Failed to fetch pending requests: ${requestsError.message}`);
    }
  }, [requestsData, requestsError]);

  useEffect(() => {
    if (historyData?.requests) {
      setHistoricalRequests(historyData.requests);
    }
    if (historyError) {
      setError(`Failed to fetch historical requests: ${historyError.message}`);
    }
  }, [historyData, historyError]);

  const handleOpenRequest = (req) => {
    setSelectedRequest({
      ...req,
      assignedTasksUpdates: req.assignedTasksUpdates || [],
      routineTasksUpdates: req.routineTasksUpdates || [],
      ISRoutineLog: req.ISRoutineLog || "",
      ISGeneralLog: req.ISGeneralLog || "",
    });
    setCurrentViewStep(1);
    setISRoutineLog("");
    setISGeneralLog("");
    setIsApproving(false);
    setIsRejecting(false);
    setShowConfirmModal(false);
  };

  const handleApprove = async (id) => {
    setIsApproving(true);
    try {
      const response = await fetch(`/api/managersCommon/dayCloseRequests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved", ISRoutineLog, ISGeneralLog }),
      });
      if (response.ok) {
        mutate("/api/managersCommon/dayCloseRequests");
        mutate(historyUrl);
        setSelectedRequest(null);
        setShowConfirmModal(false);
      } else {
        setError("Failed to approve day close");
      }
    } catch (err) {
      setError(`Error approving day close: ${err.message}`);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async (id) => {
    setIsRejecting(true);
    try {
      const response = await fetch(`/api/managersCommon/dayCloseRequests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected", ISRoutineLog, ISGeneralLog }),
      });
      if (response.ok) {
        mutate("/api/managersCommon/dayCloseRequests");
        mutate(historyUrl);
        setSelectedRequest(null);
        setShowConfirmModal(false);
      } else {
        setError("Failed to reject day close");
      }
    } catch (err) {
      setError(`Error rejecting day close: ${err.message}`);
    } finally {
      setIsRejecting(false);
    }
  };

  const handleConfirmAction = (action, id) => {
    setConfirmAction(action);
    setConfirmRequestId(id);
    setShowConfirmModal(true);
  };

  const handleNextViewStep = () => setCurrentViewStep((p) => p + 1);
  const handlePrevViewStep = () => setCurrentViewStep((p) => Math.max(1, p - 1));

  return (
    <motion.div
      className="p-8 w-screen h-screen flex flex-col overflow-hidden bg-gradient-to-br from-teal-50 to-gray-100"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <h1 className="text-3xl font-bold mb-6 text-teal-800">Day Close Requests</h1>

      {/* Tab Navigation */}
      <div className="flex gap-4 mb-6">
        <motion.button
          className={`px-4 py-2 rounded-xl font-semibold transition-all duration-200 ${
            activeTab === "pending"
              ? "bg-teal-600 text-white"
              : "bg-gray-200 text-gray-600 hover:bg-gray-300"
          }`}
          onClick={() => {
            setActiveTab("pending");
            setTimeframeFilter("");
            setUserSearch("");
          }}
          whileHover={{ scale: 1.05 }}
        >
          Pending Requests
        </motion.button>
        <motion.button
          className={`px-4 py-2 rounded-xl font-semibold transition-all duration-200 ${
            activeTab === "history"
              ? "bg-teal-600 text-white"
              : "bg-gray-200 text-gray-600 hover:bg-gray-300"
          }`}
          onClick={() => setActiveTab("history")}
          whileHover={{ scale: 1.05 }}
        >
          Previous Approvals
        </motion.button>
      </div>

      {/* Filters for History Tab */}
      {activeTab === "history" && (
        <motion.div
          className="mb-6 flex flex-col sm:flex-row gap-4"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <select
            className="px-4 py-2 rounded-xl bg-white text-gray-600 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
            value={timeframeFilter}
            onChange={(e) => setTimeframeFilter(e.target.value)}
          >
            <option value="">All Time</option>
            <option value="lastDay">Last Day</option>
            <option value="last15Days">Last 15 Days</option>
            <option value="lastMonth">Last Month</option>
          </select>
          <div className="relative">
            <input
              type="text"
              placeholder="Search by user name..."
              className="px-4 py-2 pl-10 rounded-xl bg-white text-gray-600 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 w-full sm:w-64"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-red-50 text-red-600 p-4 rounded-xl shadow-md flex items-center gap-2 mb-6"
            onClick={() => setError("")}
          >
            <AlertCircle size={20} />
            <p className="text-sm font-medium">{error} (Click to dismiss)</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pending Requests Tab */}
      {activeTab === "pending" && (
        <div className="grow overflow-y-auto">
          {requests.length === 0 ? (
            <p className="text-gray-600">There are no active day close requests</p>
          ) : (
            <div className="space-y-4">
              {requests.map((req) => (
                <motion.div
                  key={req.id}
                  className="bg-white p-4 rounded-xl shadow-md flex justify-between items-center cursor-pointer"
                  onClick={() => handleOpenRequest(req)}
                  whileHover={{ scale: 1.02 }}
                >
                  <div>
                    <p className="font-semibold text-teal-800">
                      {req.userName} - {new Date(req.date).toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                    <p className="text-sm text-gray-600">{req.status}</p>
                  </div>
                  {req.status === "pending" ? (
                    <div className="flex gap-2">
                      <motion.button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleConfirmAction("approve", req.id);
                        }}
                        className="bg-green-600 text-white p-2 rounded"
                        whileHover={{ scale: 1.05 }}
                      >
                        <CheckCircle size={20} />
                      </motion.button>
                      <motion.button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleConfirmAction("reject", req.id);
                        }}
                        className="bg-red-600 text-white p-2 rounded"
                        whileHover={{ scale: 1.05 }}
                      >
                        <XCircle size={20} />
                      </motion.button>
                    </div>
                  ) : (
                    <p
                      className={`font-medium ${
                        req.status === "approved" ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Previous Approvals Tab */}
      {activeTab === "history" && (
        <div className="grow overflow-y-auto">
          {historicalRequests.length === 0 ? (
            <p className="text-gray-600">There are no previous day close approvals</p>
          ) : (
            <div className="space-y-4">
              {historicalRequests.map((req) => (
                <motion.div
                  key={req.id}
                  className="bg-white p-4 rounded-xl shadow-md flex justify-between items-center cursor-pointer"
                  onClick={() => handleOpenRequest(req)}
                  whileHover={{ scale: 1.02 }}
                >
                  <div>
                    <p className="font-semibold text-teal-800">
                      {req.userName} - {new Date(req.date).toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                    <p
                      className={`text-sm font-medium ${
                        req.status === "approved" ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                    </p>
                    {req.approvedBy && req.approvedAt && (
                      <p className="text-sm text-gray-500">
                        {req.status === "approved" ? "Approved" : "Rejected"} by User ID{" "}
                        {req.approvedBy} on{" "}
                        {new Date(req.approvedAt).toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                  <p
                    className={`font-medium ${
                      req.status === "approved" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                  </p>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= FULL-SCREEN CONFIRM MODAL ================= */}
      <AnimatePresence>
        {showConfirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-stretch justify-stretch p-0 z-[1100]"
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="bg-white/90 backdrop-blur-md rounded-none shadow-xl p-6 w-screen h-screen border-0 text-center flex flex-col"
            >
              <h2 className="text-xl font-bold text-gray-800 mb-2">
                Confirm {confirmAction === "approve" ? "Approval" : "Rejection"}
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to {confirmAction} the day close request by{" "}
                {requests.find((r) => r.id === confirmRequestId)?.userName} without reviewing the
                report?
              </p>

              <div className="mt-auto flex gap-4 justify-center">
                <motion.button
                  onClick={() => {
                    if (confirmAction === "approve") handleApprove(confirmRequestId);
                    else handleReject(confirmRequestId);
                  }}
                  disabled={isApproving || isRejecting}
                  className={`flex-1 max-w-xs ${
                    confirmAction === "approve"
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-red-600 hover:bg-red-700"
                  } text-white py-3 rounded-xl font-semibold transition-all duration-300 shadow-sm ${
                    isApproving || isRejecting ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isApproving || isRejecting ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    "Yes"
                  )}
                </motion.button>

                <motion.button
                  onClick={() =>
                    handleOpenRequest(requests.find((r) => r.id === confirmRequestId))
                  }
                  className="flex-1 max-w-xs bg-teal-600 text-white py-3 rounded-xl font-semibold hover:bg-teal-700 transition-all duration-300 shadow-sm"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  No, View Report
                </motion.button>

                <motion.button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 max-w-xs bg-gray-600 text-white py-3 rounded-xl font-semibold hover:bg-gray-700 transition-all duration-300 shadow-sm"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Cancel
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= FULL-SCREEN DETAILS MODAL ================= */}
      <AnimatePresence>
        {selectedRequest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-stretch justify-stretch p-0 z-[1200]"
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="bg-white/90 backdrop-blur-md rounded-none shadow-xl p-4 sm:p-6 w-screen h-screen border-0 flex flex-col overflow-hidden"
            >
              <div className="shrink-0 flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-teal-800">
                  Day Close Request — Step {currentViewStep}/4
                </h2>
                <motion.button
                  onClick={() => setSelectedRequest(null)}
                  className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-all duration-200"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <X size={24} />
                </motion.button>
              </div>
              <div className="grow overflow-auto">
                {currentViewStep === 1 && (
                  <MRIStepView
                    handlePrevViewStep={handlePrevViewStep}
                    handleNextViewStep={handleNextViewStep}
                    mriCleared={selectedRequest.mriCleared}
                  />
                )}
                {currentViewStep === 2 && (
                  <AssignedTasksStepView
                    assignedTasks={selectedRequest.assignedTasksUpdates}
                    handlePrevViewStep={handlePrevViewStep}
                    handleNextViewStep={handleNextViewStep}
                  />
                )}
                {currentViewStep === 3 && (
                  <RoutineTasksStepView
                    userId={selectedRequest.userId}
                    routineTasks={selectedRequest.routineTasksUpdates}
                    routineLog={selectedRequest.routineLog}
                    ISRoutineLog={ISRoutineLog}
                    setISRoutineLog={setISRoutineLog}
                    handlePrevViewStep={handlePrevViewStep}
                    handleNextViewStep={handleNextViewStep}
                  />
                )}
                {currentViewStep === 4 && (
                  <GeneralLogView
                    generalLog={selectedRequest.generalLog}
                    ISGeneralLog={ISGeneralLog}
                    setISGeneralLog={setISGeneralLog}
                    memberId={selectedRequest.userId}
                    handlePrevViewStep={handlePrevViewStep}
                    handleApprove={() => handleApprove(selectedRequest.id)}
                    handleReject={() => handleReject(selectedRequest.id)}
                    isApproving={isApproving}
                    isRejecting={isRejecting}
                    isReadOnly={selectedRequest.status !== "pending"}
                  />
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
