// app/(main)/member/myPerformance/page.jsx
"use client";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Calendar,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Flame,
  CheckSquare,
} from "lucide-react";
import {
  format,
  differenceInCalendarDays,
  startOfMonth,
  endOfMonth,
  max as dateMax,
  min as dateMin,
} from "date-fns";

/* ----------------- helpers ----------------- */
const clamp0 = (n) => Math.max(0, Number.isFinite(n) ? n : 0);
const plural = (n, unit) => `${n} ${unit}${n === 1 ? "" : "s"}`;

const deriveTaskStatus = (sprints) => {
  if (!sprints || sprints.length === 0) return "not_started";
  const statuses = sprints.map((s) => s.status);
  const allVerified = statuses.every((s) => s === "verified");
  const allDone = statuses.every((s) => s === "done");
  const allCompleted = statuses.every((s) => ["done", "verified"].includes(s));
  const someInProgress = statuses.some((s) => s === "in_progress");
  if (allVerified) return "verified";
  if (allDone) return "done";
  if (allCompleted) return "pending_verification";
  if (someInProgress) return "in_progress";
  return "not_started";
};

const summariseTasks = (tasks) =>
  tasks.reduce(
    (a, t) => ({
      total: a.total + 1,
      notStarted: a.notStarted + (t.status === "not_started"),
      inProgress: a.inProgress + (t.status === "in_progress"),
      pendingVerification:
        a.pendingVerification + (t.status === "pending_verification"),
      completed: a.completed + (t.status === "verified" || t.status === "done"),
    }),
    {
      total: 0,
      notStarted: 0,
      inProgress: 0,
      pendingVerification: 0,
      completed: 0,
    }
  );

/* overlap days (inclusive) between [aStart,aEnd] and [bStart,bEnd] */
const overlapDaysInclusive = (aStart, aEnd, bStart, bEnd) => {
  const start = dateMax([aStart, bStart]);
  const end = dateMin([aEnd, bEnd]);
  if (start > end) return 0;
  return differenceInCalendarDays(end, start) + 1;
};

export default function MyPerformance() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;

  const [activeSection, setActiveSection] = useState(null); // "leave" | "dayclose" | null
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // assigned tasks (summary only)
  const [assignedSummary, setAssignedSummary] = useState({
    total: 0,
    notStarted: 0,
    inProgress: 0,
    pendingVerification: 0,
    completed: 0,
  });
  const [yesterdaySummary, setYesterdaySummary] = useState(null);
  const [isLoadingAssignedSummary, setIsLoadingAssignedSummary] = useState(true);

  // leave (detail filters)
  const [leaveHistory, setLeaveHistory] = useState([]);
  const [leaveDateFrom, setLeaveDateFrom] = useState("");
  const [leaveDateTo, setLeaveDateTo] = useState("");

  // day close
  const [dayCloseHistory, setDayCloseHistory] = useState([]);
  const [dcDate, setDcDate] = useState("");
  const [streakDays, setStreakDays] = useState(0);

  // leave stats (shown inside the Leave card)
  const [leaveStats, setLeaveStats] = useState({
    totalDays: 0,
    monthDays: 0,
    loading: true,
  });

  /* ------------------ fetchers ------------------ */
  const fetchLeave = async () => {
    const res = await fetch("/api/member/leave-request", {
      credentials: "include",
    });
    if (!res.ok) throw new Error(`Leave history failed: ${res.statusText}`);
    const data = await res.json();
    setLeaveHistory(Array.isArray(data?.requests) ? data.requests : []);
  };

  const fetchLeaveStats = async () => {
    try {
      setLeaveStats((s) => ({ ...s, loading: true }));
      const res = await fetch("/api/member/leave-request", {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Leave stats failed: ${res.statusText}`);
      const data = await res.json();
      const rows = Array.isArray(data?.requests) ? data.requests : [];

      const now = new Date();
      const ms = startOfMonth(now);
      const me = endOfMonth(now);

      let totalDays = 0;
      let monthDays = 0;

      rows
        .filter((r) => r.status === "approved")
        .forEach((r) => {
          const s = new Date(r.startDate);
          const e = new Date(r.endDate);
          const normS = new Date(s.getFullYear(), s.getMonth(), s.getDate());
          const normE = new Date(e.getFullYear(), e.getMonth(), e.getDate());
          totalDays += clamp0(differenceInCalendarDays(normE, normS) + 1);
          monthDays += overlapDaysInclusive(normS, normE, ms, me);
        });

      setLeaveStats({ totalDays, monthDays, loading: false });
    } catch (e) {
      setLeaveStats({ totalDays: 0, monthDays: 0, loading: false });
      console.error(e);
    }
  };

  const fetchDayClose = async () => {
    const res = await fetch("/api/member/dayClose/dayCloseHistory", {
      credentials: "include",
    });
    if (!res.ok) throw new Error(`Day close history failed: ${res.statusText}`);
    const data = await res.json();
    const history = Array.isArray(data?.requests) ? data.requests : [];
    setDayCloseHistory(history);

    // streak count till yesterday (approved only)
    let streak = 0;
    const days = [...history].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );
    let cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    cursor.setDate(cursor.getDate() - 1); // start yesterday
    const asKey = (d) => format(d, "yyyy-MM-dd");

    const approved = new Set(
      days
        .filter((r) => r.status === "approved")
        .map((r) => format(new Date(r.date), "yyyy-MM-dd"))
    );

    while (approved.has(asKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    setStreakDays(streak);
  };

  const fetchAssignedTasksSummary = async () => {
    setIsLoadingAssignedSummary(true);
    try {
      const today = new Date();
      const todayStr = format(today, "yyyy-MM-dd");
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yestStr = format(yesterday, "yyyy-MM-dd");

      const [resToday, resYest] = await Promise.all([
        fetch(`/api/member/assignedTasks?date=${todayStr}&action=tasks`, {
          credentials: "include",
        }),
        fetch(`/api/member/assignedTasks?date=${yestStr}&action=tasks`, {
          credentials: "include",
        }),
      ]);

      if (resToday.ok) {
        const data = await resToday.json();
        const tasks = (data?.tasks || []).map((t) =>
          t?.sprints?.length ? { ...t, status: deriveTaskStatus(t.sprints) } : t
        );
        setAssignedSummary(summariseTasks(tasks));
      }
      if (resYest.ok) {
        const data = await resYest.json();
        const tasks = (data?.tasks || []).map((t) =>
          t?.sprints?.length ? { ...t, status: deriveTaskStatus(t.sprints) } : t
        );
        setYesterdaySummary(summariseTasks(tasks));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingAssignedSummary(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchAssignedTasksSummary();
      fetchDayClose();
      fetchLeaveStats();
    }
  }, [status]);

  /* ------------------ memo filters (detail views) ------------------ */
  const filteredLeave = useMemo(() => {
    const from = leaveDateFrom ? new Date(leaveDateFrom) : null;
    const to = leaveDateTo ? new Date(leaveDateTo) : null;
    return [...leaveHistory]
      .filter((r) => {
        const sd = new Date(r.startDate);
        if (from && sd < from) return false;
        if (to) {
          const end = new Date(to);
          end.setHours(23, 59, 59, 999);
          if (sd > end) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [leaveHistory, leaveDateFrom, leaveDateTo]);

  const filteredDayClose = useMemo(() => {
    const picked = dcDate
      ? dayCloseHistory.filter(
          (r) => format(new Date(r.date), "yyyy-MM-dd") === dcDate
        )
      : dayCloseHistory;
    return [...picked].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [dayCloseHistory, dcDate]);

  if (status === "loading") return <div className="p-8">Loading...</div>;
  if (!["member", "team_manager"].includes(role))
    return <div className="p-8">Access Denied</div>;

  /* ------------------ streak greeting ------------------ */
  const displayName = session?.user?.team_manager_type
    ? session.user.team_manager_type.replace("_", " ")
    : session?.user?.name || "friend";

  const pendingToday = clamp0(assignedSummary.total - assignedSummary.completed);
  const delta =
    yesterdaySummary && assignedSummary.completed - yesterdaySummary.completed;
  const trendLabel =
    delta === 0
      ? "same as yesterday"
      : delta > 0
      ? `+${delta} vs yesterday`
      : `${delta} vs yesterday`;

  const headline = `hey ${displayName}, you’ve been consistent for ${plural(
    streakDays,
    "day"
  )} (till yesterday) — completed ${plural(
    assignedSummary.completed,
    "assigned task"
  )} today${pendingToday ? `, ${plural(pendingToday, "pending")}` : ""}${
    assignedSummary.pendingVerification
      ? `, ${plural(assignedSummary.pendingVerification, "awaiting verification")}`
      : ""
  }. keep going! 💪`;

  /* ------------------ UI ------------------ */
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 p-4 sm:p-6 flex items-center justify-center"
    >
      <div className="w-full h-full bg-white rounded-2xl shadow-2xl p-6 sm:p-8 flex flex-col gap-6 overflow-hidden border border-teal-100/50">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
            📊 My Performance
          </h1>
          {activeSection && (
            <motion.button
              onClick={() => {
                setActiveSection(null);
                setErr("");
              }}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all duration-200 flex items-center gap-2"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <ArrowLeft size={16} /> Back
            </motion.button>
          )}
        </div>

        <AnimatePresence>
          {err && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700"
            >
              <AlertCircle size={18} />
              <span className="text-sm">{err}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ====== MAIN (only when no detail section is open) ====== */}
        {!activeSection && (
          <>
            {/* Streak header */}
            <motion.div
              className="rounded-3xl border border-teal-200 bg-gradient-to-r from-amber-50 via-orange-50 to-pink-50 p-4 sm:p-6 shadow-lg"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Flame className="w-5 h-5 text-orange-500" />
                <h2 className="text-lg font-bold text-gray-800">🔥 Streaks</h2>
              </div>
              <p className="text-sm sm:text-base text-gray-700">{headline}</p>
              {yesterdaySummary && (
                <span
                  className={`mt-2 inline-block text-xs px-2 py-0.5 rounded-full border ${
                    delta > 0
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : delta < 0
                      ? "bg-red-50 text-red-700 border-red-200"
                      : "bg-gray-50 text-gray-600 border-gray-200"
                  }`}
                >
                  {trendLabel}
                </span>
              )}
            </motion.div>

            {/* Grid of 4 mini-cards */}
            <motion.div
              key="cards"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 md:grid-cols-4 gap-6"
            >
              {/* 1) LEAVE (merged: stats + open button) */}
              <motion.div
                className="bg-white rounded-xl shadow-md border border-indigo-100/70 p-5 flex flex-col justify-between hover:shadow-lg transition-shadow"
                style={{ minHeight: "11rem" }}
                whileHover={{ scale: 1.02 }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-6 h-6 text-indigo-600" />
                  <h2 className="text-lg font-semibold">Leave</h2>
                </div>

                {leaveStats.loading ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-12 rounded-xl bg-gray-100 animate-pulse" />
                    <div className="h-12 rounded-xl bg-gray-100 animate-pulse" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-indigo-50/70 p-3 text-center">
                      <div className="text-xs text-gray-500">Total (Approved)</div>
                      <div className="text-base font-bold text-indigo-700">
                        {leaveStats.totalDays}
                      </div>
                    </div>
                    <div className="rounded-xl bg-blue-50/70 p-3 text-center">
                      <div className="text-xs text-gray-500">This Month</div>
                      <div className="text-base font-bold text-blue-700">
                        {leaveStats.monthDays}
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-3">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setActiveSection("leave")}
                    className="w-full px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
                  >
                    View Leave History
                  </motion.button>
                </div>
              </motion.div>

              {/* 2) DAY CLOSE HISTORY */}
              <motion.div
                onClick={() => setActiveSection("dayclose")}
                className="cursor-pointer bg-white rounded-xl shadow-md border border-teal-100/50 p-5 flex flex-col justify-between hover:shadow-lg transition-shadow"
                style={{ minHeight: "11rem" }}
                whileHover={{ scale: 1.02 }}
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-6 h-6 text-teal-600" />
                  <h2 className="text-lg font-semibold">Day Close History</h2>
                </div>
                <p className="text-sm text-gray-600">
                  Check approvals/rejections and timestamps.
                </p>
                <div className="text-xs text-gray-500">Tap to open →</div>
              </motion.div>

              {/* 3) REVIEWS & METRICS (coming soon) */}
              <motion.div
                className="bg-white rounded-xl shadow-md border border-teal-100/50 p-5 flex flex-col justify-between opacity-90"
                style={{ minHeight: "11rem" }}
                whileHover={{ scale: 1.01 }}
              >
                <div className="flex items-center gap-2">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    className="text-teal-600"
                  >
                    <path
                      fill="currentColor"
                      d="M3 5h18v2H3zm0 4h14v2H3zm0 4h10v2H3zm0 4h8v2H3z"
                    />
                  </svg>
                  <h2 className="text-lg font-semibold">Reviews & Metrics</h2>
                </div>
                <p className="text-sm text-gray-600">
                  Coming soon: charts and performance reviews.
                </p>
                <div className="text-xs text-gray-500">Stay tuned</div>
              </motion.div>

              {/* 4) ASSIGNED TASK PERFORMANCE (summary) */}
              <motion.div
                className="bg-white rounded-xl shadow-md border border-teal-100/50 p-5 flex flex-col gap-3"
                style={{ minHeight: "11rem" }}
                whileHover={{ scale: 1.01 }}
              >
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-6 h-6 text-teal-600" />
                  <h2 className="text-lg font-semibold">
                    Assigned Task Performance
                  </h2>
                </div>

                {isLoadingAssignedSummary ? (
                  <div className="grid grid-cols-2 gap-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-10 w-full animate-pulse rounded-2xl bg-gray-200/50"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-indigo-50/70 p-3 text-center">
                      <div className="text-xs text-gray-500">Total</div>
                      <div className="text-base font-bold text-indigo-600">
                        {assignedSummary.total}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-green-50/70 p-3 text-center">
                      <div className="text-xs text-gray-500">Completed (Today)</div>
                      <div className="text-base font-bold text-green-600">
                        {assignedSummary.completed}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-blue-50/70 p-3 text-center">
                      <div className="text-xs text-gray-500">Pending</div>
                      <div className="text-base font-bold text-blue-700">
                        {clamp0(assignedSummary.total - assignedSummary.completed)}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-yellow-50/70 p-3 text-center">
                      <div className="text-xs text-gray-500">In Progress</div>
                      <div className="text-base font-bold text-yellow-600">
                        {assignedSummary.inProgress}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-orange-50/70 p-3 text-center">
                      <div className="text-xs text-gray-500">Awaiting Verification</div>
                      <div className="text-base font-bold text-orange-600">
                        {assignedSummary.pendingVerification}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          </>
        )}

        {/* ====== DETAIL VIEW (only the selected section shows) ====== */}
        <AnimatePresence mode="wait">
          {activeSection && (
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="flex-1 min-h-0"
            >
              <div className="bg-white/90 dark:bg-gray-900/90 rounded-2xl shadow-md border border-teal-100/50 dark:border-gray-700/50 h-full flex flex-col">
                <div className="px-5 py-4 border-b border-teal-100/50 dark:border-gray-700/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {activeSection === "leave" ? (
                      <>
                        <FileText className="w-5 h-5 text-indigo-600" />
                        <h2 className="font-semibold">Leave History</h2>
                      </>
                    ) : (
                      <>
                        <Calendar className="w-5 h-5 text-teal-600" />
                        <h2 className="font-semibold">Day Close History</h2>
                      </>
                    )}
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        setLoading(true);
                        if (activeSection === "leave") {
                          await fetchLeave();
                          await fetchLeaveStats(); // keep card stats fresh
                        }
                        if (activeSection === "dayclose") await fetchDayClose();
                      } catch (e) {
                        setErr(e.message || "Refresh failed");
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="text-sm px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700"
                  >
                    Refresh
                  </button>
                </div>

                {/* FILTERS */}
                <div className="px-5 pt-4">
                  {activeSection === "leave" ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          From
                        </label>
                        <input
                          type="date"
                          value={leaveDateFrom}
                          onChange={(e) => setLeaveDateFrom(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border bg-gray-50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          To
                        </label>
                        <input
                          type="date"
                          value={leaveDateTo}
                          onChange={(e) => setLeaveDateTo(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border bg-gray-50"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          onClick={() => {
                            setLeaveDateFrom("");
                            setLeaveDateTo("");
                          }}
                          className="w-full md:w-auto px-3 py-2 rounded-lg border bg-white hover:bg-gray-50"
                        >
                          Clear
                        </button>
                      </div>
                      {loading && (
                        <div className="flex items-end text-teal-700 gap-2">
                          <Loader2 className="h-5 w-5 animate-spin" />{" "}
                          <span>Loading…</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          Filter by Date
                        </label>
                        <input
                          type="date"
                          value={dcDate}
                          onChange={(e) => setDcDate(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border bg-gray-50"
                          max={format(new Date(), "yyyy-MM-dd")}
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          onClick={() => setDcDate("")}
                          className="w-full md:w-auto px-3 py-2 rounded-lg border bg-white hover:bg-gray-50"
                        >
                          Clear
                        </button>
                      </div>
                      {loading && (
                        <div className="flex items-end text-teal-700 gap-2">
                          <Loader2 className="h-5 w-5 animate-spin" />{" "}
                          <span>Loading…</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* CONTENT */}
                <div
                  className="p-5 overflow-auto min-h-0"
                  style={{ height: "calc(100% - 96px)" }}
                >
                  {activeSection === "leave" ? (
                    leaveHistory.length === 0 ? (
                      <p className="text-sm text-gray-600">
                        No leave requests found.
                      </p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="text-xs uppercase bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left">Start</th>
                            <th className="px-3 py-2 text-left">End</th>
                            <th className="px-3 py-2 text-left">Reason</th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2 text-left">Submitted To</th>
                            <th className="px-3 py-2 text-left">Proof</th>
                            <th className="px-3 py-2 text-left">Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredLeave.map((r) => (
                            <tr key={r.id} className="border-t">
                              <td className="px-3 py-2">
                                {new Date(r.startDate).toLocaleDateString()}
                              </td>
                              <td className="px-3 py-2">
                                {new Date(r.endDate).toLocaleDateString()}
                              </td>
                              <td className="px-3 py-2">{r.reason}</td>
                              <td className="px-3 py-2 capitalize">{r.status}</td>
                              <td className="px-3 py-2">
                                {r.supervisorName || "N/A"}
                              </td>
                              <td className="px-3 py-2">
                                {r.proof ? (
                                  <a
                                    href={r.proof}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-teal-600 hover:text-teal-700 underline"
                                  >
                                    View
                                  </a>
                                ) : (
                                  "None"
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {new Date(r.createdAt).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )
                  ) : filteredDayClose.length === 0 ? (
                    <p className="text-sm text-gray-600">No day close history.</p>
                  ) : (
                    <div className="space-y-4">
                      {filteredDayClose.map((req) => (
                        <div key={req.id} className="bg-gray-50 p-4 rounded-xl border">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold">
                              {format(new Date(req.date), "d/M/yyyy (EEEE)")}
                            </p>
                            <span
                              className={`text-xs px-2 py-1 rounded-full ${
                                req.status === "approved"
                                  ? "bg-green-100 text-green-700"
                                  : req.status === "rejected"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-indigo-100 text-indigo-700"
                              }`}
                            >
                              {req.status}
                            </span>
                          </div>
                          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                            <p>
                              <strong>Requested At:</strong>{" "}
                              {new Date(req.createdAt).toLocaleString()}
                            </p>
                            {req.approvedAt && (
                              <p>
                                <strong>
                                  {req.status === "approved" ? "Approved" : "Rejected"} At:
                                </strong>{" "}
                                {new Date(req.approvedAt).toLocaleString()}
                              </p>
                            )}
                            {req.approvedByName && (
                              <p>
                                <strong>
                                  {req.status === "approved" ? "Approved" : "Reviewed"} By:
                                </strong>{" "}
                                {req.approvedByName}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
