// components/member/AssignedTasksSummary.jsx
"use client";
import { motion } from "framer-motion";

export default function AssignedTasksSummary({
  summary = { total: 0, completed: 0, inProgress: 0, notStarted: 0, pendingVerification: 0 },
  onOpenAssigned, // optional: () => void
}) {
  const items = [
    { key: "total", label: "Total", value: summary.total, box: "bg-indigo-50/70 dark:bg-indigo-900/70", text: "text-indigo-600 dark:text-indigo-400" },
    { key: "completed", label: "Completed", value: summary.completed, box: "bg-green-50/70 dark:bg-green-900/70", text: "text-green-600 dark:text-green-400" },
    { key: "in_progress", label: "In Progress", value: summary.inProgress, box: "bg-yellow-50/70 dark:bg-yellow-900/70", text: "text-yellow-600 dark:text-yellow-400" },
    { key: "not_started", label: "Not Started", value: summary.notStarted, box: "bg-blue-50/70 dark:bg-blue-900/70", text: "text-blue-600 dark:text-blue-400" },
    { key: "pending_verification", label: "Pending", value: summary.pendingVerification, box: "bg-orange-50/70 dark:bg-orange-900/70", text: "text-orange-600 dark:text-orange-400" },
  ];

  return (
    <div className="rounded-3xl border border-gray-100/30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg p-4 sm:p-6 shadow-lg">
      <h3 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white mb-4">Assigned Tasks — Performance</h3>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {items.map((it, i) => (
          <motion.button
            key={it.key}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onOpenAssigned}
            className={`rounded-2xl p-3 text-center ${it.box} outline-none focus:ring-2 focus:ring-indigo-300 transition`}
            style={{ minHeight: 72 }}
          >
            <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{it.label}</div>
            <div className={`text-base sm:text-lg font-bold ${it.text}`}>{it.value}</div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
