"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { CheckCircle, ChevronDown, ChevronUp, X } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isToday,
  startOfDay,
} from "date-fns";

const dstr = (d) => format(startOfDay(d), "yyyy-MM-dd");

function TiltCard({ children, className = "", hover = true }) {
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
}

function RoutineTrackerModal({ show, onClose, routineTasks, monthlyStatuses, daysInMonth, todayMap }) {
  const todayStart = startOfDay(new Date());

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-2xl p-6 w-[98vw] h-[98vh] flex flex-col shadow-2xl border border-teal-100"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-800">Routine Task Tracker</h2>
              <motion.button
                onClick={onClose}
                className="text-gray-600 hover:text-gray-800"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <X size={24} />
              </motion.button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <TiltCard className="rounded-2xl border border-teal-100 bg-teal-50/40 p-4 sm:p-6 shadow-md">
                <table className="w-full text-sm text-gray-600 table-auto border-collapse">
                  <thead className="sticky top-0 bg-teal-50/50 z-10">
                    <tr>
                      <th className="p-2 text-left font-medium sticky left-0 bg-teal-50/50 z-20">
                        Task
                      </th>
                      {daysInMonth.map((day, idx) => {
                        const dayStart = startOfDay(day);
                        return (
                          <th
                            key={dayStart.toISOString()}
                            className={`p-2 text-center font-medium ${
                              isToday(dayStart)
                                ? "bg-teal-50 text-teal-600 font-bold"
                                : "hover:bg-teal-50"
                            } transition-colors`}
                            title={isToday(dayStart) ? "Today" : undefined}
                          >
                            D{idx + 1}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {(routineTasks || []).map((task) => (
                      <tr
                        key={task.id}
                        className="border-b border-teal-100 hover:bg-teal-50 transition-colors"
                      >
                        <td className="p-2 font-semibold sticky left-0 bg-teal-50/40 z-10 text-gray-800">
                          {task.description || "No description"}
                        </td>
                        {daysInMonth.map((day) => {
                          const dayStart = startOfDay(day);
                          const dayStr = dstr(dayStart);
                          const fromMonthly = monthlyStatuses.find(
                            (s) =>
                              s.routineTaskId === task.id &&
                              dstr(new Date(s.date)) === dayStr
                          );
                          const isDone =
                            fromMonthly?.status === "done" ||
                            (isToday(dayStart) && todayMap.get(task.id) === true);
                          return (
                            <td
                              key={`${task.id}-${dayStr}`}
                              className={`p-2 text-center ${
                                isToday(dayStart) ? "bg-teal-50" : ""
                              }`}
                              title="Read-only"
                            >
                              {isDone ? (
                                <CheckCircle className="w-5 h-5 text-teal-600 inline-block" />
                              ) : (
                                <div className="w-5 h-5 border border-teal-200 rounded inline-block" />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TiltCard>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function RoutineTasksStepView({
  userId,
  routineTasks,
  routineLog,
  ISRoutineLog,
  setISRoutineLog,
  handlePrevViewStep,
  handleNextViewStep,
}) {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [monthlyStatuses, setMonthlyStatuses] = useState([]);
  const [error, setError] = useState("");
  const [showTracker, setShowTracker] = useState(false);

  const daysInMonth = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfMonth(selectedMonth),
        end: endOfMonth(selectedMonth),
      }),
    [selectedMonth]
  );

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const qs = new URLSearchParams({
          month: selectedMonth.toISOString(),
          ...(userId ? { memberId: String(userId) } : {}),
        }).toString();

        const res = await fetch(`/api/member/routine-task-monthly-statuses?${qs}`);
        if (!res.ok) throw new Error(`Failed ${res.status}: ${res.statusText}`);
        const { statuses } = await res.json();
        if (isMounted) setMonthlyStatuses(Array.isArray(statuses) ? statuses : []);
      } catch (e) {
        console.error(e);
        setError("Failed to load monthly routine statuses.");
        setTimeout(() => setError(""), 3000);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [selectedMonth, userId]);

  const todayStart = startOfDay(new Date());
  const todayMap = useMemo(() => {
    const m = new Map();
    (routineTasks || []).forEach((t) => m.set(t.id, !!t.done));
    return m;
  }, [routineTasks]);

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-teal-600" />
          <h1 className="text-lg sm:text-xl font-semibold text-gray-800">
            Routine Tasks — {format(todayStart, "EEEE, MMMM d, yyyy")}
          </h1>
        </div>
        <p className="text-sm text-gray-600 bg-teal-50/40 p-3 rounded-xl border border-teal-100 mt-2">
          Review the member’s tracker for this month. Click below to view the tracker.
        </p>
        {error ? <p className="mt-2 text-sm text-gray-600">{error}</p> : null}
      </div>

      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Select Month:
        </label>
        <input
          type="month"
          value={format(selectedMonth, "yyyy-MM")}
          onChange={(e) => setSelectedMonth(new Date(e.target.value))}
          className="border border-teal-200 p-2 rounded-xl w-full text-xs focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200 bg-teal-50/50"
        />
      </div>

      <div className="mb-4">
        <button
          onClick={() => setShowTracker(!showTracker)}
          className="flex items-center gap-2 text-sm font-semibold text-teal-600 hover:text-teal-800 transition-colors"
        >
          {showTracker ? (
            <>
              <ChevronUp size={16} /> Hide Routine Tracker
            </>
          ) : (
            <>
              <ChevronDown size={16} /> Show Routine Tracker
            </>
          )}
        </button>
      </div>

      <RoutineTrackerModal
        show={showTracker}
        onClose={() => setShowTracker(false)}
        routineTasks={routineTasks}
        monthlyStatuses={monthlyStatuses}
        daysInMonth={daysInMonth}
        todayMap={todayMap}
      />

      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-600 mb-1">
          Member’s Routine Log
        </label>
        <div className="border border-teal-100 rounded-xl bg-teal-50/40 p-3 text-sm text-gray-800 whitespace-pre-wrap">
          {routineLog?.trim() ? routineLog : "No log provided"}
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-600 mb-1">
          Supervisor Comment
        </label>
        <textarea
          value={ISRoutineLog}
          onChange={(e) => setISRoutineLog(e.target.value)}
          placeholder="Add your comments on the routine tasks…"
          className="border border-teal-200 p-3 rounded-xl w-full text-sm h-24 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200 bg-teal-50/50 resize-none"
        />
      </div>

      <div className="flex justify-between mt-6 gap-4 sticky bottom-0 bg-white py-4">
        <motion.button
          onClick={handlePrevViewStep}
          className="flex-1 bg-gray-600 text-white py-3 rounded-xl font-semibold hover:bg-gray-500 transition-all duration-300"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Previous
        </motion.button>
        <motion.button
          onClick={handleNextViewStep}
          className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-all duration-300"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Next
        </motion.button>
      </div>
    </div>
  );
}