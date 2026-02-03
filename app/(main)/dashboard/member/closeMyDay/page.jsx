// app/(main)/dashboard/member/closeMyDay/page.jsx (or CloseMyDay.jsx)
"use client";
import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, Calendar, CheckCircle, AlertCircle, Loader2, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import useSWR from "swr";
import TodayAtGlanceStep from "./TodayAtGlanceStep";
import MRIStep from "./MRIStep";
import AssignedTasksStep from "./AssignedTasksStep";
import RoutineTasksStep from "./RoutineTasksStep";
import AssignedTaskDetails from "@/components/assignedTaskCardDetailForAll";
import DayCloseWaitingModal from "./DayCloseWaitingModal";
import GeneralConversationThread from "@/components/GeneralConversationThread";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  });

export default function CloseMyDay() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const userId = session?.user?.id;
  const userName = session?.user?.name || "User";
  const isTeamManager = role === "team_manager";

  const [timeLeft, setTimeLeft] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isClosingWindow, setIsClosingWindow] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState("main");
  const [showWaitingModal, setShowWaitingModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(null);
  const [isWaitingForApproval, setIsWaitingForApproval] = useState(false);
  const [requestStatus, setRequestStatus] = useState("none");
  const [requestDate, setRequestDate] = useState(null);
  const [approvedByName, setApprovedByName] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);

  // 🔁 MRI: gate until saved (or prefilled)
  const [mriCleared, setMriCleared] = useState(false);
  const [mriPayload, setMriPayload] = useState(null);

  const [assignedTasksUpdates, setAssignedTasksUpdates] = useState([]);
  const [routineTasksStatuses, setRoutineTasksStatuses] = useState([]);
  const [routineLog, setRoutineLog] = useState("");
  const [generalLog, setGeneralLog] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showEscalationModal, setShowEscalationModal] = useState(false);
  const [escalationMsg, setEscalationMsg] = useState("");
  const [success, setSuccess] = useState("");
  const [isPortrait, setIsPortrait] = useState(false);
  const [isBypass, setIsBypass] = useState(false);
  const [allowBypass, setAllowBypass] = useState(false);
  const [showIprJourney, setShowIprJourney] = useState(true);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskDetails, setTaskDetails] = useState(null);
  const [taskLogs, setTaskLogs] = useState([]);
  const [managerRoutineReport, setManagerRoutineReport] = useState({});
  const [mobileBlockActive, setMobileBlockActive] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [routineLogRequiredAll, setRoutineLogRequiredAll] = useState(false);
  const [routineLogRequiredTeachers, setRoutineLogRequiredTeachers] = useState(false);
  const [routineLogRequiredNonTeachers, setRoutineLogRequiredNonTeachers] = useState(false);
  const [routineLogRequiredMemberIds, setRoutineLogRequiredMemberIds] = useState([]);

  const mobileBlockMessage =
    "Day Close on mobile is currently disabled. Please use a desktop browser to continue.";
  const isMobileBlocked = mobileBlockActive && isMobileDevice;
  const closeButtonDisabled = isSubmitting || !isClosingWindow || isMobileBlocked;
  const bypassButtonDisabled = isSubmitting || isMobileBlocked;

  // Timer for elapsed time since submission
  useEffect(() => {
    let interval;
    if (showWaitingModal && isWaitingForApproval) {
      interval = setInterval(() => setElapsedTime((p) => p + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [showWaitingModal, isWaitingForApproval]);

  const { data: timesData } = useSWR(
    status === "authenticated" ? "/api/member/openCloseTimes" : null,
    fetcher
  );

  const { data: assignedTasksData } = useSWR(
    status === "authenticated"
      ? `/api/member/assignedTasks?date=${format(new Date(), "yyyy-MM-dd")}&action=tasks`
      : null,
    fetcher
  );

  const assignedTasksCount = assignedTasksData?.tasks?.length ?? 0;

  const { data: routineTasksData } = useSWR(
    status === "authenticated"
      ? `/api/member/routine-tasks?action=routineTasks&date=${format(new Date(), "yyyy-MM-dd")}`
      : null,
    fetcher
  );

  const { data: dayCloseStatus, mutate: mutateDayCloseStatus } = useSWR(
    status === "authenticated" ? "/api/member/dayClose/dayCloseStatus" : null,
    fetcher,
    { refreshInterval: isWaitingForApproval ? 5000 : 0 }
  );

  const { data: historyData } = useSWR(
    showHistoryModal ? "/api/member/dayClose/dayCloseHistory" : null,
    fetcher
  );

  const filteredHistory = selectedHistoryDate
    ? historyData?.requests?.filter(
        (req) => format(new Date(req.date), "yyyy-MM-dd") === selectedHistoryDate
      )
    : historyData?.requests;

  useEffect(() => {
    if (!timesData?.times) return;
    const now = new Date();
    const closeTime = new Date();
    const [closeH, closeM] = timesData.times.dayCloseTime.split(":").map(Number);
    closeTime.setHours(closeH, closeM, 0, 0);

    const closingStart = new Date();
    const [startH, startM] = timesData.times.closingWindowStart.split(":").map(Number);
    closingStart.setHours(startH, startM, 0, 0);

    const closingEnd = new Date();
    const [endH, endM] = timesData.times.closingWindowEnd.split(":").map(Number);
    closingEnd.setHours(endH, endM, 0, 0);

    setIsClosingWindow(now >= closingStart && now <= closingEnd);

    const updateTimeLeft = () => {
      const secondsLeft = Math.max(0, Math.floor((closeTime.getTime() - Date.now()) * 0.001));
      setTimeLeft(secondsLeft);
    };

    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 1000);
    setIsLoading(false);
    return () => clearInterval(interval);
  }, [timesData]);

  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.matchMedia("(orientation: portrait)").matches);
    };
    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    return () => window.removeEventListener("resize", checkOrientation);
  }, []);

  useEffect(() => {
    const detectMobileDevice = () => {
      if (typeof window === "undefined") return;
      const ua = navigator?.userAgent || "";
      const mobileRegex = /Mobi|Android|iPhone|iPad|iPod|Mobile|Tablet/i;
      const touchCapable = typeof navigator !== "undefined" ? navigator.maxTouchPoints > 1 : false;
      const narrowViewport = window.innerWidth <= 820;
      setIsMobileDevice(mobileRegex.test(ua) || (touchCapable && narrowViewport));
    };

    detectMobileDevice();
    window.addEventListener("resize", detectMobileDevice);
    window.addEventListener("orientationchange", detectMobileDevice);
    return () => {
      window.removeEventListener("resize", detectMobileDevice);
      window.removeEventListener("orientationchange", detectMobileDevice);
    };
  }, []);

  useEffect(() => {
    if (assignedTasksData?.tasks) {
      setAssignedTasksUpdates(
        assignedTasksData.tasks.map((task) => ({
          id: task.id,
          newDeadline: task.deadline ? new Date(task.deadline).toISOString().split("T")[0] : null,
          statusUpdate: task.status || "not_started",
          comment: "",
          title: task.title || "Untitled",
        }))
      );
    } else {
      setAssignedTasksUpdates([]);
    }
  }, [assignedTasksData]);

  useEffect(() => {
    if (routineTasksData?.tasks) {
      setRoutineTasksStatuses(
        routineTasksData.tasks.map((task) => ({
          id: task.id,
          done: task.status === "done", // local boolean always
          description: task.description || "No description",
        }))
      );
    } else {
      setRoutineTasksStatuses([]);
    }
  }, [routineTasksData]);

  useEffect(() => {
    if (!isTeamManager) return;
    if (!Array.isArray(routineTasksData?.tasks)) return;
    const defaultMode = assignedTasksCount > 0 ? "assigned" : "log";
    setManagerRoutineReport((prev) => {
      const next = {};
      for (const task of routineTasksData.tasks) {
        next[task.id] = prev?.[task.id] ?? {
          mode: defaultMode,
          assignedTaskId: null,
          log: "",
        };
      }
      return next;
    });
  }, [assignedTasksCount, isTeamManager, routineTasksData]);

  useEffect(() => {
    if (isTeamManager) return;
    if (Object.keys(managerRoutineReport).length === 0) return;
    setManagerRoutineReport({});
  }, [isTeamManager, managerRoutineReport]);

  useEffect(() => {
    const showBypass = !!dayCloseStatus?.showBypass;
    setAllowBypass(showBypass);
    if (!showBypass) {
      setIsBypass(false);
    }

    setShowIprJourney(dayCloseStatus?.showIprJourney !== false);
    setMobileBlockActive(dayCloseStatus?.blockMobileDayClose ?? false);
    setRoutineLogRequiredAll(dayCloseStatus?.routineLogRequiredAll ?? false);
    setRoutineLogRequiredTeachers(dayCloseStatus?.routineLogRequiredTeachers ?? false);
    setRoutineLogRequiredNonTeachers(dayCloseStatus?.routineLogRequiredNonTeachers ?? false);
    setRoutineLogRequiredMemberIds(Array.isArray(dayCloseStatus?.routineLogRequiredMemberIds) ? dayCloseStatus.routineLogRequiredMemberIds : []);

    if (dayCloseStatus && ["pending", "approved", "rejected"].includes(dayCloseStatus.status)) {
      setRequestStatus(dayCloseStatus.status);
      setRequestDate(dayCloseStatus.date || null);
      const reviewerName =
        dayCloseStatus.approvedByName ??
        (dayCloseStatus.approvedBy != null ? `Supervisor #${dayCloseStatus.approvedBy}` : null);
      setApprovedByName(reviewerName);
      setIsWaitingForApproval(dayCloseStatus.status === "pending");
      setShowWaitingModal(true);
      setElapsedTime(0);
      if (dayCloseStatus.status === "approved") {
        setSuccess("Congratulations! Your day has been approved. Good night :)");
      } else if (dayCloseStatus.status === "rejected") {
        setError("Your day close request was rejected. Please review and resubmit.");
      }
    } else {
      setRequestStatus("none");
      setIsWaitingForApproval(false);
      setShowWaitingModal(false);
      setRequestDate(null);
      setApprovedByName(null);
      setElapsedTime(0);
    }
  }, [dayCloseStatus]);

  useEffect(() => {
    if (isMobileBlocked) {
      setActiveView("main");
      setShowConfirmModal(false);
      setIsBypass(false);
      setCurrentStep(1);
      setIsSubmitting(false);
      setError(mobileBlockMessage);
    }
  }, [isMobileBlocked]);

  const formatElapsedTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const formatIST = (date) => {
    return date && !isNaN(new Date(date).getTime())
      ? new Date(date).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
      : "Unknown date";
  };

  const handleStartClose = () => {
    if (isMobileBlocked) {
      setError(mobileBlockMessage);
      setActiveView("main");
      return;
    }
    setIsBypass(false);
    setActiveView("process");
    setCurrentStep(1);
  };

  const handleBypassClose = () => {
    if (isMobileBlocked) {
      setError(mobileBlockMessage);
      setActiveView("main");
      return;
    }
    if (!allowBypass) return;
    setIsBypass(true);
    setActiveView("process");
    setCurrentStep(1);
  };

  const handleNextStep = () => setCurrentStep((p) => Math.min(p + 1, 5));
  const handlePrevStep = () => setCurrentStep((p) => Math.max(p - 1, 1));
  const handleBackToMain = () => {
    setActiveView("main");
    setCurrentStep(1);
  };

  const handleUpdateAssignedTask = (taskId, field, value) => {
    setAssignedTasksUpdates((prev) => prev.map((t) => (t.id === taskId ? { ...t, [field]: value } : t)));
  };

  // Accept "done" | "not_done" | boolean, store boolean
  const handleUpdateRoutineStatus = (taskId, statusOrBool /* "done" | "not_done" | boolean */) => {
    const done = typeof statusOrBool === "boolean" ? statusOrBool : statusOrBool === "done";
    setRoutineTasksStatuses((prev) => prev.map((t) => (t.id === taskId ? { ...t, done } : t)));
  };

  const isTeacher = session?.user?.isTeacher === true;
  const isInRoutineMemberList = routineLogRequiredMemberIds.includes(Number(session?.user?.id));
  const routineLogRequired =
    routineLogRequiredAll ||
    (isTeacher && routineLogRequiredTeachers) ||
    (!isTeacher && routineLogRequiredNonTeachers) ||
    isInRoutineMemberList;

  const handleManagerReportChange = useCallback(
    (taskId, updates) => {
      if (!isTeamManager) return;
      const numericId = Number(taskId);
      if (!numericId || Number.isNaN(numericId)) return;
      setManagerRoutineReport((prev) => {
        const defaultEntry = {
          mode: assignedTasksCount > 0 ? "assigned" : "log",
          assignedTaskId: null,
          log: "",
        };
        const previous = prev?.[numericId] ?? defaultEntry;
        const nextEntry = {
          ...previous,
          ...(updates || {}),
        };
        return {
          ...prev,
          [numericId]: nextEntry,
        };
      });
    },
    [assignedTasksCount, isTeamManager]
  );

  const handleSubmitClose = async () => {
    if (isMobileBlocked) {
      setError(mobileBlockMessage);
      setShowConfirmModal(false);
      return;
    }
    if (routineLogRequired && !routineLog.trim()) {
      setError("Routine Task Log is required. Please add what you did before submitting.");
      setShowConfirmModal(false);
      return;
    }
    setIsSubmitting(true);
    setError("");
    setSuccess("");
    setElapsedTime(0);

    try {
      const routineTasksPayload = routineTasksStatuses.map((t) => {
        const base = {
          id: Number(t.id),
          description: t.description,
          done: !!t.done,
        };
        if (!isTeamManager) return base;
        const report = managerRoutineReport?.[Number(t.id)] ?? {};
        return {
          ...base,
          managerSource: report.mode || null,
          managerAssignedTaskId:
            report.mode === "assigned" && report.assignedTaskId
              ? Number(report.assignedTaskId)
              : null,
          managerLog:
            report.mode === "log" && report.log
              ? report.log.trim()
              : null,
        };
      });

      const body = {
        userId,
        date: format(new Date(), "yyyy-MM-dd"),
        assignedTasksUpdates: assignedTasksUpdates.map((u) => ({
          id: Number(u.id),
          title: u.title,
          statusUpdate: u.statusUpdate,
          comment: u.comment || null,
          newDeadline: u.newDeadline ? new Date(u.newDeadline).toISOString() : null,
        })),
        routineTasksUpdates: routineTasksPayload,
        routineLog: routineLog || null,
        generalLog: generalLog || null,
        mriCleared,
        // 🔁 include the MRI payload snapshot if available
        mriReport: mriPayload || null,
        bypass: allowBypass && isBypass,
      };

      const dayCloseRes = await fetch("/api/member/dayClose/dayCloseRequest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!dayCloseRes.ok) {
        const errorData = await dayCloseRes.json();
        const msg = errorData?.error || "Failed to submit day close request";
        if (dayCloseRes.status === 403 && msg.toLowerCase().includes("day close paused")) {
          setEscalationMsg(msg);
          setShowEscalationModal(true);
          return; // don't proceed further
        }
        throw new Error(msg);
      }

      // Notify admins/managers
      const adminsAndManagersRes = await fetch("/api/member/dayClose/adminsAndManagers");
      if (!adminsAndManagersRes.ok) throw new Error("Failed to fetch admins and IS");

      const { users: adminsAndManagers } = await adminsAndManagersRes.json();
      const message = `Day close request submitted by ${userName} for ${format(new Date(), "yyyy-MM-dd")}. Please review.`;

      await Promise.all(
        (adminsAndManagers || []).map((user) =>
          fetch("/api/others/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, recipientId: user.id, message }),
          })
        )
      );

      setActiveView("main");
      setIsBypass(false);
      setIsWaitingForApproval(true);
      setShowWaitingModal(true);
      mutateDayCloseStatus();
    } catch (err) {
      setError(`Failed to close day: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShowDetails = (task, details, logs) => {
    setSelectedTask(task);
    setTaskDetails(details);
    setTaskLogs(logs || []);
    setShowDetailsModal(true);
  };

  const handleCloseDetails = () => {
    setShowDetailsModal(false);
    setSelectedTask(null);
    setTaskDetails(null);
    setTaskLogs([]);
  };

  if (status === "loading") return <div>Loading...</div>;
  if (!["member", "team_manager"].includes(role)) return <div>Access Denied</div>;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 bg-gradient-to-br from-teal-50 to-blue-50 p-8 flex items-center justify-center"
    >
      <div
        className="w-full h-full bg-white/80 backdrop-blur-md rounded-3xl shadow-2xl p-8 flex flex-col gap-8 border border-teal-100/50"
        style={{ minHeight: "calc(100vh - 120px)" }}
      >
        {/* Error/Success Toasts */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-4 left-4 right-4 bg-red-50 text-red-600 p-4 rounded-xl shadow-md flex items-center gap-2 z-60"
              onClick={() => setError("")}
            >
              <AlertCircle size={20} />
              <p className="text-sm font-medium">{error} (Click to dismiss)</p>
            </motion.div>
          )}
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-4 left-4 right-4 bg-green-50 text-green-600 p-4 rounded-xl shadow-md flex items-center gap-2 z-60"
              onClick={() => setSuccess("")}
            >
              <CheckCircle size={20} />
              <p className="text-sm font-medium">{success} (Click to dismiss)</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Escalation Blocker Modal */}
        <AnimatePresence>
          {showEscalationModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100]"
              onClick={() => setShowEscalationModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-amber-600 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Day Close Not Allowed</h3>
                    <p className="text-sm text-gray-700 mt-1">
                      You are NOT allowed to close your day due to an active escalation involving you. There may be ADs in your day operations that are strictly not allowed or were requested to be followed.
                    </p>
                    <p className="text-sm text-gray-700 mt-2">
                      Kindly contact your Immediate Supervisor (IS) or the Superintendent for an override.
                    </p>
                    {escalationMsg && (
                      <p className="text-xs text-gray-500 mt-2">System note: {escalationMsg}</p>
                    )}
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2 justify-end">
                  <button className="px-4 py-2 rounded-lg border" onClick={() => setShowEscalationModal(false)}>Close</button>
                  <button
                    className="px-4 py-2 rounded-lg bg-teal-600 text-white"
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/member/profile');
                        const data = await res.json();
                        const isId = data?.user?.immediate_supervisor;
                        if (isId) {
                          // open embedded chatbox to IS
                          window.dispatchEvent(new CustomEvent('open-chat', { detail: { recipientId: isId } }));
                          setShowEscalationModal(false);
                        } else {
                          alert('No immediate supervisor set.');
                        }
                      } catch { alert('Unable to fetch supervisor'); }
                    }}
                  >Talk to IS</button>
                  <button
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white"
                    onClick={() => {
                      const superId = 43; // as used in Profile.jsx
                      window.dispatchEvent(new CustomEvent('open-chat', { detail: { recipientId: superId } }));
                      setShowEscalationModal(false);
                    }}
                  >Talk to Superintendent</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        <AnimatePresence mode="wait">
          {activeView === "main" ? (
            <motion.div
              key="main"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full"
            >
              {/* Left card */}
              <motion.div
                className="bg-white/80 backdrop-blur-md rounded-3xl shadow-md p-6 border border-teal-100/50 flex flex-col lg:col-span-1 hover:shadow-xl transition-shadow duration-300"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Calendar size={20} className="text-teal-600" />
                  <h2 className="text-xl font-bold text-gray-800">Close My Day</h2>
                </div>
                <p className="text-sm text-gray-600 mb-6">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>

                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <CheckCircle size={18} className="text-teal-600" />
                    Hi {userName}
                  </h3>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
                    </div>
                  ) : (
                    timeLeft !== null && (
                      <p className="text-lg font-bold text-teal-700">
                        Time left to close day: {formatElapsedTime(timeLeft)}
                      </p>
                    )
                  )}
                  {!isClosingWindow && !isBypass && !allowBypass && (
                    <p className="text-sm text-red-500 mt-2">Closing window not active yet.</p>
                  )}
                  {isMobileBlocked && (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                      <span>{mobileBlockMessage}</span>
                    </div>
                  )}
                  {requestStatus !== "none" && (
                    <p
                      className={`text-sm font-semibold mt-2 ${
                        requestStatus === "pending"
                          ? "text-indigo-700"
                          : requestStatus === "approved"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      Status: {requestStatus.charAt(0).toUpperCase() + requestStatus.slice(1)}
                    </p>
                  )}
                </div>

                <div className="space-y-3 mt-auto">
                  <motion.button
                    className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-all duration-300 flex items-center justify-center gap-2 shadow-md"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowHistoryModal(true)}
                  >
                    View History
                  </motion.button>
                  {requestStatus === "pending" ? (
                    <p className="text-center text-lg font-bold text-indigo-700">Pending Approval</p>
                  ) : requestStatus === "approved" ? (
                    <p className="text-center text-lg font-bold text-green-600">
                      Day Approved for{" "}
                      {requestDate
                        ? format(new Date(requestDate), "d/M/yyyy")
                        : format(new Date(), "d/M/yyyy")}{" "}
                      by {approvedByName || "Unknown"}
                    </p>
                  ) : (
                    <>
                      <motion.button
                        className={`w-full bg-teal-600 text-white py-3 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 shadow-md ${
                          closeButtonDisabled ? "opacity-50 cursor-not-allowed" : "hover:bg-teal-700"
                        }`}
                        whileHover={{ scale: closeButtonDisabled ? 1 : 1.02 }}
                        whileTap={{ scale: closeButtonDisabled ? 1 : 0.98 }}
                        onClick={handleStartClose}
                        disabled={closeButtonDisabled}
                        title={
                          isMobileBlocked
                            ? mobileBlockMessage
                            : !isClosingWindow
                            ? "Closing window not open, try at the right time."
                            : ""
                        }
                      >
                        <Clock size={16} />
                        Close My Day
                      </motion.button>
                      {allowBypass && (
                        <motion.button
                          className={`w-full bg-orange-600 text-white py-3 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 shadow-md ${
                            bypassButtonDisabled ? "opacity-50 cursor-not-allowed" : "hover:bg-orange-700"
                          }`}
                          whileHover={{ scale: bypassButtonDisabled ? 1 : 1.02 }}
                          whileTap={{ scale: bypassButtonDisabled ? 1 : 0.98 }}
                          onClick={handleBypassClose}
                          title={
                            isMobileBlocked
                              ? mobileBlockMessage
                              : "Bypass close window (admin-controlled toggle)"
                          }
                          disabled={bypassButtonDisabled}
                        >
                          <Clock size={16} />
                          Bypass Close (Test)
                        </motion.button>
                      )}
                    </>
                  )}
                </div>
              </motion.div>

              {/* Right card */}
              <motion.div
                className="bg-white/80 backdrop-blur-md rounded-3xl shadow-md p-6 border border-teal-100/50 flex flex-col lg:col-span-2 hover:shadow-xl transition-shadow duration-300"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <div className="flex items-center gap-2 mb-6">
                  <Calendar size={20} className="text-teal-600" />
                  <h2 className="text-xl font-bold text-gray-800">Day Close Information</h2>
                </div>
                <div className="flex flex-wrap gap-2 mb-6 justify-center">
                  {[
                    { label: "Day Open Time", value: timesData?.times?.dayOpenTime || "Not set" },
                    { label: "Day Close Time", value: timesData?.times?.dayCloseTime || "Not set" },
                    { label: "Closing Window Start", value: timesData?.times?.closingWindowStart || "Not set" },
                    { label: "Closing Window End", value: timesData?.times?.closingWindowEnd || "Not set" },
                  ].map((item, index) => (
                    <motion.div
                      key={item.label}
                      className="bg-white/80 backdrop-blur-md rounded-xl shadow-sm p-3 border border-teal-100/50 flex flex-col items-center justify-center min-w-[120px] hover:shadow-md transition-shadow duration-300"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      whileHover={{ scale: 1.03 }}
                    >
                      <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide text-center">{item.label}</h3>
                      <p className="text-sm font-bold text-teal-700 mt-1">{item.value}</p>
                    </motion.div>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
                  <motion.div
                    className="bg-white/80 backdrop-blur-md rounded-2xl shadow-md p-6 border border-teal-100/50 flex flex-col items-center justify-center text-center hover:shadow-xl transition-shadow duration-300"
                    whileHover={{ scale: 1.02 }}
                  >
                    <Clock className="w-12 h-12 text-teal-600 mb-4" />
                    <h3 className="text-lg font-bold text-gray-800 mb-2">Closing Window</h3>
                    <p className="text-sm text-gray-600 mb-4">The time period during which you can close your day.</p>
                    <p className="text-sm font-semibold text-teal-800">
                      {timesData?.times?.closingWindowStart} - {timesData?.times?.closingWindowEnd}
                    </p>
                  </motion.div>
                  <motion.div
                    className="bg-white/80 backdrop-blur-md rounded-2xl shadow-md p-6 border border-teal-100/50 flex flex-col items-center justify-center text-center hover:shadow-xl transition-shadow duration-300"
                    whileHover={{ scale: 1.02 }}
                  >
                    <CheckCircle className="w-12 h-12 text-blue-600 mb-4" />
                    <h3 className="text-lg font-bold text-gray-800 mb-2">Day Close Process</h3>
                    <p className="text-sm text-gray-600">Review MRI clearance, update tasks, and submit logs to close your day.</p>
                  </motion.div>
                </div>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="process"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col h-full"
            >
              <div className="flex items-center justify-between mb-6">
                <motion.button
                  onClick={handleBackToMain}
                  className="text-gray-600 hover:text-gray-800 flex items-center gap-2"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <ArrowLeft size={20} /> Back
                </motion.button>
                <h2 className="text-xl font-bold text-gray-800">Day Closing Process - Step {currentStep}/5</h2>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((step) => (
                    <motion.div
                      key={step}
                      className={`w-8 h-2 rounded-full ${step <= currentStep ? "bg-teal-600" : "bg-gray-300"}`}
                      animate={{ scale: step === currentStep ? 1.2 : 1 }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 pb-6">
                <AnimatePresence mode="wait">
                  {currentStep === 1 && (
                    <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                      <MRIStep
                        handleNextStep={handleNextStep}
                        onMriClearedChange={setMriCleared}
                        onMriPayloadChange={setMriPayload}
                      />
                    </motion.div>
                  )}

                  {currentStep === 2 && (
                    <motion.div
                      key="step2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <AssignedTasksStep
                        assignedTasksData={assignedTasksData}
                        assignedTasksUpdates={assignedTasksUpdates}
                        handleUpdateAssignedTask={handleUpdateAssignedTask}
                        handlePrevStep={handlePrevStep}
                        handleNextStep={handleNextStep}
                        onShowDetails={handleShowDetails}
                        showDetailsModal={showDetailsModal}
                        onCloseDetails={handleCloseDetails}
                      />
                    </motion.div>
                  )}

                  {currentStep === 3 && (
                    <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                      <RoutineTasksStep
                        routineTasksData={routineTasksData}
                        routineTasksStatuses={routineTasksStatuses}
                        handleUpdateRoutineStatus={handleUpdateRoutineStatus}
                        routineLog={routineLog}
                        setRoutineLog={setRoutineLog}
                        handlePrevStep={handlePrevStep}
                        handleNextStep={handleNextStep}
                        routineLogRequired={routineLogRequired}
                        isTeamManager={isTeamManager}
                        assignedTasksData={assignedTasksData}
                        managerRoutineReport={managerRoutineReport}
                        onManagerReportChange={handleManagerReportChange}
                      />
                    </motion.div>
                  )}

                  {currentStep === 4 && (
                    <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                      <TodayAtGlanceStep
                        handleNextStep={handleNextStep}
                        handlePrevStep={handlePrevStep}
                        showIprJourney={showIprJourney}
                      />
                    </motion.div>
                  )}

                  {currentStep === 5 && (
                    <motion.div key="step5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                      <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <CheckCircle size={18} className="text-teal-600" />
                        General Log
                      </h3>

                      {/* Today's note input */}
                      <textarea
                        value={generalLog}
                        onChange={(e) => setGeneralLog(e.target.value)}
                        placeholder="Any message to the superintendent/admin?"
                        className="border border-teal-200 p-3 rounded-xl w-full text-sm h-24 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200 bg-teal-50/50 resize-none"
                      />

                      {/* Past-day conversation thread */}
                      <div className="mt-5">
                        <GeneralConversationThread limitDays={14} />
                      </div>

                      <div className="flex justify-between mt-6 gap-4">
                        <motion.button
                          onClick={handlePrevStep}
                          className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-all duration-300 shadow-sm"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          Previous
                        </motion.button>
                        <motion.button
                          onClick={() => {
                            if (isMobileBlocked) {
                              setError(mobileBlockMessage);
                              return;
                            }
                            setShowConfirmModal(true);
                          }}
                          disabled={isSubmitting || isMobileBlocked}
                          className={`flex-1 bg-teal-600 text-white py-3 rounded-xl font-semibold transition-all duration-300 shadow-md ${
                            isSubmitting || isMobileBlocked ? "opacity-50 cursor-not-allowed" : "hover:bg-teal-700"
                          }`}
                          whileHover={{ scale: isSubmitting || isMobileBlocked ? 1 : 1.02 }}
                          whileTap={{ scale: isSubmitting || isMobileBlocked ? 1 : 0.98 }}
                        >
                          {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Submit Close Day"}
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Details Modal */}
        <AnimatePresence>
          {showDetailsModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-70"
              onClick={(e) => {
                if (e.target === e.currentTarget) handleCloseDetails();
              }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white/90 backdrop-blur-md rounded-3xl shadow-xl p-6 w-full max-w-md border border-teal-100/50 text-center overflow-y-auto max-h-[80vh]"
                onClick={(e) => e.stopPropagation()}
              >
                <button onClick={handleCloseDetails} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700">
                  <X className="w-6 h-6" />
                </button>
                <h2 className="text-xl font-bold text-gray-800 mb-4">Task Details</h2>
                <AssignedTaskDetails
                  task={taskDetails}
                  taskLogs={taskLogs}
                  users={users || []}
                  onClose={handleCloseDetails}
                  currentUserId={session?.user?.id}
                  currentUserName={session?.user?.name}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Waiting Modal */}
        <DayCloseWaitingModal
          showWaitingModal={showWaitingModal}
          isWaitingForApproval={isWaitingForApproval}
          elapsedTime={elapsedTime}
          formatElapsedTime={formatElapsedTime}
          dayCloseStatus={dayCloseStatus}
          routineTasksStatuses={routineTasksStatuses}
          userId={userId}
          setSuccess={setSuccess}
          setError={setError}
          onClose={() => {
            setShowWaitingModal(false);
            setActiveView("main");
            mutateDayCloseStatus();
          }}
        />

        {/* History Modal */}
        <AnimatePresence>
          {showHistoryModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-70">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white/90 backdrop-blur-md rounded-3xl shadow-xl p-6 w-full max-w-md border border-teal-100/50 text-center overflow-y-auto max-h-[80vh]"
              >
                <h2 className="text-xl font-bold text-gray-800 mb-4">Day Close History</h2>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-800">Select Date:</label>
                  <input
                    type="date"
                    value={selectedHistoryDate || ""}
                    onChange={(e) => setSelectedHistoryDate(e.target.value)}
                    className="border border-teal-200 p-2 rounded-xl w-full text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200 bg-teal-50/50"
                    max={format(new Date(), "yyyy-MM-dd")}
                  />
                </div>
                {filteredHistory?.length ? (
                  <div className="space-y-4">
                    {filteredHistory.map((req) => (
                      <div key={req.id} className="bg-gray-50 p-4 rounded-xl shadow-sm border border-teal-100/50">
                        <p>
                          <strong>Date:</strong>{" "}
                          {req.date && !isNaN(new Date(req.date).getTime())
                            ? format(new Date(req.date), "d/M/yyyy (EEEE)")
                            : "Unknown date"}
                        </p>
                        <p>
                          <strong>Status:</strong> {req.status}
                        </p>
                        <p>
                          <strong>Requested At:</strong> {formatIST(req.createdAt)}
                        </p>
                        {req.approvedAt && (
                          <p>
                            <strong>{req.status === "approved" ? "Approved" : "Rejected"} By:</strong>{" "}
                            {req.approvedByName || "Unknown"}
                          </p>
                        )}
                        {req.approvedAt && (
                          <p>
                            <strong>{req.status === "approved" ? "Approved" : "Rejected"} At:</strong>{" "}
                            {formatIST(req.approvedAt)}
                          </p>
                        )}
                        {req.ISRoutineLog && (
                          <p>
                            <strong>Supervisor Routine Comment:</strong> {req.ISRoutineLog}
                          </p>
                        )}
                        {req.ISGeneralLog && (
                          <p>
                            <strong>Supervisor General Comment:</strong> {req.ISGeneralLog}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">No history available for selected date.</p>
                )}
                <motion.button
                  onClick={() => setShowHistoryModal(false)}
                  className="w-full bg-gray-600 text-white py-3 rounded-xl font-semibold hover:bg-gray-700 transition-all duration-300 mt-6 shadow-sm"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Close
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Confirmation Modal */}
        <AnimatePresence>
          {showConfirmModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-70">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white/90 backdrop-blur-md rounded-3xl shadow-xl p-6 w-full max-w-md border border-teal-100/50 text-center"
              >
                <h2 className="text-xl font-bold text-gray-800 mb-2">Confirm Submission</h2>
                <p className="text-sm text-gray-600 mb-6">Are you sure you want to submit your day close request?</p>
                <div className="flex gap-4">
                  <motion.button
                    onClick={() => setShowConfirmModal(false)}
                    className="flex-1 bg-gray-600 text-white py-3 rounded-xl font-semibold hover:bg-gray-700 transition-all duration-300 shadow-sm"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    No
                  </motion.button>
                  <motion.button
                    onClick={() => {
                      setShowConfirmModal(false);
                      handleSubmitClose();
                    }}
                    className="flex-1 bg-teal-600 text-white py-3 rounded-xl font-semibold hover:bg-teal-700 transition-all duration-300 shadow-sm"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Yes
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
