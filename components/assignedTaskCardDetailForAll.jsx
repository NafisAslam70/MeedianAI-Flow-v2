"use client";
import { motion } from "framer-motion";

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
    <div>
      <div className="flex flex-row gap-4 mb-4">
        <div className="flex-1 space-y-3">
          <p className="text-sm font-medium text-gray-700"><strong>Title:</strong> {task?.title || "Untitled Task"}</p>
          <p className="text-sm font-medium text-gray-700"><strong>Description:</strong> {task?.description || "No description"}</p>
          <p className="text-sm font-medium text-gray-700">
            <strong>Assigned By:</strong> {getUserName(task?.createdBy, users, currentUserId, currentUserName)}
          </p>
          {!isManager && (
            <p className="text-sm font-medium text-gray-700"><strong>Status:</strong> {(task?.status || "not_started").replace("_", " ")}</p>
          )}
          <p className="text-sm font-medium text-gray-700">
            <strong>Assigned Date:</strong> {task?.assignedDate ? new Date(task.assignedDate).toLocaleDateString() : "N/A"}
          </p>
          <p className="text-sm font-medium text-gray-700">
            <strong>Deadline:</strong> {task?.deadline ? new Date(task.deadline).toLocaleDateString() : "No deadline"}
          </p>
          <p className="text-sm font-medium text-gray-700">
            <strong>Resources:</strong> {task?.resources || "No resources"}
          </p>
          {isManager && task.assignees && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700">Assignees</h3>
              {task.assignees.map((assignee) => (
                <div key={assignee.id} className="mt-2 bg-gray-50 p-3 rounded border">
                  <p className="font-medium">{getUserName(assignee.id, users, currentUserId, currentUserName)}</p>
                  <p className="text-sm text-gray-600">Status: {assignee.status?.replace("_", " ") || "N/A"}</p>
                  <select
                    value={newTaskStatuses[assignee.id] || assignee.status}
                    onChange={(e) => setNewTaskStatuses({ ...newTaskStatuses, [assignee.id]: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg mb-3 bg-gray-50 focus:ring-2 focus:ring-teal-500 text-sm font-medium text-gray-700"
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
                      className="px-4 py-2 bg-teal-600 text-white rounded-md text-sm font-medium"
                    >
                      Update Task Status
                    </motion.button>
                  )}
                  {assignee.sprints?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700">Sprints</h4>
                      <ul className="space-y-2">
                        {assignee.sprints.map((s) => (
                          <li key={s.id} className="p-2 bg-white rounded border">
                            <p className="font-medium">{s.title || "Untitled Sprint"}</p>
                            <p className="text-sm text-gray-600">Status: {s.status.replace("_", " ")}</p>
                            <p className="text-sm text-gray-600">{s.description || "No description."}</p>
                            <select
                              value={newSprintStatuses[`${assignee.id}-${s.id}`] || s.status}
                              onChange={(e) => setNewSprintStatuses({ ...newSprintStatuses, [`${assignee.id}-${s.id}`]: e.target.value })}
                              className="w-full px-4 py-2 border rounded-lg mb-3 bg-gray-50 focus:ring-2 focus:ring-teal-500 text-sm font-medium text-gray-700"
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
                              className="px-4 py-2 bg-teal-600 text-white rounded-md text-sm font-medium"
                            >
                              Update Sprint Status
                            </motion.button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {!isManager && task.sprints?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700">Sprints</h3>
              <ul className="space-y-2">
                {task.sprints.map((s) => (
                  <li key={s.id} className="p-2 bg-gray-50 rounded border">
                    <p className="font-medium">{s.title || "Untitled Sprint"}</p>
                    <p className="text-sm text-gray-600">Status: {s.status.replace("_", " ")}</p>
                    <p className="text-sm text-gray-600">{s.description || "No description."}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Discussion</h3>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {taskLogs.length === 0 ? (
              <p className="text-sm text-gray-500">No discussion yet.</p>
            ) : (
              taskLogs.map((log) => {
                const sprint = log.sprintId
                  ? (isManager
                      ? task.assignees?.flatMap((a) => a.sprints || []).find((s) => s.id === log.sprintId)
                      : task.sprints?.find((s) => s.id === log.sprintId))
                  : null;
                const prefix = sprint ? `[${sprint.title || "Untitled Sprint"}] ` : "[Main] ";
                return (
                  <div key={log.id} className="p-3 bg-gray-50 rounded-lg shadow-sm border border-gray-200">
                    <p className="text-xs text-gray-600">
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
                  className="w-full px-4 py-2 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-teal-500 text-sm font-medium text-gray-700 mb-3"
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onAddLog}
                  disabled={!newLogComment || isAddingLog}
                  className="px-4 py-2 bg-teal-600 text-white rounded-md text-sm font-medium"
                >
                  {isAddingLog ? "Adding..." : "Add Log"}
                </motion.button>
              </div>
          )}
        </div>
      </div>
      <div className="flex justify-end mt-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClose}
          className="px-4 py-2 bg-gray-500 text-white rounded-md text-sm font-medium"
        >
          Close
        </motion.button>
      </div>
    </div>
  );
};

export default AssignedTaskDetails;
