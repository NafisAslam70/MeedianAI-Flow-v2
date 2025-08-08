"use client";
import { motion } from "framer-motion";
import {
  Calendar,
  User,
  FileText,
  Clock,
  AlertCircle,
  MessageSquare,
  X,
  UserCircle,
  ArrowDownCircle
} from "lucide-react";
import { useState } from "react";

// Helper: Get User Display Name/Avatar
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
const getInitials = (name = "") =>
  name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

const capitalize = (str) =>
  str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

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

const AssignedTaskDetails = ({
  task,
  taskLogs = [],
  users = [],
  onClose,
  isManager = false,
  currentUserId,
  currentUserName,
}) => {
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [showFullLogs, setShowFullLogs] = useState(false);

  const description = task?.description || "No description provided.";
  const isLongDescription = description.length > 240;

  // Responsive sprints grid (2 columns on md+)
  const sprintsGrid =
    !isManager && task?.sprints?.length > 0 ? (
      <div className="mt-3">
        <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-teal-600" />
          Sprints
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {task.sprints.map((s) => (
            <div
              key={s.id}
              className={`
                p-4 rounded-2xl shadow group transition-all
                border-2 ${statusStyles(s.status)}
                hover:shadow-xl hover:-translate-y-1 hover:bg-white/90
                cursor-pointer
              `}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-900 text-[15px] truncate">
                  {s.title || "Untitled Sprint"}
                </span>
                <span
                  className={`ml-2 px-2 py-0.5 text-xs font-bold rounded-xl border ${statusStyles(
                    s.status
                  )} uppercase tracking-wide shadow-sm`}
                >
                  {capitalize(s.status.replace("_", " "))}
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium mb-1">
                {s.description || <span className="italic text-gray-300">No description.</span>}
              </p>
            </div>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.33, ease: "easeOut" }}
      className="fixed inset-0 z-50 flex items-start justify-center bg-gradient-to-br from-teal-50 to-blue-50/80 p-2 md:p-8 overflow-y-auto"
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

        {/* Split view */}
        <div className="flex-1 flex flex-col md:flex-row gap-8 w-full h-full mt-2">
          {/* LEFT: Task details */}
          <div className="flex-[2.7] min-w-[300px] pr-0 md:pr-5 flex flex-col overflow-y-auto h-[65vh]">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
              <FileText className="w-6 h-6 text-teal-600" />
              {task?.title || "Untitled Task"}
            </h2>
            <p className="text-[15px] text-gray-700 dark:text-slate-200 mb-3 whitespace-pre-line">
              {isLongDescription && !showFullDescription
                ? `${description.slice(0, 240)}...`
                : description}
              {isLongDescription && (
                <button
                  onClick={() => setShowFullDescription((v) => !v)}
                  className="text-teal-700 font-semibold text-xs ml-2 hover:underline transition"
                >
                  {showFullDescription ? "Show Less" : "Show More"}
                </button>
              )}
            </p>
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                <User className="w-4 h-4 text-teal-500" />
                <span className="font-medium">Assigned By:</span>
                <span className="font-semibold">
                  {getUserName(task?.createdBy, users, currentUserId, currentUserName)}
                </span>
              </div>
              {!isManager && (
                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                  <AlertCircle className="w-4 h-4 text-teal-500" />
                  <span className="font-medium">Status:</span>
                  <span
                    className={`px-2 py-0.5 rounded-xl border font-semibold shadow-sm ${statusStyles(
                      task?.status || "not_started"
                    )}`}
                  >
                    {capitalize((task?.status || "not_started").replace("_", " "))}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                <Calendar className="w-4 h-4 text-teal-500" />
                <span className="font-medium">Assigned:</span>
                {task?.assignedDate ? (
                  <span className="font-semibold">
                    {new Date(task.assignedDate).toLocaleDateString()}
                  </span>
                ) : (
                  <span className="italic text-gray-400">N/A</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                <Clock className="w-4 h-4 text-teal-500" />
                <span className="font-medium">Deadline:</span>
                {task?.deadline ? (
                  <span className="font-semibold">
                    {new Date(task.deadline).toLocaleDateString()}
                  </span>
                ) : (
                  <span className="italic text-gray-400">No deadline</span>
                )}
              </div>
            </div>
            <div className="text-sm text-gray-700 dark:text-gray-200 mb-3">
              <span className="font-medium">Resources:</span>{" "}
              {task?.resources ? (
                <span className="font-semibold">{task.resources}</span>
              ) : (
                <span className="italic text-gray-400">No resources available.</span>
              )}
            </div>

            {/* Manager assignees list */}
            {isManager && task.assignees && (
              <div className="mt-2">
                <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
                  <UserCircle className="w-4 h-4 text-teal-600" />
                  Assignees
                </h3>
                <div className="space-y-2">
                  {task.assignees.map((assignee) => (
                    <div
                      key={assignee.id}
                      className="bg-gray-50 dark:bg-slate-800/60 p-3 rounded-xl border border-gray-200 dark:border-slate-700 shadow flex items-center gap-2"
                    >
                      <span className="w-8 h-8 flex items-center justify-center bg-teal-100 text-teal-800 rounded-full font-bold mr-2">
                        {getInitials(getUserName(assignee.id, users))}
                      </span>
                      <div>
                        <span className="font-semibold text-gray-900 dark:text-gray-200">
                          {getUserName(assignee.id, users, currentUserId, currentUserName)}
                        </span>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Status:{" "}
                          <span
                            className={`px-2 py-0.5 rounded-xl border font-semibold shadow-sm ${statusStyles(
                              assignee.status || "not_started"
                            )}`}
                          >
                            {capitalize(assignee.status?.replace("_", " ") || "N/A")}
                          </span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sprints: two-column modern grid */}
            {sprintsGrid}
          </div>

          {/* RIGHT: Modern discussion panel */}
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
                (showFullLogs ? taskLogs : taskLogs.slice(0, 6)).map((log) => {
                  const sprint = log.sprintId
                    ? (isManager
                        ? task.assignees?.flatMap((a) => a.sprints || []).find((s) => s.id === log.sprintId)
                        : task.sprints?.find((s) => s.id === log.sprintId))
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
              {/* Show more logs if needed */}
              {taskLogs.length > 6 && !showFullLogs && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ scale: 1.05 }}
                  onClick={() => setShowFullLogs(true)}
                  className="flex items-center gap-1 text-teal-700 bg-teal-50 hover:bg-teal-100 font-semibold text-xs px-4 py-2 rounded-xl mx-auto mt-2 shadow border border-teal-100 transition-all"
                >
                  <ArrowDownCircle className="w-4 h-4" />
                  Show More
                </motion.button>
              )}
            </div>
            {/* (Optional: input for adding a new comment can go here) */}
          </div>
        </div>
      </div>
      {/* Custom scrollbar for entire modal (optional, add to globals.css) */}
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

export default AssignedTaskDetails;
