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
  const [groupByUpdated, setGroupByUpdated] = useState(false);
  const [groupByDeadline, setGroupByDeadline] = useState(false);
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
  const [unreadLogs, setUnreadLogs] = useState(new Set());
  const [newLogComment, setNewLogComment] = useState("");
  const [showAddLogModal, setShowAddLogModal] = useState(false);

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
      case "not_started": return "bg-red-100 text-red-800";
      case "in_progress": return "bg-yellow-100 text-yellow-800";
      case "pending_verification": return "bg-blue-100 text-blue-800";
      case "done": case "verified": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getUserName = (userId) => {
    const user = users.find(u => u.id === userId);
    if (!user) return "Unknown";
    return user.name + (userId === session?.user?.id ? " (you)" : "");
  };

  const groupedTasks = () => {
    if (!groupByUser) return null;
    const groups = {};
    tasks.forEach(task => {
      task.assignees.forEach(assignee => {
        const groupId = assignee.id;
        if (!groups[groupId]) groups[groupId] = [];
        if (!groups[groupId].some(t => t.id === task.id)) {
          groups[groupId].push(task);
        }
      });
    });
    return groups;
  };

  const groupedLatestUpdated = () => {
    if (!groupByUpdated) return null;
    const groups = {};
    latestUpdated.forEach(task => {
      task.assignees.forEach(assignee => {
        const groupId = assignee.id;
        if (!groups[groupId]) groups[groupId] = [];
        if (!groups[groupId].some(t => t.id === task.id)) {
          groups[groupId].push(task);
        }
      });
    });
    return groups;
  };

  const groupedDeadlineApproaching = () => {
    if (!groupByDeadline) return null;
    const groups = {};
    approachingDeadlines.forEach(task => {
      task.assignees.forEach(assignee => {
        const groupId = assignee.id;
        if (!groups[groupId]) groups[groupId] = [];
        if (!groups[groupId].some(t => t.id === task.id)) {
          groups[groupId].push(task);
        }
      });
    });
    return groups;
  };

  const handleRemindUser = async (taskId, userIds, taskTitle) => {
    try {
      const logsRes = await fetch(`/api/member/assignedTasks?taskId=${taskId}&action=logs`);
      const logsData = await logsRes.json();
      const latestLog = logsData.logs?.[0]?.details || "No recent updates";
      const message = `Hi dear, please update me (${latestLog}) for this task "${taskTitle}" :) Thank you`;
      await Promise.all(
        userIds.map(userId =>
          fetch("/api/others/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: session?.user?.id,
              recipientId: userId,
              message,
            }),
          }).then(res => {
            if (!res.ok) {
              throw new Error(`Failed to send chat message to user ${userId}`);
            }
            return res;
          })
        )
      );
      console.log(`Reminder sent for task ${taskId}`);
    } catch (err) {
      setError("Error sending reminder");
      console.error(err);
    }
  };

  const handleAddLog = async (taskId, notifyAssignees = false) => {
    if (!newLogComment) {
      setError("Log comment cannot be empty");
      return;
    }
    try {
      const response = await fetch(`/api/member/assignedTasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          action: "log_added",
          details: newLogComment,
        }),
      });
      if (response.ok) {
        const { log } = await response.json();
        setRecentLogs(prev => [
          { ...log, userId: session?.user?.id },
          ...prev.slice(0, 4)
        ]);
        setTaskLogs(prev => [
          { ...log, userId: session?.user?.id },
          ...prev
        ]);
        setNewLogComment("");
        setShowAddLogModal(false);

        // Send message to all assignees
        if (notifyAssignees) {
          const task = tasks.find(t => t.id === taskId);
          if (task) {
            const message = `Log added to task "${task.title}" by ${getUserName(session?.user?.id)}: ${newLogComment}`;
            await Promise.all(
              task.assignees.map(a => a.id).filter(id => id !== session?.user?.id).map(userId =>
                fetch("/api/others/chat", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    userId: session?.user?.id,
                    recipientId: userId,
                    message,
                  }),
                })
              )
            );
          }
        }
      } else {
        setError("Failed to add log");
      }
    } catch (err) {
      setError("Error adding log");
      console.error(err);
    }
  };

  const handleVerifyTask = async (taskId) => {
    if (!newLogComment) {
      setError("Comment required for verification");
      return;
    }
    try {
      const response = await fetch(`/api/member/assignedTasks/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          status: "verified",
          action: "update_task",
          notifyAssignees: true,
          notifyWhatsapp: false,
          newLogComment,
        }),
      });
      if (response.ok) {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: "verified" } : t));
        setLatestUpdated(prev => prev.map(t => t.id === taskId ? { ...t, status: "verified" } : t));
        setTaskLogs(prev => [
          { id: Date.now(), userId: session?.user?.id, action: "status_update", details: newLogComment, createdAt: new Date() },
          ...prev
        ]);
        setNewLogComment("");
      } else {
        setError("Failed to verify task");
      }
    } catch (err) {
      setError("Error verifying task");
      console.error(err);
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
      logsData.logs.forEach(log => localStorage.setItem(`viewed_${log.id}`, true));
      setUnreadLogs(prev => {
        const newSet = new Set(prev);
        newSet.delete(task.id);
        return newSet;
      });
    } catch (err) {
      setError("Failed to fetch task logs");
      console.error(err);
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
      className="fixed inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 p-8 flex items-center justify-center"
    >
      <div className="w-full h-full bg-white rounded-2xl shadow-2xl p-8 flex flex-col gap-8 overflow-y-auto">
        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 left-4 right-4 text-red-600 text-sm font-medium bg-red-50 p-4 rounded-lg shadow-md"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Dashboard Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-4xl font-bold text-indigo-800">Admin Task Tracking Dashboard</h1>
          <div className="flex items-center space-x-4">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm bg-white shadow-sm"
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setGroupByUser(!groupByUser)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm shadow-md transition-all duration-200"
            >
              {groupByUser ? "Ungroup by User" : "Group by User"}
            </motion.button>
            <div className="relative">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm shadow-md transition-all duration-200"
              >
                Filters
              </motion.button>
              <AnimatePresence>
                {showFilterDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-2xl p-4 z-20 border border-indigo-200"
                  >
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-semibold text-indigo-700 mb-1">User</p>
                        <select
                          value={userFilter}
                          onChange={(e) => setUserFilter(e.target.value)}
                          className="w-full px-3 py-2 border border-indigo-300 rounded-lg text-sm bg-indigo-50 focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
                        >
                          <option value="all">All Users</option>
                          {users.map(user => (
                            <option key={user.id} value={user.id}>{user.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-indigo-700 mb-1">Status</p>
                        <select
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                          className="w-full px-3 py-2 border border-indigo-300 rounded-lg text-sm bg-indigo-50 focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
                        >
                          <option value="all">All Statuses</option>
                          <option value="not_started">Not Started</option>
                          <option value="in_progress">In Progress</option>
                          <option value="pending_verification">Pending Verification</option>
                          <option value="done">Done/Verified</option>
                        </select>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Task Overview - Clickable Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
          <motion.div whileHover={{ scale: 1.05 }} onClick={() => handleSummaryClick("total")} className="cursor-pointer text-center p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-md border border-indigo-200 transition-all duration-200">
            <p className="text-sm font-medium text-indigo-700">Total Tasks</p>
            <p className="text-4xl font-bold text-indigo-800">{totalTasks}</p>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} onClick={() => handleSummaryClick("completed")} className="cursor-pointer text-center p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg shadow-md border border-green-200 transition-all duration-200">
            <p className="text-sm font-medium text-green-700">Completed</p>
            <p className="text-4xl font-bold text-green-800">{completedTasks}</p>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} onClick={() => handleSummaryClick("in_progress")} className="cursor-pointer text-center p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg shadow-md border border-yellow-200 transition-all duration-200">
            <p className="text-sm font-medium text-yellow-700">In Progress</p>
            <p className="text-4xl font-bold text-yellow-800">{inProgressTasks}</p>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} onClick={() => handleSummaryClick("pending_verification")} className="cursor-pointer text-center p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg shadow-md border border-blue-200 transition-all duration-200">
            <p className="text-sm font-medium text-blue-700">Pending Verification</p>
            <p className="text-4xl font-bold text-blue-800">{pendingVerificationTasks}</p>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} onClick={() => handleSummaryClick("not_started")} className="cursor-pointer text-center p-4 bg-gradient-to-r from-red-50 to-red-100 rounded-lg shadow-md border border-red-200 transition-all duration-200">
            <p className="text-sm font-medium text-red-700">Not Started</p>
            <p className="text-4xl font-bold text-red-800">{notStartedTasks}</p>
          </motion.div>
        </div>

        {/* Recent Activity Logs Carousel */}
        <div>
          <h2 className="text-2xl font-bold text-indigo-800 mb-3">Latest Activity Logs</h2>
          <div className="overflow-x-auto whitespace-nowrap pb-2">
            {recentLogs.map((log) => (
              <motion.div
                key={log.id}
                className="inline-block w-80 bg-white rounded-lg shadow-md p-5 mr-4 cursor-pointer relative border border-indigo-100 transition-all duration-200 hover:shadow-lg"
                whileHover={{ scale: 1.05 }}
              >
                {!localStorage.getItem(`viewed_${log.id}`) && (
                  <span className="absolute top-3 right-3 w-3 h-3 bg-red-500 rounded-full"></span>
                )}
                <div className="flex flex-col h-full">
                  <p className="text-base text-indigo-700 font-medium mb-2">
                    {getUserName(log.userId)} {log.action} task {log.taskId}:
                  </p>
                  <p className="text-sm text-gray-700 mb-3">{log.details}</p>
                  <p className="text-xs text-gray-500">{new Date(log.createdAt).toLocaleString()}</p>
                  <div className="flex justify-end mt-auto">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleViewLog(log)}
                      className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-sm hover:bg-indigo-200 transition-all duration-200"
                    >
                      Details
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Two Columns: Latest Updated and Deadline Approaching */}
        <div className="grid grid-cols-2 gap-8">
          <div className="border border-indigo-200 rounded-lg p-5 shadow-md bg-white">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-2xl font-bold text-indigo-800">Latest Updated Tasks</h2>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setGroupByUpdated(!groupByUpdated)}
                className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-sm hover:bg-indigo-200 transition-all duration-200 shadow-sm"
              >
                {groupByUpdated ? "Ungroup by User" : "Group by User"}
              </motion.button>
            </div>
            {groupByUpdated ? (
              Object.entries(groupedLatestUpdated() || {}).map(([userId, userTasks]) => (
                <div key={userId} className="mb-4">
                  <h3 className="text-lg font-semibold text-indigo-700">{getUserName(parseInt(userId))}</h3>
                  <div className="space-y-2 mt-2">
                    {userTasks.map((task, index) => (
                      <motion.div
                        key={`${task.id}-${index}`}
                        className="bg-indigo-50 rounded-lg shadow-sm p-4 border border-indigo-200 transition-all duration-200"
                        whileHover={{ scale: 1.02 }}
                      >
                        <p className="text-sm text-indigo-800 truncate">{task.title}</p>
                        <p className="text-xs text-indigo-600">Assignees: {task.assignees.map(a => a.name).join(", ")}</p>
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(task.status)}`}>
                          {task.status.replace("_", " ")}
                        </span>
                        <div className="flex gap-2 mt-2">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleViewTaskDetails(task)}
                            className="px-3 py-1 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 transition-all duration-200"
                          >
                            Details
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleRemindUser(task.id, task.assignees.map(a => a.id), task.title)}
                            className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-all duration-200"
                          >
                            Remind
                          </motion.button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {latestUpdated.map((task) => (
                  <motion.div
                    key={task.id}
                    className="bg-indigo-50 rounded-lg shadow-sm p-4 border border-indigo-200 transition-all duration-200"
                    whileHover={{ scale: 1.05 }}
                  >
                    <p className="text-sm text-indigo-800 truncate">{task.title}</p>
                    <p className="text-xs text-indigo-600">Assignees: {task.assignees.map(a => a.name).join(", ")}</p>
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(task.status)}`}>
                      {task.status.replace("_", " ")}
                    </span>
                    <div className="flex gap-2 mt-2">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleViewTaskDetails(task)}
                        className="px-3 py-1 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 transition-all duration-200"
                      >
                        Details
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleRemindUser(task.id, task.assignees.map(a => a.id), task.title)}
                        className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-all duration-200"
                      >
                        Remind
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
          <div className="border border-indigo-200 rounded-lg p-5 shadow-md bg-white">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-2xl font-bold text-indigo-800">Deadline Approaching Tasks</h2>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setGroupByDeadline(!groupByDeadline)}
                className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-sm hover:bg-indigo-200 transition-all duration-200 shadow-sm"
              >
                {groupByDeadline ? "Ungroup by User" : "Group by User"}
              </motion.button>
            </div>
            {groupByDeadline ? (
              Object.entries(groupedDeadlineApproaching() || {}).map(([userId, userTasks]) => (
                <div key={userId} className="mb-4">
                  <h3 className="text-lg font-semibold text-indigo-700">{getUserName(parseInt(userId))}</h3>
                  <div className="space-y-2 mt-2">
                    {userTasks.map((task, index) => (
                      <motion.div
                        key={`${task.id}-${index}`}
                        className="bg-indigo-50 rounded-lg shadow-sm p-4 border border-indigo-200 transition-all duration-200"
                        whileHover={{ scale: 1.02 }}
                      >
                        <p className="text-sm text-indigo-800 truncate">{task.title}</p>
                        <p className="text-xs text-indigo-600">Assignees: {task.assignees.map(a => a.name).join(", ")}</p>
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(task.status)}`}>
                          {task.status.replace("_", " ")}
                        </span>
                        <div className="flex gap-2 mt-2">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleViewTaskDetails(task)}
                            className="px-3 py-1 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 transition-all duration-200"
                          >
                            Details
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleRemindUser(task.id, task.assignees.map(a => a.id), task.title)}
                            className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-all duration-200"
                          >
                            Remind
                          </motion.button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {approachingDeadlines.map((task) => (
                  <motion.div
                    key={task.id}
                    className="bg-indigo-50 rounded-lg shadow-sm p-4 border border-indigo-200 transition-all duration-200"
                    whileHover={{ scale: 1.05 }}
                  >
                    <p className="text-sm text-indigo-800 truncate">{task.title}</p>
                    <p className="text-xs text-indigo-600">Assignees: {task.assignees.map(a => a.name).join(", ")}</p>
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(task.status)}`}>
                      {task.status.replace("_", " ")}
                    </span>
                    <div className="flex gap-2 mt-2">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleViewTaskDetails(task)}
                        className="px-3 py-1 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 transition-all duration-200"
                      >
                        Details
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleRemindUser(task.id, task.assignees.map(a => a.id), task.title)}
                        className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-all duration-200"
                      >
                        Remind
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Grouped by User */}
        {groupByUser && (
          <div>
            <h2 className="text-2xl font-bold text-indigo-800 mb-3">Tasks Grouped by User</h2>
            {Object.entries(groupedTasks() || {}).map(([userId, userTasks]) => (
              <div key={userId} className="mb-4">
                <h3 className="text-lg font-semibold text-indigo-700">{getUserName(parseInt(userId))}</h3>
                <div className="space-y-2">
                  {userTasks.map((task, index) => (
                    <motion.div
                      key={`${task.id}-${index}`}
                      className="bg-indigo-50 rounded-lg shadow-sm p-4 border border-indigo-200 transition-all duration-200"
                      whileHover={{ scale: 1.02 }}
                    >
                      <p className="text-sm text-indigo-800 truncate">{task.title}</p>
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
                className="bg-white rounded-2xl p-8 w-full max-w-6xl overflow-y-auto max-h-[90vh] shadow-2xl border border-indigo-200"
              >
                <h2 className="text-2xl font-bold text-indigo-800 mb-6">{selectedTask.title}</h2>
                <div className="flex flex-row gap-6 mb-6">
                  <div className="flex-1 space-y-4">
                    <p className="text-base"><strong className="text-indigo-700">Description:</strong> {selectedTask.description || "N/A"}</p>
                    <p className="text-base"><strong className="text-indigo-700">Assignees:</strong> {selectedTask.assignees.map(a => a.name).join(", ")}</p>
                    <p className="text-base"><strong className="text-indigo-700">Status:</strong> {selectedTask.status.replace("_", " ")}</p>
                    <p className="text-base"><strong className="text-indigo-700">Deadline:</strong> {selectedTask.deadline ? new Date(selectedTask.deadline).toLocaleString() : "N/A"}</p>
                    <p className="text-base"><strong className="text-indigo-700">Resources:</strong> {selectedTask.resources || "N/A"}</p>
                    {selectedTask.sprints && selectedTask.sprints.filter(sprint => sprint !== null).length > 0 && (
                      <div className="mt-6">
                        <h3 className="text-xl font-semibold text-indigo-700">Sprints</h3>
                        {selectedTask.sprints.filter(sprint => sprint !== null).map(sprint => (
                          <div key={sprint.id} className="mt-3 bg-indigo-50 p-4 rounded-lg shadow-sm border border-indigo-200">
                            <p className="text-base"><strong className="text-indigo-700">{sprint.title || "Untitled Sprint"}:</strong> {sprint.description || "N/A"}</p>
                            <p className="text-base">Status: {sprint.status.replace("_", " ")}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-indigo-700 mb-3">Logs</h3>
                    <div className="max-h-64 overflow-y-auto space-y-3 mb-6">
                      {taskLogs.length > 0 ? (
                        taskLogs.map(log => (
                          <div key={log.id} className="p-4 bg-indigo-50 rounded-lg shadow-sm border border-indigo-200 transition-all duration-200">
                            <p className="text-base text-indigo-800">{getUserName(log.userId)}: {log.details}</p>
                            <p className="text-xs text-gray-500 mt-1">{new Date(log.createdAt).toLocaleString()}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-base text-gray-500">No logs available.</p>
                      )}
                    </div>
                    <div className="mt-6">
                      <h4 className="text-base font-semibold text-indigo-700 mb-2">Add New Log</h4>
                      <textarea
                        value={newLogComment}
                        onChange={(e) => setNewLogComment(e.target.value)}
                        placeholder="Add a comment to the task discussion..."
                        className="w-full px-4 py-3 border border-indigo-300 rounded-lg bg-indigo-50 focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-gray-700 mb-3 transition-all duration-200"
                      />
                      {selectedTask.status === "pending_verification" && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleVerifyTask(selectedTask.id)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-all duration-200 mr-2"
                          disabled={!newLogComment}
                        >
                          Verify Task
                        </motion.button>
                      )}
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleAddLog(selectedTask.id, true)}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-all duration-200"
                        disabled={!newLogComment}
                      >
                        Add Log & Notify Assignees
                      </motion.button>
                    </div>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowDetailsModal(false)}
                  className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all duration-200 shadow-md"
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
                className="bg-white rounded-2xl p-8 w-full max-w-6xl overflow-y-auto max-h-[90vh] shadow-2xl border border-indigo-200"
              >
                <h2 className="text-2xl font-bold text-indigo-800 mb-6">Tasks in {selectedSummaryCategory.toUpperCase()}</h2>
                <div className="space-y-6">
                  {categoryTasks.map((task) => (
                    <motion.div
                      key={task.id}
                      className="bg-indigo-50 rounded-lg shadow-md p-5 border border-indigo-200 transition-all duration-200"
                      whileHover={{ scale: 1.05 }}
                    >
                      <p className="text-base text-indigo-800 truncate">{task.title}</p>
                      <p className="text-sm text-indigo-600">Assignees: {task.assignees.map(a => a.name).join(", ")}</p>
                      <span className={`text-sm px-3 py-1 rounded-full ${getStatusColor(task.status)}`}>
                        {task.status.replace("_", " ")}
                      </span>
                      <div className="flex gap-3 mt-3">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            setShowSummaryModal(false);
                            handleViewTaskDetails(task);
                          }}
                          className="px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 transition-all duration-200"
                        >
                          Details
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleRemindUser(task.id, task.assignees.map(a => a.id), task.title)}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-all duration-200"
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
                  className="mt-6 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all duration-200 shadow-md"
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