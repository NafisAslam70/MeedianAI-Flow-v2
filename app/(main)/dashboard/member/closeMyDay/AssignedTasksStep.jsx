"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, startOfDay, isSameDay, differenceInCalendarDays } from "date-fns";
import { CheckCircle, Info, Calendar, AlertTriangle, SunMedium } from "lucide-react";
import useSWR from "swr";
import AssignedTaskDetails from "@/components/assignedTaskCardDetailForAll";
import { useSession } from "next-auth/react";
import { createPortal } from "react-dom";

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function AssignedTasksStep({
  assignedTasksData,
  assignedTasksUpdates,
  handleUpdateAssignedTask,
  handlePrevStep,
  handleNextStep,
}) {
  const { data: session } = useSession();
  const { data } = useSWR("/api/member/users", fetcher);
  const users = data?.users || [];

  const [selectedTaskDetails, setSelectedTaskDetails] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [validationError, setValidationError] = useState("");

  const { data: taskDetails } = useSWR(
    selectedTaskDetails ? `/api/member/assignedTasks?taskId=${selectedTaskDetails.id}&action=task` : null,
    fetcher
  );
  const { data: taskLogs } = useSWR(
    selectedTaskDetails ? `/api/member/assignedTasks?taskId=${selectedTaskDetails.id}&action=logs` : null,
    fetcher
  );

  useEffect(() => {
    if (taskDetails && selectedTaskDetails) {
      setShowDetailsModal(true);
    }
  }, [taskDetails, selectedTaskDetails]);

  const todayStart = startOfDay(new Date());

  const parseDeadline = (deadline) => {
    if (!deadline) return null;
    const asDate = new Date(deadline);
    return Number.isNaN(asDate.valueOf()) ? null : asDate;
  };

  const activeTasks = useMemo(
    () =>
      (assignedTasksData?.tasks || []).filter(
        (task) => task && !["done", "verified"].includes(task.status)
      ),
    [assignedTasksData]
  );

  const categorizeTasks = useMemo(() => {
    const todayList = [];
    const approachingList = [];
    const overdueList = [];

    activeTasks.forEach((task) => {
      const deadline = parseDeadline(task.deadline);
      if (!deadline) {
        todayList.push(task);
        return;
      }

      const deadlineStart = startOfDay(deadline);
      if (deadlineStart < todayStart) {
        overdueList.push(task);
      } else if (isSameDay(deadlineStart, todayStart)) {
        todayList.push(task);
      } else {
        approachingList.push(task);
      }
    });

    approachingList.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    overdueList.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

    return {
      todayList,
      approachingList,
      overdueList,
    };
  }, [activeTasks, todayStart]);

  const getUserLabel = (task) => {
    const user = users?.find((u) => u.id === task.createdBy);
    if (!user) return `ID ${task.createdBy || "Unknown"}`;
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

  const isBasketTask = (task) => task?.pinned && !task?.savedForLater;

  const basketTasks = useMemo(
    () => (assignedTasksData?.tasks || []).filter(isBasketTask),
    [assignedTasksData]
  );

  const sections = useMemo(() => {
    const blocks = [];

    const todayTasks = categorizeTasks.todayList.filter((task) => !isBasketTask(task));
    if (todayTasks.length) {
      blocks.push({
        id: "today",
        title: "Today's Basket Work",
        description: "Focus on tasks due today or without a set deadline.",
        tasks: todayTasks,
      });
    }

    const approachingTasks = categorizeTasks.approachingList.filter((task) => !isBasketTask(task));
    if (approachingTasks.length) {
      blocks.push({
        id: "approaching",
        title: "Approaching Deadlines",
        description: "Tasks that are coming up soon—stay ahead before they turn urgent.",
        tasks: approachingTasks,
      });
    }

    const overdueTasks = categorizeTasks.overdueList.filter((task) => !isBasketTask(task));
    if (overdueTasks.length) {
      blocks.push({
        id: "overdue",
        title: "Past Deadline",
        description: "Overdue items that need immediate attention before you can close the day.",
        tasks: overdueTasks,
      });
    }

    if (!blocks.length && basketTasks.length === 0) {
      blocks.push({
        id: "empty",
        title: "No Active Assigned Work",
        description: "All assigned work is verified for today. Great job!",
        tasks: [],
      });
    }

    return blocks;
  }, [basketTasks, categorizeTasks]);

  const getUpdateEntry = (taskId) =>
    assignedTasksUpdates?.find((update) => update.id === taskId) ?? {};

  const formatCreatedAt = (value) => {
    if (!value) return "Unknown";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.valueOf())) {
      return "Unknown";
    }
    return format(parsed, "d MMM yyyy");
  };

  const formatDeadline = (deadline) => {
    const parsed = parseDeadline(deadline);
    if (!parsed) return "No deadline";
    return format(parsed, "EEE, d MMM yyyy");
  };

  const getDaysLeftLabel = (deadline) => {
    const parsed = parseDeadline(deadline);
    if (!parsed) return { label: "Flexible", color: "text-gray-500" };
    const diff = differenceInCalendarDays(startOfDay(parsed), todayStart);
    if (diff === 0) return { label: "Due today", color: "text-red-600" };
    if (diff < 0) return { label: `Overdue by ${Math.abs(diff)} day${Math.abs(diff) === 1 ? "" : "s"}`, color: "text-red-600" };
    if (diff <= 3) return { label: `Due in ${diff} day${diff === 1 ? "" : "s"}`, color: "text-amber-600" };
    return { label: `Due in ${diff} day${diff === 1 ? "" : "s"}`, color: "text-emerald-600" };
  };

  const needsUpdate = (task, update) => {
    if (task.status !== "in_progress") return false;
    const originalStatus = task.status;
    const statusChanged = update?.statusUpdate && update.statusUpdate !== originalStatus;
    const commentAdded = update?.comment && update.comment.trim().length > 0;
    const originalDeadline = task.deadline ? format(new Date(task.deadline), "yyyy-MM-dd") : "";
    const newDeadline = update?.newDeadline || "";
    const deadlineChanged = newDeadline && newDeadline !== originalDeadline;
    return !(statusChanged || commentAdded || deadlineChanged);
  };

  const inProgressWithoutUpdate = useMemo(
    () =>
      activeTasks.filter((task) => {
        if (task.status !== "in_progress") return false;
        const update = getUpdateEntry(task.id);
        return needsUpdate(task, update);
      }),
    [activeTasks, assignedTasksUpdates]
  );

  const handleAttemptNext = () => {
    if (inProgressWithoutUpdate.length) {
      const list = inProgressWithoutUpdate
        .slice(0, 3)
        .map((task) => task.title || `Task #${task.id}`)
        .join(", ");
      const suffix = inProgressWithoutUpdate.length > 3 ? "…" : "";
      setValidationError(
        `Add a quick update (status change, comment, or new date) for in-progress task${
          inProgressWithoutUpdate.length > 1 ? "s" : ""
        }: ${list}${suffix}`
      );
      return;
    }
    setValidationError("");
    handleNextStep();
  };

  const renderTaskCard = (task) => {
    const update = getUpdateEntry(task.id);
    const daysLeftInfo = getDaysLeftLabel(task.deadline);
    const requiresUpdate = needsUpdate(task, update);

    return (
      <motion.div
        key={task.id}
        layout
        className={`rounded-2xl border bg-white/80 backdrop-blur-md p-5 shadow-sm transition-all duration-200 hover:shadow-lg ${
          requiresUpdate ? "border-red-200" : "border-teal-100"
        }`}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <h4 className="text-base font-semibold text-gray-900">
              {task.title || task.description || `Task #${task.id}`}
            </h4>
            <p className="text-xs text-gray-500">
              Assigned by {getUserLabel(task)} · Created on {formatCreatedAt(task.createdAt)}
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs text-gray-600">
              <Calendar size={12} /> {formatDeadline(task.deadline)}
            </p>
            <p className={`text-xs font-semibold ${daysLeftInfo.color}`}>{daysLeftInfo.label}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 capitalize">
              {update?.statusUpdate || task.status}
            </span>
            {task.pinned && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-600">
                Pinned
              </span>
            )}
          </div>
        </div>

        {requiresUpdate && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>This in-progress task needs a status change, comment, or updated deadline before you move ahead.</span>
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Update Status</label>
            <select
              value={update?.statusUpdate || task.status}
              onChange={(e) => handleUpdateAssignedTask(task.id, "statusUpdate", e.target.value)}
              className="w-full rounded-xl border border-teal-200 bg-teal-50/50 p-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
            >
              <option value="not_started">Not Started</option>
              <option value="in_progress">In Progress</option>
              <option value="pending_verification">Pending Verification</option>
              <option value="done">Done</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Adjust Deadline</label>
            <input
              type="date"
              value={update?.newDeadline || ""}
              onChange={(e) => handleUpdateAssignedTask(task.id, "newDeadline", e.target.value)}
              className="w-full rounded-xl border border-teal-200 bg-teal-50/50 p-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
              min={format(new Date(), "yyyy-MM-dd")}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-gray-700 mb-1">Today's Comment</label>
            <textarea
              value={update?.comment || ""}
              onChange={(e) => handleUpdateAssignedTask(task.id, "comment", e.target.value)}
              className="h-24 w-full rounded-xl border border-teal-200 bg-teal-50/50 p-2 text-sm focus:border-teал-500 focus:outline-none focus:ring-2 focus:ring-teal-200 resize-none"
              placeholder="Share progress, blockers, or next steps."
            />
          </div>
        </div>

        <motion.button
          onClick={() => setSelectedTaskDetails(task)}
          className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
          whileHover={{ scale: 1.03 }}
        >
          <Info size={14} /> View Details
        </motion.button>
      </motion.div>
    );
  };

  if (!assignedTasksData || !assignedTasksData.tasks || assignedTasksData.tasks.length === 0) {
    return (
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <CheckCircle size={18} className="text-teal-600" /> Assigned Tasks
        </h3>
        <p className="text-gray-600">No assigned tasks for today.</p>
        <div className="flex justify-between mt-6 gap-4">
          <motion.button
            onClick={handlePrevStep}
            className="flex-1 rounded-xl bg-gray-200 py-3 font-semibold text-gray-800 shadow-sm transition hover:bg-gray-300"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Previous
          </motion.button>
          <motion.button
            onClick={handleNextStep}
            className="flex-1 rounded-xl bg-teal-600 py-3 font-semibold text-white shadow-md transition hover:bg-teal-700"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Next
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
          <CheckCircle size={18} className="text-teal-600" /> Assigned Tasks
        </h3>
        <p className="text-sm text-gray-600">
          Update each card with today’s progress. In-progress work needs a status/comment so supervisors can see movement.
        </p>
        {validationError && (
          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {validationError}
          </div>
        )}
      </div>

      {basketTasks.length > 0 && (
        <motion.section layout className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-100 text-teal-700">
              <SunMedium className="h-4 w-4" />
            </span>
            <div>
              <h4 className="text-base font-semibold text-teal-800">Today's Basket</h4>
              <p className="text-xs text-teal-600">
                These are the focused tasks you pinned earlier in the dashboard.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {basketTasks.map((task) => renderTaskCard(task))}
          </div>
        </motion.section>
      )}

      {sections.map((section) => (
        <motion.section key={section.id} layout className="space-y-4">
          <div className="flex items-center gap-2">
            <h4 className="text-base font-semibold text-gray-900">{section.title}</h4>
            {section.description && (
              <span className="text-xs text-gray-500">{section.description}</span>
            )}
          </div>
          {section.tasks.length ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {section.tasks.map(renderTaskCard)}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
              Nothing in this bucket right now.
            </p>
          )}
        </motion.section>
      ))}

      <div className="space-y-3 pt-4">
        {inProgressWithoutUpdate.length > 0 && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Add a quick update (status change, comment, or new date) for in-progress tasks: {validationError.replace(/^Add a quick update .*?: /, "")}
          </div>
        )}
        <div className="flex justify-between gap-4">
          <motion.button
            onClick={handlePrevStep}
            className="flex-1 rounded-xl bg-gray-200 py-3 font-semibold text-gray-800 shadow-sm transition hover:bg-gray-300"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
        >
          Previous
        </motion.button>
        <motion.button
          onClick={handleAttemptNext}
          className="flex-1 rounded-xl bg-teal-600 py-3 font-semibold text-white shadow-md transition hover:bg-teal-700"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Next
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {showDetailsModal && taskDetails?.task && createPortal(
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setShowDetailsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <AssignedTaskDetails
                task={taskDetails.task}
                taskLogs={taskLogs?.logs || []}
                users={users || []}
                onClose={() => setShowDetailsModal(false)}
                currentUserId={session?.user?.id}
                currentUserName={session?.user?.name}
              />
            </motion.div>
          </motion.div>,
          document.body
        )}
      </AnimatePresence>
    </div>
  );
}
