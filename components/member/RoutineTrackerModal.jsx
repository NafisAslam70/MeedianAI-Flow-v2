"use client";
import { useEffect, useMemo, useState } from "react";
import { startOfMonth, endOfMonth, eachDayOfInterval, startOfDay, format, isToday } from "date-fns";
import { X } from "lucide-react";

export default function RoutineTrackerModal({ open, onClose }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [tasks, setTasks] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const daysInMonth = useMemo(() => eachDayOfInterval({ start: startOfMonth(selectedMonth), end: endOfMonth(selectedMonth) }), [selectedMonth]);

  useEffect(() => {
    if (!open) return;
    let aborted = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`/api/member/routine-task-monthly-statuses?month=${selectedMonth.toISOString()}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        if (aborted) return;
        setTasks(data.tasks || []);
        setStatuses(data.statuses || []);
      } catch (e) {
        if (!aborted) setError(e.message || "Failed to load routine tracker");
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => { aborted = true; };
  }, [open, selectedMonth]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[10050] bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 p-2 sm:p-4 flex items-center justify-center">
      {/* Inner full-viewport card (maximize width so monthly grid fits) */}
      <div className="w-[98vw] h-[92vh] max-w-none bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl border border-teal-100/60 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-teal-100 bg-white/90">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Routine Tracker</h2>
            <p className="text-xs text-gray-600">Read-only monthly view</p>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-800 p-2 rounded-full hover:bg-gray-100 transition" aria-label="Close">
            <X className="w-4 h-4" />
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          <div className="min-w-full">
            <table className="w-full text-sm text-gray-700 table-auto border-collapse">
              <thead className="sticky top-0 bg-teal-50/70 z-10">
                <tr>
                  <th className="p-2 text-left font-medium sticky left-0 bg-teal-50/70 z-20">Task</th>
                  {daysInMonth.map((day, idx) => (
                    <th key={idx} className={`p-1.5 text-center font-medium ${isToday(day) ? "bg-teal-200 text-teal-800 font-bold" : ""}`}>D{idx + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id} className="border-b border-teal-100 hover:bg-teal-50/40 transition-colors">
                    <td className="p-2 font-semibold sticky left-0 bg-white z-10">{t.description}</td>
                    {daysInMonth.map((d, idx) => {
                      const dayStr = format(startOfDay(d), "yyyy-MM-dd");
                      const row = statuses.find((s) => s.routineTaskId === t.id && format(startOfDay(new Date(s.date)), "yyyy-MM-dd") === dayStr);
                      const st = row?.status || "not_done";
                      const color = st === "done" ? "bg-green-500" : st === "verified" ? "bg-blue-500" : st === "in_progress" ? "bg-yellow-500" : "bg-gray-300";
                      return (
                        <td key={idx} className="p-1 text-center">
                          <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} title={st} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-teal-100 bg-white/90">
          <button onClick={onClose} className="w-full bg-teal-600 text-white py-3 rounded-xl font-semibold hover:bg-teal-700 transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
