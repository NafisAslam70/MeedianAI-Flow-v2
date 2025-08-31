"use client";

import useSWR from "swr";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { MessageSquare, CheckCircle, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  });

/**
 * Recent General Logs (scrollable)
 * Props:
 * - limitDays?: number = 14
 * - maxHeight?: string = "40vh"
 * - className?: string
 */
export default function GeneralConversationThread({
  limitDays = 14,
  maxHeight = "40vh",
  className = "",
}) {
  const { data, error, isLoading } = useSWR("/api/member/dayClose/dayCloseHistory", fetcher);

  const items = useMemo(() => {
    const reqs = Array.isArray(data?.requests) ? data.requests : [];
    const filtered = reqs.filter(
      (r) =>
        (typeof r.generalLog === "string" && r.generalLog.trim()) ||
        (typeof r.ISGeneralLog === "string" && r.ISGeneralLog.trim())
    );
    return filtered
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limitDays);
  }, [data, limitDays]);

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-2">
        <MessageSquare className="w-4 h-4 text-teal-600" />
        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          Recent General Logs
        </h4>
      </div>

      <div
        className="rounded-2xl border border-teal-100/60 dark:border-teal-900/50 bg-white/70 dark:bg-slate-900/50 p-3"
        style={{ maxHeight, overflowY: "auto" }}
      >
        {isLoading && (
          <div className="text-xs text-gray-500 flex items-center gap-2 py-2">
            <Clock className="w-4 h-4" /> Loading…
          </div>
        )}
        {error && (
          <div className="text-xs text-red-600 py-2">
            Failed to load history: {error.message}
          </div>
        )}
        {!isLoading && !error && items.length === 0 && (
          <div className="text-xs text-gray-500 py-2">No general logs yet.</div>
        )}

        <div className="space-y-3">
          {items.map((req) => {
            const day = new Date(req.date);
            const safeDate = isNaN(day.getTime()) ? "Unknown date" : format(day, "EEE, MMM d, yyyy");

            const badge =
              req.status === "approved" ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                  <CheckCircle className="w-3 h-3" /> Approved
                </span>
              ) : req.status === "rejected" ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                  <XCircle className="w-3 h-3" /> Rejected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                  <Clock className="w-3 h-3" /> Pending
                </span>
              );

            return (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-teal-100/50 dark:border-teal-900/50 bg-white/70 dark:bg-slate-900/50 p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">{safeDate}</div>
                  {badge}
                </div>

                {/* Member (generalLog) */}
                <div className="text-xs">
                  <div className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">
                    Member note
                  </div>
                  <div className="mt-0.5 p-2 rounded-lg bg-teal-50/60 dark:bg-teal-900/30 border border-teal-100/60 dark:border-teal-900/60">
                    {req.generalLog?.trim() ? (
                      <p className="whitespace-pre-wrap">{req.generalLog}</p>
                    ) : (
                      <span className="text-gray-400">No note provided</span>
                    )}
                  </div>
                </div>

                {/* Supervisor (ISGeneralLog) */}
                <div className="text-xs mt-2">
                  <div className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">
                    Supervisor reply
                  </div>
                  <div className="mt-0.5 p-2 rounded-lg bg-gray-50/70 dark:bg-slate-800/50 border border-gray-100/70 dark:border-slate-700/70">
                    {req.ISGeneralLog?.trim() ? (
                      <p className="whitespace-pre-wrap">{req.ISGeneralLog}</p>
                    ) : (
                      <span className="text-gray-400">No reply</span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
