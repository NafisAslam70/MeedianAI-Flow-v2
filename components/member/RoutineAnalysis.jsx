"use client";
import { useEffect, useMemo, useState } from "react";
import { startOfMonth, endOfMonth, eachDayOfInterval, startOfDay, format } from "date-fns";

export default function RoutineAnalysis() {
  const [month, setMonth] = useState(() => new Date());
  const [tasks, setTasks] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const days = useMemo(() => eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) }), [month]);

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`/api/member/routine-task-monthly-statuses?month=${month.toISOString()}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        if (aborted) return;
        setTasks(Array.isArray(data.tasks) ? data.tasks : []);
        setStatuses(Array.isArray(data.statuses) ? data.statuses : []);
      } catch (e) {
        if (!aborted) setError(e.message || "Failed to load routine analysis");
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => { aborted = true; };
  }, [month]);

  // Map dateStr -> aggregated counts
  const byDate = useMemo(() => {
    const m = new Map();
    statuses.forEach((s) => {
      const d = format(startOfDay(new Date(s.date)), "yyyy-MM-dd");
      const cur = m.get(d) || { done: 0, verified: 0, in_progress: 0, not_done: 0 };
      cur[s.status] = (cur[s.status] || 0) + 1;
      m.set(d, cur);
    });
    return m;
  }, [statuses]);

  // Month totals
  const totals = useMemo(() => {
    const t = { done: 0, verified: 0, in_progress: 0, not_done: 0 };
    statuses.forEach((s) => (t[s.status] = (t[s.status] || 0) + 1));
    return t;
  }, [statuses]);

  // Week breakdown (week index within month 1..5)
  const weeks = useMemo(() => {
    const w = [0, 1, 2, 3, 4, 5].map(() => ({ done: 0, verified: 0, in_progress: 0, not_done: 0 }));
    statuses.forEach((s) => {
      const d = new Date(s.date);
      const day = d.getDate();
      const idx = Math.min(5, Math.floor((day - 1) / 7));
      w[idx][s.status] += 1;
    });
    return w;
  }, [statuses]);

  const totalEntries = statuses.length || 1;
  const pct = (n) => Math.round((100 * n) / totalEntries);

  return (
    <div className="rounded-3xl border border-teal-200 bg-white p-4 sm:p-6 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[1.05rem] sm:text-lg font-bold text-gray-800">Routine Analysis</h2>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600">Month</label>
          <input
            type="month"
            value={format(month, "yyyy-MM")}
            onChange={(e) => setMonth(new Date(e.target.value))}
            className="px-3 py-2 rounded-xl text-xs sm:text-sm bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      {error ? (
        <div className="text-sm text-red-600">{error}</div>
      ) : loading ? (
        <div className="text-sm text-gray-600">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Totals */}
          <div className="rounded-2xl border border-gray-200 p-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Badge label="Done" color="bg-emerald-100 text-emerald-700" value={`${totals.done} (${pct(totals.done)}%)`} />
              <Badge label="Verified" color="bg-blue-100 text-blue-700" value={`${totals.verified} (${pct(totals.verified)}%)`} />
              <Badge label="Progress" color="bg-amber-100 text-amber-700" value={`${totals.in_progress} (${pct(totals.in_progress)}%)`} />
              <Badge label="Not done" color="bg-gray-100 text-gray-700" value={`${totals.not_done} (${pct(totals.not_done)}%)`} />
            </div>
          </div>

          {/* Week bars */}
          <div className="rounded-2xl border border-gray-200 p-3">
            <div className="text-sm font-semibold text-gray-800 mb-2">Weekly Breakdown</div>
            <div className="space-y-2">
              {weeks.map((w, i) => {
                const total = w.done + w.verified + w.in_progress + w.not_done || 1;
                const seg = (n, cls) => (
                  <div className={`${cls}`} style={{ width: `${(100 * n) / total}%` }} />
                );
                return (
                  <div key={i} className="flex items-center gap-2">
                    <div className="text-xs w-10 text-gray-600">W{i + 1}</div>
                    <div className="flex h-3 w-full rounded-full overflow-hidden bg-gray-200">
                      {seg(w.done, "bg-emerald-500")} {seg(w.verified, "bg-blue-500")} {seg(w.in_progress, "bg-amber-400")} {seg(w.not_done, "bg-gray-400")}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 text-[11px] text-gray-500">Legend: Done · Verified · In progress · Not done</div>
          </div>

          {/* Heatmap (day done rate) */}
          <div className="lg:col-span-2 rounded-2xl border border-gray-200 p-3">
            <div className="text-sm font-semibold text-gray-800 mb-2">Day-wise Done Rate</div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((d, idx) => {
                const key = format(startOfDay(d), "yyyy-MM-dd");
                const agg = byDate.get(key) || { done: 0, verified: 0, in_progress: 0, not_done: 0 };
                const total = agg.done + agg.verified + agg.in_progress + agg.not_done || 1;
                const score = (agg.done + agg.verified) / total; // completion rate
                const bg = score > 0.8 ? "bg-emerald-500" : score > 0.5 ? "bg-emerald-400" : score > 0.2 ? "bg-emerald-300" : total > 0 ? "bg-gray-300" : "bg-gray-200";
                return (
                  <div key={idx} className="aspect-square rounded-md flex items-center justify-center text-[10px] text-gray-700 bg-gray-100">
                    <div className={`h-full w-full rounded-md ${bg}`} title={`${format(d, "d MMM")}: ${Math.round(score * 100)}%`} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Badge({ label, value, color }) {
  return (
    <div className={`rounded-xl px-3 py-2 text-center ${color}`}>
      <div className="text-[11px] font-semibold">{label}</div>
      <div className="text-sm font-bold">{value}</div>
    </div>
  );
}

