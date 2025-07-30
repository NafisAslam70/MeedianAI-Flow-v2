
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
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
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
  const [latestAssigned, setLatestAssigned] = useState([]);
  const [latestUpdated, setLatestUpdated] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);

  const { data: usersData } = useSWR("/api/member/users", fetcher);
  const { data: tasksData } = useSWR(`/api/managersCommon/assign-tasks?date=${selectedDate}&user=${userFilter}&status=${statusFilter}`, fetcher);
  const { data: logsData } = useSWR("/api/managersCommon/assigned-task-logs", fetcher);

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
    if (tasksData?.assignedTasks) {
      const filteredTasks = tasksData.assignedTasks;
      setTasks(filteredTasks);

      // Compute summaries
      setTotalTasks(filteredTasks.length);
      setCompletedTasks(filteredTasks.filter(t => t.status === "done" || t.status === "verified").length);
      setInProgressTasks(filteredTasks.filter(t => t.status === "in_progress").length);
      setNotStartedTasks(filteredTasks.filter(t => t.status === "not_started").length);
      setPendingVerificationTasks(filteredTasks.filter(t => t.status === "pending_verification").length);

      // Latest assigned (sort by createdAt desc, top 5)
      const sortedAssigned = [...filteredTasks].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
      setLatestAssigned(sortedAssigned);

      // Latest updated (sort by updatedAt desc, top 5)
      const sortedUpdated = [...filteredTasks].sort((a, b) => new Date(b.updatedAt) - new Date(a.createdAt)).slice(0, 5);
      setLatestUpdated(sortedUpdated);
    }
  }, [tasksData]);

  useEffect(() => {
    if (logsData?.logs) {
      // Recent logs (top 5)
      const sortedLogs = [...logsData.logs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
      setRecentLogs(sortedLogs);
    }
  }, [logsData]);

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

  const handleRemindUser = (taskId, userId, taskTitle) => {
    // Placeholder for reminding logic (e.g., send notification)
    console.log(`Reminding user ${userId} for task ${taskId}: ${taskTitle}`);
    // You can integrate with the chat or WhatsApp API here
  };

  const handleViewTaskDetails = (taskId) => {
    // Navigate to task details or open modal
    console.log(`Viewing details for task ${taskId}`);
    // router.push(`/dashboard/admin/task/${taskId}`);
  };

  if (status === "loading") {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-100">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-2xl font-semibold text-gray-700"
        >
          Loading...
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 bg-gray-100 p-8 flex items-center justify-center"
    >
      <div className="w-full h-full bg-white rounded-2xl shadow-2xl p-8 flex flex-col gap-8 overflow-y-auto">
        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 left-4 right-4 text-red-600 text-sm font-medium bg-red-50 p-4 rounded-lg"
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
              className="px-3 py-1 border rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setGroupByUser(!groupByUser)}
              className="px-3 py-1 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm"
            >
              {groupByUser ? "Ungroup by User" : "Group by User"}
            </motion.button>
            <div className="relative">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="px-3 py-1 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm"
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
                      className="w-full px-2 py-1 border rounded text-sm mb-2"
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
                      className="w-full px-2 py-1 border rounded text-sm"
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

        {/* Task Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          <div className="text-center p-4 bg-gradient-to-r from-teal-50 to-teal-100 rounded-lg">
            <p className="text-sm font-medium text-gray-700">Total Tasks</p>
            <p className="text-4xl font-bold text-teal-800">{totalTasks}</p>
          </div>
          <div className="text-center p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg">
            <p className="text-sm font-medium text-gray-700">Completed</p>
            <p className="text-4xl font-bold text-green-700">{completedTasks}</p>
          </div>
          <div className="text-center p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg">
            <p className="text-sm font-medium text-gray-700">In Progress</p>
            <p className="text-4xl font-bold text-yellow-700">{inProgressTasks}</p>
          </div>
          <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
            <p className="text-sm font-medium text-gray-700">Pending Verification</p>
            <p className="text-4xl font-bold text-blue-700">{pendingVerificationTasks}</p>
          </div>
          <div className="text-center p-4 bg-gradient-to-r from-red-50 to-red-100 rounded-lg">
            <p className="text-sm font-medium text-gray-700">Not Started</p>
            <p className="text-4xl font-bold text-red-700">{notStartedTasks}</p>
          </div>
        </div>

        {/* Latest Assigned Tasks */}
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Latest Assigned Tasks</h2>
          <div className="overflow-x-auto whitespace-nowrap pb-2">
            {latestAssigned.map((task) => (
              <motion.div
                key={task.id}
                className="inline-block w-64 bg-white/90 rounded-lg shadow-md p-3 mr-3"
                whileHover={{ scale: 1.05 }}
              >
                <p className="text-sm font-medium text-gray-700 truncate">{task.title}</p>
                <p className="text-xs text-gray-600">Assignees: {task.assignees.map(a => a.name).join(", ")}</p>
                <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(task.status)}`}>
                  {task.status.replace("_", " ")}
                </span>
                <div className="flex gap-2 mt-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleViewTaskDetails(task.id)}
                    className="px-2 py-1 bg-gray-600 text-white rounded-lg text-xs"
                  >
                    Details
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleRemindUser(task.id, task.assignees[0]?.id, task.title)}
                    className="px-2 py-1 bg-teal-600 text-white rounded-lg text-xs"
                  >
                    Remind
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Latest Updated Tasks */}
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Latest Updated Tasks</h2>
          <div className="overflow-x-auto whitespace-nowrap pb-2">
            {latestUpdated.map((task) => (
              <motion.div
                key={task.id}
                className="inline-block w-64 bg-white/90 rounded-lg shadow-md p-3 mr-3"
                whileHover={{ scale: 1.05 }}
              >
                <p className="text-sm font-medium text-gray-700 truncate">{task.title}</p>
                <p className="text-xs text-gray-600">Assignees: {task.assignees.map(a => a.name).join(", ")}</p>
                <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(task.status)}`}>
                  {task.status.replace("_", " ")}
                </span>
                <div className="flex gap-2 mt-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleViewTaskDetails(task.id)}
                    className="px-2 py-1 bg-gray-600 text-white rounded-lg text-xs"
                  >
                    Details
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleRemindUser(task.id, task.assignees[0]?.id, task.title)}
                    className="px-2 py-1 bg-teal-600 text-white rounded-lg text-xs"
                  >
                    Remind
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Recent Activity Logs */}
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Recent Activity Logs</h2>
          <div className="space-y-2">
            {recentLogs.map((log) => (
              <motion.div
                key={log.id}
                className="bg-white/90 rounded-lg shadow-md p-3"
                whileHover={{ scale: 1.02 }}
              >
                <p className="text-sm text-gray-700">
                  {getUserName(log.userId)} {log.action} task {log.taskId}: {log.details}
                </p>
                <p className="text-xs text-gray-500">{new Date(log.createdAt).toLocaleString()}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Grouped by User */}
        {groupByUser && (
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Tasks Grouped by User</h2>
            {Object.entries(groupedTasks()).map(([userId, userTasks]) => (
              <div key={userId} className="mb-4">
                <h3 className="text-lg font-semibold text-gray-700">{getUserName(parseInt(userId))}</h3>
                <div className="space-y-2">
                  {userTasks.map((task, index) => (
                    <motion.div
                      key={`${task.id}-${index}`} // Ensure unique key even if potential duplicates
                      className="bg-white/90 rounded-lg shadow-md p-3"
                      whileHover={{ scale: 1.02 }}
                    >
                      <p className="text-sm font-medium text-gray-700 truncate">{task.title}</p>
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
      </div>
    </motion.div>
  );
}
