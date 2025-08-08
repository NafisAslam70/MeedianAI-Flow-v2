"use client";
import { motion } from "framer-motion";
import { Calendar, User, FileText, Clock, AlertCircle, MessageSquare, X } from "lucide-react";
import { useState } from "react";

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

const capitalize = (str) =>
  str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

const AssignedTaskDetails = ({
  task,
  taskLogs,
  users,
  onClose,
  isManager = false,
  newLogComment = "",
  setNewLogComment = () => {},
  isAddingLog = false,
  onAddLog = () => {},
  newTaskStatuses = {},
  setNewTaskStatuses = () => {},
  newSprintStatuses = {},
  setNewSprintStatuses = () => {},
  handleUpdateTaskStatus = () => {},
  handleUpdateSprintStatus = () => {},
  isUpdating = false,
  currentUserId,
  currentUserName,
}) => {
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [showFullLogs, setShowFullLogs] = useState(false);

  const description = task?.description || "No description provided.";
  const isLongDescription = description.length > 240;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.35 }}
      className="fixed inset-0 z-40 flex items-center justify-center bg-gradient-to-br from-teal-50 to-blue-50/80 p-8 overflow-auto"
    >
      <div className="relative w-full max-w-[95vw] min-h-[70vh] bg-white/90 backdrop-blur-xl border border-teal-100/60 rounded-3xl shadow-2xl px-10 py-7 flex flex-col overflow-visible">
        {/* Close button */}
        <motion.button
          whileHover={{ scale: 1.1, rotate: 90 }}
          whileTap={{ scale: 0.92 }}
          onClick={onClose}
          className="absolute top-7 right-7 z-50 p-2 bg-gray-100 hover:bg-gray-300 rounded-full shadow-md transition"
          aria-label="Close"
        >
          <X className="w-6 h-6 text-gray-700" />
        </motion.button>

        {/* LANDSCAPE SPLIT VIEW */}
        <div className="flex-1 flex flex-row gap-8 w-full h-full mt-2">
          {/* LEFT: DETAILS (2/3) */}
          <div className="flex-[2.5] min-w-[320px] pr-4 flex flex-col overflow-y-auto h-[64vh]">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-2">
              <FileText className="w-6 h-6 text-teal-600" />
              {task?.title || "Untitled Task"}
            </h2>
            <p className="text-[15px] text-gray-700 mb-3 whitespace-pre-line">
              {isLongDescription && !showFullDescription
                ? `${description.slice(0, 240)}...`
                : description}
              {isLongDescription && (
                <button
                  onClick={() => setShowFullDescription(!showFullDescription)}
                  className="text-teal-600 text-xs font-medium ml-2 hover:underline"
                >
                  {showFullDescription ? "Show Less" : "Show More"}
                </button>
              )}
            </p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <User className="w-4 h-4 text-teal-500" />
                <span className="font-medium">Assigned By:</span>{" "}
                {getUserName(task?.createdBy, users, currentUserId, currentUserName)}
              </div>
              {!isManager && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <AlertCircle className="w-4 h-4 text-teal-500" />
                  <span className="font-medium">Status:</span>{" "}
                  {capitalize((task?.status || "not_started").replace("_", " "))}
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Calendar className="w-4 h-4 text-teal-500" />
                <span className="font-medium">Assigned:</span>{" "}
                {task?.assignedDate
                  ? new Date(task.assignedDate).toLocaleDateString()
                  : "N/A"}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Clock className="w-4 h-4 text-teal-500" />
                <span className="font-medium">Deadline:</span>{" "}
                {task?.deadline
                  ? new Date(task.deadline).toLocaleDateString()
                  : "No deadline"}
              </div>
            </div>
            <div className="text-sm text-gray-700 mb-2">
              <span className="font-medium">Resources:</span>{" "}
              {task?.resources || "No resources available."}
            </div>
            {isManager && task.assignees && (
              <div className="mt-2">
                <h3 className="text-base font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <User className="w-4 h-4 text-teal-600" />
                  Assignees
                </h3>
                <div className="space-y-2">
                  {task.assignees.map((assignee) => (
                    <div
                      key={assignee.id}
                      className="bg-gray-50 p-3 rounded-xl border border-gray-200 shadow"
                    >
                      <p className="font-medium text-gray-900 mb-1">
                        {getUserName(assignee.id, users, currentUserId, currentUserName)}
                      </p>
                      <p className="text-sm text-gray-600 mb-1">
                        Status: {capitalize(assignee.status?.replace("_", " ") || "N/A")}
                      </p>
                      {/* ...task status select & sprints as above... */}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Member view: sprints */}
            {!isManager && task.sprints?.length > 0 && (
              <div className="mt-3">
                <h3 className="text-base font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-teal-600" />
                  Sprints
                </h3>
                <div className="space-y-2">
                  {task.sprints.map((s) => (
                    <div
                      key={s.id}
                      className="p-2 bg-gray-50 rounded-xl border border-gray-200 shadow-sm"
                    >
                      <p className="font-medium text-gray-900 text-sm">
                        {s.title || "Untitled Sprint"}
                      </p>
                      <p className="text-xs text-gray-600 mb-1">
                        Status: {capitalize(s.status.replace("_", " "))}
                      </p>
                      <p className="text-xs text-gray-600">{s.description || "No description."}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* RIGHT: DISCUSSION (1/3) */}
          <div className="flex-[1.1] min-w-[350px] max-w-[480px] flex flex-col bg-gray-50 rounded-2xl shadow-inner border border-gray-200 p-4 h-[64vh]">
            <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-teal-600" />
              Discussion
            </h3>
            <div className="flex-1 overflow-y-auto space-y-3">
              {taskLogs.length === 0 ? (
                <p className="text-sm text-gray-500 text-center mt-10">No discussion yet.</p>
              ) : (
                (showFullLogs ? taskLogs : taskLogs.slice(0, 6)).map((log) => {
                  const sprint = log.sprintId
                    ? (isManager
                        ? task.assignees?.flatMap((a) => a.sprints || []).find((s) => s.id === log.sprintId)
                        : task.sprints?.find((s) => s.id === log.sprintId))
                    : null;
                  const prefix = sprint ? `[${sprint.title || "Untitled Sprint"}] ` : "[Main] ";
                  return (
                    <div
                      key={log.id}
                      className="p-3 bg-white rounded-lg shadow border border-gray-200"
                    >
                      <p className="text-xs text-gray-600 mb-1">
                        {prefix}
                        {getUserName(log.userId, users, currentUserId, currentUserName)}{" "}
                        ({new Date(log.createdAt).toLocaleString()}):
                      </p>
                      <p className="text-sm text-gray-700">{log.details}</p>
                    </div>
                  );
                })
              )}
            </div>
            {/* ...show more button, comment box, etc... */}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default AssignedTaskDetails;
