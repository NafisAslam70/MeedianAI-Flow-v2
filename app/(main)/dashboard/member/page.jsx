// pages/MemberDashboard.jsx
"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import AssignedTaskCards from "@/components/member/AssignedTaskCards";
import ChatBox from "@/components/ChatBox";

// In-memory cache for tasks
const taskCache = new Map();

export default function MemberDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [routineTasks, setRoutineTasks] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [openCloseTimes, setOpenCloseTimes] = useState(null);
  const [canCloseDay, setCanCloseDay] = useState(false);
  const [isLoadingAssignedTasks, setIsLoadingAssignedTasks] = useState(false);
  const [isLoadingRoutineTasks, setIsLoadingRoutineTasks] = useState(false);
  const [assignedTaskSummary, setAssignedTaskSummary] = useState({
    total: 0,
    notStarted: 0,
    inProgress: 0,
    pendingVerification: 0,
    completed: 0,
  });
  const [routineTaskSummary, setRoutineTaskSummary] = useState({
    total: 0,
    notStarted: 0,
    inProgress: 0,
    pendingVerification: 0,
    completed: 0,
  });
  const [selectedTask, setSelectedTask] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showCloseDayModal, setShowCloseDayModal] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [selectedSprint, setSelectedSprint] = useState("");
  const [sprints, setSprints] = useState([]);
  const [taskLogs, setTaskLogs] = useState([]);
  const [newLogComment, setNewLogComment] = useState("");
  const [closeDayTasks, setCloseDayTasks] = useState([]);
  const [closeDayComment, setCloseDayComment] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [sendNotification, setSendNotification] = useState(true);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "member") {
      router.push(
        session?.user?.role === "admin" ? "/dashboard/admin" : "/dashboard/team_manager"
      );
    }
  }, [status, session, router]);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const res = await fetch("/api/member/profile");
        const data = await res.json();
        if (res.ok) {
          setUser(data.user);
          fetchOpenCloseTimes(data.user.type);
        } else {
          setError(data.error || "Failed to fetch user data");
          setTimeout(() => setError(""), 3000);
        }
      } catch (err) {
        setError("Failed to fetch user data");
        setTimeout(() => setError(""), 3000);
      }
    };

    const fetchUsers = async () => {
      try {
        const res = await fetch("/api/member/users");
        const data = await res.json();
        if (res.ok) {
          setUsers(data.users || []);
        } else {
          setError(data.error || "Failed to fetch users");
          setTimeout(() => setError(""), 3000);
        }
      } catch (err) {
        setError("Failed to fetch users");
        setTimeout(() => setError(""), 3000);
      }
    };

    const fetchOpenCloseTimes = async (userType) => {
      if (!userType) {
        console.error("User type is undefined");
        setError("User type is missing");
        return;
      }

      try {
        const res = await fetch(`/api/member/openCloseTimes?userType=${userType}`);
        const data = await res.json();

        if (res.ok) {
          setOpenCloseTimes(data.times);
          checkClosingWindow(data.times);
        } else {
          setError(data.error || "Failed to fetch open/close times");
          setTimeout(() => setError(""), 3000);
        }
      } catch (err) {
        console.error("Fetch open/close error:", err);
        setError("Failed to fetch open/close times");
        setTimeout(() => setError(""), 3000);
      }
    };

    const fetchAssignedTasks = async () => {
      const cacheKey = `assignedTasks:${selectedDate}:${session?.user?.id}`;
      if (taskCache.has(cacheKey)) {
        const tasks = taskCache.get(cacheKey);
        setAssignedTasks(tasks);
        updateTaskSummary(tasks);
        return;
      }

      setIsLoadingAssignedTasks(true);
      try {
        const res = await fetch(`/api/member/assignedTasks?date=${selectedDate}&action=tasks`);
        const data = await res.json();
        if (res.ok) {
          const tasks = data.tasks || [];
          const updatedTasks = tasks.map(task => {
            if (task.sprints && task.sprints.length > 0) {
              const hasInProgress = task.sprints.some(sprint => sprint.status === "in_progress");
              const allDone = task.sprints.every(sprint => sprint.status === "done" || sprint.status === "verified");
              return {
                ...task,
                status: hasInProgress ? "in_progress" : allDone ? "done" : task.status
              };
            }
            return task;
          });
          taskCache.set(cacheKey, updatedTasks);
          setAssignedTasks(updatedTasks);
          updateTaskSummary(updatedTasks);
        } else {
          setError(data.error || "Failed to fetch assigned tasks");
          setTimeout(() => setError(""), 3000);
        }
      } catch (err) {
        setError("Failed to fetch assigned tasks");
        setTimeout(() => setError(""), 3000);
      } finally {
        setIsLoadingAssignedTasks(false);
      }
    };

    const fetchRoutineTasks = async () => {
      const cacheKey = `routineTasks:${selectedDate}:${session?.user?.id}`;
      if (taskCache.has(cacheKey)) {
        const tasks = taskCache.get(cacheKey);
        setRoutineTasks(tasks);
        updateRoutineTaskSummary(tasks);
        setCloseDayTasks(tasks.map((task) => ({
          id: task.id,
          description: task.description || "Untitled Task",
          markAsCompleted: false
        })));
        return;
      }

      setIsLoadingRoutineTasks(true);
      try {
        const res = await fetch(`/api/member/routine-tasks?action=routineTasks&date=${selectedDate}`);
        const data = await res.json();
        if (res.ok) {
          const tasks = data.tasks || [];
          taskCache.set(cacheKey, tasks);
          setRoutineTasks(tasks);
          updateRoutineTaskSummary(tasks);
          setCloseDayTasks(tasks.map((task) => ({
            id: task.id,
            description: task.description || "Untitled Task",
            markAsCompleted: false
          })));
        } else {
          setError(data.error || "Failed to fetch routine tasks");
          setTimeout(() => setError(""), 3000);
        }
      } catch (err) {
        console.error("Error fetching routine tasks:", err);
        setError("Failed to fetch routine tasks");
        setTimeout(() => setError(""), 3000);
      } finally {
        setIsLoadingRoutineTasks(false);
      }
    };

    const updateTaskSummary = (tasks) => {
      const summary = tasks.reduce(
        (acc, task) => {
          acc.total += 1;
          if (task.status === "not_started") acc.notStarted += 1;
          if (task.status === "in_progress") acc.inProgress += 1;
          if (task.status === "pending_verification") acc.pendingVerification += 1;
          if (task.status === "verified" || task.status === "done") acc.completed += 1;
          return acc;
        },
        { total: 0, notStarted: 0, inProgress: 0, pendingVerification: 0, completed: 0 }
      );
      setAssignedTaskSummary(summary);
    };

    const updateRoutineTaskSummary = (tasks) => {
      const summary = tasks.reduce(
        (acc, task) => {
          const status = task.status || "not_started";
          acc.total += 1;
          if (status === "not_started") acc.notStarted += 1;
          if (status === "in_progress") acc.inProgress += 1;
          if (status === "pending_verification") acc.pendingVerification += 1;
          if (status === "verified" || status === "done" || status === "completed") acc.completed += 1;
          return acc;
        },
        { total: 0, notStarted: 0, inProgress: 0, pendingVerification: 0, completed: 0 }
      );
      setRoutineTaskSummary(summary);
    };

    const checkClosingWindow = (times) => {
      const now = new Date();
      const closingStart = new Date(times.closingWindowStart);
      const closingEnd = new Date(times.closingWindowEnd);
      setCanCloseDay(now >= closingStart && now <= closingEnd);
    };

    fetchUserData();
    fetchUsers();
    fetchAssignedTasks();
    fetchRoutineTasks();
  }, [selectedDate, session]);

  const fetchSprints = async (taskId, memberId) => {
    const cacheKey = `sprints:${taskId}:${memberId}`;
    if (taskCache.has(cacheKey)) {
      setSprints(taskCache.get(cacheKey));
      return;
    }

    try {
      const res = await fetch(`/api/member/assignedTasks?taskId=${taskId}&memberId=${memberId}&action=sprints`);
      const data = await res.json();
      if (res.ok) {
        const sprints = data.sprints || [];
        taskCache.set(cacheKey, sprints);
        setSprints(sprints);
      } else {
        setError(data.error || "Failed to fetch sprints");
        setTimeout(() => setError(""), 3000);
      }
    } catch (err) {
      setError("Failed to fetch sprints");
      setTimeout(() => setError(""), 3000);
    }
  };

  const fetchTaskLogs = async (taskId) => {
    try {
      const res = await fetch(`/api/member/assignedTasks?taskId=${taskId}&action=logs`);
      const data = await res.json();
      if (res.ok) {
        setTaskLogs(data.logs || []);
      } else {
        setError(data.error || "Failed to fetch task logs");
        setTimeout(() => setError(""), 3000);
      }
    } catch (err) {
      setError("Failed to fetch task logs");
      setTimeout(() => setError(""), 3000);
    }
  };

  const notifyAssignees = async (taskId, messageContent) => {
    if (!sendNotification) return;
    try {
      const res = await fetch(`/api/member/assignedTasks?taskId=${taskId}&action=assignees`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch assignees");
      }

      const assignees = data.assignees || [];
      const promises = assignees
        .filter((assignee) => assignee.memberId !== parseInt(user.id))
        .map((assignee) =>
          fetch("/api/others/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: user.id,
              recipientId: assignee.memberId,
              message: messageContent,
            }),
          })
        );

      const results = await Promise.all(promises);
      results.forEach(async (res, index) => {
        if (!res.ok) {
          const errorData = await res.json();
          console.error(`Failed to send message to assignee ${assignees[index].memberId}:`, errorData.error);
        }
      });
    } catch (err) {
      console.error("Error notifying assignees:", err);
      setError("Failed to notify assignees");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleStatusUpdate = async () => {
    if (!selectedTask || !newStatus) return;

    setIsUpdating(true);
    try {
      let res;
      let messageContent;

      if (sprints.length > 0 && selectedSprint) {
        res = await fetch("/api/member/assignedTasks/status", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sprintId: selectedSprint,
            status: newStatus,
            taskId: selectedTask.id,
            memberId: user.id,
            action: "update_sprint",
          }),
        });
        messageContent = `Task "${selectedTask.title}" sprint "${sprints.find(s => s.id === parseInt(selectedSprint))?.title}" updated to status: ${newStatus}`;
      } else {
        res = await fetch("/api/member/assignedTasks/status", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId: selectedTask.id,
            status: newStatus,
            memberId: user.id,
            action: "update_task",
          }),
        });
        messageContent = `Task "${selectedTask.title}" updated to status: ${newStatus}`;
      }

      const data = await res.json();
      if (res.ok) {
        setAssignedTasks((prev) => {
          const updatedTasks = prev.map((task) => {
            if (task.id === selectedTask.id) {
              if (sprints.length > 0 && selectedSprint) {
                const updatedSprints = task.sprints.map((sprint) =>
                  sprint.id === parseInt(selectedSprint) ? { ...sprint, status: newStatus } : sprint
                );
                const hasInProgress = updatedSprints.some(sprint => sprint.status === "in_progress");
                const allDone = updatedSprints.every(sprint => sprint.status === "done" || sprint.status === "verified");
                return {
                  ...task,
                  sprints: updatedSprints,
                  status: hasInProgress ? "in_progress" : allDone ? "done" : task.status
                };
              }
              return { ...task, status: newStatus };
            }
            return task;
          });
          taskCache.set(`assignedTasks:${selectedDate}:${session?.user?.id}`, updatedTasks);
          return updatedTasks;
        });

        setAssignedTaskSummary((prev) => {
          const updatedTasks = assignedTasks.map((task) => {
            if (task.id === selectedTask.id) {
              if (sprints.length > 0 && selectedSprint) {
                const updatedSprints = task.sprints.map((sprint) =>
                  sprint.id === parseInt(selectedSprint) ? { ...sprint, status: newStatus } : sprint
                );
                const hasInProgress = updatedSprints.some(sprint => sprint.status === "in_progress");
                const allDone = updatedSprints.every(sprint => sprint.status === "done" || sprint.status === "verified");
                return {
                  ...task,
                  sprints: updatedSprints,
                  status: hasInProgress ? "in_progress" : allDone ? "done" : task.status
                };
              }
              return { ...task, status: newStatus };
            }
            return task;
          });
          return updatedTasks.reduce(
            (acc, task) => {
              acc.total += 1;
              if (task.status === "not_started") acc.notStarted += 1;
              if (task.status === "in_progress") acc.inProgress += 1;
              if (task.status === "pending_verification") acc.pendingVerification += 1;
              if (task.status === "verified" || task.status === "done") acc.completed += 1;
              return acc;
            },
            { total: 0, notStarted: 0, inProgress: 0, pendingVerification: 0, completed: 0 }
          );
        });

        // Update task log
        const logDetails = newLogComment || (sprints.length > 0 && selectedSprint
          ? `Updated sprint ${sprints.find(s => s.id === parseInt(selectedSprint))?.title} to ${newStatus}`
          : `Updated task status to ${newStatus}`);

        await fetch("/api/member/assignedTasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId: selectedTask.id,
            userId: user.id,
            action: "status_update",
            details: logDetails,
          }),
        });

        // Notify assignees
        await notifyAssignees(selectedTask.id, messageContent);

        setSuccess("Task status updated successfully!");
        setShowStatusModal(false);
        setSelectedTask(null);
        setNewStatus("");
        setSelectedSprint("");
        setSprints([]);
        setTaskLogs([]);
        setNewLogComment("");
        setSendNotification(true);
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.error || "Failed to update task status");
        setTimeout(() => setError(""), 3000);
      }
    } catch (err) {
      setError("Failed to update task status");
      setTimeout(() => setError(""), 3000);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSprintSelect = (task, sprint) => {
    setSelectedTask(task);
    setNewStatus(sprint.status || "not_started");
    setSprints(task.sprints || []);
    setSelectedSprint(sprint.id.toString());
    fetchTaskLogs(task.id);
    setShowStatusModal(true);
  };

  const handleTaskSelect = async (task) => {
    setSelectedTask(task);
    setNewStatus(task.status || "not_started");
    await fetchSprints(task.id, user.id);
    await fetchTaskLogs(task.id);
    setShowStatusModal(true);
  };

  const handleTaskDetails = async (task) => {
    setSelectedTask(task);
    await fetchTaskLogs(task.id);
    setShowDetailsModal(true);
  };

  const handleCloseDay = async () => {
    try {
      const res = await fetch("/api/member/routine-tasks?action=closeDay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          date: selectedDate,
          tasks: closeDayTasks,
          comment: closeDayComment,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess("Day closed successfully!");
        setCanCloseDay(false);
        setShowCloseDayModal(false);
        setCloseDayTasks([]);
        setCloseDayComment("");
        setRoutineTasks((prev) =>
          prev.map((task) => {
            const taskUpdate = closeDayTasks.find((t) => t.id === task.id);
            return taskUpdate && taskUpdate.markAsCompleted
              ? { ...task, status: "completed", isLocked: true }
              : { ...task, isLocked: true };
          })
        );
        setRoutineTaskSummary((prev) => {
          const updatedTasks = routineTasks.map((task) => {
            const taskUpdate = closeDayTasks.find((t) => t.id === task.id);
            return taskUpdate && taskUpdate.markAsCompleted
              ? { ...task, status: "completed", isLocked: true }
              : { ...task, isLocked: true };
          });
          return updatedTasks.reduce(
            (acc, task) => {
              const status = task.status || "not_started";
              acc.total += 1;
              if (status === "not_started") acc.notStarted += 1;
              if (status === "in_progress") acc.inProgress += 1;
              if (status === "pending_verification") acc.pendingVerification += 1;
              if (status === "verified" || status === "done" || status === "completed") acc.completed += 1;
              return acc;
            },
            { total: 0, notStarted: 0, inProgress: 0, pendingVerification: 0, completed: 0 }
          );
        });
        taskCache.delete(`routineTasks:${selectedDate}:${session?.user?.id}`);
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.error || "Failed to close day");
        setTimeout(() => setError(""), 3000);
      }
    } catch (err) {
      setError("Failed to close day");
      setTimeout(() => setError(""), 3000);
    }
  };

  if (status === "loading") {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-100">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-2xl font-semibold text-gray-700 flex items-center gap-2"
        >
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="inline-block w-6 h-6 border-2 border-t-teal-600 border-teal-200 rounded-full"
          />
          Loading...
        </motion.div>
      </div>
    );
  }

  const getAssignedBy = (createdBy) => {
    const user = users.find(u => u.id === createdBy);
    if (!user) return "Unknown";
    if (user.role === "admin") return "Superintendent";
    if (user.role === "team_manager") {
      return user.team_manager_type 
        ? user.team_manager_type.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")
        : "Team Manager";
    }
    return user.type
      ? user.type.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")
      : "Member";
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 bg-gray-100 p-8 flex items-center justify-center"
    >
      <div className="w-full h-full bg-white rounded-2xl shadow-2xl p-8 flex flex-col gap-8 overflow-y-auto">
        {/* Error/Success Messages */}
        <AnimatePresence>
          {success && (
            <motion.p
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 left-4 right-4 text-green-600 text-sm font-medium bg-green-50 p-4 rounded-lg shadow-md"
            >
              {success}
            </motion.p>
          )}
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

        {/* Assigned Tasks */}
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Assigned Tasks</h2>
          <AssignedTaskCards
            assignedTasks={assignedTasks}
            isLoadingAssignedTasks={isLoadingAssignedTasks}
            selectedDate={selectedDate}
            handleTaskSelect={handleTaskSelect}
            handleSprintSelect={handleSprintSelect}
            handleTaskDetails={handleTaskDetails}
            users={users}
          />
        </div>

        {/* Task Summary */}
        <div className="flex-1">
          <div className="flex flex-row items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">Task Summary</h2>
            <div className="flex-shrink-0">
              <label className="block text-sm font-medium text-gray-700">Time Period</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="mt-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 text-sm bg-gray-50 transition-all duration-200"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gradient-to-r from-teal-50 to-teal-100 rounded-xl shadow-md hover:shadow-lg transition-shadow duration-200">
              <p className="text-sm font-medium text-gray-700">Total Tasks</p>
              <p className="text-3xl font-bold text-teal-800">{assignedTaskSummary.total}</p>
            </div>
            <div className="text-center p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-xl shadow-md hover:shadow-lg transition-shadow duration-200">
              <p className="text-sm font-medium text-gray-700">Completed</p>
              <p className="text-3xl font-bold text-green-700">{assignedTaskSummary.completed}</p>
            </div>
            <div className="text-center p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-xl shadow-md hover:shadow-lg transition-shadow duration-200">
              <p className="text-sm font-medium text-gray-700">In Progress</p>
              <p className="text-3xl font-bold text-yellow-700">{assignedTaskSummary.inProgress}</p>
            </div>
            <div className="text-center p-4 bg-gradient-to-r from-red-50 to-red-100 rounded-xl shadow-md hover:shadow-lg transition-shadow duration-200">
              <p className="text-sm font-medium text-gray-700">Not Started</p>
              <p className="text-3xl font-bold text-red-700">{assignedTaskSummary.notStarted}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {canCloseDay && (
            <motion.div
              whileHover={{ scale: 1.05, boxShadow: "0 10px 20px rgba(0, 128, 0, 0.2)" }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowCloseDayModal(true)}
              className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg p-4 flex flex-col items-center justify-center min-h-[160px] cursor-pointer hover:shadow-xl transition-all duration-200"
            >
              <svg className="w-12 h-12 text-teal-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
              </svg>
              <h3 className="text-xl font-bold text-gray-800 mb-1">Close Day</h3>
              <p className="text-gray-600 text-sm text-center">Close tasks for the day</p>
            </motion.div>
          )}
        </div>

        {/* Routine Tasks */}
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Routine Tasks</h2>
          {isLoadingRoutineTasks ? (
            <div className="flex items-center justify-center py-8">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-8 h-8 border-2 border-t-teal-600 border-teal-200 rounded-full"
              />
            </div>
          ) : (
            <div className="space-y-3">
              {routineTasks.length === 0 ? (
                <p className="text-sm text-gray-600 text-center">No routine tasks available for {selectedDate}</p>
              ) : (
                routineTasks.map((task) => (
                  <div key={task.id} className="p-3 bg-gray-50 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
                    <p className="text-sm font-medium text-gray-700">
                      {task.description || "Untitled Task"}: <span className="capitalize">{(task.status || "unknown").replace("_", " ")}</span>
                      {task.isLocked && " (Locked)"}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Status Update Modal */}
        <AnimatePresence>
          {showStatusModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-teal-100"
              >
                <h2 className="text-lg font-bold text-gray-800 mb-4">Update Task Status</h2>
                {sprints.length > 0 ? (
                  <>
                    <select
                      value={selectedSprint}
                      onChange={(e) => setSelectedSprint(e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg mb-3 bg-gray-50 focus:ring-2 focus:ring-teal-500 text-sm transition-all duration-200"
                    >
                      <option value="">Select Sprint</option>
                      {sprints.map((sprint) => (
                        <option key={sprint.id} value={sprint.id}>
                          {sprint.title || "Untitled Sprint"}
                        </option>
                      ))}
                    </select>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg mb-3 bg-gray-50 focus:ring-2 focus:ring-teal-500 text-sm transition-all duration-200"
                      disabled={!selectedSprint}
                    >
                      <option value="">Select Status</option>
                      <option value="not_started">Not Started</option>
                      <option value="in_progress">In Progress</option>
                      <option value="pending_verification">Pending Verification</option>
                      <option value="done">Done</option>
                    </select>
                  </>
                ) : (
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg mb-3 bg-gray-50 focus:ring-2 focus:ring-teal-500 text-sm transition-all duration-200"
                  >
                    <option value="">Select Status</option>
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="pending_verification">Pending Verification</option>
                    <option value="done">Done</option>
                  </select>
                )}
                <div className="flex items-center mb-4">
                  <input
                    type="checkbox"
                    checked={sendNotification}
                    onChange={(e) => setSendNotification(e.target.checked)}
                    className="h-4 w-4 text-teal-600 focus:ring-teal-500"
                  />
                  <label className="ml-2 text-sm text-gray-700">Notify assignees of update</label>
                </div>
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Task Discussion</h3>
                  <div className="max-h-40 overflow-y-auto space-y-2 mb-2">
                    {taskLogs.length === 0 ? (
                      <p className="text-sm text-gray-500">No discussion yet.</p>
                    ) : (
                      taskLogs.map((log) => (
                        <div key={log.id} className="p-2 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-600">
                            {users.find(u => u.id === log.userId)?.name || "Unknown"} ({new Date(log.createdAt).toLocaleString()}):
                          </p>
                          <p className="text-sm text-gray-700">{log.details}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <textarea
                    value={newLogComment}
                    onChange={(e) => setNewLogComment(e.target.value)}
                    placeholder="Add a comment to the task discussion..."
                    className="w-full px-4 py-2 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-teal-500 text-sm transition-all duration-200"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setShowStatusModal(false);
                      setSelectedTask(null);
                      setNewStatus("");
                      setSelectedSprint("");
                      setSprints([]);
                      setTaskLogs([]);
                      setNewLogComment("");
                      setSendNotification(true);
                    }}
                    className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm font-medium transition-colors duration-200"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleStatusUpdate}
                    disabled={!newStatus || (sprints.length > 0 && !selectedSprint) || isUpdating}
                    className={`relative px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium transition-colors duration-200 ${
                      !newStatus || (sprints.length > 0 && !selectedSprint) || isUpdating ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    {isUpdating ? (
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="inline-block w-4 h-4 border-2 border-t-teal-200 border-teal-600 rounded-full"
                      />
                    ) : (
                      "Update"
                    )}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Task Details Modal */}
        <AnimatePresence>
          {showDetailsModal && selectedTask && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-blue-100"
              >
                <h2 className="text-lg font-bold text-gray-800 mb-4">Task Details</h2>
                <div className="space-y-3">
                  <p className="text-sm"><strong>Title:</strong> {selectedTask.title || "Untitled Task"}</p>
                  <p className="text-sm"><strong>Description:</strong> {selectedTask.description || "No description"}</p>
                  <p className="text-sm"><strong>Assigned By:</strong> {getAssignedBy(selectedTask.createdBy)}</p>
                  <p className="text-sm"><strong>Status:</strong> {(selectedTask.status || "not_started").replace("_", " ")}</p>
                  <p className="text-sm"><strong>Assigned Date:</strong> {new Date(selectedTask.assignedDate).toLocaleDateString()}</p>
                  <p className="text-sm"><strong>Deadline:</strong> {selectedTask.deadline ? new Date(selectedTask.deadline).toLocaleDateString() : "No deadline"}</p>
                  <p className="text-sm"><strong>Resources:</strong> {selectedTask.resources || "No resources"}</p>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Discussion</h3>
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      {taskLogs.length === 0 ? (
                        <p className="text-sm text-gray-500">No discussion yet.</p>
                      ) : (
                        taskLogs.map((log) => (
                          <div key={log.id} className="p-2 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-600">
                              {users.find(u => u.id === log.userId)?.name || "Unknown"} ({new Date(log.createdAt).toLocaleString()}):
                            </p>
                            <p className="text-sm text-gray-700">{log.details}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setShowDetailsModal(false);
                      setSelectedTask(null);
                      setTaskLogs([]);
                    }}
                    className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm font-medium transition-colors duration-200"
                  >
                    Close
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Close Day Modal */}
        <AnimatePresence>
          {showCloseDayModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-teal-100"
              >
                <h2 className="text-lg font-bold text-gray-800 mb-4">Close Day</h2>
                <p className="text-sm text-gray-600 mb-3">Mark tasks as completed for {selectedDate}</p>
                {closeDayTasks.map((task) => (
                  <div key={task.id} className="flex items-center space-x-2 mb-2">
                    <input
                      type="checkbox"
                      checked={task.markAsCompleted || false}
                      onChange={(e) => {
                        setCloseDayTasks((prev) =>
                          prev.map((t) =>
                            t.id === task.id ? { ...t, markAsCompleted: e.target.checked } : t
                          )
                        );
                      }}
                      className="h-4 w-4 text-teal-600 focus:ring-teal-500"
                      disabled={routineTasks.find((t) => t.id === task.id)?.isLocked}
                    />
                    <p className="text-sm text-gray-700">{task.description}</p>
                  </div>
                ))}
                <textarea
                  value={closeDayComment}
                  onChange={(e) => setCloseDayComment(e.target.value)}
                  placeholder="Add a comment (optional)"
                  className="w-full px-4 py-2 border rounded-lg mb-3 bg-gray-50 focus:ring-2 focus:ring-teal-500 text-sm transition-all duration-200"
                />
                <div className="flex justify-end space-x-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowCloseDayModal(false)}
                    className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm font-medium transition-colors duration-200"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleCloseDay}
                    className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium transition-colors duration-200"
                  >
                    Close Day
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <ChatBox userDetails={user} />
      </div>
    </motion.div>
  );
}