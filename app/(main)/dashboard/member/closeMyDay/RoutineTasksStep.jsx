"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { CheckCircle, X, ClipboardList, FileText, ListChecks, ChevronDown } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isToday,
  startOfDay,
} from "date-fns";
import { Tooltip } from "react-tooltip";

/* ================= Tilt Card ================= */
const TiltCard = ({ children, className = "", hover = true }) => {
  const ref = useRef(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const tRx = useTransform(rx, [-20, 20], [-8, 8]);
  const tRy = useTransform(ry, [-20, 20], [8, -8]);

  const onMove = (e) => {
    if (!hover || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const px = (x / r.width) * 40 - 20;
    const py = (y / r.height) * 40 - 20;
    rx.set(py);
    ry.set(px);
  };
  const onLeave = () => {
    rx.set(0);
    ry.set(0);
  };

  return (
    <motion.div
      ref={ref}
      style={{ rotateX: tRx, rotateY: tRy }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/* ================ Helpers ================ */
const dstr = (d) => format(startOfDay(d), "yyyy-MM-dd");

/**
 * Optimistically update or insert a monthly status entry for a given (taskId, dateStr).
 * shape: { routineTaskId, date, status, isLocked }
 */
function upsertMonthlyStatus(setter, taskId, dateStr, nextStatus) {
  setter((prev) => {
    const list = Array.isArray(prev) ? [...prev] : [];
    const idx = list.findIndex(
      (s) =>
        s.routineTaskId === taskId &&
        format(startOfDay(new Date(s.date)), "yyyy-MM-dd") === dateStr
    );
    const base = {
      routineTaskId: taskId,
      date: new Date(dateStr).toISOString(),
      isLocked: false,
      comment: null,
      updatedAt: new Date().toISOString(),
    };
    if (idx === -1) {
      list.push({ ...base, status: nextStatus });
    } else {
      list[idx] = { ...list[idx], status: nextStatus, updatedAt: new Date().toISOString() };
    }
    return list;
  });
}

export default function RoutineTasksStep({
  routineTasksData,
  routineTasksStatuses,
  handleUpdateRoutineStatus, // (taskId, status, "yyyy-MM-dd")
  routineLog,
  setRoutineLog,
  handlePrevStep,
  handleNextStep,
  routineLogRequired = false,
  showNavigation = true,
  isTeamManager = false,
  assignedTasksData,
  managerRoutineReport,
  onManagerReportChange,
}) {
  const [monthlyStatuses, setMonthlyStatuses] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showRoutineLogModal, setShowRoutineLogModal] = useState(false);
  const [error, setError] = useState("");
  const routineLogMissing = routineLogRequired && !String(routineLog || "").trim();

  const todayStart = startOfDay(new Date());

  useEffect(() => {
    const fetchMonthlyStatuses = async () => {
      try {
        const res = await fetch(
          `/api/member/routine-task-monthly-statuses?month=${selectedMonth.toISOString()}`
        );
        if (!res.ok) throw new Error(`Failed to fetch monthly statuses: ${res.statusText}`);
        const { statuses } = await res.json();
        setMonthlyStatuses(statuses || []);
      } catch (err) {
        console.error("Error fetching monthly statuses:", err);
        setError("Failed to load routine tasks. Please try again.");
        setTimeout(() => setError(""), 3000);
      }
    };
    fetchMonthlyStatuses();
  }, [selectedMonth]);

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(selectedMonth),
    end: endOfMonth(selectedMonth),
  });

  const handleToggleToday = async (taskId, clickedDay, nextDone) => {
    const dateStr = dstr(clickedDay);
    // optimistic UI
    upsertMonthlyStatus(setMonthlyStatuses, taskId, dateStr, nextDone ? "done" : "not_done");

    try {
      await handleUpdateRoutineStatus(taskId, nextDone ? "done" : "not_done", dateStr);
    } catch (err) {
      // revert if API failed
      upsertMonthlyStatus(setMonthlyStatuses, taskId, dateStr, nextDone ? "not_done" : "done");
      console.error("Error updating routine status:", err);
      setError("Failed to update task status. Please try again.");
      setTimeout(() => setError(""), 3000);
    }
  };
  const [showRoutineTracker, setShowRoutineTracker] = useState(false);

  const assignedTasks = isTeamManager ? assignedTasksData?.tasks ?? [] : [];
  const hasAssignedTasks = assignedTasks.length > 0;
  const hasRoutineTasks = (routineTasksData?.tasks?.length ?? 0) > 0;

  const reportEntries = useMemo(
    () => (isTeamManager ? managerRoutineReport ?? {} : {}),
    [isTeamManager, managerRoutineReport]
  );

  const getEntry = (taskId) => {
    if (!isTeamManager) {
      return { mode: "log", assignedTaskId: null, log: "" };
    }
    return (
      reportEntries[taskId] ?? {
        mode: hasAssignedTasks ? "assigned" : "log",
        assignedTaskId: null,
        log: "",
      }
    );
  };

  const updateManagerReport = (taskId, updates) => {
    if (!isTeamManager || typeof onManagerReportChange !== "function") return;
    onManagerReportChange(taskId, updates);
  };

  const handleModeSelect = (taskId, mode) => {
    if (!isTeamManager) return;
    if (mode === "assigned" && !hasAssignedTasks) return;
    const current = getEntry(taskId);
    if (mode === "assigned") {
      updateManagerReport(taskId, {
        mode: "assigned",
        assignedTaskId: current.assignedTaskId ?? null,
        log: "",
      });
    } else {
      updateManagerReport(taskId, {
        mode: "log",
        assignedTaskId: null,
        log: current.log ?? "",
      });
    }
  };

  const handleAssignedTaskSelect = (taskId, value) => {
    if (!isTeamManager) return;
    const parsed = value ? Number(value) : null;
    updateManagerReport(taskId, {
      mode: "assigned",
      assignedTaskId: parsed,
    });
  };

  const handleLogChange = (taskId, value) => {
    if (!isTeamManager) return;
    updateManagerReport(taskId, {
      mode: "log",
      assignedTaskId: null,
      log: value,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed inset-0 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-slate-900 dark:to-slate-950 p-4 sm:p-6 flex flex-col overflow-hidden"
    >
      <div className="w-full h-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl shadow-md p-4 sm:p-6 flex flex-col relative overflow-y-auto border border-teal-100/50">
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35 }}
              className="absolute top-6 left-6 right-6 text-red-700 dark:text-red-300 text-sm sm:text-base font-semibold bg-red-100/80 dark:bg-red-900/70 p-4 rounded-2xl shadow-lg border border-red-200/40 dark:border-red-600/40 backdrop-blur-md z-[60]"
              onClick={() => setError("")}
            >
              {error} (Click to dismiss)
            </motion.p>
          )}
        </AnimatePresence>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-4 sm:mb-6"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-teal-600" />
              <h1 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-gray-200">
                Routine Tasks — {format(todayStart, "EEEE, MMMM d, yyyy")}
              </h1>
            </div>
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowRoutineTracker((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-white px-4 py-2 text-sm font-semibold text-teal-700 shadow-sm hover:bg-teal-50"
              aria-expanded={showRoutineTracker}
            >
              <ListChecks className="h-4 w-4" />
              Routine Tracker
              <motion.span
                animate={{ rotate: showRoutineTracker ? 0 : -90 }}
                transition={{ duration: 0.2 }}
                className="inline-flex"
              >
                <ChevronDown className="h-4 w-4" />
              </motion.span>
            </motion.button>
          </div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 bg-teal-50/50 dark:bg-teal-900/50 p-3 rounded-xl border border-teal-200/50">
            Please tick off what you did in your routine today! Be sincere and honest, following principle #2 of MEED.
          </p>
          <motion.button
            onClick={() => setShowRoutineLogModal(true)}
            className="mt-3 bg-teal-600 text-white py-2 px-4 rounded-xl font-semibold hover:bg-teal-700 transition-all duration-300 shadow-sm"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            data-tooltip-id="nav-tooltip"
            data-tooltip-content="Add routine task log"
          >
            Add Routine Task Log
          </motion.button>
          {routineLogRequired && (
            <p className={`mt-2 text-xs ${routineLogMissing ? "text-rose-600" : "text-teal-600"}`}>
              {routineLogMissing ? "Routine Task Log is required before you continue." : "Routine Task Log completed."}
            </p>
          )}
        </motion.div>

        <div className="space-y-6">
          <AnimatePresence initial={false}>
            {showRoutineTracker && (
              <motion.section
                key="routine-tracker"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="rounded-2xl border border-teal-100 bg-white/80 p-4 sm:p-6 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-4">
                  <ListChecks className="h-5 w-5 text-teal-600" />
                  <h2 className="text-lg font-semibold text-gray-800">
                    Routine Task Tracker{isTeamManager ? " (Optional)" : ""}
                  </h2>
                </div>
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Select Month:
                  </label>
                  <motion.input
                    type="month"
                    value={format(selectedMonth, "yyyy-MM")}
                    onChange={(e) => setSelectedMonth(new Date(e.target.value))}
                    className="border border-teal-200 p-2 rounded-xl w-full text-xs focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200 bg-teal-50/50"
                    whileHover={{ scale: 1.02 }}
                    whileFocus={{ scale: 1.02 }}
                  />
                </div>
                <TiltCard
                  className="rounded-2xl border border-teal-100/50 dark:border-teal-900/50 bg-white/80 dark:bg-slate-900/70 backdrop-blur-md p-4 sm:p-6 shadow-md overflow-auto"
                  hover={false}
                >
              <table className="w-full text-sm text-gray-700 dark:text-gray-200 table-auto border-collapse">
                <thead className="sticky top-0 bg-teal-50/50 dark:bg-teal-900/50 z-10">
                  <tr>
                    <th className="p-2 text-left font-medium sticky left-0 bg-teal-50/50 dark:bg-teal-900/50 z-20">
                      Task
                    </th>
                    {daysInMonth.map((day, index) => {
                      const dayStart = startOfDay(day);
                      return (
                        <motion.th
                          key={dayStart.toISOString()}
                          className={`p-2 text-center font-medium transition-all duration-200 hover:bg-teal-100/50 dark:hover:bg-teal-800/50 ${
                            isToday(dayStart)
                              ? "bg-teal-200 dark:bg-teal-700/50 text-teal-800 dark:text-teal-200 font-bold"
                              : ""
                          }`}
                          data-tooltip-id="day-tooltip"
                          data-tooltip-content={!isToday(dayStart) ? "You can only edit tasks for today" : ""}
                          whileHover={{ scale: 1.05 }}
                        >
                          D{index + 1}
                        </motion.th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody>
                  {(routineTasksData?.tasks || []).map((task) => {
                    const todayListRow = routineTasksStatuses.find((s) => s.id === task.id);

                    return (
                      <motion.tr
                        key={task.id}
                        className="border-b border-teal-100/50 dark:border-teal-900/50 hover:bg-teal-50/50 dark:hover:bg-teal-900/50 transition-all duration-200"
                        whileHover={{ scale: 1.01 }}
                      >
                        <td className="p-2 font-semibold sticky left-0 bg-white/80 dark:bg-slate-900/80 z-10">
                          {task.description}
                        </td>

                        {daysInMonth.map((day) => {
                          const dayStart = startOfDay(day);
                          const dayStr = dstr(dayStart);
                          const isCurrentDay = isToday(dayStart);

                          const fromMonthly = monthlyStatuses.find(
                            (s) =>
                              s.routineTaskId === task.id &&
                              format(startOfDay(new Date(s.date)), "yyyy-MM-dd") === dayStr
                          );

                          const isLocked =
                            (fromMonthly?.isLocked ?? false) ||
                            dayStr !== dstr(todayStart);

                          const isDone =
                            (fromMonthly?.status === "done") ||
                            (isCurrentDay && todayListRow?.status === "done");

                          return (
                            <motion.td
                              key={`${task.id}-${dayStr}`}
                              className={`p-2 text-center transition-all duration-200 ${
                                isCurrentDay ? "bg-teal-100 dark:bg-teal-900/50" : ""
                              }`}
                              whileHover={{ scale: 1.05 }}
                            >
                              {isDone ? (
                                <CheckCircle
                                  className={`w-5 h-5 text-teal-600 dark:text-teal-400 mx-auto ${
                                    isCurrentDay && !isLocked ? "cursor-pointer" : "cursor-default opacity-90"
                                  }`}
                                  onClick={
                                    isCurrentDay && !isLocked
                                      ? (e) => {
                                          e.stopPropagation();
                                          handleToggleToday(task.id, dayStart, false);
                                        }
                                      : undefined
                                  }
                                  data-tooltip-id="day-tooltip"
                                  data-tooltip-content={
                                    isCurrentDay && !isLocked ? "Mark as not done" : isCurrentDay ? "Locked" : ""
                                  }
                                />
                              ) : (
                                <div
                                  className={`w-5 h-5 border border-gray-300 dark:border-gray-600 rounded mx-auto ${
                                    isCurrentDay && !isLocked ? "cursor-pointer hover:shadow-sm" : "cursor-default"
                                  }`}
                                  onClick={
                                    isCurrentDay && !isLocked
                                      ? (e) => {
                                          e.stopPropagation();
                                          handleToggleToday(task.id, dayStart, true);
                                        }
                                      : undefined
                                  }
                                  data-tooltip-id="day-tooltip"
                                  data-tooltip-content={
                                    isCurrentDay && !isLocked ? "Mark as done" : isCurrentDay ? "Locked" : ""
                                  }
                                />
                              )}
                            </motion.td>
                          );
                        })}
                      </motion.tr>
                  );
                })}
              </tbody>
            </table>
              </TiltCard>
            </motion.section>
          )}
        </AnimatePresence>

          {isTeamManager && (
          <section className="rounded-2xl border border-indigo-100 bg-white/80 p-4 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-indigo-600" />
              <h4 className="text-lg font-semibold text-gray-800">Managerial Report (Compulsory)</h4>
            </div>
            <p className="text-sm text-gray-600">
              For each routine, either reference the assigned task that covered it or jot a quick note describing what happened.
            </p>

            {hasRoutineTasks ? (
              <div className="space-y-4">
                {(routineTasksData?.tasks || []).map((task) => {
                  const entry = getEntry(task.id);
                  const selectedAssigned = assignedTasks.find((item) => item.id === entry.assignedTaskId);

                  return (
                    <div key={task.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="flex-1">
                          <h5 className="text-base font-semibold text-gray-800">
                            {task.description || `Routine Task #${task.id}`}
                          </h5>
                          <p className="text-xs text-gray-500 mt-1">Routine ID: {task.id}</p>
                        </div>
                        <div className="flex gap-2">
                          <motion.button
                            type="button"
                            whileHover={{ scale: entry.mode === "assigned" || !hasAssignedTasks ? 1 : 1.03 }}
                            whileTap={{ scale: entry.mode === "assigned" || !hasAssignedTasks ? 1 : 0.97 }}
                            disabled={!hasAssignedTasks}
                            onClick={() => handleModeSelect(task.id, "assigned")}
                            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                              entry.mode === "assigned"
                                ? "border-teal-500 bg-teal-50 text-teal-700"
                                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                            } ${!hasAssignedTasks ? "cursor-not-allowed opacity-50" : ""}`}
                          >
                            <ClipboardList className="h-4 w-4" />
                            Assigned Task
                          </motion.button>
                          <motion.button
                            type="button"
                            whileHover={{ scale: entry.mode === "log" ? 1 : 1.03 }}
                            whileTap={{ scale: entry.mode === "log" ? 1 : 0.97 }}
                            onClick={() => handleModeSelect(task.id, "log")}
                            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                              entry.mode === "log"
                                ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            <FileText className="h-4 w-4" />
                            Log Note
                          </motion.button>
                        </div>
                      </div>

                      {entry.mode === "assigned" ? (
                        <div className="mt-4 space-y-3">
                          <label className="text-sm font-medium text-gray-700">
                            Link the verifying assigned task
                          </label>
                          <select
                            value={entry.assignedTaskId ?? ""}
                            onChange={(event) => handleAssignedTaskSelect(task.id, event.target.value)}
                            className="w-full rounded-xl border border-teal-200 bg-teal-50/60 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-200"
                          >
                            <option value="">
                              {hasAssignedTasks ? "Select an assigned task" : "No assigned tasks available"}
                            </option>
                            {assignedTasks.map((assigned) => (
                              <option key={assigned.id} value={assigned.id}>
                                {assigned.title || assigned.description || `Task #${assigned.id}`}
                              </option>
                            ))}
                          </select>
                          {selectedAssigned && (
                            <div className="rounded-xl border border-teal-100 bg-teal-50/70 p-3 text-sm text-teal-800">
                              <p className="font-semibold">
                                {selectedAssigned.title || selectedAssigned.description || `Task #${selectedAssigned.id}`}
                              </p>
                              {selectedAssigned.deadline && (
                                <p className="text-xs text-teal-700">
                                  Deadline: {new Date(selectedAssigned.deadline).toLocaleDateString()}
                                </p>
                              )}
                              <p className="text-xs uppercase tracking-wide text-teal-600">
                                Status: {selectedAssigned.status?.replace(/_/g, " ") || "Unknown"}
                              </p>
                            </div>
                          )}
                          {!hasAssignedTasks && (
                            <p className="text-xs text-amber-600">
                              No assigned tasks found for today. Switch to a log note instead.
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="mt-4">
                          <label className="text-sm font-medium text-gray-700">
                            Quick note for the day
                          </label>
                          <textarea
                            value={entry.log ?? ""}
                            onChange={(event) => handleLogChange(task.id, event.target.value)}
                            placeholder="Example: Conducted evening roll call manually since the app was offline."
                            className="mt-1 w-full rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 text-sm text-gray-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            rows={3}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
                No routine tasks assigned for you today.
              </p>
            )}
          </section>
        )}
        </div>

        {showNavigation && (
          <div className="mt-6 flex justify-between gap-4">
            <motion.button
              onClick={handlePrevStep}
              className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-all duration-300 shadow-sm"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              data-tooltip-id="nav-tooltip"
              data-tooltip-content="Go to previous step"
            >
              Previous
            </motion.button>
            <motion.button
              onClick={() => {
                if (routineLogMissing) {
                  setError("Routine Task Log is required before continuing.");
                  setShowRoutineLogModal(true);
                  return;
                }
                handleNextStep();
              }}
              className="flex-1 bg-teal-600 text-white py-3 rounded-xl font-semibold hover:bg-teal-700 transition-all duration-300 shadow-md disabled:opacity-60"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              data-tooltip-id="nav-tooltip"
              data-tooltip-content="Go to next step"
              disabled={routineLogMissing}
            >
              Next
            </motion.button>
          </div>
        )}

        <Tooltip id="day-tooltip" />
        <Tooltip id="nav-tooltip" />

        {/* Log Modal */}
        <AnimatePresence>
          {showRoutineLogModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 z-[100]"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white/80 dark:bg-slate-800/80 rounded-2xl shadow-2xl p-6 w-full max-w-2xl max-h-[80vh] border border-teal-300 relative overflow-y-auto"
              >
                <motion.button
                  onClick={() => setShowRoutineLogModal(false)}
                  className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-xl font-bold"
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </motion.button>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                  <CheckCircle size={18} className="text-teal-600" />
                  Routine Task Log
                </h3>
                <textarea
                  value={routineLog}
                  onChange={(e) => setRoutineLog(e.target.value)}
                  className="border border-teal-200 p-2 rounded-xl w-full text-xs h-40 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200 bg-teal-50/50 resize-none"
                  placeholder="Add your routine task log comments"
                />
                <div className="flex justify-end mt-4">
                  <motion.button
                    onClick={() => setShowRoutineLogModal(false)}
                    className="bg-teal-600 text-white py-2 px-4 rounded-xl font-semibold hover:bg-teal-700 transition-all duration-300 shadow-sm"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Close
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
