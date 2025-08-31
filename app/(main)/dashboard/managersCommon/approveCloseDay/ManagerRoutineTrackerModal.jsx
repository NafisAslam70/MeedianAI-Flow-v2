"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfDay,
  isToday,
} from "date-fns";

const dstr = (d) => format(startOfDay(d), "yyyy-MM-dd");

export default function ManagerRoutineTrackerModal({
  open,
  onClose,
  userId,               // REQUIRED: member whose tracker you’re viewing
  todaySnapshot = [],   // [{id, description, done}] from the day-close request
}) {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [tasksFromAPI, setTasksFromAPI] = useState([]);
  const [monthlyStatuses, setMonthlyStatuses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const daysInMonth = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfMonth(selectedMonth),
        end: endOfMonth(selectedMonth),
      }),
    [selectedMonth]
  );

  const todayMap = useMemo(() => {
    const m = new Map();
    (todaySnapshot || []).forEach((t) => m.set(Number(t.id), !!t.done));
    return m;
  }, [todaySnapshot]);

  const tasksToShow = useMemo(() => {
    const map = new Map();
    (tasksFromAPI || []).forEach((t) =>
      map.set(Number(t.id), { id: Number(t.id), description: t.description || "No description" })
    );
    (todaySnapshot || []).forEach((t) => {
      const id = Number(t.id);
      if (!map.has(id)) map.set(id, { id, description: t.description || "No description" });
    });
    return Array.from(map.values());
  }, [tasksFromAPI, todaySnapshot]);

  const fetchMonth = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const qs = new URLSearchParams({
        month: new Date(selectedMonth).toISOString(),
        memberId: String(userId),
      }).toString();
      const res = await fetch(`/api/member/routine-task-monthly-statuses?${qs}`);
      if (!res.ok) throw new Error(`Failed ${res.status}: ${res.statusText}`);
      const data = await res.json();
      setMonthlyStatuses(Array.isArray(data.statuses) ? data.statuses : []);
      setTasksFromAPI(Array.isArray(data.tasks) ? data.tasks : []);
      setError("");
    } catch (e) {
      console.error(e);
      setError("Failed to load monthly routine statuses.");
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, userId]);

  useEffect(() => {
    if (open) fetchMonth();
  }, [open, fetchMonth]);

  // close on ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1200] bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 p-4 sm:p-6 flex items-center justify-center"
        >
          {/* Inner full-height card */}
          <div className="w-full h-full bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl border border-teal-100/60 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-teal-100 bg-white/90">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Routine Tracker</h2>
                <p className="text-sm text-gray-600">Read-only monthly view</p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition"
                aria-label="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Controls */}
            <div className="px-6 pt-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">Select Month</label>
              <input
                type="month"
                value={format(selectedMonth, "yyyy-MM")}
                onChange={(e) => setSelectedMonth(new Date(e.target.value))}
                className="border border-teal-200 p-2 rounded-xl w-full max-w-sm text-xs focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-teal-50/50"
              />
              {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
            </div>

            {/* Content (scrollable) */}
            <div className="flex-1 overflow-auto p-6">
              <div className="min-w-full">
                <table className="w-full text-sm text-gray-700 table-auto border-collapse">
                  <thead className="sticky top-0 bg-teal-50/70 z-10">
                    <tr>
                      <th className="p-2 text-left font-medium sticky left-0 bg-teal-50/70 z-20">Task</th>
                      {daysInMonth.map((day, idx) => {
                        const ds = startOfDay(day);
                        const today = isToday(ds);
                        return (
                          <th
                            key={ds.toISOString()}
                            className={`p-2 text-center font-medium ${
                              today ? "bg-teal-200 text-teal-800 font-bold" : ""
                            }`}
                            title={today ? "Today" : undefined}
                          >
                            D{idx + 1}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={daysInMonth.length + 1} className="p-6 text-center text-gray-500">
                          Loading…
                        </td>
                      </tr>
                    ) : tasksToShow.length === 0 ? (
                      <tr>
                        <td colSpan={daysInMonth.length + 1} className="p-6 text-center text-gray-500">
                          No routine tasks.
                        </td>
                      </tr>
                    ) : (
                      tasksToShow.map((task) => (
                        <tr
                          key={task.id}
                          className="border-b border-teal-100 hover:bg-teal-50/40 transition-colors"
                        >
                          <td className="p-2 font-semibold sticky left-0 bg-white z-10">
                            {task.description}
                          </td>
                          {daysInMonth.map((day) => {
                            const dayStart = startOfDay(day);
                            const dayStr = dstr(dayStart);
                            const fromMonthly = monthlyStatuses.find(
                              (s) =>
                                Number(s.routineTaskId) === Number(task.id) &&
                                dstr(new Date(s.date)) === dayStr
                            );
                            const done =
                              fromMonthly?.status === "done" ||
                              (isToday(dayStart) && todayMap.get(Number(task.id)) === true);

                            return (
                              <td
                                key={`${task.id}-${dayStr}`}
                                className={`p-2 text-center ${
                                  isToday(dayStart) ? "bg-teal-100" : ""
                                }`}
                                title="Read-only"
                              >
                                {done ? (
                                  <CheckCircle className="w-5 h-5 text-teal-600 inline-block" />
                                ) : (
                                  <div className="w-5 h-5 border border-gray-300 rounded inline-block" />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-teal-100 bg-white/90">
              <button
                onClick={onClose}
                className="w-full bg-teal-600 text-white py-3 rounded-xl font-semibold hover:bg-teal-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
