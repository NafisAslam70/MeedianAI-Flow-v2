// app/(main)/dashboard/member/closeMyDay/page.jsx
"use client";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, Calendar, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
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
  const [showCloseProcess, setShowCloseProcess] = useState(false);
  const [showWaitingModal, setShowWaitingModal] = useState(false);
  const [isWaitingForApproval, setIsWaitingForApproval] = useState(false);
  const [requestStatus, setRequestStatus] = useState("none"); // none, pending, approved, rejected
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
    status === "authenticated" ? "/api/member/dayCloseStatus" : null,
    fetcher,
    { refreshInterval: isWaitingForApproval ? 5000 : 0 }
  );

  useEffect(() => {
    if (timesData?.times) {
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
    }
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
          comment: task.comment || "",
          description: task.description || "No description",
        }))
      );
    } else {
      setRoutineTasksStatuses([]);
    }
  }, [routineTasksData]);

  useEffect(() => {
    if (dayCloseStatus?.status) {
      setRequestStatus(dayCloseStatus.status);
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
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStartClose = () => {
    setIsBypass(false); // TO BE REMOVED FOR PRODUCTION
    setShowCloseProcess(true);
    setCurrentStep(1);
  };

  // TO BE REMOVED FOR PRODUCTION: Bypass function for testing
  const handleBypassClose = () => {
    setIsBypass(true);
    setShowCloseProcess(true);
    setCurrentStep(1);
  };

  const handleNextStep = () => {
    setCurrentStep((prev) => prev + 1);
  };

  const handlePrevStep = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const handleUpdateAssignedTask = (taskId, field, value) => {
    setAssignedTasksUpdates((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, [field]: value } : t))
    );
  };

  const handleUpdateRoutineStatus = (taskId, done, comment) => {
    setRoutineTasksStatuses((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, done, comment } : t))
    );
  };

  const handleSubmitClose = async () => {
    setIsSubmitting(true);
    setError("");
    setSuccess("");

    try {
      // Submit general log immediately
      if (generalLog) {
        const generalLogRes = await fetch("/api/member/generalLogs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "Day Close Comment",
            details: generalLog,
          }),
        });
        if (!generalLogRes.ok) {
          throw new Error("Failed to submit general log");
        }
      }

      // Submit day close request with pending updates
      const dayCloseRes = await fetch("/api/member/dayCloseRequest", {
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
            comment: task.comment || null,
          })),
          routineLog: routineLog || null,
          mriCleared,
          bypass: isBypass, // TO BE REMOVED FOR PRODUCTION
        }),
      });

      if (!dayCloseRes.ok) {
        const errorData = await dayCloseRes.json();
        throw new Error(errorData.error || "Failed to submit day close request");
      }

      // Send notification to admins and team managers
      const adminsAndManagersRes = await fetch("/api/member/adminsAndManagers");
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

      setShowCloseProcess(false);
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
      className="fixed inset-0 bg-gray-100 p-8 flex items-center justify-center"
    >
      <div className="w-full h-full bg-white rounded-2xl shadow-2xl p-8 flex flex-col gap-8 overflow-y-auto">
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

        {/* Open/Close and Closing Window Times Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Day Open Time", value: timesData?.times?.dayOpenTime || "Not set" },
            { label: "Day Close Time", value: timesData?.times?.dayCloseTime || "Not set" },
            { label: "Closing Window Start", value: timesData?.times?.closingWindowStart || "Not set" },
            { label: "Closing Window End", value: timesData?.times?.closingWindowEnd || "Not set" },
          ].map((item, index) => (
            <motion.div
              key={item.label}
              className="bg-white/50 backdrop-blur-sm rounded-2xl shadow-md p-4 border border-teal-100/50 flex flex-col justify-between min-h-[80px]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ scale: 1.03, boxShadow: "0 8px 16px rgba(0, 128, 128, 0.1)" }}
            >
              <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{item.label}</h3>
              <p className="text-lg font-bold text-teal-700">{item.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
          {/* Greeting and Time Left */}
          <motion.div
            className="bg-white/50 backdrop-blur-sm rounded-3xl shadow-md p-6 border border-teal-100/50 flex flex-col lg:col-span-1"
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
              {requestStatus === "pending" ? (
                <p className="text-center text-lg font-bold text-indigo-700">Pending Approval</p>
              ) : requestStatus === "approved" ? (
                <p className="text-center text-lg font-bold text-green-600">Day Approved</p>
              ) : (
                <>
                  <motion.button
                    className="w-full bg-teal-600 text-white py-3 rounded-xl font-semibold hover:bg-teal-700 transition-all duration-300 flex items-center justify-center gap-2"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleStartClose}
                    disabled={isSubmitting || !isClosingWindow} // TO BE REMOVED FOR PRODUCTION: Remove !isBypass
                  >
                    <Clock size={16} />
                    Close My Day
                  </motion.button>
                  {/* TO BE REMOVED FOR PRODUCTION: Bypass button */}
                  <motion.button
                    className="w-full bg-orange-600 text-white py-3 rounded-xl font-semibold hover:bg-orange-700 transition-all duration-300 flex items-center justify-center gap-2"
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

          {/* Close Day Process */}
          <motion.div
            className="bg-white/50 backdrop-blur-sm rounded-3xl shadow-md p-6 border border-teal-100/50 flex flex-col lg:col-span-2"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="flex items-center gap-2 mb-6">
              <Calendar size={20} className="text-teal-600" />
              <h2 className="text-xl font-bold text-gray-800">Day Close Information</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
              <motion.div
                className="bg-white/50 backdrop-blur-sm rounded-2xl shadow-md p-6 border border-teal-100/50 flex flex-col items-center justify-center text-center"
                whileHover={{ scale: 1.02, boxShadow: "0 8px 16px rgba(0, 128, 128, 0.1)" }}
              >
                <Clock className="w-12 h-12 text-teal-600 mb-4" />
                <h3 className="text-lg font-bold text-gray-800 mb-2">Closing Window</h3>
                <p className="text-sm text-gray-600 mb-4">The time period during which you can close your day.</p>
                <p className="text-sm font-semibold text-teal-800">
                  {timesData?.times?.closingWindowStart} - {timesData?.times?.closingWindowEnd}
                </p>
              </motion.div>
              <motion.div
                className="bg-white/50 backdrop-blur-sm rounded-2xl shadow-md p-6 border border-teal-100/50 flex flex-col items-center justify-center text-center"
                whileHover={{ scale: 1.02, boxShadow: "0 8px 16px rgba(0, 128, 128, 0.1)" }}
              >
                <CheckCircle className="w-12 h-12 text-blue-600 mb-4" />
                <h3 className="text-lg font-bold text-gray-800 mb-2">Day Close Process</h3>
                <p className="text-sm text-gray-600">Review MRI clearance, update tasks, and submit logs to close your day.</p>
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* Close Process Modal */}
        <AnimatePresence>
          {showCloseProcess && (
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
                className="bg-white/90 backdrop-blur-md rounded-3xl shadow-xl p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto border border-teal-100/50"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-800">Close Day Process - Step {currentStep}/4</h2>
                  <motion.button
                    onClick={() => setShowCloseProcess(false)}
                    className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-all duration-200"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <X size={24} />
                  </motion.button>
                </div>
                {isPortrait ? (
                  <div className="flex items-center justify-center text-center py-8">
                    <p className="text-2xl font-bold text-gray-800">Please rotate your device to landscape mode for better experience.</p>
                  </div>
                ) : (
                  <>
                    {currentStep === 1 && <MRIStep handleNextStep={handleNextStep} mriCleared={mriCleared} />}
                    {currentStep === 2 && (
                      <AssignedTasksStep
                        assignedTasksData={assignedTasksData}
                        assignedTasksUpdates={assignedTasksUpdates}
                        handleUpdateAssignedTask={handleUpdateAssignedTask}
                        handlePrevStep={handlePrevStep}
                        handleNextStep={handleNextStep}
                      />
                    )}
                    {currentStep === 3 && (
                      <RoutineTasksStep
                        routineTasksData={routineTasksData}
                        routineTasksStatuses={routineTasksStatuses}
                        handleUpdateRoutineStatus={handleUpdateRoutineStatus}
                        routineLog={routineLog}
                        setRoutineLog={setRoutineLog}
                        handlePrevStep={handlePrevStep}
                        handleNextStep={handleNextStep}
                      />
                    )}
                    {currentStep === 4 && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                          <CheckCircle size={18} className="text-teal-600" />
                          General Log
                        </h3>
                        <textarea
                          value={generalLog}
                          onChange={(e) => setGeneralLog(e.target.value)}
                          placeholder="Any message to the superintendent/admin?"
                          className="border p-2 rounded w-full h-32 text-sm"
                        />
                        <div className="flex justify-between mt-6 gap-4">
                          <motion.button
                            onClick={handlePrevStep}
                            className="flex-1 bg-gray-600 text-white py-3 rounded-xl font-semibold hover:bg-gray-500 transition-all duration-300"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            Previous
                          </motion.button>
                          <motion.button
                            onClick={handleSubmitClose}
                            disabled={isSubmitting}
                            className={`flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold transition-all duration-300 ${isSubmitting ? "opacity-50 cursor-not-allowed" : "hover:bg-green-700"}`}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Submit Close Day"}
                          </motion.button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
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
                  className="w-full bg-gray-600 text-white py-3 rounded-xl font-semibold hover:bg-gray-500 transition-all duration-300"
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