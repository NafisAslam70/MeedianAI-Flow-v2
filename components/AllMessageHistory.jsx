"use client";

import { motion } from "framer-motion";
import { MessageSquare, X, Filter } from "lucide-react";
import { useMemo, useState } from "react";

const statusStyles = (status) => {
  switch (status) {
    case "sent":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "read":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "failed":
      return "bg-red-100 text-red-700 border-red-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
};

const capitalize = (str = "") =>
  str
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

// Normalize API payloads into one UI-friendly shape
function normalizeMessage(raw, idx) {
  const type = raw?.type || raw?.messageType || "direct";

  const recipientCategory =
    raw?.recipientCategory ||
    (raw?.kind === "existing"
      ? "meedian_family"
      : raw?.kind === "custom"
      ? "non_meedian"
      : raw?.recipientUserId || raw?.recipientId
      ? "meedian_family"
      : "non_meedian");

  return {
    id: raw?.id ?? idx,
    type,
    recipientCategory,
    recipientName: raw?.recipientName || raw?.toName || raw?.name || "Unknown",
    recipientRole: raw?.recipientRole || raw?.role || "N/A",
    customWhatsappNumber:
      raw?.customWhatsappNumber ||
      raw?.toNumber ||
      raw?.recipientWhatsappNumber ||
      null,
    subject: raw?.subject ?? "N/A",
    message: raw?.message ?? raw?.content ?? "",
    note: raw?.note ?? "",
    contact: raw?.contact ?? "",
    status: raw?.status ?? "sent",
    createdAt: raw?.createdAt ?? raw?.created_at ?? Date.now(),
  };
}

export default function AllMessageHistory({ sentMessages, onClose }) {
  const [messageTypeFilter, setMessageTypeFilter] = useState("all");
  const [recipientTypeFilter, setRecipientTypeFilter] = useState("all");

  // Ensure array, strip non-objects
  const validMessages = Array.isArray(sentMessages)
    ? sentMessages.filter((m) => m && typeof m === "object")
    : [];

  // Normalize once
  const normalized = useMemo(
    () => validMessages.map((m, i) => normalizeMessage(m, i)),
    [validMessages]
  );

  // Apply filters
  const filtered = useMemo(() => {
    return normalized.filter((msg) => {
      const typeOk =
        messageTypeFilter === "all" ? true : msg.type === messageTypeFilter;
      const recipientOk =
        recipientTypeFilter === "all"
          ? true
          : msg.recipientCategory === recipientTypeFilter;
      return typeOk && recipientOk;
    });
  }, [normalized, messageTypeFilter, recipientTypeFilter]);

  // Sort newest -> oldest
  const sorted = useMemo(
    () =>
      [...filtered].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [filtered]
  );

  // Debug (safe)
  console.log("AllMessageHistory (normalized):", JSON.stringify(sorted, null, 2));

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-teal-600" />
          Sent Message History
        </h2>
        <motion.button
          whileHover={{ scale: 1.13, rotate: 90 }}
          whileTap={{ scale: 0.92 }}
          onClick={onClose}
          className="p-2 bg-gray-100/80 hover:bg-gray-300/80 dark:hover:bg-gray-600/80 rounded-full shadow-lg border border-gray-200 dark:border-gray-600 transition-all"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-gray-700 dark:text-gray-200" />
        </motion.button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-teal-600" />
            Message Type
          </label>
          <select
            value={messageTypeFilter}
            onChange={(e) => setMessageTypeFilter(e.target.value)}
            className="w-full px-3 py-1.5 border rounded-lg bg-gray-50/90 dark:bg-slate-800/90 focus:ring-2 focus:ring-teal-500 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700"
          >
            <option value="all">All Messages</option>
            <option value="direct">Direct Messages</option>
            <option value="task_update">Task Update Messages</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-teal-600" />
            Recipient Type
          </label>
          <select
            value={recipientTypeFilter}
            onChange={(e) => setRecipientTypeFilter(e.target.value)}
            className="w-full px-3 py-1.5 border rounded-lg bg-gray-50/90 dark:bg-slate-800/90 focus:ring-2 focus:ring-teal-500 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700"
          >
            <option value="all">All Recipients</option>
            <option value="meedian_family">Meedian Family</option>
            <option value="non_meedian">Non-Meedian</option>
          </select>
        </div>
      </div>

      {sorted.length === 0 ? (
        <motion.p
          className="text-sm text-gray-500 dark:text-gray-400 text-center mt-10"
          initial={{ opacity: 0.6 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          No messages found for the selected filters.
        </motion.p>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
          <div className="grid grid-cols-1 gap-4">
            {sorted.map((msg, index) => (
              <motion.div
                key={msg.id ?? `msg-${index}`}
                className="bg-white/70 dark:bg-slate-800/80 p-4 rounded-xl border border-gray-100 dark:border-slate-700 shadow group transition-all hover:shadow-xl hover:-translate-y-1"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-900 dark:text-white text-[15px] truncate">
                    {msg.recipientName}
                    {msg.recipientRole && msg.recipientRole !== "N/A" ? ` (${msg.recipientRole})` : ""}
                    {msg.recipientCategory === "non_meedian" && msg.customWhatsappNumber
                      ? ` (${msg.customWhatsappNumber})`
                      : ""}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-xs font-bold rounded-xl border ${statusStyles(
                      msg.status
                    )} uppercase tracking-wide shadow-sm`}
                  >
                    {capitalize((msg.status || "sent").replace("_", " "))}
                  </span>
                </div>

                <div className="text-sm text-gray-700 dark:text-gray-200 mb-2">
                  <span className="font-medium">Type:</span>{" "}
                  <span className="font-semibold">
                    {capitalize((msg.type || "direct").replace("_", " "))}
                  </span>
                </div>

                <div className="text-sm text-gray-700 dark:text-gray-200 mb-2">
                  <span className="font-medium">Subject:</span>{" "}
                  <span className="font-semibold">{msg.subject}</span>
                </div>

                <p className="text-sm text-gray-700 dark:text-gray-200 mb-2 whitespace-pre-line">
                  {msg.message || "No message content"}
                </p>

                {msg.note && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 italic mb-2">
                    Note: {msg.note}
                  </p>
                )}

                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <span>Sent: {new Date(msg.createdAt).toLocaleString()}</span>
                  <span>|</span>
                  <span>Contact: {msg.contact || "N/A"}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 7px;
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #b6e0fe66;
          border-radius: 6px;
        }
        .custom-scrollbar {
          scrollbar-color: #60a5fa44 transparent;
          scrollbar-width: thin;
        }
        html.dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #2563eb77;
        }
      `}</style>
    </div>
  );
}
