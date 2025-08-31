// components/RoutineTasksStep.jsx
"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { CheckCircle, X } from "lucide-react";
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
}) {
  const [monthlyStatuses, setMonthlyStatuses] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showRoutineLogModal, setShowRoutineLogModal] = useState(false);
  const [error, setError] = useState("");

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
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-teal-600" />
            <h1 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-gray-200">
              Routine Tasks — {format(todayStart, "EEEE, MMMM d, yyyy")}
            </h1>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 bg-teal-50/50 dark:bg-teal-900/50 p-3 rounded-xl border border-teal-200/50">
            Please tick off what you did in your routine today! Be sincere and honest, following principle #2 of MEED.
          </p>
        </motion.div>

        {/* Controls */}
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

        {/* Table */}
        <TiltCard
          className="flex-1 rounded-2xl border border-teal-100/50 dark:border-teal-900/50 bg-white/80 dark:bg-slate-900/70 backdrop-blur-md p-4 sm:p-6 shadow-md overflow-auto relative"
          hover={true}
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
                // quick status for "today" from the lightweight list prop
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

                      // lock all non-today slots; keep today editable unless DB says isLocked
                      const isLocked =
                        (fromMonthly?.isLocked ?? false) ||
                        dayStr !== dstr(todayStart);

                      // resolve done flag: prefer monthly snapshot; if today lacks it, fall back to today list prop
                      const isDone = (fromMonthly?.status === "done") ||
                        (isCurrentDay && (todayListRow?.status === "done"));

                      return (
                        <motion.td
                          key={`${task.id}-${dayStr}`}
                          className={`p-2 text-center transition-all duration-200 ${
                            isCurrentDay ? "bg-teal-100 dark:bg-teal-900/50" : ""
                          }`}
                          whileHover={{ scale: 1.05 }}
                        >
                          {/* Unified icon-based UI (today + past/future) */}
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

          {/* Add Log Button */}
          <div className="absolute bottom-4 right-4">
            <motion.button
              onClick={() => setShowRoutineLogModal(true)}
              className="bg-teal-600 text-white py-2 px-4 rounded-xl font-semibold hover:bg-teal-700 transition-all duration-300 shadow-sm"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              data-tooltip-id="nav-tooltip"
              data-tooltip-content="Add routine task log"
            >
              Add Routine Task Log
            </motion.button>
          </div>
        </TiltCard>

        {/* Nav */}
        <div className="flex justify-between mt-6 gap-4">
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
            onClick={handleNextStep}
            className="flex-1 bg-teal-600 text-white py-3 rounded-xl font-semibold hover:bg-teal-700 transition-all duration-300 shadow-md"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            data-tooltip-id="nav-tooltip"
            data-tooltip-content="Go to next step"
          >
            Next
          </motion.button>
        </div>

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
