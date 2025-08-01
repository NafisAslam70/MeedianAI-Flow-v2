"use client";

import { useState, useEffect, useReducer } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import useSWR from "swr";

import DashboardContent   from "@/components/member/DashboardContent";
import AssignedTasksView  from "@/components/member/AssignedTasksView";
import RoutineTasksView   from "@/components/member/RoutineTasksView";

/* ------------------------------------------------------------------ */
/*  In‑memory cache, helpers                                           */
/* ------------------------------------------------------------------ */
const taskCache = new Map();

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
    return r.json();
  });

const formatTimeLeft = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(
    2,
    "0"
  )}`;

/* ------------------------------------------------------------------ */
/*  Derived task status helper                                         */
/* ------------------------------------------------------------------ */
const deriveTaskStatus = (sprints) => {
  if (!sprints || sprints.length === 0) return "not_started";
  const statuses = sprints.map((s) => s.status);
  const hasPending = statuses.some((s) => s === "pending_verification");
  const hasInProgress = statuses.some((s) => s === "in_progress");
  const hasDone = statuses.some((s) => ["done", "verified"].includes(s));
  const allDone = statuses.every((s) => ["done", "verified"].includes(s));
  if (hasPending) return "pending_verification";
  if (allDone) return "done";
  if (hasInProgress || hasDone) return "in_progress";
  return "not_started";
};

/* ------------------------------------------------------------------ */
/*  Reducer                                                            */
/* ------------------------------------------------------------------ */
const summarise = (arr) =>
  arr.reduce(
    (a, t) => ({
      total: a.total + 1,
      notStarted: a.notStarted + (t.status === "not_started"),
      inProgress: a.inProgress + (t.status === "in_progress"),
      pendingVerification:
        a.pendingVerification + (t.status === "pending_verification"),
      completed:
        a.completed + (t.status === "verified" || t.status === "done"),
    }),
    {
      total: 0,
      notStarted: 0,
      inProgress: 0,
      pendingVerification: 0,
      completed: 0,
    }
  );

const taskReducer = (state, action) => {
  switch (action.type) {
    case "SET_ASSIGNED_TASKS":
      return {
        ...state,
        assignedTasks: action.payload,
        assignedTaskSummary: summarise(action.payload),
      };

    case "SET_ROUTINE_TASKS":
      return {
        ...state,
        routineTasks: action.payload,
        routineTaskSummary: summarise(action.payload),
        closeDayTasks: action.payload.map((t) => ({
          id: t.id,
          description: t.description || "Untitled Task",
          markAsCompleted: false,
        })),
      };

    case "UPDATE_TASK_STATUS": {
      const updated = state.assignedTasks.map((t) => {
        if (t.id !== action.taskId) return t;
        if (action.sprintId && t.sprints) {
          const sprints = t.sprints.map((s) =>
            s.id === action.sprintId ? { ...s, status: action.status } : s
          );
          return {
            ...t,
            sprints,
            status: deriveTaskStatus(sprints),
          };
        }
        return { ...t, status: action.status };
      });
      return {
        ...state,
        assignedTasks: updated,
        assignedTaskSummary: summarise(updated),
      };
    }

    case "SET_CLOSE_DAY_TASKS":
      return { ...state, closeDayTasks: action.payload };

    default:
      return state;
  }
};

/* ------------------------------------------------------------------ */
/*  Data‑fetch hook                                                    */
/* ------------------------------------------------------------------ */
const useDashboardData = (session, selectedDate) => {
  const [state, dispatch] = useReducer(taskReducer, {
    assignedTasks: [],
    routineTasks: [],
    assignedTaskSummary: {
      total: 0,
      notStarted: 0,
      inProgress: 0,
      pendingVerification: 0,
      completed: 0,
    },
    routineTaskSummary: {
      total: 0,
      notStarted: 0,
      inProgress: 0,
      pendingVerification: 0,
      completed: 0,
    },
    closeDayTasks: [],
  });

  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [openCloseTimes, setOpenCloseTimes] = useState(null);
  const [canCloseDay, setCanCloseDay] = useState(false);
  const [isLoadingAssignedTasks, setIsLoadingAssignedTasks] = useState(false);
  const [isLoadingRoutineTasks, setIsLoadingRoutineTasks] = useState(false);

  const { data: mriData, error: mriError } = useSWR(
    user
      ? `/api/member/myMRIs?section=today&userId=${user.id}&date=${selectedDate}`
      : null,
    fetcher,
    { refreshInterval: 30000 } // Reduced polling frequency
  );

  /* --- effect to fetch everything on date / session change ---------- */
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const r = await fetch("/api/member/profile");
        const d = await r.json();
        if (r.ok) {
          setUser(d.user);
          fetchOpenCloseTimes(d.user.type);
        }
      } catch (err) {
        console.error("fetchUser error:", err.message);
      }
    };

    const fetchAllUsers = async () => {
      const key = `users:${session?.user?.id}`;
      if (taskCache.has(key)) {
        setUsers(taskCache.get(key));
        return;
      }
      try {
        const r = await fetch("/api/member/users");
        const d = await r.json();
        if (r.ok) {
          taskCache.set(key, d.users || []);
          setUsers(d.users || []);
        }
      } catch (err) {
        console.error("fetchAllUsers error:", err.message);
      }
    };

    const fetchOpenCloseTimes = async (userType) => {
      if (!userType) return;
      try {
        const r = await fetch(
          `/api/member/openCloseTimes?userType=${userType}`
        );
        const d = await r.json();
        if (r.ok) {
          setOpenCloseTimes(d.times);
          const now = new Date();
          const start = new Date(d.times.closingWindowStart);
          const end = new Date(d.times.closingWindowEnd);
          setCanCloseDay(now >= start && now <= end);
        }
      } catch (err) {
        console.error("fetchOpenCloseTimes error:", err.message);
      }
    };

    const fetchAssignedTasks = async () => {
      const key = `assignedTasks:${selectedDate}:${session?.user?.id}`;
      if (taskCache.has(key) ) {
        dispatch({ type: "SET_ASSIGNED_TASKS", payload: taskCache.get(key) });
        return;
      }
      setIsLoadingAssignedTasks(true);
      try {
        const r = await fetch(
          `/api/member/assignedTasks?date=${selectedDate}&action=tasks`
        );
        const d = await r.json();
        if (r.ok) {
          const tasks = (d.tasks || []).map((t) => {
            if (t.sprints?.length) {
              return {
                ...t,
                status: deriveTaskStatus(t.sprints),
              };
            }
            return t;
          });
          taskCache.set(key, tasks);
          dispatch({ type: "SET_ASSIGNED_TASKS", payload: tasks });
        }
      } catch (err) {
        console.error("fetchAssignedTasks error:", err.message);
      } finally {
        setIsLoadingAssignedTasks(false);
      }
    };

    const fetchRoutineTasks = async () => {
      const key = `routineTasks:${selectedDate}:${session?.user?.id}`;
      if (taskCache.has(key)) {
        dispatch({ type: "SET_ROUTINE_TASKS", payload: taskCache.get(key) });
        return;
      }
      setIsLoadingRoutineTasks(true);
      try {
        const r = await fetch(
          `/api/member/routine-tasks?action=routineTasks&date=${selectedDate}`
        );
        const d = await r.json();
        if (r.ok) {
          taskCache.set(key, d.tasks || []);
          dispatch({ type: "SET_ROUTINE_TASKS", payload: d.tasks || [] });
        }
      } catch (err) {
        console.error("fetchRoutineTasks error:", err.message);
      } finally {
        setIsLoadingRoutineTasks(false);
      }
    };

    fetchUser();
    fetchAllUsers();
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

/* ------------------------------------------------------------------ */
/*  Slot-timing helper                                                 */
/* ------------------------------------------------------------------ */
const useSlotTiming = (mriData) => {
  const [activeSlot, setActiveSlot] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!mriData?.nMRIs?.length) return;

    const now = new Date();
    let found = null;

    for (const slot of mriData.nMRIs) {
      const [startStr, endStr] = slot.time.split(" - ");
      const startH = +startStr.split(":")[0];
      const endH = +endStr.split(":")[0];
      const spansMidnight = endH < startH;

      const startDateStr = spansMidnight
        ? new Date(now).setDate(now.getDate() - 1) &&
          new Date(now).toDateString()
        : now.toDateString();

      const start = new Date(`${startDateStr} ${startStr}`);
      const end = new Date(`${now.toDateString()} ${endStr}`);

      if (now >= start && now <= end) {
        found = { ...slot, startTime: start, endTime: end };
        break;
      }
    }

    if (!found) return;

    setActiveSlot(found);
    const tick = () => {
      const remain = Math.max(
        0,
        Math.floor((found.endTime.getTime() - Date.now()) / 1000)
      );
      setTimeLeft(remain);
      if (remain <= 0) {
        clearInterval(id);
        setActiveSlot(null);
        setTimeLeft(null);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [mriData]);

  return { activeSlot, timeLeft };
};

/* ------------------------------------------------------------------ */
/*  Modal wrapper                                                      */
/* ------------------------------------------------------------------ */
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
          className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl border border-teal-300 relative"
        >
          <button
            onClick={onClose}
            className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-xl font-bold"
          >
            X
          </button>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
          {children}
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

/* ------------------------------------------------------------------ */
/*  Status-update modal (now with WhatsApp checkbox)                   */
/* ------------------------------------------------------------------ */
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
  sendWhatsapp,
  setSendWhatsapp,
  isUpdating,
  onUpdate,
  onClose,
  startVoiceRecording,
  isRecording,
  handleTranslateComment,
}) => (
  <div>
    <div className="flex flex-row gap-4 mb-4">
      <div className="flex-1">
        {/* --- Sprint + Status selects ----------------------------------- */}
        {sprints.length ? (
          <>
            <select
              value={selectedSprint}
              onChange={(e) => setSelectedSprint(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg mb-3 bg-gray-50 focus:ring-2 focus:ring-teal-500 text-sm font-medium text-gray-700"
            >
              <option value="">Select Sprint</option>
              {sprints.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title || "Untitled Sprint"}
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

        {/* --- Notification check‑boxes ---------------------------------- */}
        <div className="flex items-center mb-2">
          <input
            type="checkbox"
            checked={sendNotification}
            onChange={(e) => setSendNotification(e.target.checked)}
            className="h-4 w-4 text-teal-600 focus:ring-teal-500"
          />
          <label className="ml-2 text-sm font-medium text-gray-700">
            Chat‑notify assignees
          </label>
        </div>
        <div className="flex items-center mb-4">
          <input
            type="checkbox"
            checked={sendWhatsapp}
            onChange={(e) => setSendWhatsapp(e.target.checked)}
            className="h-4 w-4 text-teal-600 focus:ring-teal-500"
          />
          <label className="ml-2 text-sm font-medium text-gray-700">
            WhatsApp ping
          </label>
        </div>
      </div>

      {/* --- Discussion / Comments ------------------------------------- */}
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Task Discussion</h3>
        <div className="max-h-40 overflow-y-auto space-y-2 mb-2">
          {taskLogs.length ? (
            taskLogs.map((log) => {
              const sprint = log.sprintId ? sprints.find((s) => s.id === log.sprintId) : null;
              const prefix = sprint ? `[${sprint.title || "Untitled Sprint"}] ` : "[Main] ";
              return (
                <div
                  key={log.id}
                  className="p-3 bg-gray-50 rounded-lg shadow-sm border border-gray-200"
                >
                  <p className="text-xs text-gray-600">
                    {prefix}{users.find((u) => u.id === log.userId)?.name || "Unknown"} (
                    {new Date(log.createdAt).toLocaleString()}):
                  </p>
                  <p className="text-sm text-gray-700">{log.details}</p>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-gray-500">No discussion yet.</p>
          )}
        </div>
      </div>
    </div>
    <textarea
      value={newLogComment}
      onChange={(e) => setNewLogComment(e.target.value)}
      placeholder="Add a comment to the task discussion..."
      className="w-full px-4 py-2 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-teal-500 text-sm font-medium text-gray-700 mb-4"
    />
    <div className="flex items-center gap-2 mb-4">
      <motion.button
        onClick={startVoiceRecording}
        disabled={isRecording}
        className={`px-3 py-1 rounded-lg text-sm font-medium ${isRecording ? "bg-gray-400 cursor-not-allowed" : "bg-teal-600 text-white hover:bg-teal-700"}`}
        whileHover={{ scale: isRecording ? 1 : 1.05 }}
        whileTap={{ scale: isRecording ? 1 : 0.95 }}
      >
        {isRecording ? "Recording..." : "Record Comment (Hindi)"}
      </motion.button>
      <motion.button
        onClick={handleTranslateComment}
        className="px-3 py-1 rounded-lg text-sm font-medium bg-purple-600 text-white hover:bg-purple-700"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        Translate to English
      </motion.button>
    </div>

    {/* --- Buttons ----------------------------------------------------- */}
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
        disabled={
          !newStatus || (sprints.length && !selectedSprint) || isUpdating
        }
        className={`px-4 py-2 bg-teal-600 text-white rounded-md text-sm font-medium ${
          !newStatus || (sprints.length && !selectedSprint) || isUpdating
            ? "opacity-50 cursor-not-allowed"
            : ""
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

/* ------------------------------------------------------------------ */
/*  Task Details Modal (restored from earlier code with all details)  */
/* ------------------------------------------------------------------ */
const TaskDetailsModal = ({ task, taskLogs, users, onClose }) => (
  <div>
    <div className="flex flex-row gap-4 mb-4">
      <div className="flex-1 space-y-3">
        <p className="text-sm font-medium text-gray-700"><strong>Title:</strong> {task?.title || "Untitled Task"}</p>
        <p className="text-sm font-medium text-gray-700"><strong>Description:</strong> {task?.description || "No description"}</p>
        <p className="text-sm font-medium text-gray-700"><strong>Assigned By:</strong> {task?.createdBy ? users.find((u) => u.id === task.createdBy)?.name || "Unknown" : "Unknown"}</p>
        <p className="text-sm font-medium text-gray-700"><strong>Status:</strong> {(task?.status || "not_started").replace("_", " ")}</p>
        <p className="text-sm font-medium text-gray-700"><strong>Assigned Date:</strong> {task?.assignedDate ? new Date(task.assignedDate).toLocaleDateString() : "N/A"}</p>
        <p className="text-sm font-medium text-gray-700"><strong>Deadline:</strong> {task?.deadline ? new Date(task.deadline).toLocaleDateString() : "No deadline"}</p>
        <p className="text-sm font-medium text-gray-700"><strong>Resources:</strong> {task?.resources || "No resources"}</p>

        {task.sprints?.length > 0 && (
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
              const sprint = log.sprintId ? task.sprints.find((s) => s.id === log.sprintId) : null;
              const prefix = sprint ? `[${sprint.title || "Untitled Sprint"}] ` : "[Main] ";
              return (
                <div key={log.id} className="p-3 bg-gray-50 rounded-lg shadow-sm border border-gray-200">
                  <p className="text-xs text-gray-600">
                    {prefix}{users.find((u) => u.id === log.userId)?.name || "Unknown"} ({new Date(log.createdAt).toLocaleString()}):
                  </p>
                  <p className="text-sm text-gray-700">{log.details}</p>
                </div>
              );
            })
          )}
        </div>
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

/* ------------------------------------------------------------------ */
/*  Close Day Modal Content (from earlier code)                       */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
export default function MemberDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  /* ------------- local UI state ---------------- */
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [selectedTask, setSelectedTask] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showCloseDayModal, setShowCloseDayModal] = useState(false);
  const [showComingSoonModal, setShowComingSoonModal] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [selectedSprint, setSelectedSprint] = useState("");
  const [sprints, setSprints] = useState([]);
  const [taskLogs, setTaskLogs] = useState([]);
  const [newLogComment, setNewLogComment] = useState("");
  const [closeDayComment, setCloseDayComment] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [sendNotification, setSendNotification] = useState(true);
  const [sendWhatsapp, setSendWhatsapp] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isRecording, setIsRecording] = useState(false);

  const {
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
  } = useDashboardData(session, selectedDate);

  const { activeSlot, timeLeft } = useSlotTiming(mriData);

  /* redirect non‑members */
  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "member") {
      router.push(
        session.user.role === "admin" ? "/dashboard/admin" : "/dashboard/team_manager"
      );
    }
  }, [status, session, router]);

  /* ------------------------------------------------------------------ */
  /*  Helpers: fetch sprints / logs, notify assignees (chat only)       */
  /* ------------------------------------------------------------------ */
  const fetchSprints = async (taskId, memberId) => {
    const key = `sprints:${taskId}:${memberId}`;
    if (taskCache.has(key)) {
      setSprints(taskCache.get(key));
      return;
    }
    try {
      const r = await fetch(
        `/api/member/assignedTasks?taskId=${taskId}&memberId=${memberId}&action=sprints`
      );
      const d = await r.json();
      if (r.ok) {
        taskCache.set(key, d.sprints || []);
        setSprints(d.sprints || []);
      }
    } catch (err) {
      console.error("fetchSprints error:", err.message);
    }
  };

  const fetchTaskLogs = async (taskId) => {
    try {
      const r = await fetch(
        `/api/member/assignedTasks?taskId=${taskId}&action=logs`
      );
      const d = await r.json();
      if (r.ok) setTaskLogs(d.logs || []);
    } catch (err) {
      console.error("fetchTaskLogs error:", err.message);
    }
  };

  const notifyAssigneesChat = async (taskId, messageContent) => {
    if (!sendNotification) return;
    try {
      const r = await fetch(`/api/member/assignedTasks?taskId=${taskId}&action=assignees`);
      const d = await r.json();
      if (!r.ok) return;
      const list = d.assignees || [];
      await Promise.all(
        list
          .filter((a) => a.memberId !== user?.id)
          .map((a) =>
            fetch("/api/others/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId: user?.id,
                recipientId: a.memberId,
                message: messageContent,
              }),
            }).then((res) => {
              if (!res.ok) {
                console.error(`Chat request failed: ${res.status} ${res.statusText}`);
              }
              return res;
            })
          )
      );
    } catch (err) {
      console.error("notifyAssigneesChat error:", err.message);
    }
  };

  /* listen for chat-originated task clicks */
  useEffect(() => {
    const handler = async (e) => {
      const { taskId, sprintId } = e.detail || {};
      if (!taskId) return;

      /* ensure tasks are loaded */
      const task = state.assignedTasks.find((t) => t.id === taskId);
      if (!task) return;               // not for this member

      /* switch tab & open details */
      setActiveTab("assigned");

      /* allow the AssignedTasksView to mount before we open modal */
      setTimeout(async () => {
        setSelectedTask(task);
        await fetchTaskLogs(taskId);
        await fetchSprints(taskId, user?.id);

        if (sprintId) {
          /* highlight sprint inside modal */
          setSelectedSprint(String(sprintId));
        }
        setShowDetailsModal(true);
      }, 0);
    };

    window.addEventListener("member-open-task", handler);
    return () => window.removeEventListener("member-open-task", handler);
  }, [state.assignedTasks, user?.id]);

  /* ------------------------------------------------------------------ */
  /*  Voice recording for comments                                      */
  /* ------------------------------------------------------------------ */
  const startVoiceRecording = () => {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "hi-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setIsRecording(true);

    recognition.start();

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setNewLogComment(prev => prev ? prev + ' ' + transcript : transcript);
      setIsRecording(false);
    };

    recognition.onerror = (event) => {
      console.error("Voice recognition error:", event.error);
      setError(`Voice recognition error: ${event.error}`);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };
  };

  const handleTranslateComment = () => {
    setShowComingSoonModal(true);
  };

  /* ------------------------------------------------------------------ */
  /*  Handle status update (task or sprint)                             */
  /* ------------------------------------------------------------------ */
  const handleStatusUpdate = async () => {
  if (!selectedTask || !newStatus) return;
  setIsUpdating(true);

  const isSprint = sprints.length && selectedSprint;
  const body = isSprint
    ? {
        sprintId: parseInt(selectedSprint),
        status: newStatus,
        taskId: selectedTask.id,
        memberId: user?.id,
        action: "update_sprint",
        notifyAssignees: sendNotification,
        notifyWhatsapp: sendWhatsapp,
        newLogComment: newLogComment || "No log provided", // Send log for WhatsApp
      }
    : {
        taskId: selectedTask.id,
        status: newStatus,
        memberId: user?.id,
        action: "update_task",
        notifyAssignees: sendNotification,
        notifyWhatsapp: sendWhatsapp,
        newLogComment: newLogComment || "No log provided", // Send log for WhatsApp
      };

  try {
    const r = await fetch("/api/member/assignedTasks/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Update failed");

    dispatch({
      type: "UPDATE_TASK_STATUS",
      taskId: selectedTask.id,
      status: newStatus,
      sprintId: isSprint ? parseInt(selectedSprint) : undefined,
    });

    taskCache.set(
      `assignedTasks:${selectedDate}:${session?.user?.id}`,
      state.assignedTasks
    );

    setSuccess("Task status updated!");
    setShowStatusModal(false);
    /* reset modal state */
    setSelectedTask(null);
    setNewStatus("");
    setSelectedSprint("");
    setSprints([]);
    setTaskLogs([]);
    setNewLogComment("");
    setSendNotification(true);
    setSendWhatsapp(false);
    setTimeout(() => setSuccess(""), 2500);
  } catch (e) {
    setError(e.message || "Update failed");
    setTimeout(() => setError(""), 2500);
  } finally {
    setIsUpdating(false);
  }
};

  /* ------------------------------------------------------------------ */
  /*  Handle “close day”                                                */
  /* ------------------------------------------------------------------ */
  const handleCloseDay = async () => {
    try {
      const r = await fetch("/api/member/routine-tasks?action=closeDay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id,
          date: selectedDate,
          tasks: state.closeDayTasks,
          comment: closeDayComment,
        }),
      });
      if (!r.ok) throw new Error("Close-day failed");
      setSuccess("Day closed!");
      setCanCloseDay(false);
      setShowCloseDayModal(false);
      setActiveTab("dashboard");
      setCloseDayComment("");
      dispatch({
        type: "SET_ROUTINE_TASKS",
        payload: state.routineTasks.map((t) => {
          const upd = state.closeDayTasks.find((x) => x.id === t.id);
          return upd?.markAsCompleted
            ? { ...t, status: "completed", isLocked: true }
            : { ...t, isLocked: true };
        }),
      });
      taskCache.delete(`routineTasks:${selectedDate}:${session?.user?.id}`);
      setTimeout(() => setSuccess(""), 2500);
    } catch (e) {
      setError(e.message);
      setTimeout(() => setError(""), 2500);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Utility helpers for UI                                            */
  /* ------------------------------------------------------------------ */
  const getAssignedBy = (createdBy) => {
    const u = users.find((x) => x.id === createdBy);
    if (!u) return "Unknown";
    if (u.role === "admin") return "Superintendent";
    if (u.role === "team_manager")
      return u.team_manager_type
        ? u.team_manager_type
            .split("_")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ")
        : "Team Manager";
    return u.type
      ? u.type
          .split("_")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ")
      : "Member";
  };

  const getTODName = (memberId) => {
    if (!memberId) return "Unassigned";
    if (String(memberId) === String(session?.user?.id))
      return `${session.user.name} (You)`;
    return users.find((m) => String(m.id) === String(memberId))?.name || "Unassigned";
  };

  /* ------------------------------------------------------------------ */
  /*  Loading screen                                                    */
  /* ------------------------------------------------------------------ */
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

  /* ------------------------------------------------------------------ */
  /*  Render                                                            */
  /* ------------------------------------------------------------------ */
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="fixed inset-0 bg-gray-100 p-6 flex items-center justify-center"
    >
      <div className="w-full h-full bg-white rounded-2xl shadow-2xl p-6 flex flex-col gap-4 overflow-y-auto">
        {/* toast messages */}
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

        {/* main tabs */}
        <AnimatePresence mode="wait">
          {activeTab === "dashboard" && (
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
          )}

          {activeTab === "assigned" && (
            <AssignedTasksView
              handleBack={() => setActiveTab("dashboard")}
              assignedTasks={state.assignedTasks}
              isLoadingAssignedTasks={isLoadingAssignedTasks}
              selectedDate={selectedDate}
              handleTaskSelect={async (t) => {
                setSelectedTask(t);
                setNewStatus(t.status || "not_started");
                await fetchSprints(t.id, user?.id);
                await fetchTaskLogs(t.id);
                setShowStatusModal(true);
              }}
              handleSprintSelect={async (t, s) => {
                setSelectedTask(t);
                setNewStatus(s.status || "not_started");
                setSprints(t.sprints || []);
                setSelectedSprint(String(s.id));
                await fetchTaskLogs(t.id);
                setShowStatusModal(true);
              }}
              handleTaskDetails={async (t) => {
                setSelectedTask(t);
                await fetchTaskLogs(t.id);
                await fetchSprints(t.id, user?.id);
                setShowDetailsModal(true);
              }}
              users={users}
              assignedTaskSummary={state.assignedTaskSummary}
            />
          )}

          {activeTab === "routine" && (
            <RoutineTasksView
              handleBack={() => setActiveTab("dashboard")}
              routineTasks={state.routineTasks}
              isLoadingRoutineTasks={isLoadingRoutineTasks}
              selectedDate={selectedDate}
              canCloseDay={canCloseDay}
              closeDayTasks={state.closeDayTasks}
              closeDayComment={closeDayComment}
              setCloseDayTasks={(tasks) =>
                dispatch({ type: "SET_CLOSE_DAY_TASKS", payload: tasks })
              }
              setCloseDayComment={setCloseDayComment}
              handleCloseDay={handleCloseDay}
              setShowCloseDayModal={setShowCloseDayModal}
              routineTaskSummary={state.routineTaskSummary}
            />
          )}
        </AnimatePresence>

        {/* --- Modals --------------------------------------------------- */}
        <Modal
          isOpen={showStatusModal}
          onClose={() => setShowStatusModal(false)}
          title="Update Task Status"
        >
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
            sendWhatsapp={sendWhatsapp}
            setSendWhatsapp={setSendWhatsapp}
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
              setSendWhatsapp(false);
            }}
            startVoiceRecording={startVoiceRecording}
            isRecording={isRecording}
            handleTranslateComment={handleTranslateComment}
          />
        </Modal>

        <Modal
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedTask(null);
            setTaskLogs([]);
          }}
          title="Task Details"
        >
          <TaskDetailsModal task={selectedTask} taskLogs={taskLogs} users={users} onClose={() => {
            setShowDetailsModal(false);
            setSelectedTask(null);
            setTaskLogs([]);
          }} />
        </Modal>

        <Modal
          isOpen={showCloseDayModal}
          onClose={() => setShowCloseDayModal(false)}
          title="Close Day"
        >
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

        <Modal
          isOpen={showComingSoonModal}
          onClose={() => setShowComingSoonModal(false)}
          title="Coming Soon"
        >
          <p>Translation is coming soon.</p>
          <div className="flex justify-end mt-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowComingSoonModal(false)}
              className="px-4 py-2 bg-teal-600 text-white rounded-md text-sm font-medium"
            >
              Close
            </motion.button>
          </div>
        </Modal>
      </div>
    </motion.div>
  );
}