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
  ArrowDownCircle,
  Edit,
} from "lucide-react";
import { useMemo, useState } from "react";

/* ------------------------------------------------------- */
/* Helpers                                                 */
/* ------------------------------------------------------- */
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

const capitalize = (str = "") =>
  str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

// Accept either array of sprint objects [{status: '...'}] OR array of status strings ['in_progress', ...]
const deriveTaskStatus = (arr = []) => {
  // Ensure arr is an array and filter out null/undefined values
  if (!Array.isArray(arr)) return "not_started";
  const validArr = arr.filter((item) => item != null);
  if (!validArr.length) return "not_started";

  const statuses = validArr.length && typeof validArr[0] === "string" 
    ? validArr 
    : validArr.map((s) => s?.status).filter((status) => status != null);

  if (!statuses.length) return "not_started";

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

const dedupeAssignees = (assignees = []) => {
  const seen = new Set();
  return assignees.filter((a) => {
    if (!a || seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
};

const dedupeSprints = (sprints = []) => {
  const seen = new Set();
  return sprints.filter((s) => {
    if (!s || seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
};

/* ------------------------------------------------------- */
/* Component                                               */
/* ------------------------------------------------------- */
const AssignedTaskDetails = ({
  task,
  taskLogs = [],
  users = [],
  onClose,
  isManager = false,
  currentUserId,
  currentUserName,
  onUpdateStatusClick,
  newLogComment,
  setNewLogComment,
  isAddingLog,
  onAddLog,
}) => {
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [showFullLogs, setShowFullLogs] = useState(false);

  const description = task?.description || "No description provided.";
  const isLongDescription = description.length > 240;

  // IMPORTANT: action=task API returns assignees with their DB statuses; it does not include task.sprints for members.
  // So we compute status as:
  // - Members: use their own assignee row's status directly from DB.
  // - Managers: roll up either all assignees' sprints (preferred) or, if none, roll up assignee statuses.
  const myAssigneeRow = task?.assignees?.find((a) => Number(a?.id) === Number(currentUserId)) || null;

  const managerRolledStatus = (() => {
    const allSprints = (task?.assignees || []).flatMap((a) => a?.sprints || []).filter((s) => s != null);
    if (allSprints.length > 0) return deriveTaskStatus(allSprints);
    const assigneeStatuses = (task?.assignees || []).map((a) => a?.status).filter((status) => status != null);
    return deriveTaskStatus(assigneeStatuses);
  })();

  const taskStatus = isManager ? managerRolledStatus : (myAssigneeRow?.status || "not_started");

  const assignees = isManager ? dedupeAssignees(task?.assignees || []) : [];
  const observerIdSet = useMemo(() => {
    const ids = new Set();
    if (task?.observerId != null) ids.add(Number(task.observerId));
    if (Array.isArray(task?.observers)) {
      task.observers.forEach((observer) => {
        if (observer?.id != null) ids.add(Number(observer.id));
      });
    }
    return ids;
  }, [task]);
  const viewerIsObserver = observerIdSet.has(Number(currentUserId));
  const observerName =
    task?.observer?.name ||
    task?.observerName ||
    (task?.observerId ? getUserName(task.observerId, users, currentUserId, currentUserName) : null);

  const sprintsGrid = (sprints = []) => (
    <div className="mt-3">
      <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
        <FileText className="w-4 h-4 text-teal-600" />
        Sprints
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {dedupeSprints(sprints).map((s) => (
          <div
            key={s.id}
            className={`
              p-4 rounded-2xl shadow group transition-all
              border-2 ${statusStyles(s.status)}
              hover:shadow-xl hover:-translate-y-1 hover:bg-white/90 dark:hover:bg-slate-800/90
            `}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-gray-900 dark:text-white text-[15px] truncate">
                {s.title || "Untitled Sprint"}
              </span>
              <span
                className={`ml-2 px-2 py-0.5 text-xs font-bold rounded-xl border ${statusStyles(
                  s.status
                )} uppercase tracking-wide shadow-sm`}
              >
                {capitalize((s.status || "not_started").replace("_", " "))}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">
              {s.description || <span className="italic text-gray-300 dark:text-gray-600">No description.</span>}
            </p>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.33, ease: "easeOut" }}
      className="fixed inset-0 z-50 flex items-start justify-center bg-gradient-to-br from-teal-50 to-blue-50/80 dark:from-teal-900/80 dark:to-blue-900/80 p-2 md:p-8 overflow-y-auto"
      style={{ minHeight: "100vh" }}
    >
      <div
        className={`
          relative w-full max-w-[96vw] min-h-[70vh] max-h-[92vh]
          bg-white/80 dark:bg-slate-900/70
          border border-teal-200/70 shadow-2xl
          rounded-3xl
          px-2 md:px-10 py-7 flex flex-col overflow-visible
          backdrop-blur-2xl
          transition-all
        `}
        style={{
          boxShadow:
            "0 12px 40px 0 rgba(16, 42, 67, 0.12), 0 2px 12px 0 rgba(16,42,67,0.09)",
        }}
      >
        {/* Close */}
        <motion.button
          whileHover={{ scale: 1.13, rotate: 90 }}
          whileTap={{ scale: 0.92 }}
          onClick={onClose}
          className="absolute top-6 right-6 z-50 p-2 bg-gray-100/80 hover:bg-gray-300/80 dark:hover:bg-gray-600/80 rounded-full shadow-lg border border-gray-200 dark:border-gray-600 transition-all"
          aria-label="Close"
        >
          <X className="w-6 h-6 text-gray-700 dark:text-gray-200" />
        </motion.button>

        {/* Split */}
        <div className="flex-1 flex flex-col md:flex-row gap-8 w-full h-full mt-2">
          {/* LEFT */}
          <div className="flex-[2.7] min-w-[300px] pr-0 md:pr-5 flex flex-col overflow-y-auto h-[65vh]">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
              <FileText className="w-6 h-6 text-teal-600" />
              {task?.title || "Untitled Task"}
            </h2>

            {!isManager && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onUpdateStatusClick?.(task)}
                className="w-fit px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 dark:bg-teal-700 dark:hover:bg-teal-800 flex items-center gap-1 shadow-lg border border-teal-200 transition-all mb-4"
              >
                <Edit className="w-4 h-4" />
                Update Status
              </motion.button>
            )}

            <p className="text-[15px] text-gray-700 dark:text-slate-200 mb-3 whitespace-pre-line">
              {isLongDescription && !showFullDescription
                ? `${description.slice(0, 240)}...`
                : description}
              {isLongDescription && (
                <button
                  onClick={() => setShowFullDescription((v) => !v)}
                  className="text-teal-700 dark:text-teal-300 font-semibold text-xs ml-2 hover:underline transition"
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
                  <span className={`px-2 py-0.5 rounded-xl border font-semibold shadow-sm ${statusStyles(taskStatus)}`}>
                    {capitalize(taskStatus.replace("_", " "))}
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
                  <span className="italic text-gray-400 dark:text-gray-500">N/A</span>
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
                  <span className="italic text-gray-400 dark:text-gray-500">No deadline</span>
                )}
              </div>

              {observerName && (
                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                  <UserCircle className="w-4 h-4 text-sky-500" />
                  <span className="font-medium">Observer:</span>
                  <span className="font-semibold">{observerName}</span>
                </div>
              )}
            </div>

            <div className="text-sm text-gray-700 dark:text-gray-200 mb-3">
              <span className="font-medium">Resources:</span>{" "}
              {task?.resources ? (
                <span className="font-semibold">{task.resources}</span>
              ) : (
                <span className="italic text-gray-400 dark:text-gray-500">No resources available.</span>
              )}
            </div>

            {/* Manager: assignees block */}
            {isManager && assignees.length > 0 && (
              <div className="mt-2">
                <h3 className="text-base font-semibold text-gray-800 dark:text-white">Assignees</h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Status changes follow the doer/observer workflow. Use the status panel to move work forward when you are the assigned observer.
                </p>
                <div className="space-y-2 mt-3">
                  {assignees.map((assignee) => {
                    const statusValue = assignee.status || "not_started";
                    const statusLabel = capitalize(statusValue.replace("_", " "));
                    const youAreDoer = Number(assignee.id) === Number(currentUserId);
                    const youObserveThisTask = viewerIsObserver && !youAreDoer;
                    return (
                      <div
                        key={assignee.id}
                        className="bg-gray-50 dark:bg-slate-800/60 p-3 rounded-xl border border-gray-200 dark:border-slate-700 shadow flex flex-col gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 flex items-center justify-center bg-teal-100 text-teal-800 rounded-full font-bold mr-2">
                            {getInitials(getUserName(assignee.id, users))}
                          </span>
                          <div>
                            <span className="font-semibold text-gray-900 dark:text-gray-200">
                              {getUserName(assignee.id, users, currentUserId, currentUserName)}
                            </span>
                            <div className="flex items-center gap-2 mt-1">
                              <span
                                className={`px-2 py-0.5 rounded-xl border font-semibold shadow-sm ${statusStyles(statusValue)}`}
                              >
                                {statusLabel}
                              </span>
                              {youAreDoer && (
                                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                  You are the doer
                                </span>
                              )}
                              {youObserveThisTask && (
                                <span className="text-[11px] font-medium text-sky-600 dark:text-sky-400">
                                  You can verify updates
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {assignee.sprints?.length > 0 && sprintsGrid(assignee.sprints)}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                  <AlertCircle className="w-4 h-4 text-teal-500" />
                  <span className="font-medium">Overall Status:</span>
                  <span className={`px-2 py-0.5 rounded-xl border font-semibold shadow-sm ${statusStyles(managerRolledStatus)}`}>
                    {capitalize(managerRolledStatus.replace("_", " "))}
                  </span>
                </div>
              </div>
            )}

            {/* Member: own sprints grid if provided by calling page */}
            {!isManager && task?.sprints?.length > 0 && sprintsGrid(task.sprints)}

            {/* Add Log (manager only) */}
            {isManager && (
              <div className="mt-4">
                <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-2">Add Log</h3>
                <textarea
                  value={newLogComment}
                  onChange={(e) => setNewLogComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-teal-500 text-sm font-medium text-gray-700 dark:text-gray-200 mb-2"
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onAddLog}
                  disabled={!newLogComment || isAddingLog}
                  className={`px-4 py-2 bg-teal-600 text-white rounded-md text-sm font-medium ${
                    !newLogComment || isAddingLog ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {isAddingLog ? "Adding..." : "Add Log"}
                </motion.button>
              </div>
            )}
          </div>

          {/* RIGHT: Discussion */}
          <div className="flex-[1.3] min-w-[320px] max-w-[520px] flex flex-col bg-gradient-to-br from-blue-50/60 to-slate-100/80 dark:from-slate-800/80 dark:to-slate-900/70 rounded-2xl shadow-xl border border-teal-100/70 p-5 h-[65vh]">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-teal-600" />
              Discussion
            </h3>
            <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
              {taskLogs.length === 0 ? (
                <motion.p
                  className="text-sm text-gray-500 dark:text-gray-400 text-center mt-10"
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
                        ? task.assignees?.flatMap((a) => a.sprints || []).find((s) => s?.id === log.sprintId)
                        : task.sprints?.find((s) => s?.id === log.sprintId))
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
                        <p className="text-xs text-teal-700 dark:text-teal-300 font-bold mb-1">{prefix}</p>
                        <p className="text-sm text-gray-800 dark:text-gray-100">{log.details}</p>
                      </div>
                    </motion.div>
                  );
                })
              )}
              {taskLogs.length > 6 && !showFullLogs && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ scale: 1.05 }}
                  onClick={() => setShowFullLogs(true)}
                  className="flex items-center gap-1 text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/60 hover:bg-teal-100 dark:hover:bg-teal-800/60 font-semibold text-xs px-4 py-2 rounded-xl mx-auto mt-2 shadow border border-teal-100 dark:border-teal-600 transition-all"
                >
                  <ArrowDownCircle className="w-4 h-4" />
                  Show More
                </motion.button>
              )}
            </div>
          </div>
        </div>

        {/* Custom scrollbar */}
        <style jsx global>{`
          .custom-scrollbar::-webkit-scrollbar { width: 7px; background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #b6e0fe66; border-radius: 6px; }
          .custom-scrollbar { scrollbar-color: #60a5fa44 #0000; scrollbar-width: thin; }
          html.dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #2563eb77; }
        `}</style>
      </div>
    </motion.div>
  );
};
 
export default AssignedTaskDetails;
