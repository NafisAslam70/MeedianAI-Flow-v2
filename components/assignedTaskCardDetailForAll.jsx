"use client";
import { motion } from "framer-motion";
import { Calendar, User, FileText, Clock, AlertCircle, MessageSquare } from "lucide-react";

// Utility: Always resolves to name or at least ID or "System"
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

const capitalize = (str) => str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

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
  return (
    <div className="bg-white rounded-3xl shadow-xl p-6 max-w-4xl w-full mx-auto">
      <div className="flex flex-col md:flex-row gap-6 mb-6">
        <div className="flex-1 space-y-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-600" />
            {task?.title || "Untitled Task"}
          </h2>
          <p className="text-sm text-gray-700">{task?.description || "No description provided."}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <User className="w-4 h-4 text-teal-500" />
              <span className="font-medium">Assigned By:</span> {getUserName(task?.createdBy, users, currentUserId, currentUserName)}
            </div>
            {!isManager && (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <AlertCircle className="w-4 h-4 text-teal-500" />
                <span className="font-medium">Status:</span> {capitalize((task?.status || "not_started").replace("_", " "))}
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Calendar className="w-4 h-4 text-teal-500" />
              <span className="font-medium">Assigned Date:</span> {task?.assignedDate ? new Date(task.assignedDate).toLocaleDateString() : "N/A"}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Clock className="w-4 h-4 text-teal-500" />
              <span className="font-medium">Deadline:</span> {task?.deadline ? new Date(task.deadline).toLocaleDateString() : "No deadline"}
            </div>
          </div>
          <div className="text-sm text-gray-700">
            <span className="font-medium">Resources:</span> {task?.resources || "No resources available."}
          </div>
          {isManager && task.assignees && (
            <div className="mt-6">
              <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <User className="w-4 h-4 text-teal-600" />
                Assignees
              </h3>
              <div className="space-y-4">
                {task.assignees.map((assignee) => (
                  <div key={assignee.id} className="bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-sm">
                    <p className="font-medium text-gray-900 mb-2">{getUserName(assignee.id, users, currentUserId, currentUserName)}</p>
                    <p className="text-sm text-gray-600 mb-2">Status: {capitalize(assignee.status?.replace("_", " ") || "N/A")}</p>
                    <select
                      value={newTaskStatuses[assignee.id] || assignee.status}
                      onChange={(e) => setNewTaskStatuses({ ...newTaskStatuses, [assignee.id]: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200 text-sm text-gray-700"
                      disabled={assignee.sprints?.length > 0}
                    >
                      <option value="not_started">Not Started</option>
                      <option value="in_progress">In Progress</option>
                      <option value="pending_verification">Pending Verification</option>
                      <option value="done">Done</option>
                      <option value="verified">Verified</option>
                    </select>
                    {!assignee.sprints?.length && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleUpdateTaskStatus(assignee.id, newTaskStatuses[assignee.id])}
                        disabled={newTaskStatuses[assignee.id] === assignee.status || isUpdating}
                        className="mt-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Update Task Status
                      </motion.button>
                    )}
                    {assignee.sprints?.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Sprints</h4>
                        <div className="space-y-3">
                          {assignee.sprints.map((s) => (
                            <div key={s.id} className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                              <p className="font-medium text-gray-900 text-sm">{s.title || "Untitled Sprint"}</p>
                              <p className="text-xs text-gray-600 mb-2">Status: {capitalize(s.status.replace("_", " "))}</p>
                              <p className="text-xs text-gray-600 mb-2">{s.description || "No description."}</p>
                              <select
                                value={newSprintStatuses[`${assignee.id}-${s.id}`] || s.status}
                                onChange={(e) => setNewSprintStatuses({ ...newSprintStatuses, [`${assignee.id}-${s.id}`]: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200 text-sm text-gray-700"
                              >
                                <option value="not_started">Not Started</option>
                                <option value="in_progress">In Progress</option>
                                <option value="done">Done</option>
                                <option value="verified">Verified</option>
                              </select>
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleUpdateSprintStatus(assignee.id, s.id, newSprintStatuses[`${assignee.id}-${s.id}`])}
                                disabled={newSprintStatuses[`${assignee.id}-${s.id}`] === s.status || isUpdating}
                                className="mt-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Update Sprint Status
                              </motion.button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {!isManager && task.sprints?.length > 0 && (
            <div className="mt-6">
              <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-600" />
                Sprints
              </h3>
              <div className="space-y-3">
                {task.sprints.map((s) => (
                  <div key={s.id} className="p-3 bg-gray-50 rounded-xl border border-gray-200 shadow-sm">
                    <p className="font-medium text-gray-900 text-sm">{s.title || "Untitled Sprint"}</p>
                    <p className="text-xs text-gray-600 mb-1">Status: {capitalize(s.status.replace("_", " "))}</p>
                    <p className="text-xs text-gray-600">{s.description || "No description."}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-teal-600" />
            Discussion
          </h3>
          <div className="max-h-96 overflow-y-auto space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-inner">
            {taskLogs.length === 0 ? (
              <p className="text-sm text-gray-500 text-center">No discussion yet.</p>
            ) : (
              taskLogs.map((log) => {
                const sprint = log.sprintId
                  ? (isManager
                      ? task.assignees?.flatMap((a) => a.sprints || []).find((s) => s.id === log.sprintId)
                      : task.sprints?.find((s) => s.id === log.sprintId))
                  : null;
                const prefix = sprint ? `[${sprint.title || "Untitled Sprint"}] ` : "[Main] ";
                return (
                  <div key={log.id} className="p-3 bg-white rounded-lg shadow-sm border border-gray-200">
                    <p className="text-xs text-gray-600 mb-1">
                      {prefix}{getUserName(log.userId, users, currentUserId, currentUserName)} ({new Date(log.createdAt).toLocaleString()}):
                    </p>
                    <p className="text-sm text-gray-700">{log.details}</p>
                  </div>
                );
              })
            )}
          </div>
          {isManager && (
            <div className="mt-4">
              <textarea
                value={newLogComment}
                onChange={(e) => setNewLogComment(e.target.value)}
                placeholder="Add a comment..."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200 text-sm text-gray-700 resize-none"
                rows={3}
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onAddLog}
                disabled={!newLogComment || isAddingLog}
                className="mt-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAddingLog ? "Adding..." : "Add Comment"}
              </motion.button>
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-end">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClose}
          className="px-6 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-all duration-200"
        >
          Close
        </motion.button>
      </div>
    </div>
  );
};

export default AssignedTaskDetails;