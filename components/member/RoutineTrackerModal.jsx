"use client";
import { useEffect, useMemo, useState } from "react";
import { startOfMonth, endOfMonth, eachDayOfInterval, startOfDay, format, isToday } from "date-fns";

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
    <div className="fixed inset-0 z-[10050] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-[96vw] max-w-5xl max-h-[88vh] bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Routine Tracker (Read‑only)</h3>
          <button onClick={onClose} className="px-2 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm">Close</button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Select Month</label>
            <input
              type="month"
              value={format(selectedMonth, "yyyy-MM")}
              onChange={(e) => setSelectedMonth(new Date(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          {error ? (
            <div className="text-sm text-red-600">{error}</div>
          ) : loading ? (
            <div className="text-sm text-gray-600">Loading…</div>
          ) : (
            <div className="overflow-auto border rounded-xl">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-gray-50">
                  <tr>
                    <th className="p-2 text-left font-medium sticky left-0 bg-gray-50 z-10">Task</th>
                    {daysInMonth.map((d, idx) => (
                      <th key={idx} className={`p-2 text-center font-medium ${isToday(d) ? "bg-teal-100" : ""}`}>D{idx + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr key={t.id} className="border-t">
                      <td className="p-2 font-medium sticky left-0 bg-white z-10">{t.description}</td>
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
          )}
        </div>
      </div>
    </div>
  );
}
