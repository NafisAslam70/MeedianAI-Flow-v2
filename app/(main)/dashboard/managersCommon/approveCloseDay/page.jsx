// app/(main)/dashboard/managersCommon/approveCloseDay/page.jsx
"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { CheckCircle, XCircle, X, Loader2 } from "lucide-react";
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
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [currentViewStep, setCurrentViewStep] = useState(1); // 1: MRI, 2: Assigned Tasks, 3: Routine Tasks, 4: General Log
  const [isApproving, setIsApproving] = useState(false);
  const [adminRoutineLog, setAdminRoutineLog] = useState("");

  const { data: requestsData } = useSWR("/api/managersCommon/dayCloseRequests", fetcher);

  useEffect(() => {
    if (requestsData?.requests) {
      setRequests(requestsData.requests);
    }
  }, [requestsData]);

  const handleOpenRequest = (req) => {
    console.log("Opening request:", req); // Debug: Log the selected request
    setSelectedRequest({
      ...req,
      assignedTasksUpdates: req.assignedTasksUpdates || [],
      routineTasksUpdates: req.routineTasksUpdates || [],
    });
    setCurrentViewStep(1);
    setAdminRoutineLog("");
  };

  const handleApprove = async (id) => {
    setIsApproving(true);
    try {
      const response = await fetch(`/api/managersCommon/dayCloseRequests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved", adminRoutineLog }),
      });
      if (response.ok) {
        mutate("/api/managersCommon/dayCloseRequests"); // Refresh the list from API
        setSelectedRequest(null);
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
    try {
      const response = await fetch(`/api/managersCommon/dayCloseRequests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" }),
      });
      if (response.ok) {
        mutate("/api/managersCommon/dayCloseRequests"); // Refresh the list from API
        setSelectedRequest(null);
      } else {
        setError("Failed to reject day close");
      }
    } catch (err) {
      setError(`Error rejecting day close: ${err.message}`);
    }
  };

  const handleNextViewStep = () => {
    setCurrentViewStep((prev) => prev + 1);
  };

  const handlePrevViewStep = () => {
    setCurrentViewStep((prev) => Math.max(1, prev - 1));
  };

  return (
    <motion.div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Approve Day Close Requests</h1>
      {requests.length === 0 ? (
        <p className="text-gray-600">There are no active day close requests</p>
      ) : (
        <div className="space-y-4">
          {requests.map(req => (
            <motion.div key={req.id} className="bg-white p-4 rounded-xl shadow-md flex justify-between items-center cursor-pointer" onClick={() => handleOpenRequest(req)}>
              <div>
                <p className="font-semibold">{req.userName} - {req.date}</p>
                <p className="text-sm text-gray-600">{req.status}</p>
              </div>
              {req.status === "pending" ? (
                <div className="flex gap-2">
                  <motion.button onClick={(e) => { e.stopPropagation(); handleApprove(req.id); }} className="bg-green-600 text-white p-2 rounded" whileHover={{ scale: 1.05 }}>
                    <CheckCircle size={20} />
                  </motion.button>
                  <motion.button onClick={(e) => { e.stopPropagation(); handleReject(req.id); }} className="bg-red-600 text-white p-2 rounded" whileHover={{ scale: 1.05 }}>
                    <XCircle size={20} />
                  </motion.button>
                </div>
              ) : (
                <p className={`font-medium ${req.status === "approved" ? "text-green-600" : "text-red-600"}`}>{req.status.charAt(0).toUpperCase() + req.status.slice(1)}</p>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Details Modal */}
      <AnimatePresence>
        {selectedRequest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white/90 backdrop-blur-md rounded-3xl shadow-xl p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto border border-teal-100/50"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">Day Close Request - Step {currentViewStep}/4</h2>
                <motion.button
                  onClick={() => setSelectedRequest(null)}
                  className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-all duration-200"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <X size={24} />
                </motion.button>
              </div>
              {currentViewStep === 1 && (
                <MRIStepView handlePrevViewStep={handlePrevViewStep} handleNextViewStep={handleNextViewStep} mriCleared={selectedRequest.mriCleared} />
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
                  routineTasks={selectedRequest.routineTasksUpdates}
                  routineLog={selectedRequest.routineLog}
                  handlePrevViewStep={handlePrevViewStep}
                  handleNextViewStep={handleNextViewStep}
                  adminRoutineLog={adminRoutineLog}
                  setAdminRoutineLog={setAdminRoutineLog}
                />
              )}
              {currentViewStep === 4 && (
                <GeneralLogView
                  generalLog={selectedRequest.generalLog}
                  handlePrevViewStep={handlePrevViewStep}
                  handleApprove={() => handleApprove(selectedRequest.id)}
                  isApproving={isApproving}
                />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}