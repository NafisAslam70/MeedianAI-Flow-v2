// app/(main)/dashboard/member/closeMyDay/page.jsx
"use client";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, Calendar, CheckCircle, AlertCircle, Loader2, ArrowLeft, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import useSWR from "swr";
import MRIStep from "./MRIStep";
import AssignedTasksStep from "./AssignedTasksStep";
import RoutineTasksStep from "./RoutineTasksStep";

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

  const [timeLeft, setTimeLeft] = useState(null);
  const [isClosingWindow, setIsClosingWindow] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState("main"); // main or process
  const [showWaitingModal, setShowWaitingModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(null);
  const [isWaitingForApproval, setIsWaitingForApproval] = useState(false);
  const [requestStatus, setRequestStatus] = useState("none"); // none, pending, approved, rejected
  const [requestDate, setRequestDate] = useState(null);
  const [approvedByName, setApprovedByName] = useState(null);
  const [currentStep, setCurrentStep] = useState(1); // 1: MRI, 2: Assigned Tasks, 3: Routine Tasks, 4: General Log
  const [mriCleared, setMriCleared] = useState(true);
  const [assignedTasksUpdates, setAssignedTasksUpdates] = useState([]);
  const [routineTasksStatuses, setRoutineTasksStatuses] = useState([]);
  const [routineLog, setRoutineLog] = useState("");
  const [generalLog, setGeneralLog] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPortrait, setIsPortrait] = useState(false);
  // TO BE REMOVED FOR PRODUCTION: Bypass state for testing
  const [isBypass, setIsBypass] = useState(false);

  const { data: timesData, error: timesError } = useSWR(
    status === "authenticated" ? "/api/member/openCloseTimes" : null,
    fetcher
  );

  const { data: assignedTasksData, mutate: mutateAssigned } = useSWR(
    status === "authenticated" ? `/api/member/assignedTasks?date=${format(new Date(), "yyyy-MM-dd")}&action=tasks` : null,
    fetcher
  );

  const { data: routineTasksData, mutate: mutateRoutine } = useSWR(
    status === "authenticated" ? `/api/member/routine-tasks?action=routineTasks&date=${format(new Date(), "yyyy-MM-dd")}` : null,
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
    ? historyData?.requests?.filter(req => format(new Date(req.date), "yyyy-MM-dd") === selectedHistoryDate)
    : historyData?.requests;

useEffect(() => {
  if (!timesData?.times) return;

  // IST offset in milliseconds
  const IST_OFFSET = 5.5 * 60 * 60 * 1000;

  // Build “close time” and window boundaries in IST, then convert back to UTC epoch
  const buildEpoch = (hh, mm) => {
    // Get current date in IST
    const nowUtcMs = Date.now();
    const istNow = new Date(nowUtcMs + IST_OFFSET);
    const year = istNow.getUTCFullYear();
    const month = istNow.getUTCMonth();
    const day = istNow.getUTCDate();

    // UTC timestamp for that IST date/time
    const utcTs = Date.UTC(year, month, day, hh, mm);
    // Convert back to local epoch by subtracting the IST offset
    return utcTs - IST_OFFSET;
  };

  const closeEpoch    = buildEpoch(...timesData.times.dayCloseTime.split(":").map(Number));
  const startEpoch    = buildEpoch(...timesData.times.closingWindowStart.split(":").map(Number));
  const endEpoch      = buildEpoch(...timesData.times.closingWindowEnd.split(":").map(Number));
  const nowEpoch      = Date.now();

  setIsClosingWindow(nowEpoch >= startEpoch && nowEpoch <= endEpoch);

  const updateTimeLeft = () => {
    let diff = closeEpoch - Date.now();
    // if we've already passed today’s IST close, roll forward 24h
    if (diff < 0) diff += 24 * 3600 * 1000;
    setTimeLeft(Math.floor(diff / 1000));
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
          done: task.status === "done",
          description: task.description || "No description",
        }))
      );
    } else {
      setRoutineTasksStatuses([]);
    }
  }, [routineTasksData]);

  useEffect(() => {
    if (dayCloseStatus) {
      setRequestStatus(dayCloseStatus.status || "none");
      setRequestDate(dayCloseStatus.date || null);
      setApprovedByName(dayCloseStatus.approvedByName || null);
      setIsWaitingForApproval(dayCloseStatus.status === "pending");
      if (dayCloseStatus.status === "pending") {
        setShowWaitingModal(true);
      } else {
        setShowWaitingModal(false);
        if (dayCloseStatus.status === "approved") {
          setSuccess("Congratulations! Your day has been approved. Good night :)");
        } else if (dayCloseStatus.status === "rejected") {
          setError("Your day close request was rejected. Please review and resubmit.");
        }
      }
    } else {
      setRequestStatus("none");
      setIsWaitingForApproval(false);
      setShowWaitingModal(false);
    }
  }, [dayCloseStatus]);

  const formatTimeLeft = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const formatIST = (date) => {
    return new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  };

  const handleStartClose = () => {
    setIsBypass(false); // TO BE REMOVED FOR PRODUCTION
    setActiveView("process");
    setCurrentStep(1);
  };

  // TO BE REMOVED FOR PRODUCTION: Bypass function for testing
  const handleBypassClose = () => {
    setIsBypass(true);
    setActiveView("process");
    setCurrentStep(1);
  };

  const handleNextStep = () => {
    setCurrentStep((prev) => Math.min(prev + 1, 4));
  };

  const handlePrevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleBackToMain = () => {
    setActiveView("main");
    setCurrentStep(1);
  };

  const handleUpdateAssignedTask = (taskId, field, value) => {
    setAssignedTasksUpdates((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, [field]: value } : t))
    );
  };

  const handleUpdateRoutineStatus = (taskId, done) => {
    setRoutineTasksStatuses((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, done } : t))
    );
  };

  const handleSubmitClose = async () => {
    setIsSubmitting(true);
    setError("");
    setSuccess("");

    try {
      // Submit day close request with pending updates
      const dayCloseRes = await fetch("/api/member/dayClose/dayCloseRequest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          date: format(new Date(), "yyyy-MM-dd"),
          assignedTasksUpdates: assignedTasksUpdates.map((update) => ({
            id: update.id,
            title: update.title,
            statusUpdate: update.statusUpdate,
            comment: update.comment || null,
            newDeadline: update.newDeadline ? new Date(update.newDeadline).toISOString() : null,
          })),
          routineTasksUpdates: routineTasksStatuses.map((task) => ({
            id: task.id,
            description: task.description,
            done: task.done,
          })),
          routineLog: routineLog || null,
          generalLog: generalLog || null,
          mriCleared,
          bypass: isBypass, // TO BE REMOVED FOR PRODUCTION
        }),
      });

      if (!dayCloseRes.ok) {
        const errorData = await dayCloseRes.json();
        throw new Error(errorData.error || "Failed to submit day close request");
      }

      // Send notification to admins and team managers
      const adminsAndManagersRes = await fetch("/api/member/dayClose/adminsAndManagers");
      if (!adminsAndManagersRes.ok) {
        throw new Error("Failed to fetch admins and team managers");
      }
      const { users: adminsAndManagers } = await adminsAndManagersRes.json();
      const message = `Day close request submitted by ${userName} for ${format(new Date(), "yyyy-MM-dd")}. Please review.`;
      await Promise.all(
        adminsAndManagers.map((user) =>
          fetch("/api/others/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId,
              recipientId: user.id,
              message,
            }),
          })
        )
      );

      setActiveView("main");
      setIsWaitingForApproval(true);
      setShowWaitingModal(true);
      mutateDayCloseStatus();
    } catch (err) {
      setError(`Failed to close day: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === "loading") return <div>Loading...</div>;
  if (!["member", "team_manager"].includes(role)) {
    return <div>Access Denied</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 bg-gradient-to-br from-teal-50 to-blue-50 p-8 flex items-center justify-center"
    >
      <div className="w-full h-full bg-white/80 backdrop-blur-md rounded-3xl shadow-2xl p-8 flex flex-col gap-8 overflow-y-auto border border-teal-100/50">
        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 left-4 right-4 bg-red-50 text-red-600 p-4 rounded-xl shadow-md flex items-center gap-2 z-50"
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
              className="absolute top-4 left-4 right-4 bg-green-50 text-green-600 p-4 rounded-xl shadow-md flex items-center gap-2 z-50"
              onClick={() => setSuccess("")}
            >
              <CheckCircle size={20} />
              <p className="text-sm font-medium">{success} (Click to dismiss)</p>
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
              {/* Greeting and Time Left */}
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
                  ) : timeLeft !== null && (
                    <p className="text-lg font-bold text-teal-700">
                      Time left to close day: {formatTimeLeft(timeLeft)}
                    </p>
                  )}
                  {!isClosingWindow && !isBypass && ( // TO BE REMOVED FOR PRODUCTION: isBypass check
                    <p className="text-sm text-red-500 mt-2">Closing window not active yet.</p>
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

                {/* Buttons or Status */}
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
                      Day Approved for {requestDate ? format(new Date(requestDate), "d/M/yyyy") : format(new Date(), "d/M/yyyy")} by {approvedByName || "Unknown"}
                    </p>
                  ) : (
                    <>
                      <motion.button
                        className="w-full bg-teal-600 text-white py-3 rounded-xl font-semibold hover:bg-teal-700 transition-all duration-300 flex items-center justify-center gap-2 shadow-md"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleStartClose}
                        disabled={isSubmitting || !isClosingWindow} // TO BE REMOVED FOR PRODUCTION: Remove !isBypass
                        title={!isClosingWindow ? "Closing window not open, try at the right time." : ""}
                      >
                        <Clock size={16} />
                        Close My Day
                      </motion.button>
                      {/* TO BE REMOVED FOR PRODUCTION: Bypass button */}
                      <motion.button
                        className="w-full bg-orange-600 text-white py-3 rounded-xl font-semibold hover:bg-orange-700 transition-all duration-300 flex items-center justify-center gap-2 shadow-md"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleBypassClose}
                        title="Bypass for testing - remove later"
                      >
                        <Clock size={16} />
                        Bypass Close (Test)
                      </motion.button>
                    </>
                  )}
                </div>
              </motion.div>

              {/* Day Close Information */}
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
                <h2 className="text-xl font-bold text-gray-800">Day Closing Process - Step {currentStep}/4</h2>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map((step) => (
                    <motion.div
                      key={step}
                      className={`w-8 h-2 rounded-full ${step <= currentStep ? 'bg-teal-600' : 'bg-gray-300'}`}
                      animate={{ scale: step === currentStep ? 1.2 : 1 }}
                    />
                  ))}
                </div>
              </div>
              <AnimatePresence mode="wait">
                {currentStep === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <MRIStep handleNextStep={handleNextStep} mriCleared={mriCleared} />
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
                    />
                  </motion.div>
                )}
                {currentStep === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <RoutineTasksStep
                      routineTasksData={routineTasksData}
                      routineTasksStatuses={routineTasksStatuses}
                      handleUpdateRoutineStatus={handleUpdateRoutineStatus}
                      routineLog={routineLog}
                      setRoutineLog={setRoutineLog}
                      handlePrevStep={handlePrevStep}
                      handleNextStep={handleNextStep}
                    />
                  </motion.div>
                )}
                {currentStep === 4 && (
                  <motion.div
                    key="step4"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <CheckCircle size={18} className="text-teal-600" />
                        General Log
                      </h3>
                      <textarea
                        value={generalLog}
                        onChange={(e) => setGeneralLog(e.target.value)}
                        placeholder="Any message to the superintendent/admin?"
                        className="border border-teal-200 p-3 rounded-xl w-full text-sm h-24 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200 bg-teal-50/50 resize-none"
                      />
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
                          onClick={handleSubmitClose}
                          disabled={isSubmitting}
                          className={`flex-1 bg-teal-600 text-white py-3 rounded-xl font-semibold transition-all duration-300 shadow-md ${isSubmitting ? "opacity-50 cursor-not-allowed" : "hover:bg-teal-700"}`}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Submit Close Day"}
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Waiting Modal */}
        <AnimatePresence>
          {showWaitingModal && (
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
                transition={{ duration: 0.3 }}
                className="bg-white/90 backdrop-blur-md rounded-3xl shadow-xl p-6 w-full max-w-md border border-teal-100/50 text-center"
              >
                <div className="text-6xl mb-4">😊</div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Waiting for Approval</h2>
                <p className="text-sm text-gray-600 mb-6">Your day close request has been submitted. Please wait for admin/manager approval.</p>
                <motion.button
                  onClick={() => setShowWaitingModal(false)}
                  className="w-full bg-gray-600 text-white py-3 rounded-xl font-semibold hover:bg-gray-500 transition-all duration-300 shadow-sm"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Close
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* History Modal */}
        <AnimatePresence>
          {showHistoryModal && (
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
                        <p><strong>Date:</strong> {format(new Date(req.date), "d/M/yyyy (EEEE)")}</p>
                        <p><strong>Status:</strong> {req.status}</p>
                        <p><strong>Requested At:</strong> {formatIST(req.createdAt)}</p>
                        {req.approvedAt && <p><strong>{req.status === "approved" ? "Approved" : "Rejected"} By:</strong> {req.approvedByName || "Unknown"}</p>}
                        {req.approvedAt && <p><strong>{req.status === "approved" ? "Approved" : "Rejected"} At:</strong> {formatIST(req.approvedAt)}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">No history available for selected date.</p>
                )}
                <motion.button
                  onClick={() => setShowHistoryModal(false)}
                  className="w-full bg-gray-600 text-white py-3 rounded-xl font-semibold hover:bg-gray-500 transition-all duration-300 mt-6 shadow-sm"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Close
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}