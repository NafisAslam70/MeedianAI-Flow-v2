"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import useSWR, { mutate } from "swr";
import Link from "next/link";
import {
  CalendarDays,
  LayoutList,
  Kanban,
  RefreshCw,
  Search,
  ArrowLeft,
  ArrowRight,
  Clock,
  Bell,
  Users,
  Filter,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Target,
  ClipboardList,
  Share2,
} from "lucide-react";

import SharedDashboard from "@/components/SharedDashboard";
import AssignedTaskDetails from "@/components/assignedTaskCardDetailForAll";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((response) => {
    if (!response.ok) throw new Error(response.statusText);
    return response.json();
  });

const STATUS_META = {
  not_started: {
    label: "Not started",
    tint: "bg-rose-50",
    text: "text-rose-600",
    pill: "bg-rose-100 text-rose-700",
  },
  in_progress: {
    label: "In progress",
    tint: "bg-amber-50",
    text: "text-amber-600",
    pill: "bg-amber-100 text-amber-700",
  },
  pending_verification: {
    label: "Needs review",
    tint: "bg-indigo-50",
    text: "text-indigo-600",
    pill: "bg-indigo-100 text-indigo-700",
  },
  done: {
    label: "Done",
    tint: "bg-emerald-50",
    text: "text-emerald-600",
    pill: "bg-emerald-100 text-emerald-700",
  },
  verified: {
    label: "Verified",
    tint: "bg-emerald-50",
    text: "text-emerald-600",
    pill: "bg-emerald-100 text-emerald-700",
  },
};

const normalizeStatus = (status) => (status ? status : "not_started");
const isCompleted = (status) => ["done", "verified"].includes(normalizeStatus(status));

const deadlineState = (deadline) => {
  if (!deadline) return "none";
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return "none";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  if (date < startOfToday) return "overdue";
  if (date < endOfToday) return "due_today";
  return "upcoming";
};

const formatDeadline = (deadline) => {
  if (!deadline) return "No deadline";
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return "No deadline";
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
};

const dedupeByTaskId = (arr) => {
  const map = new Map();
  arr.forEach((item) => {
    if (map.has(item.id)) {
      const existing = map.get(item.id);
      const seen = new Set(existing.assignees.map((assignee) => assignee.id));
      item.assignees.forEach((assignee) => {
        if (!seen.has(assignee.id)) {
          existing.assignees.push(assignee);
          seen.add(assignee.id);
        }
      });
      if (!existing.deadline && item.deadline) existing.deadline = item.deadline;
      if (!existing.description && item.description) existing.description = item.description;
      map.set(item.id, existing);
    } else {
      map.set(item.id, {
        ...item,
        assignees: Array.isArray(item.assignees)
          ? Array.from(new Map(item.assignees.map((assignee) => [assignee.id, assignee])).values())
          : [],
      });
    }
  });
  return Array.from(map.values());
};

const defaultSummary = {
  totalTasks: 0,
  completedTasks: 0,
  inProgressTasks: 0,
  notStartedTasks: 0,
  pendingVerificationTasks: 0,
};

export default function ManagersCommonDashboard({ disableUserSelect = false }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  const [selectedDate, setSelectedDate] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deadlineFilter, setDeadlineFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("board");
  const [activeUserId, setActiveUserId] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskLogs, setTaskLogs] = useState([]);
  const [newLogComment, setNewLogComment] = useState("");
  const [selectedLogSprint, setSelectedLogSprint] = useState("");
  const [newTaskStatuses, setNewTaskStatuses] = useState({});
  const [newSprintStatuses, setNewSprintStatuses] = useState({});
  const [isAddingLog, setIsAddingLog] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isReminding, setIsReminding] = useState({});
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAddLogModal, setShowAddLogModal] = useState(false);
  const [error, setError] = useState("");

  const { data: usersData } = useSWR("/api/member/users", fetcher);
  const users = usersData?.users || [];

  useEffect(() => {
    if (status === "authenticated" && !["admin", "team_manager"].includes(session?.user?.role)) {
      router.push("/dashboard/member");
    }
  }, [status, session, router]);

  useEffect(() => {
    if (disableUserSelect) {
      setActiveUserId(null);
    }
  }, [disableUserSelect]);

  const dashboardKey = useMemo(() => {
    const params = new URLSearchParams();
    params.set("user", assigneeFilter);
    params.set("status", statusFilter);
    if (selectedDate) params.set("date", selectedDate);
    return `/api/managersCommon/dashboard?${params.toString()}`;
  }, [assigneeFilter, statusFilter, selectedDate]);

  const {
    data: dashboardData,
    isLoading: isDashboardLoading,
    error: dashboardError,
  } = useSWR(dashboardKey, fetcher, { revalidateOnFocus: false });

  const allTasks = useMemo(() => {
    if (!dashboardData?.assignedTasks) return [];
    return dedupeByTaskId(dashboardData.assignedTasks.map((task) => ({
      ...task,
      status: normalizeStatus(task.status),
    })));
  }, [dashboardData?.assignedTasks]);

  const summaries = dashboardData?.summaries || defaultSummary;
  const latestTouched = dashboardData?.latestTouched || [];
  const recentLogs = dashboardData?.recentLogs || [];

  const filteredTasks = useMemo(() => {
    let tasks = [...allTasks];

    if (assigneeFilter !== "all") {
      const targetId = Number(assigneeFilter);
      tasks = tasks.filter((task) => task.assignees?.some((assignee) => Number(assignee.id) === targetId));
    }

    if (statusFilter !== "all") {
      const lookup = statusFilter === "completed" ? ["done", "verified"] : [statusFilter];
      tasks = tasks.filter((task) => lookup.includes(normalizeStatus(task.status)));
    }

    if (deadlineFilter !== "all") {
      tasks = tasks.filter((task) => deadlineState(task.deadline) === deadlineFilter);
    }

    if (searchQuery) {
      const needle = searchQuery.toLowerCase();
      tasks = tasks.filter((task) => {
        const inTitle = task.title?.toLowerCase().includes(needle);
        const inDescription = task.description?.toLowerCase().includes(needle);
        const inAssignee = task.assignees?.some((assignee) => assignee.name?.toLowerCase().includes(needle));
        return inTitle || inDescription || inAssignee;
      });
    }

    return tasks.sort((a, b) => {
      const dateA = new Date(b.updatedAt || b.createdAt).getTime();
      const dateB = new Date(a.updatedAt || a.createdAt).getTime();
      return dateB - dateA;
    });
  }, [allTasks, assigneeFilter, statusFilter, deadlineFilter, searchQuery]);

  const boardColumns = useMemo(() => {
    const columns = {
      not_started: [],
      in_progress: [],
      pending_verification: [],
      completed: [],
    };

    filteredTasks.forEach((task) => {
      const status = normalizeStatus(task.status);
      if (isCompleted(status)) {
        columns.completed.push(task);
        return;
      }
      if (!columns[status]) {
        columns[status] = [];
      }
      columns[status].push(task);
    });

    return columns;
  }, [filteredTasks]);

const teamDigest = useMemo(() => {
  if (!allTasks.length) return [];
  const map = new Map();

  allTasks.forEach((task) => {
    task.assignees?.forEach((assignee) => {
      const key = assignee.id;
      if (!map.has(key)) {
        map.set(key, {
          assignee,
          total: 0,
          inProgress: 0,
          pendingVerification: 0,
          completed: 0,
          overdue: 0,
          notStarted: 0,
          tasks: [],
        });
      }
      const entry = map.get(key);
      entry.total += 1;
      const status = normalizeStatus(task.status);
      if (status === "not_started") entry.notStarted += 1;
      if (status === "in_progress") entry.inProgress += 1;
      if (status === "pending_verification") entry.pendingVerification += 1;
      if (isCompleted(status)) entry.completed += 1;
      if (deadlineState(task.deadline) === "overdue") entry.overdue += 1;
      entry.tasks.push(task);
      });
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [allTasks]);

  useEffect(() => {
    if (selectedTask) {
      const taskStatuses = {};
      const sprintStatuses = {};
      selectedTask.assignees?.forEach((assignee) => {
        taskStatuses[assignee.id] = assignee.status;
        assignee.sprints?.forEach((sprint) => {
          sprintStatuses[`${assignee.id}-${sprint.id}`] = sprint.status;
        });
      });
      setNewTaskStatuses(taskStatuses);
      setNewSprintStatuses(sprintStatuses);
    }
  }, [selectedTask]);

  useEffect(() => {
    const focusTask = searchParams.get("focusTask");
    if (focusTask) {
      handleOpenTask(Number(focusTask));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const getUserName = (userId) => {
    if (!userId) return "Unknown";
    const user = users.find((entry) => Number(entry.id) === Number(userId));
    if (user) return user.name;
    if (Number(userId) === Number(session?.user?.id)) return session?.user?.name || "You";
    return `User ${userId}`;
  };

  const fetchTask = async (taskId) => {
    try {
      const response = await fetch(`/api/member/assignedTasks?taskId=${taskId}&action=task`);
      if (!response.ok) throw new Error("Failed to fetch task");
      const data = await response.json();
      return data.task || null;
    } catch (err) {
      console.error(err);
      setError("Unable to load task details");
      return null;
    }
  };

  const hydrateTask = async (taskId) => {
    const baseTask = await fetchTask(taskId);
    if (!baseTask) return null;

    const enrichedAssignees = await Promise.all(
      (baseTask.assignees || []).map(async (assignee) => ({
        ...assignee,
        sprints: await fetchSprints(baseTask.id, assignee.id),
      }))
    );

    return { ...baseTask, assignees: enrichedAssignees };
  };

  const handleOpenTask = async (taskId) => {
    const hydrated = await hydrateTask(taskId);
    if (!hydrated) {
      setError("Task not found");
      return;
    }
    await handleViewTaskDetails(hydrated);
  };

  const fetchSprints = async (taskId, assigneeId) => {
    try {
      const response = await fetch(`/api/member/assignedTasks?taskId=${taskId}&memberId=${assigneeId}&action=sprints`);
      if (!response.ok) throw new Error("Failed to fetch sprints");
      const data = await response.json();
      return data.sprints || [];
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  const handleViewTaskDetails = async (task) => {
    const needsHydration = !task.assignees?.some(
      (assignee) => Array.isArray(assignee.sprints) && assignee.sprints.length > 0
    );
    const baseTask = needsHydration ? await hydrateTask(task.id) : task;
    if (!baseTask) return;

    setSelectedTask(baseTask);

    try {
      const response = await fetch(`/api/member/assignedTasks?taskId=${task.id}&action=logs`);
      if (!response.ok) throw new Error("Failed to fetch logs");
      const data = await response.json();
      setTaskLogs(data.logs || []);
    } catch (err) {
      console.error(err);
      setTaskLogs([]);
    }

    setShowDetailsModal(true);
  };

  const handleAddLog = async (taskId, notifyAssignees = false) => {
    if (!newLogComment.trim()) {
      setError("Add a short update before saving the log");
      return;
    }

    setIsAddingLog(true);
    try {
      const body = {
        taskId,
        action: "log_added",
        details: newLogComment.trim(),
      };
      if (selectedLogSprint) body.sprintId = Number(selectedLogSprint);

      const response = await fetch(`/api/member/assignedTasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error("Failed to add log");

      const { log } = await response.json();
      const decoratedLog = {
        ...log,
        userId: session?.user?.id,
        userName: session?.user?.name,
      };
      setTaskLogs((prev) => [decoratedLog, ...prev]);
      setNewLogComment("");
      setSelectedLogSprint("");
      mutate(dashboardKey);

      if (notifyAssignees && selectedTask) {
        const message = `New update on "${selectedTask.title}" by ${getUserName(session?.user?.id)}: ${log.details} [task:${selectedTask.id}]`;
        await Promise.all(
          selectedTask.assignees
            .map((assignee) => assignee.id)
            .filter((id) => Number(id) !== Number(session?.user?.id))
            .map((recipientId) =>
              fetch("/api/others/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  userId: session?.user?.id,
                  recipientId,
                  message,
                }),
              })
            )
        );
      }

      setShowAddLogModal(false);
    } catch (err) {
      console.error(err);
      setError("Could not save the log. Try again.");
    } finally {
      setIsAddingLog(false);
    }
  };

  const handleUpdateTaskStatus = async (memberId, status) => {
    if (!selectedTask) return;
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/member/assignedTasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: selectedTask.id,
          status,
          action: "update_task",
          memberId,
          notifyAssignees: true,
          notifyWhatsapp: false,
          newLogComment,
        }),
      });

      if (!response.ok) throw new Error("Failed to update task");

      setSelectedTask((prev) => ({
        ...prev,
        assignees: prev.assignees.map((assignee) =>
          assignee.id === memberId ? { ...assignee, status } : assignee
        ),
      }));
      setNewTaskStatuses((prev) => ({ ...prev, [memberId]: status }));
      setNewLogComment("");
      mutate(dashboardKey);
    } catch (err) {
      console.error(err);
      setError("Unable to update status right now");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateSprintStatus = async (memberId, sprintId, status) => {
    if (!selectedTask) return;
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/member/assignedTasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: selectedTask.id,
          status,
          sprintId,
          action: "update_sprint",
          memberId,
          notifyAssignees: true,
          notifyWhatsapp: false,
          newLogComment,
        }),
      });

      if (!response.ok) throw new Error("Failed to update sprint");

      setSelectedTask((prev) => ({
        ...prev,
        assignees: prev.assignees.map((assignee) => {
          if (assignee.id !== memberId) return assignee;
          const updatedSprints = assignee.sprints.map((sprint) =>
            sprint.id === sprintId ? { ...sprint, status } : sprint
          );
          return { ...assignee, sprints: updatedSprints };
        }),
      }));
      setNewSprintStatuses((prev) => ({ ...prev, [`${memberId}-${sprintId}`]: status }));
      setNewLogComment("");
      mutate(dashboardKey);
    } catch (err) {
      console.error(err);
      setError("Unable to update sprint status");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemindUser = async (task) => {
    setIsReminding((prev) => ({ ...prev, [task.id]: true }));
    try {
      const response = await fetch(`/api/member/assignedTasks?taskId=${task.id}&action=logs`);
      const data = await response.json();
      const latestLog = data.logs?.[0]?.details || "Please share the latest update";

      await Promise.all(
        task.assignees.map((assignee) =>
          fetch("/api/others/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: session?.user?.id,
              recipientId: assignee.id,
              message: `Hi ${assignee.name}, quick nudge on "${task.title}" — ${latestLog} [task:${task.id}]`,
            }),
          })
        )
      );
    } catch (err) {
      console.error(err);
      setError("Could not send the reminder");
    } finally {
      setIsReminding((prev) => ({ ...prev, [task.id]: false }));
    }
  };

  const renderTaskCard = (task, variant = "default") => {
    const statusKey = normalizeStatus(task.status);
    const meta = STATUS_META[statusKey] || STATUS_META.not_started;
    const dueState = deadlineState(task.deadline);
    const overdue = dueState === "overdue";
    const dueToday = dueState === "due_today";

    return (
      <motion.div
        key={task.id}
        layout
        className={`group flex flex-col justify-between rounded-3xl border bg-white p-4 shadow-sm transition-all hover:shadow-xl ${
          meta.tint
        } ${overdue ? "border-rose-200" : "border-slate-200"}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-500">
              #{task.id} · {new Date(task.createdAt).toLocaleDateString()}
            </p>
            <h3 className="mt-1 text-base font-semibold text-slate-900 line-clamp-2">
              {task.title || "Untitled task"}
            </h3>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.pill}`}>
            {meta.label}
          </span>
        </div>

        {task.description && (
          <p className="mt-3 line-clamp-3 text-sm text-slate-600">{task.description}</p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1 text-slate-600">
            <Users className="h-3.5 w-3.5" />
            {task.assignees.map((assignee) => assignee.name).join(", ") || "Unassigned"}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1 text-slate-600">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatDeadline(task.deadline)}
          </span>
          {dueToday && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-amber-700">
              <Clock className="h-3.5 w-3.5" /> Due today
            </span>
          )}
          {overdue && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-rose-700">
              <AlertTriangle className="h-3.5 w-3.5" /> Overdue
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => handleViewTaskDetails(task)}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
          >
            Open details
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={async () => {
              const hydrated = await hydrateTask(task.id);
              if (!hydrated) return;
              setSelectedTask(hydrated);
              setShowAddLogModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            <ClipboardList className="h-3.5 w-3.5" /> Add log
          </button>
          <button
            onClick={() => handleRemindUser(task)}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            disabled={isReminding[task.id]}
          >
            {isReminding[task.id] ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Bell className="h-3.5 w-3.5" />
            )}
            Nudge team
          </button>
        </div>
      </motion.div>
    );
  };

  const renderBoardView = () => (
    <div className="grid gap-4 lg:grid-cols-4">
      {[
        { key: "not_started", title: "Backlog" },
        { key: "in_progress", title: "In progress" },
        { key: "pending_verification", title: "Needs review" },
        { key: "completed", title: "Completed" },
      ].map(({ key, title }) => (
        <section key={key} className="flex h-full flex-col rounded-3xl border border-slate-200 bg-slate-50/60 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">{title}</p>
            <span className="text-xs text-slate-500">{boardColumns[key]?.length || 0}</span>
          </div>
          <div className="mt-3 flex flex-1 flex-col gap-3">
            {(boardColumns[key] || []).map((task) => renderTaskCard(task, key))}
            {(boardColumns[key] || []).length === 0 && (
              <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 p-4 text-xs text-slate-400">
                Nothing here right now
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  );

  const renderListView = () => (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {filteredTasks.map((task) => renderTaskCard(task))}
      {filteredTasks.length === 0 && (
        <div className="col-span-full rounded-3xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          No tasks match the current filters.
        </div>
      )}
    </div>
  );

  if (activeUserId && !disableUserSelect) {
    const activeUser = users.find((user) => Number(user.id) === Number(activeUserId));
    return (
      <div className="space-y-4 rounded-3xl bg-white/90 p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Focused view</p>
            <h1 className="text-xl font-semibold text-slate-900">
              {activeUser ? activeUser.name : `User ${activeUserId}`}
            </h1>
          </div>
          <button
            onClick={() => setActiveUserId(null)}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" /> Back to team board
          </button>
        </div>
        <SharedDashboard role="team_manager" viewUserId={activeUserId} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-3xl bg-white/90 p-5 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Team operations</p>
            <h1 className="text-2xl font-semibold text-slate-900">Manager's Command Centre</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard/managersCommon/assignTask" className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
              <Target className="h-4 w-4" /> Assign new task
            </Link>
            <Link href="/dashboard/managersCommon/approveCloseDay" className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
              <CheckCircle2 className="h-4 w-4" /> Approve day close
            </Link>
            <Link href="/dashboard/managersCommon/approveLeave" className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
              <Share2 className="h-4 w-4" /> Leave requests
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          {[
            {
              label: "Total tasks",
              value: summaries.totalTasks,
              meta: "Across all assignees",
            },
            {
              label: "In progress",
              value: summaries.inProgressTasks,
              meta: "Actively moving",
            },
            {
              label: "Needs review",
              value: summaries.pendingVerificationTasks,
              meta: "Waiting for manager QA",
            },
            {
              label: "Not started",
              value: summaries.notStartedTasks,
              meta: "Kick-off pending",
            },
            {
              label: "Completed",
              value: summaries.completedTasks,
              meta: "Done or verified",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4"
            >
              <p className="text-xs uppercase tracking-wide text-slate-400">{card.label}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{card.value}</p>
              <p className="mt-1 text-xs text-slate-500">{card.meta}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search tasks, notes or assignees"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
            />
          </div>
          <select
            value={assigneeFilter}
            onChange={(event) => setAssigneeFilter(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
          >
            <option value="all">All members</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
          >
            <option value="all">All statuses</option>
            <option value="not_started">Not started</option>
            <option value="in_progress">In progress</option>
            <option value="pending_verification">Pending verification</option>
            <option value="completed">Completed</option>
          </select>
          <select
            value={deadlineFilter}
            onChange={(event) => setDeadlineFilter(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
          >
            <option value="all">All deadlines</option>
            <option value="due_today">Due today</option>
            <option value="overdue">Overdue</option>
          </select>
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
          />
          <div className="ml-auto flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
            <button
              onClick={() => setViewMode("board")}
              className={`flex items-center gap-1 rounded-2xl px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === "board" ? "bg-white text-slate-900 shadow" : "text-slate-500"
              }`}
            >
              <Kanban className="h-4 w-4" /> Board
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1 rounded-2xl px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === "list" ? "bg-white text-slate-900 shadow" : "text-slate-500"
              }`}
            >
              <LayoutList className="h-4 w-4" /> Cards
            </button>
            <button
              onClick={() => mutate(dashboardKey)}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </p>
        )}

        <div className="mt-6">
          {isDashboardLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : viewMode === "board" ? (
            renderBoardView()
          ) : (
            renderListView()
          )}
        </div>
      </section>

      <section className="rounded-3xl bg-white/90 p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Team spotlight</p>
            <h2 className="text-xl font-semibold text-slate-900">Where attention is needed</h2>
          </div>
        </div>
        {teamDigest.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No assignments found yet.</p>
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {teamDigest.map((entry) => (
              <div
                key={entry.assignee.id}
                className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-slate-50/80 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Member</p>
                    <h3 className="text-lg font-semibold text-slate-900">{entry.assignee.name}</h3>
                    <p className="text-xs text-slate-500">{entry.total} active tasks</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">In progress</p>
                    <p className="text-xl font-semibold text-slate-900">{entry.inProgress}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs font-semibold text-slate-600">
                  <div className="rounded-2xl bg-white/90 px-3 py-2">
                    <span className="block text-xs text-slate-400">Pending</span>
                    {entry.notStarted}
                  </div>
                  <div className="rounded-2xl bg-white/90 px-3 py-2">
                    <span className="block text-xs text-slate-400">In flow</span>
                    {entry.inProgress}
                  </div>
                  <div className="rounded-2xl bg-white/90 px-3 py-2">
                    <span className="block text-xs text-slate-400">Review</span>
                    {entry.pendingVerification}
                  </div>
                  <div className="rounded-2xl bg-white/90 px-3 py-2">
                    <span className="block text-xs text-slate-400">Overdue</span>
                    {entry.overdue}
                  </div>
                </div>
                {!disableUserSelect && (
                  <button
                    onClick={() => setActiveUserId(entry.assignee.id)}
                    className="mt-4 inline-flex items-center gap-2 self-start rounded-2xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Open member dashboard
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-3xl bg-white/90 p-5 shadow-2xl">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Latest signals</p>
              <h2 className="text-xl font-semibold text-slate-900">Activity stream</h2>
            </div>
          </div>
          {recentLogs.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No new logs yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {recentLogs.map((log) => (
                <div key={log.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {log.userName || getUserName(log.userId)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(log.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleOpenTask(log.taskId)}
                      className="inline-flex items-center gap-1 rounded-2xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      View
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{log.details}</p>
                  <p className="mt-2 text-xs text-slate-500">Task #{log.taskId}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl bg-white/90 p-5 shadow-2xl">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Most recently touched</p>
              <h2 className="text-xl font-semibold text-slate-900">Momentum tracker</h2>
            </div>
          </div>
          {latestTouched.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Updates will show here as soon as tasks move.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {latestTouched.map((task) => (
                <div key={task.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                      <p className="text-xs text-slate-500">
                        Last touch: {new Date(task.lastTouched).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleOpenTask(task.id)}
                      className="inline-flex items-center gap-1 rounded-2xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      Inspect
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {task.assignees.map((assignee) => assignee.name).join(", ")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <AnimatePresence>
        {showDetailsModal && selectedTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
            >
              <AssignedTaskDetails
                task={selectedTask}
                taskLogs={taskLogs}
                users={users}
                onClose={() => setShowDetailsModal(false)}
                isManager
                newLogComment={newLogComment}
                setNewLogComment={setNewLogComment}
                isAddingLog={isAddingLog}
                onAddLog={() => handleAddLog(selectedTask.id, true)}
                newTaskStatuses={newTaskStatuses}
                setNewTaskStatuses={setNewTaskStatuses}
                newSprintStatuses={newSprintStatuses}
                setNewSprintStatuses={setNewSprintStatuses}
                handleUpdateTaskStatus={handleUpdateTaskStatus}
                handleUpdateSprintStatus={handleUpdateSprintStatus}
                isUpdating={isUpdating}
                currentUserId={session?.user?.id}
                currentUserName={session?.user?.name}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddLogModal && selectedTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
            >
              <h3 className="text-lg font-semibold text-slate-900">Add log · {selectedTask.title}</h3>
              <textarea
                value={newLogComment}
                onChange={(event) => setNewLogComment(event.target.value)}
                placeholder="Share the latest insight or blocker"
                className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
                rows={4}
              />
              <div className="mt-3 flex items-center gap-2">
                <select
                  value={selectedLogSprint}
                  onChange={(event) => setSelectedLogSprint(event.target.value)}
                  className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
                >
                  <option value="">Whole task</option>
                  {selectedTask.assignees.flatMap((assignee) =>
                    assignee.sprints?.map((sprint) => (
                      <option key={`${assignee.id}-${sprint.id}`} value={sprint.id}>
                        {assignee.name}: {sprint.title}
                      </option>
                    ))
                  )}
                </select>
                <button
                  onClick={() => setShowAddLogModal(false)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAddLog(selectedTask.id, true)}
                  disabled={!newLogComment.trim() || isAddingLog}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-500"
                >
                  {isAddingLog ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
                  Save log
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
