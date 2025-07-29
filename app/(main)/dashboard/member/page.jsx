"use client";
import { useState, useEffect, useReducer } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import DashboardContent from "@/components/member/DashboardContent";
import AssignedTasksView from "@/components/member/AssignedTasksView";
import RoutineTasksView from "@/components/member/RoutineTasksView";

// In-memory cache
const taskCache = new Map();

// Fetcher for SWR
const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  });

// Format time left
const formatTimeLeft = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

// Reducer for task state management
const taskReducer = (state, action) => {
  switch (action.type) {
    case "SET_ASSIGNED_TASKS":
      return {
        ...state,
        assignedTasks: action.payload,
        assignedTaskSummary: action.payload.reduce(
          (acc, task) => ({
            total: acc.total + 1,
            notStarted: acc.notStarted + (task.status === "not_started" ? 1 : 0),
            inProgress: acc.inProgress + (task.status === "in_progress" ? 1 : 0),
            pendingVerification: acc.pendingVerification + (task.status === "pending_verification" ? 1 : 0),
            completed: acc.completed + (task.status === "verified" || task.status === "done" ? 1 : 0),
          }),
          { total: 0, notStarted: 0, inProgress: 0, pendingVerification: 0, completed: 0 }
        ),
      };
    case "SET_ROUTINE_TASKS":
      return {
        ...state,
        routineTasks: action.payload,
        routineTaskSummary: action.payload.reduce(
          (acc, task) => ({
            total: acc.total + 1,
            notStarted: acc.notStarted + (task.status === "not_started" ? 1 : 0),
            inProgress: acc.inProgress + (task.status === "in_progress" ? 1 : 0),
            pendingVerification: acc.pendingVerification + (task.status === "pending_verification" ? 1 : 0),
            completed: acc.completed + (task.status === "verified" || task.status === "done" || task.status === "completed" ? 1 : 0),
          }),
          { total: 0, notStarted: 0, inProgress: 0, pendingVerification: 0, completed: 0 }
        ),
        closeDayTasks: action.payload.map((task) => ({
          id: task.id,
          description: task.description || "Untitled Task",
          markAsCompleted: false,
        })),
      };
    case "UPDATE_TASK_STATUS":
      const updatedTasks = state.assignedTasks.map((task) => {
        if (task.id === action.taskId) {
          if (action.sprintId && task.sprints) {
            const updatedSprints = task.sprints.map((sprint) =>
              sprint.id === action.sprintId ? { ...sprint, status: action.status } : sprint
            );
            const hasInProgress = updatedSprints.some((sprint) => sprint.status === "in_progress");
            const allDone = updatedSprints.every((sprint) => sprint.status === "done" || sprint.status === "verified");
            return {
              ...task,
              sprints: updatedSprints,
              status: hasInProgress ? "in_progress" : allDone ? "done" : task.status,
            };
          }
          return { ...task, status: action.status };
        }
        return task;
      });
      return {
        ...state,
        assignedTasks: updatedTasks,
        assignedTaskSummary: updatedTasks.reduce(
          (acc, task) => ({
            total: acc.total + 1,
            notStarted: acc.notStarted + (task.status === "not_started" ? 1 : 0),
            inProgress: acc.inProgress + (task.status === "in_progress" ? 1 : 0),
            pendingVerification: acc.pendingVerification + (task.status === "pending_verification" ? 1 : 0),
            completed: acc.completed + (task.status === "verified" || task.status === "done" ? 1 : 0),
          }),
          { total: 0, notStarted: 0, inProgress: 0, pendingVerification: 0, completed: 0 }
        ),
      };
    case "SET_CLOSE_DAY_TASKS":
      return { ...state, closeDayTasks: action.payload };
    default:
      return state;
  }
};

// Custom hook for data fetching
const useDashboardData = (session, selectedDate) => {
  const [state, dispatch] = useReducer(taskReducer, {
    assignedTasks: [],
    routineTasks: [],
    assignedTaskSummary: { total: 0, notStarted: 0, inProgress: 0, pendingVerification: 0, completed: 0 },
    routineTaskSummary: { total: 0, notStarted: 0, inProgress: 0, pendingVerification: 0, completed: 0 },
    closeDayTasks: [],
  });
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [openCloseTimes, setOpenCloseTimes] = useState(null);
  const [canCloseDay, setCanCloseDay] = useState(false);
  const [isLoadingAssignedTasks, setIsLoadingAssignedTasks] = useState(false);
  const [isLoadingRoutineTasks, setIsLoadingRoutineTasks] = useState(false);

  const { data: mriData, error: mriError } = useSWR(
    user ? `/api/member/myMRIs?section=today&userId=${user.id}&date=${selectedDate}` : null,
    fetcher
  );

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const res = await fetch("/api/member/profile");
        const data = await res.json();
        if (res.ok) {
          setUser(data.user);
          fetchOpenCloseTimes(data.user.type);
        }
      } catch {}
    };

    const fetchUsers = async () => {
      try {
        const res = await fetch("/api/member/users");
        const data = await res.json();
        if (res.ok) setUsers(data.users || []);
      } catch {}
    };

    const fetchOpenCloseTimes = async (userType) => {
      if (!userType) return;
      try {
        const res = await fetch(`/api/member/openCloseTimes?userType=${userType}`);
        const data = await res.json();
        if (res.ok) {
          setOpenCloseTimes(data.times);
          const now = new Date();
          const closingStart = new Date(data.times.closingWindowStart);
          const closingEnd = new Date(data.times.closingWindowEnd);
          setCanCloseDay(now >= closingStart && now <= closingEnd);
        }
      } catch {}
    };

    const fetchAssignedTasks = async () => {
      const cacheKey = `assignedTasks:${selectedDate}:${session?.user?.id}`;
      if (taskCache.has(cacheKey)) {
        dispatch({ type: "SET_ASSIGNED_TASKS", payload: taskCache.get(cacheKey) });
        return;
      }
      setIsLoadingAssignedTasks(true);
      try {
        const res = await fetch(`/api/member/assignedTasks?date=${selectedDate}&action=tasks`);
        const data = await res.json();
        if (res.ok) {
          const tasks = (data.tasks || []).map((task) => {
            if (task.sprints?.length) {
              const hasInProgress = task.sprints.some((sprint) => sprint.status === "in_progress");
              const allDone = task.sprints.every((sprint) => sprint.status === "done" || sprint.status === "verified");
              return { ...task, status: hasInProgress ? "in_progress" : allDone ? "done" : task.status };
            }
            return task;
          });
          taskCache.set(cacheKey, tasks);
          dispatch({ type: "SET_ASSIGNED_TASKS", payload: tasks });
        }
      } finally {
        setIsLoadingAssignedTasks(false);
      }
    };

    const fetchRoutineTasks = async () => {
      const cacheKey = `routineTasks:${selectedDate}:${session?.user?.id}`;
      if (taskCache.has(cacheKey)) {
        dispatch({ type: "SET_ROUTINE_TASKS", payload: taskCache.get(cacheKey) });
        return;
      }
      setIsLoadingRoutineTasks(true);
      try {
        const res = await fetch(`/api/member/routine-tasks?action=routineTasks&date=${selectedDate}`);
        const data = await res.json();
        if (res.ok) {
          const tasks = data.tasks || [];
          taskCache.set(cacheKey, tasks);
          dispatch({ type: "SET_ROUTINE_TASKS", payload: tasks });
        }
      } finally {
        setIsLoadingRoutineTasks(false);
      }
    };

    fetchUserData();
    fetchUsers();
    fetchAssignedTasks();
    fetchRoutineTasks();
  }, [selectedDate, session]);

  return {
    state,
    dispatch,
    user,
    users,
    mriData,
    mriError,
    openCloseTimes,
    canCloseDay,
    isLoadingAssignedTasks,
    isLoadingRoutineTasks,
  };
};

// Custom hook for slot timing
const useSlotTiming = (mriData) => {
  const [activeSlot, setActiveSlot] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!mriData || !mriData.nMRIs || mriData.nMRIs.length === 0) return;

    const now = new Date();
    let found = null;

    for (const slot of mriData.nMRIs) {
      const [startTimeStr, endTimeStr] = slot.time.split(" - ");
      if (!startTimeStr || !endTimeStr) continue;
      const startHours = parseInt(startTimeStr.split(":")[0], 10);
      const endHours = parseInt(endTimeStr.split(":")[0], 10);
      const isMidnightSpanning = endHours < startHours;
      let startDate = now.toDateString();
      let endDate = now.toDateString();
      if (isMidnightSpanning) {
        const prevDay = new Date(now);
        prevDay.setDate(now.getDate() - 1);
        startDate = prevDay.toDateString();
      }
      const startTime = new Date(`${startDate} ${startTimeStr}`);
      const endTime = new Date(`${endDate} ${endTimeStr}`);
      if (now >= startTime && now <= endTime) {
        found = { ...slot, startTime, endTime };
        break;
      }
    }

    if (found) {
      setActiveSlot(found);
      const secondsLeft = Math.max(0, Math.floor((found.endTime.getTime() - now.getTime()) / 1000));
      setTimeLeft(secondsLeft);

      const intervalId = setInterval(() => {
        const now = new Date();
        const remaining = Math.max(0, Math.floor((found.endTime.getTime() - now.getTime()) / 1000));
        setTimeLeft(remaining);
        if (remaining <= 0) {
          clearInterval(intervalId);
          setActiveSlot(null);
          setTimeLeft(null);
        }
      }, 1000);

      return () => clearInterval(intervalId);
    }
  }, [mriData]);

  return { activeSlot, timeLeft };
};

// Modal Component
const Modal = ({ isOpen, onClose, title, children }) => (
  <AnimatePresence>
    {isOpen && (
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
          className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-teal-300"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
          {children}
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

// Status Update Modal Content
const StatusUpdateModal = ({
  task,
  sprints,
  selectedSprint,
  setSelectedSprint,
  newStatus,
  setNewStatus,
  taskLogs,
  users,
  newLogComment,
  setNewLogComment,
  sendNotification,
  setSendNotification,
  isUpdating,
  onUpdate,
  onClose,
}) => (
  <div>
    {sprints.length > 0 ? (
      <>
        <select
          value={selectedSprint}
          onChange={(e) => setSelectedSprint(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg mb-3 bg-gray-50 focus:ring-2 focus:ring-teal-500 text-sm font-medium text-gray-700"
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
          className="w-full px-4 py-2 border rounded-lg mb-3 bg-gray-50 focus:ring-2 focus:ring-teal-500 text-sm font-medium text-gray-700"
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
        className="w-full px-4 py-2 border rounded-lg mb-3 bg-gray-50 focus:ring-2 focus:ring-teal-500 text-sm font-medium text-gray-700"
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
      <label className="ml-2 text-sm font-medium text-gray-700">Notify assignees</label>
    </div>
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">Task Discussion</h3>
      <div className="max-h-40 overflow-y-auto space-y-2 mb-2">
        {taskLogs.length === 0 ? (
          <p className="text-sm text-gray-500">No discussion yet.</p>
        ) : (
          taskLogs.map((log) => (
            <div key={log.id} className="p-3 bg-gray-50 rounded-lg shadow-sm border border-gray-200">
              <p className="text-xs text-gray-600">
                {users.find((u) => u.id === log.userId)?.name || "Unknown"} ({new Date(log.createdAt).toLocaleString()}):
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
        className="w-full px-4 py-2 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-teal-500 text-sm font-medium text-gray-700"
      />
    </div>
    <div className="flex justify-end space-x-2">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClose}
        className="px-4 py-2 bg-gray-500 text-white rounded-md text-sm font-medium"
      >
        Cancel
      </motion.button>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onUpdate}
        disabled={!newStatus || (sprints.length > 0 && !selectedSprint) || isUpdating}
        className={`px-4 py-2 bg-teal-600 text-white rounded-md text-sm font-medium ${
          !newStatus || (sprints.length > 0 && !selectedSprint) || isUpdating ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        {isUpdating ? (
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="inline-block w-4 h-4 border-4 border-t-teal-200 border-teal-600 rounded-full"
          />
        ) : (
          "Update"
        )}
      </motion.button>
    </div>
  </div>
);

// Task Details Modal Content
const TaskDetailsModal = ({ task, taskLogs, users, onClose }) => (
  <div className="space-y-3">
    <p className="text-sm font-medium text-gray-700"><strong>Title:</strong> {task?.title || "Untitled Task"}</p>
    <p className="text-sm font-medium text-gray-700"><strong>Description:</strong> {task?.description || "No description"}</p>
    <p className="text-sm font-medium text-gray-700"><strong>Assigned By:</strong> {task?.createdBy ? users.find((u) => u.id === task.createdBy)?.name || "Unknown" : "Unknown"}</p>
    <p className="text-sm font-medium text-gray-700"><strong>Status:</strong> {(task?.status || "not_started").replace("_", " ")}</p>
    <p className="text-sm font-medium text-gray-700"><strong>Assigned Date:</strong> {task?.assignedDate ? new Date(task.assignedDate).toLocaleDateString() : "N/A"}</p>
    <p className="text-sm font-medium text-gray-700"><strong>Deadline:</strong> {task?.deadline ? new Date(task.deadline).toLocaleDateString() : "No deadline"}</p>
    <p className="text-sm font-medium text-gray-700"><strong>Resources:</strong> {task?.resources || "No resources"}</p>
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">Discussion</h3>
      <div className="max-h-40 overflow-y-auto space-y-2">
        {taskLogs.length === 0 ? (
          <p className="text-sm text-gray-500">No discussion yet.</p>
        ) : (
          taskLogs.map((log) => (
            <div key={log.id} className="p-3 bg-gray-50 rounded-lg shadow-sm border border-gray-200">
              <p className="text-xs text-gray-600">
                {users.find((u) => u.id === log.userId)?.name || "Unknown"} ({new Date(log.createdAt).toLocaleString()}):
              </p>
              <p className="text-sm text-gray-700">{log.details}</p>
            </div>
          ))
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

// Close Day Modal Content
const CloseDayModal = ({
  closeDayTasks,
  setCloseDayTasks,
  closeDayComment,
  setCloseDayComment,
  routineTasks,
  onClose,
  onConfirm,
}) => (
  <div>
    {closeDayTasks.map((task) => (
      <div key={task.id} className="flex items-center space-x-2 mb-2">
        <input
          type="checkbox"
          checked={task.markAsCompleted}
          onChange={(e) =>
            setCloseDayTasks(
              closeDayTasks.map((t) => (t.id === task.id ? { ...t, markAsCompleted: e.target.checked } : t))
            )
          }
          className="h-4 w-4 text-teal-600 focus:ring-teal-500"
          disabled={routineTasks.find((t) => t.id === task.id)?.isLocked}
        />
        <p className="text-sm font-medium text-gray-700">{task.description}</p>
      </div>
    ))}
    <textarea
      value={closeDayComment}
      onChange={(e) => setCloseDayComment(e.target.value)}
      placeholder="Add a comment (optional)"
      className="w-full px-4 py-2 border rounded-lg mb-3 bg-gray-50 focus:ring-2 focus:ring-teal-500 text-sm font-medium text-gray-700"
    />
    <div className="flex justify-end space-x-2">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClose}
        className="px-4 py-2 bg-gray-500 text-white rounded-md text-sm font-medium"
      >
        Cancel
      </motion.button>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onConfirm}
        className="px-4 py-2 bg-teal-600 text-white rounded-md text-sm font-medium"
      >
        Close Day
      </motion.button>
    </div>
  </div>
);

export default function MemberDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showCloseDayModal, setShowCloseDayModal] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [selectedSprint, setSelectedSprint] = useState("");
  const [sprints, setSprints] = useState([]);
  const [taskLogs, setTaskLogs] = useState([]);
  const [newLogComment, setNewLogComment] = useState("");
  const [closeDayComment, setCloseDayComment] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [sendNotification, setSendNotification] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const { state, dispatch, user, users, mriData, mriError, canCloseDay, isLoadingAssignedTasks, isLoadingRoutineTasks } =
    useDashboardData(session, selectedDate);
  const { activeSlot, timeLeft } = useSlotTiming(mriData);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "member") {
      router.push(session?.user?.role === "admin" ? "/dashboard/admin" : "/dashboard/team_manager");
    }
  }, [status, session, router]);

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
      }
    } catch {}
  };

  const fetchTaskLogs = async (taskId) => {
    try {
      const res = await fetch(`/api/member/assignedTasks?taskId=${taskId}&action=logs`);
      const data = await res.json();
      if (res.ok) setTaskLogs(data.logs || []);
    } catch {}
  };

  const notifyAssignees = async (taskId, messageContent) => {
    if (!sendNotification) return;
    try {
      const res = await fetch(`/api/member/assignedTasks?taskId=${taskId}&action=assignees`);
      const data = await res.json();
      if (!res.ok) return;
      const assignees = data.assignees || [];
      await Promise.all(
        assignees
          .filter((assignee) => assignee.memberId !== user?.id)
          .map((assignee) =>
            fetch("/api/others/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId: user?.id,
                recipientId: assignee.memberId,
                message: messageContent,
              }),
            })
          )
      );
    } catch {}
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
            memberId: user?.id,
            action: "update_sprint",
          }),
        });
        messageContent = `Task "${selectedTask.title}" sprint "${sprints.find((s) => s.id === parseInt(selectedSprint))?.title}" updated to status: ${newStatus}`;
      } else {
        res = await fetch("/api/member/assignedTasks/status", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId: selectedTask.id,
            status: newStatus,
            memberId: user?.id,
            action: "update_task",
          }),
        });
        messageContent = `Task "${selectedTask.title}" updated to status: ${newStatus}`;
      }

      const data = await res.json();
      if (res.ok) {
        dispatch({ type: "UPDATE_TASK_STATUS", taskId: selectedTask.id, status: newStatus, sprintId: selectedSprint ? parseInt(selectedSprint) : undefined });
        taskCache.set(`assignedTasks:${selectedDate}:${session?.user?.id}`, state.assignedTasks);
        await fetch("/api/member/assignedTasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId: selectedTask.id,
            userId: user?.id,
            action: "status_update",
            details:
              newLogComment ||
              (sprints.length > 0 && selectedSprint
                ? `Updated sprint ${sprints.find((s) => s.id === parseInt(selectedSprint))?.title} to ${newStatus}`
                : `Updated task status to ${newStatus}`),
          }),
        });
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
      }
    } catch {
      setError("Failed to update task status");
      setTimeout(() => setError(""), 3000);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCloseDay = async () => {
    try {
      const res = await fetch("/api/member/routine-tasks?action=closeDay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id,
          date: selectedDate,
          tasks: state.closeDayTasks,
          comment: closeDayComment,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess("Day closed successfully!");
        setCanCloseDay(false);
        setShowCloseDayModal(false);
        setActiveTab("dashboard");
        setCloseDayComment("");
        dispatch({
          type: "SET_ROUTINE_TASKS",
          payload: state.routineTasks.map((task) => {
            const taskUpdate = state.closeDayTasks.find((t) => t.id === task.id);
            return taskUpdate && taskUpdate.markAsCompleted ? { ...task, status: "completed", isLocked: true } : { ...task, isLocked: true };
          }),
        });
        taskCache.delete(`routineTasks:${selectedDate}:${session?.user?.id}`);
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch {
      setError("Failed to close day");
      setTimeout(() => setError(""), 3000);
    }
  };

  const getAssignedBy = (createdBy) => {
    const user = users.find((u) => u.id === createdBy);
    if (!user) return "Unknown";
    if (user.role === "admin") return "Superintendent";
    if (user.role === "team_manager") {
      return user.team_manager_type
        ? user.team_manager_type.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")
        : "Team Manager";
    }
    return user.type ? user.type.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ") : "Member";
  };

  const getTODName = (assignedMemberId) => {
    if (!assignedMemberId) return "Unassigned";
    if (String(assignedMemberId) === String(session?.user?.id)) return `${session?.user?.name} (You)`;
    const member = users.find((m) => String(m.id) === String(assignedMemberId));
    return member?.name || "Unassigned";
  };

  if (status === "loading") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 flex items-center justify-center bg-gray-100"
      >
        <motion.div className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="inline-block w-6 h-6 border-4 border-t-teal-600 border-teal-200 rounded-full"
          />
          Loading...
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="fixed inset-0 bg-gray-100 p-6 flex items-center justify-center"
    >
      <div className="w-full h-full bg-white rounded-2xl shadow-2xl p-6 flex flex-col gap-4 overflow-y-auto">
        <AnimatePresence>
          {success && (
            <motion.p
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="absolute top-4 left-4 right-4 text-green-800 text-sm font-medium bg-green-50 p-4 rounded-lg shadow-md border border-green-300"
            >
              {success}
            </motion.p>
          )}
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="absolute top-4 left-4 right-4 text-red-800 text-sm font-medium bg-red-50 p-4 rounded-lg shadow-md border border-red-300"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {activeTab === "dashboard" ? (
            <DashboardContent
              mriData={mriData}
              mriError={mriError}
              activeSlot={activeSlot}
              timeLeft={timeLeft}
              formatTimeLeft={formatTimeLeft}
              session={session}
              getTODName={getTODName}
              setActiveTab={setActiveTab}
              assignedTaskSummary={state.assignedTaskSummary}
              routineTaskSummary={state.routineTaskSummary}
            />
          ) : activeTab === "assigned" ? (
            <AssignedTasksView
              handleBack={() => setActiveTab("dashboard")}
              assignedTasks={state.assignedTasks}
              isLoadingAssignedTasks={isLoadingAssignedTasks}
              selectedDate={selectedDate}
              handleTaskSelect={async (task) => {
                setSelectedTask(task);
                setNewStatus(task.status || "not_started");
                await fetchSprints(task.id, user?.id || 0);
                await fetchTaskLogs(task.id);
                setShowStatusModal(true);
              }}
              handleSprintSelect={async (task, sprint) => {
                setSelectedTask(task);
                setNewStatus(sprint.status || "not_started");
                setSprints(task.sprints || []);
                setSelectedSprint(sprint.id.toString());
                await fetchTaskLogs(task.id);
                setShowStatusModal(true);
              }}
              handleTaskDetails={async (task) => {
                setSelectedTask(task);
                await fetchTaskLogs(task.id);
                setShowDetailsModal(true);
              }}
              users={users}
              assignedTaskSummary={state.assignedTaskSummary}
            />
          ) : activeTab === "routine" ? (
            <RoutineTasksView
              handleBack={() => setActiveTab("dashboard")}
              routineTasks={state.routineTasks}
              isLoadingRoutineTasks={isLoadingRoutineTasks}
              selectedDate={selectedDate}
              canCloseDay={canCloseDay}
              closeDayTasks={state.closeDayTasks}
              closeDayComment={closeDayComment}
              setCloseDayTasks={(tasks) => dispatch({ type: "SET_CLOSE_DAY_TASKS", payload: tasks })}
              setCloseDayComment={setCloseDayComment}
              handleCloseDay={handleCloseDay}
              setShowCloseDayModal={setShowCloseDayModal}
              routineTaskSummary={state.routineTaskSummary}
            />
          ) : null}
        </AnimatePresence>

        <Modal isOpen={showStatusModal} onClose={() => setShowStatusModal(false)} title="Update Task Status">
          <StatusUpdateModal
            task={selectedTask}
            sprints={sprints}
            selectedSprint={selectedSprint}
            setSelectedSprint={setSelectedSprint}
            newStatus={newStatus}
            setNewStatus={setNewStatus}
            taskLogs={taskLogs}
            users={users}
            newLogComment={newLogComment}
            setNewLogComment={setNewLogComment}
            sendNotification={sendNotification}
            setSendNotification={setSendNotification}
            isUpdating={isUpdating}
            onUpdate={handleStatusUpdate}
            onClose={() => {
              setShowStatusModal(false);
              setSelectedTask(null);
              setNewStatus("");
              setSelectedSprint("");
              setSprints([]);
              setTaskLogs([]);
              setNewLogComment("");
              setSendNotification(true);
            }}
          />
        </Modal>

        <Modal isOpen={showDetailsModal} onClose={() => setShowDetailsModal(false)} title="Task Details">
          <TaskDetailsModal
            task={selectedTask}
            taskLogs={taskLogs}
            users={users}
            onClose={() => {
              setShowDetailsModal(false);
              setSelectedTask(null);
              setTaskLogs([]);
            }}
          />
        </Modal>

        <Modal isOpen={showCloseDayModal} onClose={() => setShowCloseDayModal(false)} title="Close Day">
          <CloseDayModal
            closeDayTasks={state.closeDayTasks}
            setCloseDayTasks={(tasks) => dispatch({ type: "SET_CLOSE_DAY_TASKS", payload: tasks })}
            closeDayComment={closeDayComment}
            setCloseDayComment={setCloseDayComment}
            routineTasks={state.routineTasks}
            onClose={() => setShowCloseDayModal(false)}
            onConfirm={handleCloseDay}
          />
        </Modal>
      </div>
    </motion.div>
  );
}