"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import useSWR from "swr";

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function AdminDashboard() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [totalTasks, setTotalTasks] = useState(0);
  const [completedTasks, setCompletedTasks] = useState(0);
  const [inProgressTasks, setInProgressTasks] = useState(0);
  const [notStartedTasks, setNotStartedTasks] = useState(0);
  const [pendingVerificationTasks, setPendingVerificationTasks] = useState(0);
  const [userFilter, setUserFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [groupByUser, setGroupByUser] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [latestUpdated, setLatestUpdated] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [selectedSummaryCategory, setSelectedSummaryCategory] = useState(null);
  const [categoryTasks, setCategoryTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskLogs, setTaskLogs] = useState([]);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [unreadLogs, setUnreadLogs] = useState(new Set()); // Track tasks with unread logs

  const { data: usersData } = useSWR("/api/member/users", fetcher);
  const { data: dashboardData } = useSWR(`/api/managersCommon/dashboard?user=${userFilter}&status=${statusFilter}${selectedDate ? `&date=${selectedDate}` : ''}`, fetcher);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "admin") {
      router.push(
        session?.user?.role === "team_manager" ? "/dashboard/team_manager" : "/dashboard/member"
      );
    }
  }, [status, session, router]);

  useEffect(() => {
    if (usersData?.users) {
      setUsers(usersData.users);
    }
  }, [usersData]);

  useEffect(() => {
    if (dashboardData) {
      const filteredTasks = dashboardData.assignedTasks || [];
      setTasks(filteredTasks);

      // Set summaries from backend
      setTotalTasks(dashboardData.summaries?.totalTasks || 0);
      setCompletedTasks(dashboardData.summaries?.completedTasks || 0);
      setInProgressTasks(dashboardData.summaries?.inProgressTasks || 0);
      setNotStartedTasks(dashboardData.summaries?.notStartedTasks || 0);
      setPendingVerificationTasks(dashboardData.summaries?.pendingVerificationTasks || 0);

      // Latest updated from backend
      setLatestUpdated(dashboardData.latestUpdated || []);

      // Recent logs from backend
      setRecentLogs(dashboardData.recentLogs || []);

      // Unread logs using localStorage
      const unread = new Set();
      (dashboardData.recentLogs || []).forEach(log => {
        if (!localStorage.getItem(`viewed_${log.id}`)) {
          unread.add(log.taskId);
        }
      });
      setUnreadLogs(unread);
    }
  }, [dashboardData]);

  const getStatusColor = (status) => {
    switch (status) {
      case "not_started": return "bg-red-50 text-red-700";
      case "in_progress": return "bg-yellow-50 text-yellow-700";
      case "pending_verification": return "bg-blue-50 text-blue-700";
      case "done": case "verified": return "bg-green-50 text-green-700";
      default: return "bg-gray-50 text-gray-700";
    }
  };

  const getUserName = (userId) => {
    return users.find(u => u.id === userId)?.name || "Unknown";
  };

  const groupedTasks = () => {
    if (!groupByUser) return null;
    const groups = {};
    tasks.forEach(task => {
      task.assignees.forEach(assignee => {
        const groupId = assignee.id;
        if (!groups[groupId]) groups[groupId] = [];
        // Avoid duplicates
        if (!groups[groupId].some(t => t.id === task.id)) {
          groups[groupId].push(task);
        }
      });
    });
    return groups;
  };

  const handleRemindUser = async (taskId, userId, taskTitle) => {
    try {
      const response = await fetch(`/api/member/assignedTasks/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          notifyAssignees: true,
          notifyWhatsapp: true,
          newLogComment: `Reminder for task "${taskTitle}"`,
        }),
      });
      if (response.ok) {
        console.log(`Reminder sent for task ${taskId} to user ${userId}`);
      } else {
        setError("Failed to send reminder");
      }
    } catch (err) {
      setError("Error sending reminder");
    }
  };

  const fetchTask = async (taskId) => {
    try {
      const res = await fetch(`/api/managersCommon/assign-tasks?taskId=${taskId}`);
      const data = await res.json();
      return data.assignedTasks?.[0] || null;
    } catch (err) {
      setError("Failed to fetch task");
      return null;
    }
  };

  const handleViewTaskDetails = async (task) => {
    setSelectedTask(task);
    try {
      const logsRes = await fetch(`/api/member/assignedTasks?taskId=${task.id}&action=logs`);
      const logsData = await logsRes.json();
      setTaskLogs(logsData.logs || []);
      // Mark as viewed
      logsData.logs.forEach(log => localStorage.setItem(`viewed_${log.id}`, true));
      setUnreadLogs(prev => {
        const newSet = new Set(prev);
        newSet.delete(task.id);
        return newSet;
      });
    } catch (err) {
      setError("Failed to fetch task logs");
    }
    setShowDetailsModal(true);
  };

  const handleViewLog = async (log) => {
    let task = tasks.find(t => t.id === log.taskId);
    if (!task) {
      task = await fetchTask(log.taskId);
    }
    if (task) {
      handleViewTaskDetails(task);
    } else {
      setError("Task not found");
    }
  };

  const handleSummaryClick = (category) => {
    let filtered = [];
    switch (category) {
      case "total":
        filtered = tasks;
        break;
      case "completed":
        filtered = tasks.filter(t => t.status === "done" || t.status === "verified");
        break;
      case "in_progress":
        filtered = tasks.filter(t => t.status === "in_progress");
        break;
      case "pending_verification":
        filtered = tasks.filter(t => t.status === "pending_verification");
        break;
      case "not_started":
        filtered = tasks.filter(t => t.status === "not_started");
        break;
    }
    setCategoryTasks(filtered);
    setSelectedSummaryCategory(category);
    setShowSummaryModal(true);
  };

  if (status === "loading") {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-50">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-2xl font-semibold text-gray-600"
        >
          Loading...
        </motion.div>
      </div>
    );
  }

  const approachingDeadlines = tasks
    .filter(t => t.deadline && new Date(t.deadline) > new Date() && new Date(t.deadline) < new Date(new Date().getTime() + 3 * 24 * 60 * 60 * 1000) && t.status !== "done" && t.status !== "verified")
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .slice(0, 10);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 bg-gray-50 p-8 flex items-center justify-center"
    >
      <div className="w-full h-full bg-white rounded-xl shadow-lg p-8 flex flex-col gap-8 overflow-y-auto">
        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 left-4 right-4 text-red-600 text-sm font-medium bg-red-50 p-4 rounded-lg shadow-sm"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Dashboard Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-800">Admin Task Tracking Dashboard</h1>
          <div className="flex items-center space-x-4">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white"
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setGroupByUser(!groupByUser)}
              className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm shadow-sm"
            >
              {groupByUser ? "Ungroup by User" : "Group by User"}
            </motion.button>
            <div className="relative">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm shadow-sm"
              >
                Filters
              </motion.button>
              <AnimatePresence>
                {showFilterDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg p-3 z-20"
                  >
                    <p className="text-sm font-medium text-gray-700 mb-2">User</p>
                    <select
                      value={userFilter}
                      onChange={(e) => setUserFilter(e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm mb-2 bg-white"
                    >
                      <option value="all">All Users</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>{user.name}</option>
                      ))}
                    </select>
                    <p className="text-sm font-medium text-gray-700 mb-2">Status</p>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm bg-white"
                    >
                      <option value="all">All Statuses</option>
                      <option value="not_started">Not Started</option>
                      <option value="in_progress">In Progress</option>
                      <option value="pending_verification">Pending Verification</option>
                      <option value="done">Done/Verified</option>
                    </select>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Task Overview - Clickable Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
          <motion.div whileHover={{ scale: 1.05 }} onClick={() => handleSummaryClick("total")} className="cursor-pointer text-center p-4 bg-white rounded-lg shadow-sm border border-gray-200">
            <p className="text-sm font-medium text-gray-600">Total Tasks</p>
            <p className="text-4xl font-bold text-gray-800">{totalTasks}</p>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} onClick={() => handleSummaryClick("completed")} className="cursor-pointer text-center p-4 bg-white rounded-lg shadow-sm border border-gray-200">
            <p className="text-sm font-medium text-gray-600">Completed</p>
            <p className="text-4xl font-bold text-green-600">{completedTasks}</p>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} onClick={() => handleSummaryClick("in_progress")} className="cursor-pointer text-center p-4 bg-white rounded-lg shadow-sm border border-gray-200">
            <p className="text-sm font-medium text-gray-600">In Progress</p>
            <p className="text-4xl font-bold text-yellow-600">{inProgressTasks}</p>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} onClick={() => handleSummaryClick("pending_verification")} className="cursor-pointer text-center p-4 bg-white rounded-lg shadow-sm border border-gray-200">
            <p className="text-sm font-medium text-gray-600">Pending Verification</p>
            <p className="text-4xl font-bold text-blue-600">{pendingVerificationTasks}</p>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} onClick={() => handleSummaryClick("not_started")} className="cursor-pointer text-center p-4 bg-white rounded-lg shadow-sm border border-gray-200">
            <p className="text-sm font-medium text-gray-600">Not Started</p>
            <p className="text-4xl font-bold text-red-600">{notStartedTasks}</p>
          </motion.div>
        </div>

        {/* Recent Activity Logs Carousel */}
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Latest Activity Logs</h2>
          <div className="overflow-x-auto whitespace-nowrap pb-2">
            {recentLogs.map((log) => (
              <motion.div
                key={log.id}
                className="inline-block w-64 bg-white rounded-lg shadow-sm p-4 mr-3 cursor-pointer relative border border-gray-200"
                whileHover={{ scale: 1.05 }}
                onClick={() => handleViewLog(log)}
              >
                {!localStorage.getItem(`viewed_${log.id}`) && (
                  <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full"></span>
                )}
                <p className="text-sm text-gray-700">
                  {getUserName(log.userId)} {log.action} task {log.taskId}: {log.details}
                </p>
                <p className="text-xs text-gray-500">{new Date(log.createdAt).toLocaleString()}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Two Columns: Latest Updated and Deadline Approaching */}
        <div className="grid grid-cols-2 gap-8">
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Latest Updated Tasks</h2>
            <div className="grid grid-cols-2 gap-4">
              {latestUpdated.map((task) => (
                <motion.div
                  key={task.id}
                  className="bg-white rounded-lg shadow-sm p-4 border border-gray-200"
                  whileHover={{ scale: 1.05 }}
                >
                  <p className="text-sm text-gray-800 truncate">{task.title}</p>
                  <p className="text-xs text-gray-600">Assignees: {task.assignees.map(a => a.name).join(", ")}</p>
                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(task.status)}`}>
                    {task.status.replace("_", " ")}
                  </span>
                  <div className="flex gap-2 mt-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleViewTaskDetails(task)}
                      className="px-3 py-1 bg-gray-100 rounded-lg text-sm hover:bg-gray-200"
                    >
                      Details
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleRemindUser(task.id, task.assignees[0]?.id, task.title)}
                      className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                    >
                      Remind
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Deadline Approaching Tasks</h2>
            <div className="grid grid-cols-2 gap-4">
              {approachingDeadlines.map((task) => (
                <motion.div
                  key={task.id}
                  className="bg-white rounded-lg shadow-sm p-4 border border-gray-200"
                  whileHover={{ scale: 1.05 }}
                >
                  <p className="text-sm text-gray-800 truncate">{task.title}</p>
                  <p className="text-xs text-gray-600">Assignees: {task.assignees.map(a => a.name).join(", ")}</p>
                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(task.status)}`}>
                    {task.status.replace("_", " ")}
                  </span>
                  <div className="flex gap-2 mt-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleViewTaskDetails(task)}
                      className="px-3 py-1 bg-gray-100 rounded-lg text-sm hover:bg-gray-200"
                    >
                      Details
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleRemindUser(task.id, task.assignees[0]?.id, task.title)}
                      className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                    >
                      Remind
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Grouped by User */}
        {groupByUser && (
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Tasks Grouped by User</h2>
            {Object.entries(groupedTasks() || {}).map(([userId, userTasks]) => (
              <div key={userId} className="mb-4">
                <h3 className="text-lg font-semibold text-gray-700">{getUserName(parseInt(userId))}</h3>
                <div className="space-y-2">
                  {userTasks.map((task, index) => (
                    <motion.div
                      key={`${task.id}-${index}`} // Ensure unique key
                      className="bg-white rounded-lg shadow-sm p-4 border border-gray-200"
                      whileHover={{ scale: 1.02 }}
                    >
                      <p className="text-sm text-gray-800 truncate">{task.title}</p>
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(task.status)}`}>
                        {task.status.replace("_", " ")}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Task Details Modal */}
        <AnimatePresence>
          {showDetailsModal && selectedTask && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-xl p-6 w-full max-w-lg overflow-y-auto max-h-[80vh] shadow-lg"
              >
                <h2 className="text-xl font-bold text-gray-800 mb-4">{selectedTask.title}</h2>
                <p><strong>Description:</strong> {selectedTask.description || "N/A"}</p>
                <p><strong>Assignees:</strong> {selectedTask.assignees.map(a => a.name).join(", ")}</p>
                <p><strong>Status:</strong> {selectedTask.status.replace("_", " ")}</p>
                <p><strong>Deadline:</strong> {selectedTask.deadline ? new Date(selectedTask.deadline).toLocaleString() : "N/A"}</p>
                <p><strong>Resources:</strong> {selectedTask.resources || "N/A"}</p>
                {selectedTask.sprints && selectedTask.sprints.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-lg font-semibold">Sprints</h3>
                    {selectedTask.sprints.map(sprint => (
                      <div key={sprint.id} className="mt-2">
                        <p><strong>{sprint.title}:</strong> {sprint.description}</p>
                        <p>Status: {sprint.status.replace("_", " ")}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-4">
                  <h3 className="text-lg font-semibold">Logs</h3>
                  {taskLogs.length > 0 ? (
                    taskLogs.map(log => (
                      <div key={log.id} className="mt-2">
                        <p>{getUserName(log.userId)}: {log.details}</p>
                        <p className="text-xs text-gray-500">{new Date(log.createdAt).toLocaleString()}</p>
                      </div>
                    ))
                  ) : (
                    <p>No logs available.</p>
                  )}
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowDetailsModal(false)}
                  className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Close
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Summary Modal */}
        <AnimatePresence>
          {showSummaryModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-xl p-6 w-full max-w-4xl overflow-y-auto max-h-[80vh] shadow-lg"
              >
                <h2 className="text-xl font-bold text-gray-800 mb-4">Tasks in {selectedSummaryCategory.toUpperCase()}</h2>
                <div className="space-y-4">
                  {categoryTasks.map((task) => (
                    <motion.div
                      key={task.id}
                      className="bg-white rounded-lg shadow-sm p-4 border border-gray-200"
                      whileHover={{ scale: 1.05 }}
                    >
                      <p className="text-sm text-gray-800 truncate">{task.title}</p>
                      <p className="text-xs text-gray-600">Assignees: {task.assignees.map(a => a.name).join(", ")}</p>
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(task.status)}`}>
                        {task.status.replace("_", " ")}
                      </span>
                      <div className="flex gap-2 mt-2">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            setShowSummaryModal(false);
                            handleViewTaskDetails(task);
                          }}
                          className="px-3 py-1 bg-gray-100 rounded-lg text-sm hover:bg-gray-200"
                        >
                          Details
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleRemindUser(task.id, task.assignees[0]?.id, task.title)}
                          className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                        >
                          Remind
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowSummaryModal(false)}
                  className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Close
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}