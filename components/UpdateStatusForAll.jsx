"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  MessageSquare,
  Mic,
  Languages,
  UserCircle,
  X,
  CheckCircle,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { STATUS_LABELS, normalizeTaskStatus } from "@/lib/taskWorkflow";

// Status styles helper (shared from AssignedTaskDetails)
const statusStyles = (status) => {
  switch (status) {
    case "not_started":
      return "bg-red-100 text-red-700 border-red-200";
    case "in_progress":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "pending_verification":
      return "bg-indigo-100 text-indigo-700 border-indigo-200";
    case "verified":
    case "done":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
};

// Capitalize helper
const capitalize = (str) =>
  str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const DOER_FLOW_GUIDANCE = {
  not_started: {
    title: "Kickoff",
    body: "As soon as you begin, switch the task to In Progress so your observer knows work has started.",
  },
  in_progress: {
    title: "Ready for review?",
    body: "When you complete this pass, move the task to Pending Verification to ask your observer for feedback.",
  },
  pending_verification: {
    title: "Waiting on your observer",
    body: "You’ve handed off the task. Your observer will either mark it Done/Verified or send it back to In Progress.",
  },
};

const OBSERVER_FLOW_GUIDANCE = {
  pending_verification: "Review the update and either mark it Done/Verified or send it back to In Progress for more work.",
  done: "Give it a final check or move it back to Pending Verification if more review is required.",
  verified: "You can reopen this task if follow-up work is needed.",
};

// Get User Name helper (shared)
const getUserName = (userId, users, currentUserId, currentUserName) => {
  if (!userId) return "System";
  const user = users?.find((u) => Number(u.id) === Number(userId));
  if (user) {
    if (currentUserId && Number(userId) === Number(currentUserId)) {
      return (currentUserName || user.name || "You") + " (You)";
    }
    return user.name || `ID ${userId}`;
  }
  return `ID ${userId}`;
};

// Get Initials helper
const getInitials = (name = "") =>
  name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

const UpdateStatusForAll = ({
  task,
  sprints = [],
  selectedSprint,
  setSelectedSprint,
  newStatus,
  setNewStatus,
  taskLogs = [],
  users = [],
  newLogComment,
  setNewLogComment,
  sendNotification,
  setSendNotification,
  sendWhatsapp,
  setSendWhatsapp,
  isUpdating,
  onUpdate,
  onAddLog,
  onClose,
  startVoiceRecording,
  isRecording,
  handleTranslateComment,
  currentUserId,
  currentUserName,
  error,
  success,
  statusOptions = [],
  mode = "task",
  actorContext = { isObserver: false, isDoer: false, isManager: false },
  observerName,
  onSprintChange,
}) => {
  const availableOptions = Array.isArray(statusOptions) ? statusOptions : [];
  const selectedOption = useMemo(
    () => availableOptions.find((opt) => opt.value === newStatus) || null,
    [availableOptions, newStatus]
  );
  const sprintList = Array.isArray(sprints) ? sprints : [];
  const isTaskMode = mode === "task";
  const currentTaskStatus = useMemo(
    () => (isTaskMode ? normalizeTaskStatus(task?.status) : null),
    [isTaskMode, task?.status]
  );
  const currentTaskLabel = currentTaskStatus ? STATUS_LABELS[currentTaskStatus] : null;
  const doerGuidance = isTaskMode && actorContext.isDoer ? DOER_FLOW_GUIDANCE[currentTaskStatus] : null;
  const observerGuidance = isTaskMode && actorContext.isObserver ? OBSERVER_FLOW_GUIDANCE[currentTaskStatus] : null;

  useEffect(() => {
    if (!availableOptions.length) return;
    const exists = availableOptions.some((opt) => opt.value === newStatus);
    if (!exists) {
      setNewStatus(availableOptions[0].value);
    }
  }, [availableOptions, newStatus, setNewStatus]);

  const noTransitions = availableOptions.length === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.33, ease: "easeOut" }}
      className="fixed inset-0 z-[60] flex items-start justify-center bg-gradient-to-br from-teal-50 to-blue-50/80 p-2 md:p-8 overflow-y-auto"
      style={{ minHeight: "100vh" }}
    >
      <div
        className={`
          relative w-full max-w-[96vw] min-h-[70vh] max-h-[92vh]
          bg-white/80 dark:bg-slate-900/70
          border border-teal-200/70 shadow-2xl
          rounded-3xl
          px-2 md:px-10 py-7 flex flex-col overflow-visible
          glassmorphism mt-2 md:mt-8
          backdrop-blur-2xl
          transition-all
        `}
        style={{
          boxShadow: "0 12px 40px 0 rgba(16, 42, 67, 0.12), 0 2px 12px 0 rgba(16,42,67,0.09)",
        }}
      >
        {/* Close button */}
        <motion.button
          whileHover={{ scale: 1.13, rotate: 90 }}
          whileTap={{ scale: 0.92 }}
          onClick={onClose}
          className="absolute top-6 right-6 z-50 p-2 bg-gray-100/80 hover:bg-gray-300/80 rounded-full shadow-lg border border-gray-200 transition-all"
          aria-label="Close"
        >
          <X className="w-6 h-6 text-gray-700 dark:text-gray-200" />
        </motion.button>

        {/* Split view: Left (Status Update), Right (Discussion) */}
        <div className="flex-1 flex flex-col md:flex-row gap-8 w-full h-full mt-2">
          {/* LEFT: Status Update Form */}
          <div className="flex-[2] min-w-[300px] pr-0 md:pr-5 flex flex-col overflow-y-auto h-[65vh]">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
              <AlertCircle className="w-6 h-6 text-teal-600" />
              Update Status for "{task?.title || "Untitled Task"}"
            </h2>

            {mode === "sprint" ? (
              <>
                {/* Sprint Selector */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Select Sprint
                  </label>
                  <select
                    value={selectedSprint}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSelectedSprint(value);
                      onSprintChange?.(value);
                    }}
                    className="w-full px-4 py-2 border rounded-xl bg-gray-50 focus:ring-2 focus:ring-teal-500 text-sm font-medium text-gray-700 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-200"
                  >
                    <option value="">Select Sprint</option>
                    {sprintList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title || "Untitled Sprint"}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Selector */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Select New Status
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    disabled={!selectedSprint || noTransitions}
                    className="w-full px-4 py-2 border rounded-xl bg-gray-50 focus:ring-2 focus:ring-teal-500 text-sm font-medium text-gray-700 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-200"
                  >
                    <option value="">Select Status</option>
                    {availableOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {noTransitions && (
                    <p className="mt-2 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {actorContext.isDoer
                        ? "No sprint status changes are available right now."
                        : "Only the assigned doer can update sprint progress."}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="mb-4 space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Current status · {currentTaskLabel || capitalize((task?.status || "not_started").replace("_", " "))}
                  </p>
                  {doerGuidance && (
                    <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                      <p className="font-semibold">{doerGuidance.title}</p>
                      <p className="mt-0.5 leading-snug">{doerGuidance.body}</p>
                    </div>
                  )}
                  {!doerGuidance && observerGuidance && (
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-snug">
                      {observerGuidance}
                    </p>
                  )}
                  {actorContext.isDoer && (
                    <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                      Workflow: Not Started → In Progress → Pending Verification → Observer marks Done/Verified or sends it back.
                    </p>
                  )}
                </div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Choose the next step
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  disabled={noTransitions}
                  className="w-full px-4 py-2 border rounded-xl bg-gray-50 focus:ring-2 focus:ring-teal-500 text-sm font-medium text-gray-700 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-200"
                >
                  <option value="">Select Status</option>
                  {availableOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {noTransitions && (
                  <p className="mt-1 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {actorContext.isDoer && currentTaskStatus === "pending_verification"
                      ? "All set! Your observer now has control. They’ll finish the task or send it back to In Progress."
                      : "No task status changes are available for your role right now."}
                  </p>
                )}
              </div>
            )}

            {selectedOption?.reason && !noTransitions && (
              <p className="mb-4 -mt-2 flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600">
                <AlertTriangle className="h-4 w-4 text-slate-500" /> {selectedOption.reason}
              </p>
            )}

            {/* Notification Checkboxes */}
            <div className="flex flex-col gap-2 mb-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={sendNotification}
                  onChange={(e) => setSendNotification(e.target.checked)}
                  className="h-4 w-4 text-teal-600 focus:ring-teal-500"
                />
                <label className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                  Chat-notify assignees
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={sendWhatsapp}
                  onChange={(e) => setSendWhatsapp(e.target.checked)}
                  className="h-4 w-4 text-teal-600 focus:ring-teal-500"
                />
                <label className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                  WhatsApp ping
                </label>
              </div>
            </div>

            {/* Comment Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Add a Comment
              </label>
              <textarea
                value={newLogComment}
                onChange={(e) => setNewLogComment(e.target.value)}
                placeholder="Add a comment to the task discussion..."
                className="w-full px-4 py-2 border rounded-xl bg-gray-50 focus:ring-2 focus:ring-teal-500 text-sm font-medium text-gray-700 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-200"
              />
            </div>

            {/* Voice & Translate Buttons */}
            <div className="flex items-center gap-3 mb-6">
              <motion.button
                onClick={startVoiceRecording}
                disabled={isRecording}
                className={`flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-medium ${
                  isRecording
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-teal-600 text-white hover:bg-teal-700"
                } dark:bg-teal-700 dark:hover:bg-teal-800`}
                whileHover={{ scale: isRecording ? 1 : 1.05 }}
                whileTap={{ scale: isRecording ? 1 : 0.95 }}
              >
                <Mic className="w-4 h-4" />
                {isRecording ? "Recording..." : "Record Comment (Hindi)"}
              </motion.button>
              <motion.button
                onClick={handleTranslateComment}
                className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-800"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Languages className="w-4 h-4" />
                Translate to English
              </motion.button>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="px-5 py-2 bg-gray-500 text-white rounded-xl text-sm font-medium hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700"
              >
                Cancel
              </motion.button>
              <motion.button
                whileHover={{ scale: noTransitions || isUpdating ? 1 : 1.05 }}
                whileTap={{ scale: noTransitions || isUpdating ? 1 : 0.95 }}
                onClick={onUpdate}
                disabled={!newStatus || (mode === "sprint" && !selectedSprint) || isUpdating || noTransitions}
                className={`px-5 py-2 rounded-xl text-sm font-medium ${
                  !newStatus || (mode === "sprint" && !selectedSprint) || isUpdating || noTransitions
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-teal-600 text-white hover:bg-teal-700 dark:bg-teal-700 dark:hover:bg-teal-800"
                }`}
              >
                {isUpdating ? (
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="inline-block w-4 h-4 border-4 border-t-teal-200 border-teal-600 rounded-full"
                  />
                ) : (
                  "Update Status"
                )}
              </motion.button>
            </div>

            {/* Error/Success Messages */}
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 text-red-600 text-sm font-medium flex items-center gap-1"
              >
                <AlertTriangle className="w-4 h-4" />
                {error}
              </motion.p>
            )}
            {success && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 text-emerald-600 text-sm font-medium flex items-center gap-1"
              >
                <CheckCircle className="w-4 h-4" />
                {success}
              </motion.p>
            )}
          </div>

          {/* RIGHT: Discussion Panel (similar to AssignedTaskDetails) */}
          <div className="flex-[1.3] min-w-[320px] max-w-[520px] flex flex-col bg-gradient-to-br from-blue-50/60 to-slate-100/80 dark:from-slate-800/80 dark:to-slate-900/70 rounded-2xl shadow-xl border border-teal-100/70 p-5 h-[65vh]">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-teal-600" />
              Discussion
            </h3>
            <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
              {taskLogs.length === 0 ? (
                <motion.p
                  className="text-sm text-gray-500 text-center mt-10"
                  initial={{ opacity: 0.6 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                >
                  No discussion yet.
                </motion.p>
              ) : (
                taskLogs.map((log) => {
                  const sprint = log.sprintId
                    ? sprints.find((s) => s.id === log.sprintId)
                    : null;
                  const prefix = sprint ? `[${sprint.title || "Untitled Sprint"}] ` : "[Main] ";
                  return (
                    <motion.div
                      key={log.id}
                      className="flex gap-2 p-3 rounded-xl bg-white/70 dark:bg-slate-800/80 border border-gray-100 dark:border-slate-700 shadow"
                      initial={{ opacity: 0, x: 15 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <span className="w-8 h-8 flex items-center justify-center bg-slate-200 dark:bg-slate-700 text-teal-700 dark:text-teal-300 rounded-full font-bold mt-1">
                        {getInitials(getUserName(log.userId, users, currentUserId, currentUserName))}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 dark:text-gray-400 font-bold">
                            {getUserName(log.userId, users, currentUserId, currentUserName)}
                          </span>
                          <span className="text-[11px] text-gray-400 dark:text-gray-500">
                            {new Date(log.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-teal-700 font-bold mb-1">
                          {prefix}
                        </p>
                        <p className="text-sm text-gray-800 dark:text-gray-100">{log.details}</p>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Custom scrollbar (same as AssignedTaskDetails) */}
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
          scrollbar-color: #60a5fa44 #0000;
          scrollbar-width: thin;
        }
        html.dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #2563eb77;
        }
      `}</style>
    </motion.div>
  );
};

export default UpdateStatusForAll;
