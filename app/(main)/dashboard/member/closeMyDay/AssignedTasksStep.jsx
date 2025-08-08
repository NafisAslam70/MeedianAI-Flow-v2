"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRef, useState, useEffect, useMemo } from "react";
import { ArrowLeft, ArrowRight, CheckCircle, Info, Calendar } from "lucide-react";
import { format } from "date-fns";
import useSWR from "swr";
import AssignedTaskDetails from "@/components/assignedTaskCardDetailForAll";
import { useSession } from "next-auth/react";

const fetcher = (url) =>
  fetch(url).then((res) => res.json());

export default function AssignedTasksStep({
  assignedTasksData,
  assignedTasksUpdates,
  handleUpdateAssignedTask,
  handlePrevStep,
  handleNextStep,
}) {
  const carouselRef = useRef(null);
  const [carouselPosition, setCarouselPosition] = useState(0);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const [selectedTaskDetails, setSelectedTaskDetails] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const { data: session } = useSession();
const { data } = useSWR("/api/member/users", fetcher);
const users = data?.users || [];


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

  useEffect(() => {
    const updateArrows = () => {
      if (carouselRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
        setShowLeftArrow(scrollLeft > 0);
        setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 1);
      }
    };

    const ref = carouselRef.current;
    if (ref) {
      ref.addEventListener("scroll", updateArrows);
      updateArrows();
    }

    return () => {
      if (ref) ref.removeEventListener("scroll", updateArrows);
    };
  }, [assignedTasksData?.tasks]);

  const getStatusColor = (status) => {
    switch (status) {
      case "not_started": return { bg: "bg-red-50", border: "border-red-100", text: "text-red-600" };
      case "in_progress": return { bg: "bg-amber-50", border: "border-amber-100", text: "text-amber-600" };
      case "pending_verification": return { bg: "bg-indigo-50", border: "border-indigo-100", text: "text-indigo-600" };
      case "verified": case "done": return { bg: "bg-emerald-50", border: "border-emerald-100", text: "text-emerald-600" };
      default: return { bg: "bg-gray-50", border: "border-gray-100", text: "text-gray-600" };
    }
  };

  const getAssignedBy = (createdBy) => {
    const user = users?.find((u) => u.id === createdBy);
    if (!user) return `ID ${createdBy || "Unknown"}`;
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

  const completedTasks = useMemo(() =>
    (assignedTasksData?.tasks || []).filter(task => task.status === "verified" || task.status === "done"),
    [assignedTasksData]
  );

  const pendingTasks = useMemo(() =>
    (assignedTasksData?.tasks || []).filter(task => task.status !== "verified" && task.status !== "done"),
    [assignedTasksData]
  );

  const pinnedTasks = useMemo(() => pendingTasks.filter(task => task.pinned), [pendingTasks]);
  const savedTasks = useMemo(() => pendingTasks.filter(task => task.savedForLater), [pendingTasks]);
  const normalTasks = useMemo(() => pendingTasks.filter(task => !task.pinned && !task.savedForLater), [pendingTasks]);

  const pastDeadlineTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return pendingTasks.filter(task => task.deadline && new Date(task.deadline) < today);
  }, [pendingTasks]);

  const scrollCarousel = (direction) => {
    const scrollAmount = 304;
    const newPosition = direction === "left"
      ? Math.max(carouselPosition - scrollAmount, 0)
      : Math.min(carouselPosition + scrollAmount, carouselRef.current.scrollWidth - carouselRef.current.clientWidth);

    setCarouselPosition(newPosition);
    carouselRef.current.scrollTo({ left: newPosition, behavior: "smooth" });
  };

  const cardVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: (index) => ({
      opacity: 1,
      scale: 1,
      transition: { duration: 0.3, delay: index * 0.05, ease: "easeOut" },
    }),
  };

  const calculateDaysLeft = (deadline) => {
    if (!deadline) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = new Date(deadline) - today;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : "Overdue";
  };

  const getDaysLeftColor = (daysLeft) => {
    if (daysLeft === null) return "text-gray-600";
    if (daysLeft === "Overdue" || (typeof daysLeft === "number" && daysLeft < 3)) return "text-red-600";
    if (typeof daysLeft === "number" && daysLeft <= 5) return "text-orange-600";
    return "text-green-600";
  };

  if (!assignedTasksData || !assignedTasksData.tasks || assignedTasksData.tasks.length === 0) {
    return (
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <CheckCircle size={18} className="text-teal-600" />
          Assigned Tasks
        </h3>
        <p className="text-gray-600">No assigned tasks for today.</p>
        <div className="flex justify-between mt-6 gap-4">
          <motion.button
            onClick={handlePrevStep}
            className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-all duration-300 shadow-sm"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Previous
          </motion.button>
          <motion.button
            onClick={handleNextStep}
            className="flex-1 bg-teal-600 text-white py-3 rounded-xl font-semibold hover:bg-teal-700 transition-all duration-300 shadow-md"
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
    <div className="relative">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <CheckCircle size={18} className="text-teal-600" />
        Assigned Tasks
      </h3>
      <div className="overflow-x-auto flex gap-4 pb-4 relative snap-x snap-mandatory" ref={carouselRef}>
        {(() => {
          let currentIndex = 0;
          return (
            <>
              {completedTasks.length > 0 && (
                <motion.div
                  key="completed"
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  custom={currentIndex++}
                  className="flex-shrink-0 bg-white/80 backdrop-blur-md rounded-3xl shadow-md p-4 border border-emerald-50/50 hover:shadow-xl transition-all duration-300 snap-center"
                  whileHover={{ y: -4, scale: 1.01 }}
                >
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-sm font-semibold text-gray-900">
                      Completed Tasks ({completedTasks.length})
                    </p>
                    <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-600 font-medium">
                      Done
                    </span>
                  </div>
                  <div className="grid grid-rows-3 grid-flow-col gap-2">
                    {completedTasks.map((task, idx) => (
                      <motion.div
                        key={task.id}
                        className="w-24 h-24 bg-emerald-50/80 rounded-2xl p-2 cursor-pointer hover:bg-emerald-100 transition-all duration-200 flex flex-col justify-between shadow-sm"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, transition: { delay: idx * 0.02 } }}
                        onClick={() => setSelectedTaskDetails(task)}
                      >
                        <p className="text-xs font-medium text-gray-900 truncate">
                          {task.title || "Untitled"}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
              {pastDeadlineTasks.length > 0 && (
                <motion.div
                  key="past_deadline"
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  custom={currentIndex++}
                  className="flex-shrink-0 bg-white/80 backdrop-blur-md rounded-3xl shadow-md p-4 border border-red-50/50 hover:shadow-xl transition-all duration-300 snap-center"
                  whileHover={{ y: -4, scale: 1.01 }}
                >
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-sm font-semibold text-gray-900">
                      Past Deadline Tasks ({pastDeadlineTasks.length})
                    </p>
                    <span className="text-xs px-2 py-1 rounded-full bg-red-50 text-red-600 font-medium">
                      Overdue
                    </span>
                  </div>
                  <div className="grid grid-rows-3 grid-flow-col gap-2">
                    {pastDeadlineTasks.map((task, idx) => (
                      <motion.div
                        key={task.id}
                        className="w-24 h-24 bg-red-50/80 rounded-2xl p-2 cursor-pointer hover:bg-red-100 transition-all duration-200 flex flex-col justify-between shadow-sm"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, transition: { delay: idx * 0.02 } }}
                        onClick={() => setSelectedTaskDetails(task)}
                      >
                        <p className="text-xs font-medium text-gray-900 truncate">
                          {task.title || "Untitled"}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
              {pinnedTasks.length > 0 && (
                <motion.div
                  key="pinned"
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  custom={currentIndex++}
                  className="flex-shrink-0 bg-white/80 backdrop-blur-md rounded-3xl shadow-md p-4 border border-indigo-50/50 hover:shadow-xl transition-all duration-300 snap-center"
                  whileHover={{ y: -4, scale: 1.01 }}
                >
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-sm font-semibold text-gray-900">
                      Pinned Tasks ({pinnedTasks.length})
                    </p>
                    <span className="text-xs px-2 py-1 rounded-full bg-indigo-50 text-indigo-600 font-medium">
                      Pinned
                    </span>
                  </div>
                  <div className="flex flex-row gap-4">
                    {pinnedTasks.map((task, idx) => {
                      const daysLeft = calculateDaysLeft(task.deadline);
                      const daysLeftColor = getDaysLeftColor(daysLeft);
                      const isNearDeadline = daysLeft !== null && daysLeft !== "Overdue" && daysLeft <= 3;
                      const update = assignedTasksUpdates.find((u) => u.id === task.id);
                      const colors = getStatusColor(task.status);
                      const today = new Date();

                      return (
                        <motion.div
                          key={task.id}
                          className={`flex-shrink-0 w-64 bg-white/80 backdrop-blur-md rounded-3xl shadow-md p-4 border ${colors.border} hover:shadow-xl transition-all duration-300`}
                          whileHover={{ y: -4, scale: 1.01 }}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1, transition: { delay: idx * 0.02 } }}
                        >
                          <p className={`text-xs font-bold ${daysLeftColor} mb-2 flex items-center gap-1`}>
                            <Calendar size={12} /> Days Left: {daysLeft ?? "No Deadline"}
                          </p>
                          <div className="flex justify-between items-center mb-3">
                            <p className="text-sm font-semibold text-gray-900 truncate pr-4">
                              {task.title || "Untitled"}
                            </p>
                            <span className={`text-xs px-2 py-1 rounded-full ${colors.bg} ${colors.text} font-medium capitalize`}>
                              {(task.status || "not_started").replace("_", " ")}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 mb-3 flex items-center gap-1">
                            <Info size={12} /> Assigned By: {getAssignedBy(task.createdBy)}
                          </p>
                          {task.sprints && task.sprints.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-semibold text-gray-700 mb-1">Sprints:</p>
                              <div className="space-y-1">
                                {task.sprints.map((sprint) => {
                                  const sprintColors = getStatusColor(sprint.status);
                                  return (
                                    <div key={sprint.id} className={`p-2 rounded-xl border ${sprintColors.border}/50 ${sprintColors.bg}/50 shadow-sm`}>
                                      <p className="text-xs font-medium text-gray-900 truncate">
                                        {sprint.title || "Untitled Sprint"}
                                      </p>
                                      <p className={`text-xs ${sprintColors.text} capitalize`}>
                                        Status: {(sprint.status || "not_started").replace("_", " ")}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {isNearDeadline && (
                            <div className="mt-2">
                              <label className="block text-xs font-medium text-gray-700 mb-1">Transfer Deadline To:</label>
                              <input
                                type="date"
                                value={update?.newDeadline || ""}
                                onChange={(e) => handleUpdateAssignedTask(task.id, "newDeadline", e.target.value)}
                                className="border border-teal-200 p-2 rounded-xl w-full text-xs focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200 bg-teal-50/50"
                                min={format(new Date(today.getTime() + 86400000), "yyyy-MM-dd")}
                              />
                            </div>
                          )}
                          <div className="mt-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Update Status:</label>
                            <select
                              value={update?.statusUpdate || task.status}
                              onChange={(e) => handleUpdateAssignedTask(task.id, "statusUpdate", e.target.value)}
                              className="border border-teal-200 p-2 rounded-xl w-full text-xs focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200 bg-teal-50/50"
                            >
                              <option value="not_started">Not Started</option>
                              <option value="in_progress">In Progress</option>
                              <option value="pending_verification">Pending Verification</option>
                              <option value="done">Done</option>
                            </select>
                          </div>
                          <div className="mt-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Comment:</label>
                            <textarea
                              value={update?.comment || ""}
                              onChange={(e) => handleUpdateAssignedTask(task.id, "comment", e.target.value)}
                              className="border border-teal-200 p-2 rounded-xl w-full text-xs h-20 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200 bg-teal-50/50 resize-none"
                            />
                          </div>
                          <motion.button
                            onClick={() => setSelectedTaskDetails(task)}
                            className="mt-3 flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium"
                            whileHover={{ scale: 1.05 }}
                          >
                            <Info size={14} /> View Details
                          </motion.button>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
              {normalTasks.map((task) => {
                const daysLeft = calculateDaysLeft(task.deadline);
                const daysLeftColor = getDaysLeftColor(daysLeft);
                const isNearDeadline = daysLeft !== null && daysLeft !== "Overdue" && daysLeft <= 3;
                const update = assignedTasksUpdates.find((u) => u.id === task.id);
                const colors = getStatusColor(task.status);
                const index = currentIndex++;
                const today = new Date();

                return (
                  <motion.div
                    key={task.id}
                    variants={cardVariants}
                    initial="hidden"
                    animate="visible"
                    custom={index}
                    className={`flex-shrink-0 w-64 bg-white/80 backdrop-blur-md rounded-3xl shadow-md p-4 border ${colors.border} hover:shadow-xl transition-all duration-300 snap-center`}
                    whileHover={{ y: -4, scale: 1.01 }}
                  >
                    <p className={`text-xs font-bold ${daysLeftColor} mb-2 flex items-center gap-1`}>
                      <Calendar size={12} /> Days Left: {daysLeft ?? "No Deadline"}
                    </p>
                    <div className="flex justify-between items-center mb-3">
                      <p className="text-sm font-semibold text-gray-900 truncate pr-4">
                        {task.title || "Untitled"}
                      </p>
                      <span className={`text-xs px-2 py-1 rounded-full ${colors.bg} ${colors.text} font-medium capitalize`}>
                        {(task.status || "not_started").replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mb-3 flex items-center gap-1">
                      <Info size={12} /> Assigned By: {getAssignedBy(task.createdBy)}
                    </p>
                    {task.sprints && task.sprints.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-gray-700 mb-1">Sprints:</p>
                        <div className="space-y-1">
                          {task.sprints.map((sprint) => {
                            const sprintColors = getStatusColor(sprint.status);
                            return (
                              <div key={sprint.id} className={`p-2 rounded-xl border ${sprintColors.border}/50 ${sprintColors.bg}/50 shadow-sm`}>
                                <p className="text-xs font-medium text-gray-900 truncate">
                                  {sprint.title || "Untitled Sprint"}
                                </p>
                                <p className={`text-xs ${sprintColors.text} capitalize`}>
                                  Status: {(sprint.status || "not_started").replace("_", " ")}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {isNearDeadline && (
                      <div className="mt-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Transfer Deadline To:</label>
                        <input
                          type="date"
                          value={update?.newDeadline || ""}
                          onChange={(e) => handleUpdateAssignedTask(task.id, "newDeadline", e.target.value)}
                          className="border border-teal-200 p-2 rounded-xl w-full text-xs focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200 bg-teal-50/50"
                          min={format(new Date(today.getTime() + 86400000), "yyyy-MM-dd")}
                        />
                      </div>
                    )}
                    <div className="mt-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Update Status:</label>
                      <select
                        value={update?.statusUpdate || task.status}
                        onChange={(e) => handleUpdateAssignedTask(task.id, "statusUpdate", e.target.value)}
                        className="border border-teal-200 p-2 rounded-xl w-full text-xs focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200 bg-teal-50/50"
                      >
                        <option value="not_started">Not Started</option>
                        <option value="in_progress">In Progress</option>
                        <option value="pending_verification">Pending Verification</option>
                        <option value="done">Done</option>
                      </select>
                    </div>
                    <div className="mt-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Comment:</label>
                      <textarea
                        value={update?.comment || ""}
                        onChange={(e) => handleUpdateAssignedTask(task.id, "comment", e.target.value)}
                        className="border border-teal-200 p-2 rounded-xl w-full text-xs h-20 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200 bg-teal-50/50 resize-none"
                      />
                    </div>
                    <motion.button
                      onClick={() => setSelectedTaskDetails(task)}
                      className="mt-3 flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium"
                      whileHover={{ scale: 1.05 }}
                    >
                      <Info size={14} /> View Details
                    </motion.button>
                  </motion.div>
                );
              })}
              {savedTasks.length > 0 && (
                <motion.div
                  key="saved"
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  custom={currentIndex++}
                  className="flex-shrink-0 bg-white/80 backdrop-blur-md rounded-3xl shadow-md p-4 border border-amber-50/50 hover:shadow-xl transition-all duration-300 snap-center"
                  whileHover={{ y: -4, scale: 1.01 }}
                >
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-sm font-semibold text-gray-900">
                      Saved for Later ({savedTasks.length})
                    </p>
                    <span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-600 font-medium">
                      Saved
                    </span>
                  </div>
                  <div className="flex flex-row gap-4">
                    {savedTasks.map((task, idx) => {
                      const daysLeft = calculateDaysLeft(task.deadline);
                      const daysLeftColor = getDaysLeftColor(daysLeft);
                      const isNearDeadline = daysLeft !== null && daysLeft !== "Overdue" && daysLeft <= 3;
                      const update = assignedTasksUpdates.find((u) => u.id === task.id);
                      const colors = getStatusColor(task.status);
                      const today = new Date();

                      return (
                        <motion.div
                          key={task.id}
                          className={`flex-shrink-0 w-64 bg-white/80 backdrop-blur-md rounded-3xl shadow-md p-4 border ${colors.border} hover:shadow-xl transition-all duration-300`}
                          whileHover={{ y: -4, scale: 1.01 }}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1, transition: { delay: idx * 0.02 } }}
                        >
                          <p className={`text-xs font-bold ${daysLeftColor} mb-2 flex items-center gap-1`}>
                            <Calendar size={12} /> Days Left: {daysLeft ?? "No Deadline"}
                          </p>
                          <div className="flex justify-between items-center mb-3">
                            <p className="text-sm font-semibold text-gray-900 truncate pr-4">
                              {task.title || "Untitled"}
                            </p>
                            <span className={`text-xs px-2 py-1 rounded-full ${colors.bg} ${colors.text} font-medium capitalize`}>
                              {(task.status || "not_started").replace("_", " ")}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 mb-3 flex items-center gap-1">
                            <Info size={12} /> Assigned By: {getAssignedBy(task.createdBy)}
                          </p>
                          {task.sprints && task.sprints.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-semibold text-gray-700 mb-1">Sprints:</p>
                              <div className="space-y-1">
                                {task.sprints.map((sprint) => {
                                  const sprintColors = getStatusColor(sprint.status);
                                  return (
                                    <div key={sprint.id} className={`p-2 rounded-xl border ${sprintColors.border}/50 ${sprintColors.bg}/50 shadow-sm`}>
                                      <p className="text-xs font-medium text-gray-900 truncate">
                                        {sprint.title || "Untitled Sprint"}
                                      </p>
                                      <p className={`text-xs ${sprintColors.text} capitalize`}>
                                        Status: {(sprint.status || "not_started").replace("_", " ")}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {isNearDeadline && (
                            <div className="mt-2">
                              <label className="block text-xs font-medium text-gray-700 mb-1">Transfer Deadline To:</label>
                              <input
                                type="date"
                                value={update?.newDeadline || ""}
                                onChange={(e) => handleUpdateAssignedTask(task.id, "newDeadline", e.target.value)}
                                className="border border-teal-200 p-2 rounded-xl w-full text-xs focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200 bg-teal-50/50"
                                min={format(new Date(today.getTime() + 86400000), "yyyy-MM-dd")}
                              />
                            </div>
                          )}
                          <div className="mt-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Update Status:</label>
                            <select
                              value={update?.statusUpdate || task.status}
                              onChange={(e) => handleUpdateAssignedTask(task.id, "statusUpdate", e.target.value)}
                              className="border border-teal-200 p-2 rounded-xl w-full text-xs focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200 bg-teal-50/50"
                            >
                              <option value="not_started">Not Started</option>
                              <option value="in_progress">In Progress</option>
                              <option value="pending_verification">Pending Verification</option>
                              <option value="done">Done</option>
                            </select>
                          </div>
                          <div className="mt-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Comment:</label>
                            <textarea
                              value={update?.comment || ""}
                              onChange={(e) => handleUpdateAssignedTask(task.id, "comment", e.target.value)}
                              className="border border-teal-200 p-2 rounded-xl w-full text-xs h-20 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200 bg-teal-50/50 resize-none"
                            />
                          </div>
                          <motion.button
                            onClick={() => setSelectedTaskDetails(task)}
                            className="mt-3 flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium"
                            whileHover={{ scale: 1.05 }}
                          >
                            <Info size={14} /> View Details
                          </motion.button>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </>
          );
        })()}
      </div>
      {showLeftArrow && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => scrollCarousel("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 bg-white/90 text-gray-900 p-2 rounded-full shadow-lg hover:bg-white transition-all duration-200 z-10"
        >
          <ArrowLeft className="w-4 h-4" />
        </motion.button>
      )}
      {showRightArrow && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => scrollCarousel("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 bg-white/90 text-gray-900 p-2 rounded-full shadow-lg hover:bg-white transition-all duration-200 z-10"
        >
          <ArrowRight className="w-4 h-4" />
        </motion.button>
      )}
      <div className="flex justify-between mt-6 gap-4">
        <motion.button
          onClick={handlePrevStep}
          className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-all duration-300 shadow-sm"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Previous
        </motion.button>
        <motion.button
          onClick={handleNextStep}
          className="flex-1 bg-teal-600 text-white py-3 rounded-xl font-semibold hover:bg-teal-700 transition-all duration-300 shadow-md"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Next
        </motion.button>
      </div>

      {/* Details Modal */}
      <AnimatePresence>
        {showDetailsModal && taskDetails?.task && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white/90 backdrop-blur-md p-6 rounded-3xl max-w-lg w-full shadow-xl border border-teal-100/50"
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
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}