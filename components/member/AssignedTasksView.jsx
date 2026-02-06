"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  RefreshCw,
  Search,
  LayoutList,
  Kanban,
  PinOff,
  Archive,
  CalendarDays,
  Clock,
  BadgeCheck,
  ListChecks,
  SunMedium,
  Undo2,
  UserCircle,
  CheckCircle2,
} from "lucide-react";

const STATUS_META = {
  not_started: {
    label: "Not Started",
    bg: "bg-rose-50",
    text: "text-rose-600",
    border: "border-rose-200",
    pill: "bg-rose-100 text-rose-700 border border-rose-200",
  },
  in_progress: {
    label: "In Progress",
    bg: "bg-amber-50",
    text: "text-amber-600",
    border: "border-amber-200",
    pill: "bg-amber-100 text-amber-700 border border-amber-200",
  },
  pending_verification: {
    label: "Needs Review",
    bg: "bg-indigo-50",
    text: "text-indigo-600",
    border: "border-indigo-200",
    pill: "bg-indigo-100 text-indigo-700 border border-indigo-200",
  },
  done: {
    label: "Done",
    bg: "bg-emerald-50",
    text: "text-emerald-600",
    border: "border-emerald-200",
    pill: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  },
  verified: {
    label: "Verified",
    bg: "bg-emerald-50",
    text: "text-emerald-600",
    border: "border-emerald-200",
    pill: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  },
};

const SIDEBAR_FILTERS = [
  { value: "all", label: "Everything", helper: "Reset to all tasks" },
  { value: "in_progress", label: "Active work", helper: "Currently being worked on" },
  { value: "pending_verification", label: "Needs review", helper: "Awaiting verification" },
  { value: "due_today", label: "Due today", helper: "Ending before midnight" },
  { value: "overdue", label: "Overdue", helper: "Past the target date" },
  { value: "completed", label: "Completed", helper: "Marked as done or verified" },
];

const BASKET_FILTERS = [
  { value: "all", label: "All" },
  { value: "in_progress", label: "Active" },
  { value: "pending_verification", label: "Needs review" },
  { value: "due_today", label: "Due today" },
  { value: "overdue", label: "Overdue" },
  { value: "completed", label: "Completed" },
];

const normalizeStatus = (status) => (status ? status : "not_started");
const isCompleted = (status) => ["done", "verified"].includes(normalizeStatus(status));
const isPending = (status) => normalizeStatus(status) === "pending_verification";
const isActiveStatus = (status) => !isCompleted(status);

const formatStatusLabel = (status) => STATUS_META[normalizeStatus(status)]?.label ?? "Not Started";
const formatDeadline = (deadline) => {
  if (!deadline) return "No deadline";
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return "No deadline";

  const today = new Date();
  const dateKey = date.toISOString().slice(0, 10);
  const todayKey = today.toISOString().slice(0, 10);
  const tomorrowKey = new Date(today.getTime() + 86400000).toISOString().slice(0, 10);

  if (dateKey === todayKey) return "Due today";
  if (dateKey === tomorrowKey) return "Due tomorrow";
  if (date < today) return `Overdue · ${date.toLocaleDateString()}`;
  return date.toLocaleDateString();
};

const matchesSearch = (task, query) => {
  if (!query) return true;
  const needle = query.toLowerCase();
  return (
    task.title?.toLowerCase().includes(needle) ||
    task.description?.toLowerCase().includes(needle) ||
    task.resources?.toLowerCase().includes(needle)
  );
};

const sortTasks = (tasks, sortMode) => {
  const clone = [...tasks];
  switch (sortMode) {
    case "deadline":
      return clone.sort((a, b) => {
        const aTime = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        const bTime = b.deadline ? new Date(b.deadline).getTime() : Infinity;
        return aTime - bTime;
      });
    case "status":
      return clone.sort((a, b) => normalizeStatus(a.status).localeCompare(normalizeStatus(b.status)));
    case "alphabetical":
      return clone.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    default:
      return clone.sort((a, b) => {
        const aTime = a.assignedDate ? new Date(a.assignedDate).getTime() : 0;
        const bTime = b.assignedDate ? new Date(b.assignedDate).getTime() : 0;
        return bTime - aTime;
      });
  }
};

const deadlineState = (deadline) => {
  if (!deadline) return "none";
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return "none";
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfTomorrow = new Date(startOfToday.getTime() + 86400000);
  if (date < startOfToday) return "overdue";
  if (date < startOfTomorrow) return "today";
  return "upcoming";
};

const getAssignedBy = (createdBy, users) => {
  const user = users?.find((u) => Number(u.id) === Number(createdBy));
  if (!user) return "Unknown";
  if (user.role === "admin") return "Superintendent";
  if (user.role === "team_manager") {
    return user.team_manager_type
      ? user.team_manager_type
          .split("_")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ")
      : "Team Manager";
  }
  return user.type
    ? user.type
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    : "Member";
};

export default function AssignedTasksView({
  handleBack,
  assignedTasks: initialAssignedTasks,
  isLoadingAssignedTasks,
  selectedDate,
  handleTaskSelect,
  handleSprintSelect,
  handleTaskDetails,
  users,
  assignedTaskSummary,
  refreshTasks: externalRefreshTasks,
  resolveTaskPermissions,
}) {
  const [assignedTasks, setAssignedTasks] = useState(initialAssignedTasks || []);
  const [viewMode, setViewMode] = useState("list");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortMode, setSortMode] = useState("recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [hideCompleted, setHideCompleted] = useState(true);
  const [showArchive, setShowArchive] = useState(false);
  const [showBasketModal, setShowBasketModal] = useState(false);
  const [showPrepareModal, setShowPrepareModal] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [draftDragSource, setDraftDragSource] = useState(null);
  const [basketExpanded, setBasketExpanded] = useState(true);
  const [basketHighlight, setBasketHighlight] = useState(false);
  const [focusFilter, setFocusFilter] = useState("all");
  const [draftBasket, setDraftBasket] = useState([]);
  const [prepareHighlight, setPrepareHighlight] = useState({ basket: false, available: false });

  useEffect(() => {
    setAssignedTasks(initialAssignedTasks || []);
  }, [initialAssignedTasks]);

  const focusTasks = useMemo(
    () => assignedTasks.filter((task) => task.pinned && !task.savedForLater),
    [assignedTasks]
  );

  const archivedTasks = useMemo(
    () => assignedTasks.filter((task) => task.savedForLater),
    [assignedTasks]
  );

  const availableTasks = useMemo(
    () => assignedTasks.filter((task) => !task.pinned && !task.savedForLater),
    [assignedTasks]
  );

  const completedTasks = useMemo(
    () => availableTasks.filter((task) => isCompleted(task.status)),
    [availableTasks]
  );

  const workQueue = useMemo(
    () => availableTasks.filter((task) => isActiveStatus(task.status)),
    [availableTasks]
  );

  const filteredWorkQueue = useMemo(() => {
    let tasks = [...workQueue];

    if (statusFilter && statusFilter !== "all") {
      if (statusFilter === "due_today") {
        tasks = tasks.filter((task) => deadlineState(task.deadline) === "today");
      } else if (statusFilter === "overdue") {
        tasks = tasks.filter((task) => deadlineState(task.deadline) === "overdue");
      } else {
        tasks = tasks.filter((task) => normalizeStatus(task.status) === statusFilter);
      }
    }

    tasks = tasks.filter((task) => matchesSearch(task, searchQuery));
    return sortTasks(tasks, sortMode);
  }, [workQueue, statusFilter, searchQuery, sortMode]);

  const matchesQuickFilter = (task, filterKey) => {
    if (filterKey === "all") return true;
    if (filterKey === "completed") return isCompleted(task.status);
    if (["in_progress", "pending_verification", "not_started"].includes(filterKey)) {
      return normalizeStatus(task.status) === filterKey;
    }
    if (["due_today", "overdue"].includes(filterKey)) {
      const state = deadlineState(task.deadline);
      return state === (filterKey === "due_today" ? "today" : "overdue");
    }
    return true;
  };

  const filteredFocusTasks = useMemo(
    () => focusTasks.filter((task) => matchesQuickFilter(task, focusFilter)),
    [focusTasks, focusFilter]
  );

  useEffect(() => {
    setDraftBasket(focusTasks.map((task) => task.id));
  }, [focusTasks]);

  const availableForDraft = useMemo(
    () => assignedTasks.filter((task) => !isCompleted(task.status)),
    [assignedTasks]
  );

  const draftBasketTasks = useMemo(
    () => availableForDraft.filter((task) => draftBasket.includes(task.id)),
    [availableForDraft, draftBasket]
  );

  const draftAvailableTasks = useMemo(
    () => availableForDraft.filter((task) => !draftBasket.includes(task.id)),
    [availableForDraft, draftBasket]
  );

  const openPrepareModal = () => {
    setDraftBasket(focusTasks.map((task) => task.id));
    setShowPrepareModal(true);
  };

  const handlePrepareCancel = () => {
    setDraftBasket(focusTasks.map((task) => task.id));
    setShowPrepareModal(false);
  };

  const addToDraft = (taskId) =>
    setDraftBasket((prev) => (prev.includes(taskId) ? prev : [...prev, taskId]));

  const removeFromDraft = (taskId) =>
    setDraftBasket((prev) => prev.filter((id) => id !== taskId));

  const handleDraftDragStart = (taskId, source) => {
    setDraggedTaskId(taskId);
    setDraftDragSource(source);
  };

  const handleDraftDragEnd = () => {
    setDraggedTaskId(null);
    setDraftDragSource(null);
    setPrepareHighlight({ basket: false, available: false });
  };

  const handleDraftDrop = (target) => {
    if (!draggedTaskId || draftDragSource === target) return;
    if (target === "basket") addToDraft(draggedTaskId);
    if (target === "available") removeFromDraft(draggedTaskId);
    handleDraftDragEnd();
  };

  const handleCommitDraft = async () => {
    const currentPinnedIds = focusTasks.map((task) => task.id);
    const desiredIds = draftBasket;

    const toPin = desiredIds.filter((id) => !currentPinnedIds.includes(id));
    const toUnpin = currentPinnedIds.filter((id) => !desiredIds.includes(id));

    for (const id of toPin) {
      await handlePinTask(id);
    }
    for (const id of toUnpin) {
      await handlePinTask(id);
    }

    setShowPrepareModal(false);
    setShowBasketModal(true);
  };

  const filteredCompleted = useMemo(() => {
    if (hideCompleted) return [];
    const matches = completedTasks.filter((task) => {
      if (statusFilter === "overdue") return deadlineState(task.deadline) === "overdue";
      if (statusFilter === "due_today") return deadlineState(task.deadline) === "today";
      if (statusFilter === "all" || statusFilter === "completed") return true;
      return statusFilter === normalizeStatus(task.status);
    });
    return sortTasks(matches.filter((task) => matchesSearch(task, searchQuery)), sortMode);
  }, [completedTasks, statusFilter, searchQuery, sortMode, hideCompleted]);

  const statusSummary = useMemo(() => {
    if (assignedTaskSummary) return assignedTaskSummary;
    return {
      total: assignedTasks.length,
      notStarted: assignedTasks.filter((t) => normalizeStatus(t.status) === "not_started").length,
      inProgress: assignedTasks.filter((t) => normalizeStatus(t.status) === "in_progress").length,
      pendingVerification: assignedTasks.filter((t) => normalizeStatus(t.status) === "pending_verification").length,
      completed: assignedTasks.filter((t) => isCompleted(t.status)).length,
    };
  }, [assignedTasks, assignedTaskSummary]);

  const handleRefresh = () => {
    if (externalRefreshTasks) {
      externalRefreshTasks();
    } else {
      setAssignedTasks([]);
      setTimeout(() => setAssignedTasks(initialAssignedTasks || []), 800);
    }
  };

  const handleDragStart = (taskId) => setDraggedTaskId(taskId);
  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setBasketHighlight(false);
  };

  const handleBasketDrop = (event) => {
    event.preventDefault();
    if (draggedTaskId) {
      handlePinTask(draggedTaskId);
    }
    handleDragEnd();
  };

  const handleBasketDragOver = (event) => {
    event.preventDefault();
    if (!basketHighlight) setBasketHighlight(true);
  };

  const handleBasketDragLeave = () => setBasketHighlight(false);

  const handlePinTask = async (taskId) => {
    const oldTask = assignedTasks.find((task) => task.id === taskId);
    if (!oldTask) return;

    const oldPinned = oldTask.pinned;
    const oldSaved = oldTask.savedForLater;
    const newPinned = !oldPinned;

    setAssignedTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, pinned: newPinned, savedForLater: newPinned ? false : oldSaved } : task
      )
    );

    try {
      const response = await fetch("/api/member/assignedTasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_flags",
          statusId: oldTask.taskStatusId,
          pinned: newPinned,
          savedForLater: newPinned ? false : oldSaved,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update focus");
      }
    } catch (error) {
      console.error("Error updating focus state:", error);
      setAssignedTasks((prev) =>
        prev.map((task) =>
          task.id === taskId ? { ...task, pinned: oldPinned, savedForLater: oldSaved } : task
        )
      );
    }
  };

  const handleSaveForLater = async (taskId) => {
    const oldTask = assignedTasks.find((task) => task.id === taskId);
    if (!oldTask) return;

    const oldPinned = oldTask.pinned;
    const oldSaved = oldTask.savedForLater;
    const newSaved = !oldSaved;

    setAssignedTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, savedForLater: newSaved, pinned: newSaved ? false : oldPinned } : task
      )
    );

    try {
      const response = await fetch("/api/member/assignedTasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_flags",
          statusId: oldTask.taskStatusId,
          pinned: newSaved ? false : oldPinned,
          savedForLater: newSaved,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update archive state");
      }
    } catch (error) {
      console.error("Error updating archive state:", error);
      setAssignedTasks((prev) =>
        prev.map((task) =>
          task.id === taskId ? { ...task, pinned: oldPinned, savedForLater: oldSaved } : task
        )
      );
    }
  };

  const boardColumns = useMemo(() => {
    const columns = {
      not_started: [],
      in_progress: [],
      pending_verification: [],
      completed: [],
    };

    [...filteredWorkQueue, ...filteredCompleted].forEach((task) => {
      const status = normalizeStatus(task.status);
      if (isCompleted(status)) {
        columns.completed.push(task);
      } else {
        columns[status]?.push(task);
      }
    });

    return columns;
  }, [filteredWorkQueue, filteredCompleted]);

  const renderSprintTags = (task) => {
    if (!task.sprints || task.sprints.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-2 mt-3">
        {task.sprints.map((sprint) => (
          <button
            key={sprint.id}
            onClick={() => handleSprintSelect(task, sprint)}
            className="flex items-center gap-2 px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium hover:bg-slate-200 transition-colors"
          >
            <ListChecks className="w-3 h-3" />
            {sprint.title || "Untitled Sprint"}
          </button>
        ))}
      </div>
    );
  };

  const renderTaskCard = (task, { inBasket = false, inArchive = false } = {}) => {
    const permissions = resolveTaskPermissions
      ? resolveTaskPermissions(task)
      : { statusOptions: [], context: { isObserver: false, isDoer: false, isManager: false } };
    const statusKey = normalizeStatus(task.status);
    const meta = STATUS_META[statusKey] || STATUS_META.not_started;
    const deadlineLabel = formatDeadline(task.deadline);
    const deadlineKind = deadlineState(task.deadline);
    const allowArchive = isCompleted(task.status);
    const canUpdateTask = permissions.statusOptions.length > 0;
    const observerEntries = Array.isArray(task.observers) ? task.observers : [];
    const observerNames = observerEntries
      .map((observer) => observer?.name || (observer?.id != null ? `Observer ${observer.id}` : null))
      .filter(Boolean);
    if (!observerNames.length && task.observerName) observerNames.push(task.observerName);
    const observerLabel = observerNames.length
      ? observerNames.slice(0, 2).join(", ") + (observerNames.length > 2 ? ` +${observerNames.length - 2}` : "")
      : "—";

    return (
      <motion.div
        key={task.id}
        layout
        draggable={!inArchive}
        onDragStart={() => handleDragStart(task.id)}
        onDragEnd={handleDragEnd}
        className={`group relative flex flex-col justify-between rounded-3xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-xl ${meta.border}`}
      >
        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">{task.title || "Untitled Task"}</h3>
              <p className="mt-1 text-xs text-slate-500">Assigned by {getAssignedBy(task.createdBy, users)}</p>
            </div>
            <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${meta.bg} ${meta.text}`}>
              <BadgeCheck className="h-3 w-3" />
              {formatStatusLabel(task.status)}
            </span>
          </div>

          {task.description && (
            <p className="mt-3 line-clamp-3 text-sm text-slate-600">{task.description}</p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-medium text-slate-600">
            <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1">
              <CalendarDays className="h-3.5 w-3.5" /> {deadlineLabel}
            </span>
            <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1">
              <Clock className="h-3.5 w-3.5" />
              Assigned {task.assignedDate ? new Date(task.assignedDate).toLocaleDateString() : "recently"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-xl bg-sky-100 px-3 py-1 text-sky-700">
              <UserCircle className="h-3.5 w-3.5" /> Observer{observerNames.length > 1 ? "s" : ""}: {observerLabel}
            </span>
            {deadlineKind === "overdue" && (
              <span className="inline-flex items-center gap-1 rounded-xl bg-rose-100 px-3 py-1 text-rose-600">
                • Needs immediate attention
              </span>
            )}
            {deadlineKind === "today" && (
              <span className="inline-flex items-center gap-1 rounded-xl bg-amber-100 px-3 py-1 text-amber-600">
                • Due today
              </span>
            )}
            {isPending(task.status) && (
              <span className="inline-flex items-center gap-1 rounded-xl bg-indigo-100 px-3 py-1 text-indigo-600">
                • Waiting for verification
              </span>
            )}
          </div>

          {renderSprintTags(task)}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => (inBasket ? handlePinTask(task.id) : handlePinTask(task.id))}
            className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
              inBasket
                ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                : "bg-teal-100 text-teal-700 hover:bg-teal-200"
            }`}
          >
            {inBasket ? <PinOff className="h-3.5 w-3.5" /> : <SunMedium className="h-3.5 w-3.5" />}
            {inBasket ? "Remove from basket" : "Focus today"}
          </button>

          {allowArchive && (
            <button
              onClick={() => handleSaveForLater(task.id)}
              className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                inArchive
                  ? "bg-teal-100 text-teal-700 hover:bg-teal-200"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {inArchive ? <Undo2 className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
              {inArchive ? "Restore" : "Archive"}
            </button>
          )}

          <button
            onClick={() => handleTaskDetails(task)}
            className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
          >
            Details
          </button>

          <button
            onClick={() => handleTaskSelect(task)}
            disabled={!canUpdateTask}
            title={canUpdateTask ? undefined : "No status changes available for your role"}
            className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
              canUpdateTask
                ? "bg-indigo-600 text-white hover:bg-indigo-500"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
          >
            Update
          </button>
        </div>
      </motion.div>
    );
  };

  const renderFocusBasket = () => (
    <section
      className={`rounded-3xl border border-dashed ${
        basketHighlight ? "border-teal-400 bg-teal-50/80" : "border-teal-200 bg-teal-50/40"
      } transition-colors`}
      onDragOver={handleBasketDragOver}
      onDragLeave={handleBasketDragLeave}
      onDrop={handleBasketDrop}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2 text-teal-700">
          <SunMedium className="h-5 w-5" />
          <div>
            <p className="text-sm font-semibold">Today's Basket</p>
            <p className="text-xs text-teal-600">
              Drag any card here (or tap Focus today) to make it part of today's short list.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-teal-700 shadow">
            {filteredFocusTasks.length} task{filteredFocusTasks.length === 1 ? "" : "s"}
          </span>
          <button
            onClick={() => setBasketExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-white px-3 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-50"
          >
            {basketExpanded ? "Collapse" : "Expand"}
          </button>
        </div>
      </header>

      <AnimatePresence initial={false}>
        {basketExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden px-4 pb-4"
          >
            {filteredFocusTasks.length === 0 ? (
              <p className="text-xs text-teal-600">
                No tasks match the current basket filters.
              </p>
            ) : (
              <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredFocusTasks.map((task) => renderTaskCard(task, { inBasket: true }))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );

  const renderPrepareTask = (task, source) => {
    const statusKey = normalizeStatus(task.status);
    const meta = STATUS_META[statusKey] || {
      label: "Not Started",
      pill: "bg-slate-100 text-slate-600 border border-slate-200",
    };

    return (
      <div
        key={`prepare-${source}-${task.id}`}
        draggable
        onDragStart={() => handleDraftDragStart(task.id, source)}
        onDragEnd={handleDraftDragEnd}
        className="group rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md cursor-grab"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900 line-clamp-2">{task.title || "Untitled task"}</p>
            <p className="mt-1 text-xs text-slate-500">
              {formatDeadline(task.deadline)}
            </p>
          </div>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${meta.pill}`}>
            {meta.label}
          </span>
        </div>
        {task.assignees?.length ? (
          <p className="mt-2 text-xs text-slate-500 line-clamp-1">
            {task.assignees.map((assignee) => assignee.name).join(", ")}
          </p>
        ) : null}
        <div className="mt-3 flex justify-end">
          <button
            onClick={() => (source === "available" ? addToDraft(task.id) : removeFromDraft(task.id))}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition ${
              source === "available"
                ? "bg-teal-600 text-white hover:bg-teal-500"
                : "border border-slate-300 text-slate-600 hover:bg-slate-100"
            }`}
          >
            {source === "available" ? "Add" : "Remove"}
          </button>
        </div>
      </div>
    );
  };

  const renderListView = () => (
    <div className="space-y-2">
      <div className="hidden rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500 md:grid md:grid-cols-[minmax(0,3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)_auto] md:items-center">
        <span>Task</span>
        <span>Status</span>
        <span>Deadline</span>
        <span>Assignees</span>
        <span className="text-right">Actions</span>
      </div>
      {filteredWorkQueue.map((task) => {
        const statusKey = normalizeStatus(task.status);
        const meta = STATUS_META[statusKey] || STATUS_META.not_started;
        const dueState = deadlineState(task.deadline);
        return (
          <div
            key={task.id}
            className="grid grid-cols-1 gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md md:grid-cols-[minmax(0,3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)_auto] md:items-center"
          >
            <div>
              <p className="text-sm font-semibold text-slate-900 line-clamp-1">{task.title || "Untitled task"}</p>
              <p className="mt-1 text-xs text-slate-500">
                #{task.id} · {new Date(task.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2 md:justify-start">
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${meta.pill}`}>
                {meta.label}
              </span>
            </div>
            <div className="text-sm text-slate-600">
              {formatDeadline(task.deadline)}
              {dueState === "overdue" && (
                <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-600">Overdue</span>
              )}
              {dueState === "today" && (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-600">Due today</span>
              )}
            </div>
            <div className="text-sm text-slate-600 md:text-left">
              {task.assignees?.map((assignee) => assignee.name).join(", ") || "Unassigned"}
            </div>
            <div className="flex flex-wrap justify-end gap-2 md:justify-end">
              <button
                onClick={() => handlePinTask(task.id)}
                className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                {task.pinned ? "Unfocus" : "Focus"}
              </button>
              {isCompleted(task.status) && (
                <button
                  onClick={() => handleSaveForLater(task.id)}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  {task.savedForLater ? "Restore" : "Archive"}
                </button>
              )}
              <button
                onClick={() => handleTaskDetails(task)}
                className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Details
              </button>
              <button
                onClick={() => handleTaskSelect(task)}
                disabled={task.sprints && task.sprints.length > 0}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition ${
                  task.sprints && task.sprints.length > 0
                    ? "cursor-not-allowed bg-slate-100 text-slate-400"
                    : "bg-indigo-600 text-white hover:bg-indigo-500"
                }`}
              >
                Update
              </button>
            </div>
          </div>
        );
      })}
      {filteredWorkQueue.length === 0 && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          No tasks match the current filters.
        </div>
      )}
    </div>
  );

  const renderBoardView = () => (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {[
        { key: "not_started", title: "Ready to Begin" },
        { key: "in_progress", title: "In Progress" },
        { key: "pending_verification", title: "Awaiting Verification" },
        { key: "completed", title: "Completed" },
      ].map(({ key, title }) => (
        <div key={key} className="flex h-full flex-col rounded-3xl border border-slate-200 bg-slate-50/60 p-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">{title}</p>
            <span className="text-xs text-slate-500">{boardColumns[key].length}</span>
          </div>
          <div className="flex flex-1 flex-col gap-3">
            {boardColumns[key].map((task) => renderTaskCard(task))}
            {boardColumns[key].length === 0 && (
              <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 p-4 text-xs text-slate-400">
                Nothing here right now
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const renderCompletedSection = () =>
    hideCompleted ? null : (
      <section className="rounded-3xl border border-emerald-100 bg-emerald-50/40 p-4">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-emerald-700">
            Completed (Visible) · {filteredCompleted.length} task{filteredCompleted.length === 1 ? "" : "s"}
          </p>
          <span className="text-xs text-emerald-600">
            Archive finished work to keep the main view tidy.
          </span>
        </div>
        {filteredCompleted.length === 0 ? (
          <p className="text-xs text-emerald-600">No completed tasks match the current filters.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredCompleted.map((task) => renderTaskCard(task))}
          </div>
        )}
      </section>
    );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex min-h-screen w-full flex-col gap-5 rounded-3xl bg-white/90 p-5 shadow-2xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleBack}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </motion.button>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="text-right pr-2">
            <p className="text-xs uppercase tracking-wide text-slate-400">Selected day</p>
            <p className="text-sm font-semibold text-slate-700">{selectedDate}</p>
          </div>
          <button
            onClick={() => setShowBasketModal(true)}
            className="inline-flex items-center gap-2 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700 transition hover:bg-teal-100"
          >
            Today's Basket
          </button>
          <button
            onClick={openPrepareModal}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Prepare today's basket
          </button>
          <span className="text-xs uppercase tracking-wide text-slate-400 pl-2">Views</span>
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
            <button
              onClick={() => setViewMode("board")}
              className={`inline-flex items-center gap-1 rounded-2xl px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === "board" ? "bg-white text-teal-700 shadow" : "text-slate-500"
              }`}
            >
              <Kanban className="h-4 w-4" /> Board
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`inline-flex items-center gap-1 rounded-2xl px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === "list" ? "bg-white text-teal-700 shadow" : "text-slate-500"
              }`}
            >
              <LayoutList className="h-4 w-4" /> List
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row flex-1 overflow-hidden">
        <aside className="flex-shrink-0 space-y-5 lg:w-64">
          <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Quick filters</p>
            <div className="mt-3 flex flex-col gap-2">
              {SIDEBAR_FILTERS.map((item) => (
                <button
                  key={item.value}
                  onClick={() => setStatusFilter(item.value)}
                  className={`flex flex-col rounded-2xl border px-3 py-2 text-left transition ${
                    statusFilter === item.value
                      ? "border-teal-400 bg-white shadow"
                      : "border-transparent bg-white/60 hover:border-teal-200"
                  }`}
                >
                  <span className="text-sm font-semibold text-slate-800">{item.label}</span>
                  <span className="text-xs text-slate-500">{item.helper}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Basket focus</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {BASKET_FILTERS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFocusFilter(option.value)}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition ${
                    focusFilter === option.value
                      ? "bg-teal-600 text-white shadow"
                      : "border border-teal-200 bg-white text-teal-700"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {filteredFocusTasks.length} task{filteredFocusTasks.length === 1 ? "" : "s"} in today's basket
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Snapshot</p>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <p className="flex items-center justify-between">
                <span>Total</span>
                <span className="font-semibold">{statusSummary.total}</span>
              </p>
              <p className="flex items-center justify-between">
                <span>Active</span>
                <span className="font-semibold">{statusSummary.inProgress}</span>
              </p>
              <p className="flex items-center justify-between">
                <span>Needs review</span>
                <span className="font-semibold">{statusSummary.pendingVerification}</span>
              </p>
              <p className="flex items-center justify-between">
                <span>Completed</span>
                <span className="font-semibold">{statusSummary.completed}</span>
              </p>
            </div>
          </div>
        </aside>

        <div className="flex-1 space-y-5 overflow-y-auto pr-1">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Total tasks",
                value: statusSummary.total,
                meta: "All assignments visible to you",
                onClick: () => setStatusFilter("all"),
              },
              {
                label: "In progress",
                value: statusSummary.inProgress,
                meta: "Actively moving",
                onClick: () => setStatusFilter("in_progress"),
              },
              {
                label: "Needs review",
                value: statusSummary.pendingVerification,
                meta: "Waiting for verification",
                onClick: () => setStatusFilter("pending_verification"),
              },
              {
                label: "Completed",
                value: statusSummary.completed,
                meta: "Done or verified",
                onClick: () => setStatusFilter("completed"),
              },
            ].map((item) => (
              <motion.button
                key={item.label}
                whileHover={{ y: -2 }}
                className={`rounded-3xl border border-slate-200 bg-slate-50/60 p-4 text-left transition-shadow hover:shadow-md ${
                  statusFilter === "all" && item.label === "Total tasks"
                    ? "border-teal-300"
                    : statusFilter !== "all" && item.onClick && item.label.toLowerCase().includes(statusFilter.replace("_", " "))
                    ? "border-teal-300"
                    : ""
                }`}
                onClick={item.onClick}
              >
                <p className="text-xs uppercase tracking-wide text-slate-400">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</p>
                <p className="mt-1 text-xs text-slate-500">{item.meta}</p>
              </motion.button>
            ))}
          </div>

          {renderFocusBasket()}

          <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search tasks, notes, resources…"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </div>
            <button
              onClick={() => setHideCompleted((prev) => !prev)}
              className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold transition border ${
                hideCompleted
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-slate-50 border-slate-200 text-slate-600"
              }`}
              title="Hide tasks marked Done or Verified to declutter"
            >
              <CheckCircle2 className="h-4 w-4" />
              {hideCompleted ? "Hiding completed" : "Show completed"}
            </button>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
            >
              <option value="all">All statuses</option>
              <option value="not_started">Not started</option>
              <option value="in_progress">In progress</option>
              <option value="pending_verification">Pending verification</option>
              <option value="completed">Completed</option>
              <option value="due_today">Due today</option>
              <option value="overdue">Overdue</option>
            </select>
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
            >
              <option value="recent">Recently assigned</option>
              <option value="deadline">Closest deadline</option>
              <option value="status">Status</option>
              <option value="alphabetical">Alphabetical</option>
            </select>
            <button
              onClick={() => setShowArchive((prev) => !prev)}
              className={`ml-auto inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium transition-colors ${
                showArchive ? "bg-teal-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Archive className="h-4 w-4" /> {showArchive ? "Hide archive" : "Show archive"}
            </button>
          </div>

          {isLoadingAssignedTasks ? (
            <div className="flex flex-1 items-center justify-center rounded-3xl border border-slate-200 bg-white py-12">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                className="h-10 w-10 rounded-full border-4 border-teal-200 border-t-teal-600"
              />
            </div>
          ) : (
            <>
              {viewMode === "board" ? renderBoardView() : renderListView()}
              {renderCompletedSection()}
            </>
          )}

          <AnimatePresence initial={false}>
            {showArchive && (
              <motion.section
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50/70"
              >
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Archive</p>
                    <p className="text-xs text-slate-500">Completed items you parked for later reference.</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 shadow">
                    {archivedTasks.length} task{archivedTasks.length === 1 ? "" : "s"}
                  </span>
                </div>
                {archivedTasks.length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-slate-400">Archive is empty for now.</p>
                ) : (
                  <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 xl:grid-cols-3">
                    {archivedTasks.map((task) => renderTaskCard(task, { inArchive: true }))}
                  </div>
                )}
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {showBasketModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Today's Basket</h2>
                  <p className="text-sm text-slate-500">Focused tasks for {selectedDate}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setShowBasketModal(false);
                      openPrepareModal();
                    }}
                    className="inline-flex items-center gap-2 rounded-2xl border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-700 hover:bg-teal-100"
                  >
                    Prepare today's basket
                  </button>
                  <button
                    onClick={() => setShowBasketModal(false)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {focusTasks.length === 0 ? (
                  <p className="text-sm text-slate-500">No focus tasks yet. Prepare the basket to add some.</p>
                ) : (
                  focusTasks.map((task) => (
                    <div key={`modal-basket-${task.id}`} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{task.title || "Untitled task"}</p>
                          <p className="text-xs text-slate-500">
                            {formatDeadline(task.deadline)}
                          </p>
                          {task.assignees?.length ? (
                            <p className="mt-2 text-xs text-slate-500 line-clamp-1">
                              {task.assignees.map((assignee) => assignee.name).join(", ")}
                            </p>
                          ) : null}
                        </div>
                        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                          (STATUS_META[normalizeStatus(task.status)]?.pill) || "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}>
                          {formatStatusLabel(task.status)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPrepareModal && (
          <motion.div
            className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-5xl rounded-3xl bg-white p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Prepare today's basket</h2>
                  <p className="text-sm text-slate-500">Drag tasks to curate today's focus list. Completed tasks are hidden.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrepareCancel}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCommitDraft}
                    className="inline-flex items-center gap-2 rounded-2xl bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-500"
                  >
                    Save basket
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div
                  onDragOver={(event) => event.preventDefault()}
                  onDragEnter={() => setPrepareHighlight((prev) => ({ ...prev, available: true }))}
                  onDragLeave={() => setPrepareHighlight((prev) => ({ ...prev, available: false }))}
                  onDrop={() => handleDraftDrop("available")}
                  className={`rounded-3xl border ${
                    prepareHighlight.available ? "border-teal-300 bg-teal-50/60" : "border-slate-200 bg-slate-50/60"
                  } p-4 min-h-[220px]`}
                >
                  <h3 className="text-sm font-semibold text-slate-800">All tasks</h3>
                  <p className="text-xs text-slate-500">Drag into the basket or tap add.</p>
                  <div className="mt-3 space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                    {draftAvailableTasks.length === 0 ? (
                      <p className="text-xs text-slate-500">Everything is already in today's basket.</p>
                    ) : (
                      draftAvailableTasks.map((task) => renderPrepareTask(task, "available"))
                    )}
                  </div>
                </div>

                <div
                  onDragOver={(event) => event.preventDefault()}
                  onDragEnter={() => setPrepareHighlight((prev) => ({ ...prev, basket: true }))}
                  onDragLeave={() => setPrepareHighlight((prev) => ({ ...prev, basket: false }))}
                  onDrop={() => handleDraftDrop("basket")}
                  className={`rounded-3xl border ${
                    prepareHighlight.basket ? "border-teal-300 bg-teal-50/60" : "border-slate-200 bg-slate-50/60"
                  } p-4 min-h-[220px]`}
                >
                  <h3 className="text-sm font-semibold text-slate-800">Today's basket blueprint</h3>
                  <p className="text-xs text-slate-500">Drag out to remove or tap remove.</p>
                  <div className="mt-3 space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                    {draftBasketTasks.length === 0 ? (
                      <p className="text-xs text-slate-500">No tasks selected yet.</p>
                    ) : (
                      draftBasketTasks.map((task) => renderPrepareTask(task, "basket"))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
