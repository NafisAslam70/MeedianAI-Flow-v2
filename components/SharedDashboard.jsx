// app/(main)/member/sharedDashboard/page.jsx
"use client";

import { useState, useEffect, useReducer, useMemo, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  FileText,
  Calendar,
  CheckSquare,
  List,
  FilePlus,
  X,
  Sparkles,
  Activity,
  Clock,
} from "lucide-react";

import AssignedTaskDetails from "@/components/assignedTaskCardDetailForAll";
import UpdateStatusForAll from "@/components/UpdateStatusForAll";
import AssignedTasksView from "@/components/member/AssignedTasksView";
import RoutineTasksView from "@/components/member/RoutineTasksView";
import MyNotes from "@/components/MyNotes";
import RoutineTrackerModal from "@/components/member/RoutineTrackerModal";
import { DeepCalendarModal, ActiveBlockView, fromMinutes } from "@/components/DeepCalendar";

/* ------------------------------------------------------------------ */
/*  DeepCalendar helpers                                               */
/* ------------------------------------------------------------------ */
const DC_ORIGIN = "https://deep-calendar.vercel.app";

function dcUrl(path, token) {
  if (!token) throw new Error("No DeepCalendar token provided");
  const base = DC_ORIGIN.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}/api/public/${token}${p}`;
}
async function getJsonAbs(url) {
  try {
    const r = await fetch(url, { mode: "cors", cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } catch {
    return null;
  }
}
function fmtHM(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/* ------------------------------------------------------------------ */
/*  In-memory cache, helpers                                           */
/* ------------------------------------------------------------------ */
const taskCache = new Map();
const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
    return r.json();
  });
const formatTimeLeft = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

const clamp0 = (n) => Math.max(0, Number.isFinite(n) ? n : 0);

/* ------------------------------------------------------------------ */
/*  Derived task status helper & reducer                               */
/* ------------------------------------------------------------------ */
const deriveTaskStatus = (sprints) => {
  if (!sprints || sprints.length === 0) return "not_started";
  const statuses = sprints.map((s) => s.status);
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

const summarise = (arr) =>
  arr.reduce(
    (a, t) => ({
      total: a.total + 1,
      notStarted: a.notStarted + (t.status === "not_started"),
      inProgress: a.inProgress + (t.status === "in_progress"),
      pendingVerification: a.pendingVerification + (t.status === "pending_verification"),
      completed: a.completed + (t.status === "verified" || t.status === "done"),
    }),
    { total: 0, notStarted: 0, inProgress: 0, pendingVerification: 0, completed: 0 }
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
          const sprints = t.sprints.map((s) => (s.id === action.sprintId ? { ...s, status: action.status } : s));
          return { ...t, sprints, status: deriveTaskStatus(sprints) };
        }
        return { ...t, status: action.status };
      });
      return { ...state, assignedTasks: updated, assignedTaskSummary: summarise(updated) };
    }
    case "SET_CLOSE_DAY_TASKS":
      return { ...state, closeDayTasks: action.payload };
    default:
      return state;
  }
};

/* ------------------------------------------------------------------ */
/*  Data-fetch hook                                                    */
/* ------------------------------------------------------------------ */
const useDashboardData = (session, selectedDate, role, router, viewUserId = null) => {
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
  const [error, setError] = useState("");
  const [dcLoading, setDcLoading] = useState(true);
  const [todayItems, setTodayItems] = useState([]);
  const [todayWindow, setTodayWindow] = useState(null);
  const [goals, setGoals] = useState([]);
  const [dayPack, setDayPack] = useState(null);
  const [dcToken, setDcToken] = useState(null);

  const { data: mriData, error: mriError } = useSWR(
    viewUserId || user
      ? `/api/member/myMRIs?section=today&userId=${viewUserId || user.id}&date=${selectedDate}`
      : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  // Current MRN (for the viewing user). Refreshed every 10s.
  const { data: currentMrnData } = useSWR(
    session?.user ? "/api/member/meRightNow?action=current" : null,
    fetcher,
    { refreshInterval: 10000, revalidateOnFocus: false }
  );

  // DeepCalendar token
  useEffect(() => {
    const fetchDeepCalendarToken = async () => {
      if (!session?.user?.id) return;
      try {
        const response = await fetch("/api/member/deep-calendar", { method: "GET", headers: { "Content-Type": "application/json" } });
        if (response.ok) {
          const { deep_calendar_token } = await response.json();
          setDcToken(deep_calendar_token);
        } else {
          setError("Failed to fetch DeepCalendar token");
          setTimeout(() => setError(""), 3000);
        }
      } catch {
        setError("Failed to fetch DeepCalendar token");
        setTimeout(() => setError(""), 3000);
      }
    };
    fetchDeepCalendarToken();
  }, [session]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        let url = "/api/member/profile";
        if (viewUserId) url += `?userId=${viewUserId}`;
        const r = await fetch(url);
        if (role === "team_manager" && r.status === 401) {
          setError("Unauthorized access. Please log in again.");
          setTimeout(() => setError(""), 3000);
          router.push("/login");
          return;
        }
        const d = await r.json();
        if (r.ok) {
          setUser(d.user);
          fetchOpenCloseTimes(d.user.type);
        }
      } catch {
        setError("Failed to fetch user profile. Please try again.");
        setTimeout(() => setError(""), 3000);
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
      } catch {}
    };

    const fetchOpenCloseTimes = async (userType) => {
      if (!userType) return;
      try {
        const r = await fetch(`/api/member/openCloseTimes?userType=${userType}`);
        const d = await r.json();
        if (r.ok) {
          setOpenCloseTimes(d.times);
          const now = new Date();
          const start = new Date(d.times.closingWindowStart);
          const end = new Date(d.times.closingWindowEnd);
          setCanCloseDay(now >= start && now <= end);
        }
      } catch {}
    };

    const fetchAssignedTasks = async () => {
      const key = `assignedTasks:${selectedDate}:${viewUserId || session?.user?.id}`;
      if (taskCache.has(key)) {
        dispatch({ type: "SET_ASSIGNED_TASKS", payload: taskCache.get(key) });
        return;
      }
      setIsLoadingAssignedTasks(true);
      try {
        let url = `/api/member/assignedTasks?date=${selectedDate}&action=tasks`;
        if (viewUserId) url += `&userId=${viewUserId}`;
        const r = await fetch(url);
        if (role === "team_manager" && r.status === 401) {
          setError("Unauthorized access. Please log in again.");
          setTimeout(() => setError(""), 3000);
          router.push("/login");
          return;
        }
        const d = await r.json();
        if (r.ok) {
          const tasks = (d.tasks || []).map((t) => (t.sprints?.length ? { ...t, status: deriveTaskStatus(t.sprints) } : t));
          taskCache.set(key, tasks);
          dispatch({ type: "SET_ASSIGNED_TASKS", payload: tasks });
        }
      } catch {}
      finally {
        setIsLoadingAssignedTasks(false);
      }
    };

    const fetchRoutineTasks = async () => {
      const key = `routineTasks:${selectedDate}:${viewUserId || session?.user?.id}`;
      if (taskCache.has(key)) {
        dispatch({ type: "SET_ROUTINE_TASKS", payload: taskCache.get(key) });
        return;
      }
      setIsLoadingRoutineTasks(true);
      try {
        let url = `/api/member/routine-tasks?action=routineTasks&date=${selectedDate}`;
        if (viewUserId) url += `&userId=${viewUserId}`;
        const r = await fetch(url);
        if (role === "team_manager" && r.status === 401) {
          setError("Unauthorized access. Please log in again.");
          setTimeout(() => setError(""), 3000);
          router.push("/login");
          return;
        }
        const d = await r.json();
        if (r.ok) {
          taskCache.set(key, d.tasks || []);
          dispatch({ type: "SET_ROUTINE_TASKS", payload: d.tasks || [] });
        }
      } catch {}
      finally {
        setIsLoadingRoutineTasks(false);
      }
    };

    const fetchDeepCalendarData = async () => {
      setDcLoading(true);
      if (!dcToken) {
        setDcLoading(false);
        return;
      }
      const date = selectedDate;
      const weekday = new Date(date).getDay();
      const [routineRes, goalsRes, dayRes] = await Promise.all([
        getJsonAbs(dcUrl(`/routine?weekday=${weekday}`, dcToken)),
        getJsonAbs(dcUrl(`/goals`, dcToken)),
        getJsonAbs(dcUrl(`/day?date=${encodeURIComponent(date)}`, dcToken)),
      ]);
      if (routineRes) {
        const items = Array.isArray(routineRes.items) ? routineRes.items : [];
        setTodayItems(items.sort((a, b) => a.startMin - b.startMin));
        setTodayWindow(routineRes.window ?? null);
      }
      if (goalsRes) setGoals(Array.isArray(goalsRes) ? goalsRes : goalsRes.goals ?? []);
      if (dayRes) setDayPack(dayRes.pack ?? null);
      setDcLoading(false);
    };

    fetchUser();
    fetchAllUsers();
    fetchAssignedTasks();
    fetchRoutineTasks();
    fetchDeepCalendarData();
  }, [session, selectedDate, viewUserId, dcToken, router, role]);

  return {
    state,
    dispatch,
    user,
    users,
    mriData,
    mriError,
    currentMrn: currentMrnData?.current || null,
    openCloseTimes,
    canCloseDay,
    isLoadingAssignedTasks,
    isLoadingRoutineTasks,
    error,
    setError,
    dcLoading,
    todayItems,
    setTodayItems,
    todayWindow,
    setTodayWindow,
    goals,
    setGoals,
    dayPack,
    setDayPack,
    dcToken,
    setDcToken,
  };
};

/* ------------------------------------------------------------------ */
/*  Slot timing                                                        */
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
        ? new Date(now).setDate(now.getDate() - 1) && new Date(now).toDateString()
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
      const remain = Math.max(0, Math.floor((found.endTime.getTime() - Date.now()) / 1000));
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
/*  Modal                                                              */
/* ------------------------------------------------------------------ */
const Modal = ({ isOpen, onClose, title, children }) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 z-[60]"
      >
        <motion.div
          initial={{ y: 30, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 30, opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl p-4 sm:p-8 w-full max-w-[95vw] sm:max-w-lg border border-gray-100/30"
        >
          <motion.button
            whileHover={{ scale: 1.08, rotate: 90 }}
            whileTap={{ scale: 0.92 }}
            onClick={onClose}
            className="absolute top-4 right-4 p-1 bg-gray-100/80 hover:bg-gray-200/80 rounded-full border border-gray-200"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-gray-700 dark:text-gray-200" />
          </motion.button>
          <h2 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mb-6">{title}</h2>
          {children}
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

/* ------------------------------------------------------------------ */
/*  Close Day Modal Content                                            */
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
  <div className="space-y-6">
    {closeDayTasks.map((task) => (
      <div key={task.id} className="flex items-center space-x-4">
        <input
          type="checkbox"
          checked={task.markAsCompleted}
          onChange={(e) =>
            setCloseDayTasks(
              closeDayTasks.map((t) => (t.id === task.id ? { ...t, markAsCompleted: e.target.checked } : t))
            )
          }
          className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 rounded border-gray-300 transition duration-200"
          disabled={routineTasks.find((t) => t.id === task.id)?.isLocked}
        />
        <p className="text-sm sm:text-base font-medium text-gray-800 dark:text-gray-200">{task.description}</p>
      </div>
    ))}
    <textarea
      value={closeDayComment}
      onChange={(e) => setCloseDayComment(e.target.value)}
      placeholder="Add a comment (optional)"
      className="w-full px-4 py-3 border border-gray-200/40 rounded-xl bg-white/40 dark:bg-slate-800/40 backdrop-blur-md focus:ring-2 focus:ring-indigo-500 text-sm sm:text-base text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 transition duration-200"
    />
    <div className="flex justify-end space-x-4">
      <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={onClose}
        className="px-6 py-3 bg-gray-200/70 text-gray-800 dark:text-gray-200 rounded-xl text-sm sm:text-base font-medium hover:bg-gray-300/70 dark:hover:bg-gray-600/70 transition-all duration-200">
        Cancel
      </motion.button>
      <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={onConfirm}
        className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm sm:text-base font-medium hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-800 transition-all duration-200">
        Close Day
      </motion.button>
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Tilt wrapper (subtle 3D)                                           */
/* ------------------------------------------------------------------ */
const TiltCard = ({ children, className = "", hover = true }) => {
  const ref = useRef(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const tRx = useTransform(rx, [-20, 20], [-8, 8]);
  const tRy = useTransform(ry, [-20, 20], [8, -8]);

  const onMove = (e) => {
    if (!hover || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const px = (x / r.width) * 40 - 20;
    const py = (y / r.height) * 40 - 20;
    rx.set(py);
    ry.set(px);
  };
  const onLeave = () => {
    rx.set(0);
    ry.set(0);
  };

  return (
    <motion.div
      ref={ref}
      style={{ rotateX: tRx, rotateY: tRy }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/* ------------------------------------------------------------------ */
/*  Reusable UI bits                                                   */
/* ------------------------------------------------------------------ */
const PrimaryButton = ({ children, onClick }) => (
  <motion.button
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className="rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2 text-xs sm:text-sm text-white hover:from-indigo-700 hover:to-blue-700 transition-all duration-200"
  >
    {children}
  </motion.button>
);
const GhostButton = ({ children, onClick }) => (
  <motion.button
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className="rounded-2xl border border-gray-100/30 dark:border-white/10 px-4 py-2 text-xs sm:text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-100/60 dark:hover:bg-slate-700/60 transition-all duration-200"
  >
    {children}
  </motion.button>
);
const DangerGhostButton = ({ children, onClick }) => (
  <motion.button
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className="rounded-2xl border border-red-100/30 px-4 py-2 text-xs sm:text-sm text-red-600 dark:text-red-400 hover:bg-red-100/60 dark:hover:bg-red-900/60 transition-all duration-200"
  >
    {children}
  </motion.button>
);

const InfoTile = ({ label, value, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.96 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.3, delay }}
    className="rounded-2xl border border-gray-100/30 dark:border-white/10 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md p-4"
  >
    <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{label}</div>
    <div className="mt-1 text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-200">{value}</div>
  </motion.div>
);

const SkeletonStats = () => (
  <div className="grid grid-cols-2 gap-3">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="h-12 w-full animate-pulse rounded-2xl bg-gray-200/50 dark:bg-slate-700/40" />
    ))}
  </div>
);

const StatPill = ({ tone, label, value }) => {
  const map = {
    indigo: "bg-indigo-50/70 dark:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300",
    blue: "bg-blue-50/70 dark:bg-blue-900/70 text-blue-700 dark:text-blue-300",
    yellow: "bg-yellow-50/70 dark:bg-yellow-900/70 text-yellow-700 dark:text-yellow-300",
    orange: "bg-orange-50/70 dark:bg-orange-900/70 text-orange-700 dark:text-orange-300",
    green: "bg-green-50/70 dark:bg-green-900/70 text-green-700 dark:text-green-300",
  };
  return (
    <div className={`rounded-2xl p-3 text-center ${map[tone] || ""}`}>
      <div className="text-xs sm:text-sm opacity-80">{label}</div>
      <div className="text-base sm:text-lg font-bold">{value}</div>
    </div>
  );
};
const StatGrid = ({ stats }) => (
  <div className="grid grid-cols-2 gap-3">
    {stats.map(([label, value, tone]) => (
      <StatPill key={label} label={label} value={value} tone={tone} />
    ))}
  </div>
);

const CompletionRing = ({ pct = 0, size = 44, stroke = 5 }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <svg width={size} height={size} className="block">
      <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} stroke="currentColor" className="text-gray-200 dark:text-slate-700" fill="none" />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={stroke}
        strokeLinecap="round"
        stroke="url(#grad)"
        fill="none"
        initial={{ strokeDasharray: `0 ${c}` }}
        animate={{ strokeDasharray: `${dash} ${c - dash}` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
      <defs>
        <linearGradient id="grad" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
      </defs>
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
export default function SharedDashboard({ role, viewUserId = null, embed = false }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  // ui state
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showCloseDayModal, setShowCloseDayModal] = useState(false);
  const [showComingSoonModal, setShowComingSoonModal] = useState(false);
  const [showDeepCalendarModal, setShowDeepCalendarModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showRoutineTrackerModal, setShowRoutineTrackerModal] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [selectedSprint, setSelectedSprint] = useState("");
  const [sprints, setSprints] = useState([]);
  const [taskLogs, setTaskLogs] = useState([]);
  const [newLogComment, setNewLogComment] = useState("");
  const [closeDayComment, setCloseDayComment] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [sendNotification, setSendNotification] = useState(true);
  const [sendWhatsapp, setSendWhatsapp] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [tokenInput, setTokenInput] = useState("");

  // force dark theme on this view
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("dark");
    return () => {};
  }, []);

  // data hook
  const {
    state,
    dispatch,
    user,
    users,
    mriData,
    mriError,
    currentMrn,
    openCloseTimes,
    canCloseDay,
    isLoadingAssignedTasks,
    isLoadingRoutineTasks,
    dcLoading,
    todayItems,
    setTodayItems,
    todayWindow,
    setTodayWindow,
    goals,
    setGoals,
    dayPack,
    setDayPack,
    dcToken,
    setDcToken,
  } = useDashboardData(session, selectedDate, role, router, viewUserId);

  const { activeSlot, timeLeft } = useSlotTiming(mriData);

  // General Dashboard-style current block (from slots)
  const { data: slotData } = useSWR("/api/admin/manageMeedian?section=slots", fetcher);
  const [slotsGD, setSlotsGD] = useState([]);
  const [currentSlotGD, setCurrentSlotGD] = useState(null);
  const [currentBlockGD, setCurrentBlockGD] = useState(null);
  const [timeLeftGD, setTimeLeftGD] = useState(null);

  useEffect(() => {
    if (slotData && Array.isArray(slotData.slots)) setSlotsGD(slotData.slots);
  }, [slotData]);

  useEffect(() => {
    let intervalId = null;
    const now = new Date();
    let foundSlot = null;
    for (const slot of slotsGD) {
      if (
        !slot?.startTime ||
        !slot?.endTime ||
        !/^\d{2}:\d{2}:\d{2}$/.test(slot.startTime) ||
        !/^\d{2}:\d{2}:\d{2}$/.test(slot.endTime)
      ) continue;

      const startHours = parseInt(slot.startTime.split(":")[0], 10);
      const endHours = parseInt(slot.endTime.split(":")[0], 10);
      const isMidnightSpanning = endHours < startHours;
      let startDate = now.toDateString();
      let endDate = now.toDateString();
      if (isMidnightSpanning) {
        const prevDay = new Date(now);
        prevDay.setDate(now.getDate() - 1);
        startDate = prevDay.toDateString();
      }
      const startTime = new Date(`${startDate} ${slot.startTime}`);
      const endTime = new Date(`${endDate} ${slot.endTime}`);
      if (isNaN(startTime) || isNaN(endTime)) continue;
      if (now >= startTime && now <= endTime) {
        foundSlot = slot;
        break;
      }
    }

    let foundBlock = null;
    if (foundSlot) {
      const id = Number(foundSlot.id);
      if (id >= 1 && id <= 6) foundBlock = `BLOCK 1: ${foundSlot.name}`;
      else if (id >= 7 && id <= 9) foundBlock = `BLOCK 2: ${foundSlot.name}`;
      else if (id >= 10 && id <= 11) foundBlock = `BLOCK 3: ${foundSlot.name}`;
      else if (id >= 12 && id <= 14) foundBlock = `BLOCK 4: ${foundSlot.name}`;
      else if (id >= 15 && id <= 16) foundBlock = `BLOCK 5: ${foundSlot.name}`;
      else if (id === 17) foundBlock = `BLOCK 6: ${foundSlot.name}`;

      const endDate = now.toDateString();
      const endTime = new Date(`${endDate} ${foundSlot.endTime}`);
      if (endTime < now) endTime.setDate(endTime.getDate() + 1);
      const secondsLeft = Math.max(0, Math.floor((endTime - now) / 1000));
      setTimeLeftGD(secondsLeft);
      const tick = () => {
        const currentTime = new Date();
        const newSecondsLeft = Math.max(0, Math.floor((endTime - currentTime) / 1000));
        setTimeLeftGD(newSecondsLeft);
        if (newSecondsLeft <= 0) {
          clearInterval(intervalId);
          setCurrentSlotGD(null);
          setCurrentBlockGD(null);
          setTimeLeftGD(null);
        }
      };
      intervalId = setInterval(tick, 1000);
    }

    setCurrentSlotGD(foundSlot);
    setCurrentBlockGD(foundBlock);
    return () => intervalId && clearInterval(intervalId);
  }, [slotsGD]);

  const getTODName = (slot) => {
    if (!slot || !slot.assignedMemberId) return "Unassigned";
    if (String(slot.assignedMemberId) === String(session?.user?.id)) return `${session?.user?.name} (you)`;
    const member = (users || []).find((m) => String(m.id) === String(slot.assignedMemberId));
    return member?.name || "Unassigned";
  };

  const nowMin = useMemo(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  }, []);
  const activeBlock = useMemo(
    () => todayItems.find((b) => b.startMin <= nowMin && nowMin < b.endMin) || null,
    [todayItems, nowMin]
  );
  const goalById = useMemo(() => {
    const map = {};
    (goals || []).forEach((g) => { map[g.id] = g; });
    return map;
  }, [goals]);

  // redirect non-members
  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== role && !viewUserId) {
      router.push(
        session.user.role === "admin"
          ? "/dashboard/admin"
          : session.user.role === "team_manager"
          ? "/dashboard/team_manager"
          : "/dashboard/member"
      );
    }
  }, [status, session, router, role, viewUserId]);

  /* ------------------------------------------- */
  /*  Task helpers                               */
  /* ------------------------------------------- */
  const fetchSprints = async (taskId, memberId) => {
    memberId = viewUserId || user?.id;
    const key = `sprints:${taskId}:${memberId}`;
    if (taskCache.has(key)) {
      setSprints(taskCache.get(key));
      return;
    }
    try {
      const r = await fetch(`/api/member/assignedTasks?taskId=${taskId}&memberId=${memberId}&action=sprints`);
      if (role === "team_manager" && r.status === 401) {
        setError("Unauthorized access. Please log in again.");
        setTimeout(() => setError(""), 3000);
        router.push("/login");
        return;
      }
      const d = await r.json();
      if (r.ok) {
        taskCache.set(key, d.sprints || []);
        setSprints(d.sprints || []);
      }
    } catch (err) {
      setError("Failed to fetch sprints. Please try again.");
      setTimeout(() => setError(""), 3000);
    }
  };

  const fetchTaskLogs = async (taskId) => {
    try {
      const r = await fetch(`/api/member/assignedTasks?taskId=${taskId}&action=logs`);
      if (role === "team_manager" && r.status === 401) {
        setError("Unauthorized access. Please log in again.");
        setTimeout(() => setError(""), 3000);
        router.push("/login");
        return;
      }
      const d = await r.json();
      if (r.ok) setTaskLogs(d.logs || []);
    } catch {
      setError("Failed to fetch task logs. Please try again.");
      setTimeout(() => setError(""), 3000);
    }
  };

  const fetchFullTask = async (taskId) => {
    try {
      const r = await fetch(`/api/member/assignedTasks?taskId=${taskId}&action=task`);
      if (r.ok) {
        const d = await r.json();
        return d.task;
      }
    } catch {
      setError("Failed to fetch full task details. Please try again.");
      setTimeout(() => setError(""), 3000);
    }
    return null;
  };

  const notifyAssigneesChat = async (taskId, messageContent) => {
    if (!sendNotification) return;
    try {
      const r = await fetch(`/api/member/assignedTasks?taskId=${taskId}&action=assignees`);
      if (!r.ok) return;
      const d = await r.json();
      const list = d.assignees || [];
      await Promise.all(
        list
          .filter((a) => a.memberId !== (viewUserId || user?.id))
          .map((a) =>
            fetch("/api/others/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId: session?.user?.id,
                recipientId: a.memberId,
                message: messageContent,
              }),
            })
          )
      );
    } catch {
      setError("Failed to send chat notifications. Please try again.");
      setTimeout(() => setError(""), 3000);
    }
  };

  // listen for chat-originated task clicks
  useEffect(() => {
    const handler = async (e) => {
      const { taskId, sprintId } = e.detail || {};
      if (!taskId) return;
      const task = state.assignedTasks.find((t) => t.id === taskId);
      if (!task) return;
      setActiveTab("assigned");
      setTimeout(async () => {
        setSelectedTask(task);
        await fetchTaskLogs(taskId);
        await fetchSprints(taskId, viewUserId || user?.id);
        if (sprintId) setSelectedSprint(String(sprintId));
        setShowDetailsModal(true);
      }, 0);
    };
    window.addEventListener("member-open-task", handler);
    return () => window.removeEventListener("member-open-task", handler);
  }, [state.assignedTasks, user?.id, viewUserId]);

  const startVoiceRecording = () => {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      setError("Speech recognition is not supported in this browser.");
      setTimeout(() => setError(""), 3000);
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
      setNewLogComment((prev) => (prev ? prev + " " + transcript : transcript));
      setIsRecording(false);
    };
    recognition.onerror = (event) => {
      setError(`Voice recognition error: ${event.error}`);
      setTimeout(() => setError(""), 3000);
      setIsRecording(false);
    };
    recognition.onend = () => setIsRecording(false);
  };

  const handleTranslateComment = () => setShowComingSoonModal(true);

  const handleAddLog = async () => {
    if (!newLogComment) {
      setError("Comment required");
      setTimeout(() => setError(""), 3000);
      return;
    }
    setIsUpdating(true);
    const body = { taskId: selectedTask.id, action: "log_added", details: newLogComment };
    if (selectedSprint) body.sprintId = parseInt(selectedSprint);
    try {
      const r = await fetch("/api/member/assignedTasks", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Add log failed");
      const newLog = { ...d.log, userName: session?.user?.name };
      setTaskLogs([newLog, ...taskLogs]);
      if (sendNotification) {
        let message = `Log added to task "${selectedTask.title}" by ${session?.user?.name}: ${newLogComment} [task:${selectedTask.id}]`;
        if (body.sprintId) message += ` [sprint:${body.sprintId}]`;
        await notifyAssigneesChat(selectedTask.id, message);
      }
      setNewLogComment("");
      setSuccess("Log added!");
      setTimeout(() => setSuccess(""), 2500);
    } catch (e) {
      setError(e.message || "Add log failed");
      setTimeout(() => setError(""), 3000);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!selectedTask || !newStatus) return;
    setIsUpdating(true);
    const isSprint = sprints.length && selectedSprint;
    const body = isSprint
      ? {
          sprintId: parseInt(selectedSprint),
          status: newStatus,
          taskId: selectedTask.id,
          memberId: viewUserId || user?.id,
          action: "update_sprint",
          notifyAssignees: sendNotification,
          notifyWhatsapp: sendWhatsapp,
          newLogComment: newLogComment || "",
        }
      : {
          taskId: selectedTask.id,
          status: newStatus,
          memberId: viewUserId || user?.id,
          action: "update_task",
          notifyAssignees: sendNotification,
          notifyWhatsapp: sendWhatsapp,
          newLogComment: newLogComment || "",
        };

    try {
      const r = await fetch("/api/member/assignedTasks", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Update failed");

      dispatch({
        type: "UPDATE_TASK_STATUS",
        taskId: selectedTask.id,
        status: newStatus,
        sprintId: isSprint ? parseInt(selectedSprint) : undefined,
      });

      taskCache.set(`assignedTasks:${selectedDate}:${viewUserId || session?.user?.id}`, state.assignedTasks);

      const updatedTask = state.assignedTasks.find((t) => t.id === selectedTask.id);
      if (updatedTask) setSelectedTask(updatedTask);

      if (newLogComment) await fetchTaskLogs(selectedTask.id);

      setSuccess("Task status updated!");
      setShowStatusModal(false);
      setNewStatus("");
      setSelectedSprint("");
      setNewLogComment("");
      setSendNotification(true);
      setSendWhatsapp(false);
      setTimeout(() => setSuccess(""), 2500);
    } catch (e) {
      setError(e.message || "Update failed");
      setTimeout(() => setError(""), 3000);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCloseDay = async () => {
    try {
      const r = await fetch("/api/member/routine-tasks?action=closeDay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: viewUserId || user?.id,
          date: selectedDate,
          tasks: state.closeDayTasks,
          comment: closeDayComment,
        }),
      });
      if (!r.ok) throw new Error("Close-day failed");
      setSuccess("Day closed!");
      setShowCloseDayModal(false);
      setCloseDayComment("");
      dispatch({
        type: "SET_ROUTINE_TASKS",
        payload: state.routineTasks.map((t) => {
          const upd = state.closeDayTasks.find((x) => x.id === t.id);
          return upd?.markAsCompleted ? { ...t, status: "completed", isLocked: true } : { ...t, isLocked: true };
        }),
      });
      taskCache.delete(`routineTasks:${selectedDate}:${viewUserId || session?.user?.id}`);
      setTimeout(() => setSuccess(""), 2500);
    } catch (e) {
      setError(e.message);
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleSaveToken = async () => {
    if (!tokenInput) {
      setError("Token is required");
      setTimeout(() => setError(""), 3000);
      return;
    }
    try {
      const r = await fetch("/api/member/deep-calendar", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deep_calendar_token: tokenInput }),
      });
      if (r.ok) {
        setDcToken(tokenInput);
        setTokenInput("");
        setSuccess("DeepCalendar token saved and linked!");
        setTimeout(() => setSuccess(""), 2500);
      } else {
        const { error: e } = await r.json();
        setError(e || "Failed to save token");
        setTimeout(() => setError(""), 3000);
      }
    } catch {
      setError("Failed to save token");
      setTimeout(() => setError(""), 3000);
    }
  };
  const handleRemoveToken = async () => {
    try {
      const r = await fetch("/api/member/deep-calendar", { method: "DELETE", headers: { "Content-Type": "application/json" } });
      if (r.ok) {
        setDcToken(null);
        setTodayItems([]);
        setTodayWindow(null);
        setGoals([]);
        setDayPack(null);
        setSuccess("DeepCalendar token removed!");
        setTimeout(() => setSuccess(""), 2500);
      } else {
        setError("Failed to remove token");
        setTimeout(() => setError(""), 3000);
      }
    } catch {
      setError("Failed to remove token");
      setTimeout(() => setError(""), 3000);
    }
  };

  // keyboard shortcuts: g d (dashboard), g a (assigned), g r (routine), n (notes)
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key.toLowerCase() === "n") setShowNotesModal(true);
      if (e.key.toLowerCase() === "g") {
        const next = (k) => {
          if (k === "d") setActiveTab("dashboard");
          if (k === "a") setActiveTab("assigned");
          if (k === "r") setActiveTab("routine");
          if (k === "l") setActiveTab("deepLife");
        };
        const handler = (ev) => {
          window.removeEventListener("keydown", handler, true);
          next(ev.key.toLowerCase());
        };
        window.addEventListener("keydown", handler, true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (status === "loading") {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50">
        <motion.div className="text-xl sm:text-3xl font-bold text-indigo-800 dark:text-indigo-200 flex items-center gap-4">
          <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="inline-block w-6 h-6 sm:w-8 sm:h-8 border-4 border-t-indigo-600 border-indigo-200 dark:border-t-indigo-400 dark:border-indigo-600 rounded-full" />
          Loading Dashboard...
        </motion.div>
      </motion.div>
    );
  }

  // completion ring
  const compPct =
    state.assignedTaskSummary.total === 0
      ? 0
      : Math.round((state.assignedTaskSummary.completed / state.assignedTaskSummary.total) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: "easeOut" }}
      /* BASE CONTAINER: DO NOT CHANGE sizing/padding signature */
      className="fixed inset-0 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-slate-900 dark:to-slate-950 p-2 sm:p-6 flex flex-col overflow-hidden min-w-0"
    >
      {/* Ambient gradient blobs (non-intrusive) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          initial={{ opacity: 0.25 }} animate={{ opacity: 0.35, y: [-10, 10, -10] }}
          transition={{ repeat: Infinity, duration: 14, ease: "easeInOut" }}
          className="absolute -top-20 -left-20 h-64 w-64 rounded-full bg-gradient-to-br from-indigo-400/40 to-cyan-300/30 blur-3xl"
        />
        <motion.div
          initial={{ opacity: 0.2 }} animate={{ opacity: 0.3, y: [12, -12, 12] }}
          transition={{ repeat: Infinity, duration: 18, ease: "easeInOut" }}
          className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-gradient-to-tr from-fuchsia-400/30 to-rose-300/20 blur-3xl"
        />
      </div>

      <div
        /* DO NOT CHANGE base size/padding */
        className="w-full h-full bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-xl p-4 sm:p-6 flex flex-col relative overflow-y-auto border border-white/40 dark:border-white/10 min-w-0"
      >
        {/* Top status/error/success toasts */}
        <AnimatePresence>
          {success && (
            <motion.p
              initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.35 }}
              className="absolute top-6 left-6 right-6 text-green-700 dark:text-green-300 text-sm sm:text-base font-semibold bg-green-100/80 dark:bg-green-900/70 p-4 rounded-2xl shadow-lg border border-green-200/40 dark:border-green-600/40 backdrop-blur-md z-[60]"
            >
              {success}
            </motion.p>
          )}
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.35 }}
              className="absolute top-6 left-6 right-6 text-red-700 dark:text-red-300 text-sm sm:text-base font-semibold bg-red-100/80 dark:bg-red-900/70 p-4 rounded-2xl shadow-lg border border-red-200/40 dark:border-red-600/40 backdrop-blur-md z-[60]"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-4 relative z-[1] min-w-0"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-lg sm:text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-700 to-blue-600 dark:from-indigo-300 dark:to-blue-300 truncate">
              Hi {session?.user?.name || "User"}, welcome to MeedianAI-Flow!
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
            {/* Segmented tabs with date + opened inline */}
            <div className="flex items-center bg-white/70 dark:bg-slate-800/60 border border-gray-200/40 dark:border-white/10 rounded-2xl p-1 flex-wrap">
              {[
                { key: "dashboard", label: "Dashboard", Icon: Calendar },
                { key: "assigned", label: "Assigned", Icon: CheckSquare },
                { key: "routine", label: "Routine", Icon: List },
                { key: "deepLife", label: "DeepLife", Icon: FileText },
              ].map(({ key, label, Icon }) => (
                <motion.button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                    activeTab === key
                      ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow"
                      : "text-gray-700 dark:text-gray-200 hover:bg-gray-100/60 dark:hover:bg-slate-700/60"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{label}</span>
                </motion.button>
              ))}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowNotesModal(true)}
                className="ml-1 flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100/60 dark:hover:bg-slate-700/60"
              >
                <FilePlus className="w-4 h-4" />
                <span className="hidden sm:inline">Notes</span>
              </motion.button>

              {/* Divider */}
              <div className="hidden sm:block w-px h-6 mx-2 bg-gray-200 dark:bg-white/10 rounded" />

              {/* Date + Opened inline */}
              <div className="flex items-center gap-2 px-1 py-1">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1.5 rounded-xl text-xs sm:text-[13px] bg-white/80 dark:bg-slate-800/70 border border-gray-200/50 dark:border-white/10 focus:ring-2 focus:ring-indigo-500 text-gray-700 dark:text-gray-200"
                />
                <div className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-xl text-[11px] bg-white/80 dark:bg-slate-800/70 border border-gray-200/50 dark:border-white/10 text-gray-700 dark:text-gray-200">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Opened: {dayPack?.openedAt ? fmtHM(dayPack.openedAt) : "6:53 am"}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {activeTab === "dashboard" && (
            <motion.div
              key="dash"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col space-y-6 flex-grow relative z-[1]"
            >
              {/* Three core cards (Role-based moved to MyMRIs) */}
              <section className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 flex-grow">
                {/* Spotlight (bolder, asymmetric) */}
                <TiltCard className="md:col-span-3 relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-600 via-blue-600 to-teal-500 text-white p-5 sm:p-7 shadow-xl">
                  <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-wider opacity-90">Spotlight</div>
                      <div className="mt-1 text-lg sm:text-2xl font-extrabold">
                        {currentMrn ? (
                          <>
                            {(currentMrn.type || "").toUpperCase()} · {currentMrn.itemTitle || "Untitled"}
                          </>
                        ) : (
                          "No active MRN"
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] sm:text-xs opacity-95">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/15 border border-white/20">
                          <Clock className="w-3.5 h-3.5" />
                          Opened: {dayPack?.openedAt ? fmtHM(dayPack.openedAt) : "6:53 am"}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/15 border border-white/20">
                          Now: {currentBlockGD || "—"}
                        </span>
                        {currentSlotGD && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/15 border border-white/20">
                            {`${currentSlotGD.startTime?.slice(0, 5)}–${currentSlotGD.endTime?.slice(0, 5)}`} · {timeLeftGD !== null ? `${formatTimeLeft(timeLeftGD)} left` : "Ended"}
                          </span>
                        )}
                      </div>
                      {currentMrn?.note && (
                        <div className="mt-2 text-xs sm:text-sm italic opacity-95">Note: {currentMrn.note}</div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 min-w-[220px]">
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          ["Total", state.assignedTaskSummary.total],
                          ["Pending", state.assignedTaskSummary.pendingVerification],
                          ["Done", state.assignedTaskSummary.completed],
                        ].map(([k, v]) => (
                          <div key={k} className="rounded-2xl bg-white/15 border border-white/20 p-3 text-center">
                            <div className="text-[11px] opacity-90">{k}</div>
                            <div className="text-lg font-bold">{v}</div>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => setShowRoutineTrackerModal(true)}
                          className="flex-1 rounded-xl bg-white/20 hover:bg-white/25 border border-white/30 px-3 py-2 text-xs font-semibold"
                        >
                          Routine Tracker
                        </button>
                        <button
                          onClick={() => setShowDeepCalendarModal(true)}
                          className="flex-1 rounded-xl bg-white/20 hover:bg-white/25 border border-white/30 px-3 py-2 text-xs font-semibold"
                        >
                          View My Day
                        </button>
                      </div>
                    </div>
                  </div>
                  {/* decorative sweep */}
                  <div className="absolute -top-24 -right-20 w-72 h-72 rounded-full bg-white/20 blur-3xl" />
                  <div className="absolute -bottom-28 -left-24 w-80 h-80 rounded-full bg-cyan-300/20 blur-3xl" />
                </TiltCard>

                {/* Block (exact General Dashboard logic) */}
                <TiltCard className="rounded-3xl border border-gray-100/30 dark:border-white/10 bg-white/80 dark:bg-slate-900/70 backdrop-blur-lg p-4 sm:p-6 shadow-lg transition-all duration-300">
                  <div className="flex items-center gap-3 mb-2">
                    <Clock className="w-5 h-5 text-teal-600" />
                    <h3 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white">Block</h3>
                  </div>
                  <div className="mt-1">
                    <p className="text-sm sm:text-lg font-bold text-teal-700 dark:text-teal-400">{currentBlockGD || "No Block"}</p>
                    {currentSlotGD && (
                      <>
                        <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">{`${currentSlotGD.startTime?.slice(0, 5)} - ${currentSlotGD.endTime?.slice(0, 5)}`}</p>
                        <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">{getTODName(currentSlotGD)}</p>
                        <p className="text-xs sm:text-sm text-teal-600 dark:text-teal-400 font-medium">{timeLeftGD !== null ? `${formatTimeLeft(timeLeftGD)} left` : "Ended"}</p>
                      </>
                    )}
                  </div>
                </TiltCard>

                {/* Assigned Summary (wider) */}
                <TiltCard className="md:col-span-2 cursor-pointer rounded-3xl border border-gray-100/30 dark:border-white/10 bg-white/80 dark:bg-slate-900/70 backdrop-blur-lg p-4 sm:p-6 shadow-lg transition-all duration-300">
                  <div onClick={() => setActiveTab("assigned")}>
                    <h3 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white mb-4">Assigned Tasks</h3>
                    {isLoadingAssignedTasks ? (
                      <SkeletonStats />
                    ) : (
                      <StatGrid
                        stats={[
                          ["Total", state.assignedTaskSummary.total, "indigo"],
                          ["Not Started", state.assignedTaskSummary.notStarted, "blue"],
                          ["In Progress", state.assignedTaskSummary.inProgress, "yellow"],
                          ["Pending", state.assignedTaskSummary.pendingVerification, "orange"],
                          ["Completed", state.assignedTaskSummary.completed, "green"],
                        ]}
                      />
                    )}
                  </div>
                </TiltCard>

                {/* Quick tools */}
                <TiltCard className="md:col-span-3 rounded-3xl border border-gray-100/30 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 backdrop-blur-lg p-4 sm:p-6 shadow-lg transition-all duration-300">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white mr-2">Quick Tools:</span>
                    <PrimaryButton onClick={() => setShowRoutineTrackerModal(true)}>Open Routine Tracker</PrimaryButton>
                    <GhostButton onClick={() => setShowNotesModal(true)}>My Notes</GhostButton>
                    <DangerGhostButton onClick={() => setShowCloseDayModal(true)}>Close My Day</DangerGhostButton>
                  </div>
                </TiltCard>
              </section>
            </motion.div>
          )}

          {activeTab === "deepLife" && (
            <motion.div
              key="deeplife"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col space-y-6 flex-grow relative z-[1]"
            >
              {/* Intro text */}
              <TiltCard className="rounded-3xl border border-gray-100/30 dark:border-white/10 bg-white/80 dark:bg-slate-900/70 backdrop-blur-lg p-4 sm:p-6 shadow-lg">
                <h2 className="text-lg sm:text-2xl font-extrabold text-gray-900 dark:text-white mb-2">DeepLife</h2>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
                  Your personal life hub powered by DeepCalendar and DeepWork AI. More coming later…
                </p>
              </TiltCard>

              {/* Active Block / Routine Window */}
              <TiltCard className="rounded-3xl border border-gray-100/30 dark:border-white/10 bg-white/80 dark:bg-slate-900/70 backdrop-blur-lg p-4 sm:p-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg sm:text-2xl font-extrabold text-gray-900 dark:text-white">Your Active Block</h2>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 space-y-2 sm:space-y-0">
                  <div>
                    <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Routine Window (Today)</div>
                    <div className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-200">
                      {todayWindow ? `${fromMinutes(todayWindow.openMin)}–${fromMinutes(todayWindow.closeMin)}` : "Not set"}
                    </div>
                  </div>
                  <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    Current Time: <span className="font-semibold">{fromMinutes(nowMin)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <InfoTile label="Full Window" value={todayWindow ? `${fromMinutes(todayWindow.openMin)}–${fromMinutes(todayWindow.closeMin)}` : "—"} delay={0} />
                  <InfoTile label="Day Opened" value={dayPack?.openedAt ? fmtHM(dayPack.openedAt) : "Not opened yet"} delay={0.05} />
                  <InfoTile label="Day Closed" value={dayPack?.shutdownAt ? fmtHM(dayPack.shutdownAt) : "Not closed yet"} delay={0.1} />
                </div>
              </TiltCard>

              {/* DeepCalendar Card */}
              <section className="grid grid-cols-1 gap-4 sm:gap-6 flex-grow">
                <TiltCard className="rounded-3xl border border-gray-100/30 dark:border-white/10 bg-white/80 dark:bg-slate-900/70 backdrop-blur-lg p-4 sm:p-6 shadow-lg transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white">Your Calendar For Day</h3>
                  </div>
                  {dcToken ? (
                    <>
                      <div className="rounded-2xl border border-gray-100/30 dark:border-white/10 bg-white/40 dark:bg-slate-800/40 backdrop-blur-md p-4 text-xs sm:text-sm mb-4">
                        <div className="mb-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">Right Now</div>
                        {dcLoading ? (
                          <div className="h-4 w-40 animate-pulse rounded bg-gray-200/50 dark:bg-slate-700/50" />
                        ) : activeBlock ? (
                          <ActiveBlockView item={activeBlock} />
                        ) : (
                          <div className="text-gray-600 dark:text-gray-400">No active deep block</div>
                        )}
                      </div>
                      <div className="flex flex-col gap-3">
                        <PrimaryButton onClick={() => setShowDeepCalendarModal(true)}>View My Day</PrimaryButton>
                        <GhostButton onClick={() => setSuccess("Ritual is coming soon!")}>Perform Ritual</GhostButton>
                        <DangerGhostButton onClick={handleRemoveToken}>Remove DeepCalendar Token</DangerGhostButton>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-gray-100/30 dark:border-white/10 bg-white/40 dark:bg-slate-800/40 backdrop-blur-md p-4 text-xs sm:text-sm">
                      <p className="text-gray-800 dark:text-gray-200 mb-3 text-sm sm:text-base font-medium">Setup DeepCalendar Integration</p>
                      <p className="text-gray-600 dark:text-gray-400 mb-3">
                        Get a token from{" "}
                        <a href={DC_ORIGIN + "/account"} target="_blank" rel="noreferrer"
                           className="text-indigo-600 dark:text-indigo-400 underline hover:text-indigo-700 dark:hover:text-indigo-500">
                          DeepCalendar
                        </a>{" "}
                        and paste it below.
                      </p>
                      <input
                        type="text"
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        placeholder="Paste token here"
                        className="w-full px-4 py-2 border border-gray-200/40 dark:border-white/10 rounded-xl mb-3 focus:ring-2 focus:ring-indigo-500 text-xs sm:text-sm bg-white/70 dark:bg-slate-800/60 text-gray-800 dark:text-gray-200"
                      />
                      <PrimaryButton onClick={handleSaveToken}>Save Token</PrimaryButton>
                    </div>
                  )}
                  <div className="mt-3 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    Powered by{" "}
                    <a className="text-indigo-600 dark:text-indigo-400 underline hover:text-indigo-700 dark:hover:text-indigo-500" href={DC_ORIGIN} target="_blank" rel="noreferrer">
                      DeepCalendar
                    </a>
                  </div>
                </TiltCard>
              </section>
            </motion.div>
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
                let taskToSet = t;
                const isManager = role === "team_manager" || role === "admin";
                if (isManager) {
                  const fullTask = await fetchFullTask(t.id);
                  if (fullTask) taskToSet = fullTask;
                }
                setSelectedTask(taskToSet);
                await fetchTaskLogs(t.id);
                if (!isManager) await fetchSprints(t.id, user?.id);
                setShowDetailsModal(true);
              }}
              users={users}
              assignedTaskSummary={state.assignedTaskSummary}
            />
          )}

          {activeTab === "routine" && (
            <>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-300">Routine tasks for {selectedDate}</span>
                <button
                  onClick={() => setShowRoutineTrackerModal(true)}
                  className="px-3 py-2 text-xs rounded-lg bg-teal-600 hover:bg-teal-700 text-white"
                >
                  Open Routine Tracker
                </button>
              </div>
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
            </>
          )}
        </AnimatePresence>

        {/* Modals */}
        <AnimatePresence>
          {showStatusModal && (
            <UpdateStatusForAll
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
              onAddLog={handleAddLog}
              onClose={() => {
                setShowStatusModal(false);
                setNewStatus("");
                setSelectedSprint("");
                setNewLogComment("");
                setSendNotification(true);
                setSendWhatsapp(false);
              }}
              startVoiceRecording={startVoiceRecording}
              isRecording={isRecording}
              handleTranslateComment={handleTranslateComment}
              currentUserId={session?.user?.id}
              currentUserName={session?.user?.name}
              error={error}
              success={success}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showDetailsModal && (
            <AssignedTaskDetails
              task={selectedTask}
              taskLogs={taskLogs}
              users={users}
              onClose={() => {
                setShowDetailsModal(false);
                setSelectedTask(null);
                setTaskLogs([]);
                setSprints([]);
              }}
              currentUserId={session?.user?.id}
              currentUserName={session?.user?.name}
              onUpdateStatusClick={() => {
                setNewStatus(selectedTask?.status || "not_started");
                setSelectedSprint("");
                setShowStatusModal(true);
              }}
            />
          )}
        </AnimatePresence>

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

        <Modal isOpen={showComingSoonModal} onClose={() => setShowComingSoonModal(false)} title="Coming Soon">
          <p className="text-gray-800 dark:text-gray-200 text-sm sm:text-base">Translation is coming soon.</p>
          <div className="flex justify-end mt-6">
            <PrimaryButton onClick={() => setShowComingSoonModal(false)}>Close</PrimaryButton>
          </div>
        </Modal>

        <Modal isOpen={showNotesModal} onClose={() => setShowNotesModal(false)} title="My Notes">
          <MyNotes
            userId={viewUserId || user?.id}
            setError={(msg) => {
              setShowNotesModal(false);
              setError(msg);
              setTimeout(() => setError(""), 3000);
            }}
            setSuccess={(msg) => {
              setShowNotesModal(false);
              setSuccess(msg);
              setTimeout(() => setSuccess(""), 2500);
            }}
          />
        </Modal>

        {/* Routine Tracker Modal (full view, monthly grid) */}
        {showRoutineTrackerModal && (
          <RoutineTrackerModal open={true} onClose={() => setShowRoutineTrackerModal(false)} />
        )}

        <DeepCalendarModal
          open={showDeepCalendarModal}
          onClose={() => setShowDeepCalendarModal(false)}
          items={todayItems}
          window={todayWindow}
          goalById={goalById}
        />
      </div>
    </motion.div>
  );
}
