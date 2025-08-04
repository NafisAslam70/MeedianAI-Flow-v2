"use client";
import { motion } from "framer-motion";
import { useRef, useState, useEffect, useMemo } from "react";
import { ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";

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
}) {
  const carouselRef = useRef(null);
  const [carouselPosition, setCarouselPosition] = useState(0);
  const [assignedTasks, setAssignedTasks] = useState(initialAssignedTasks || []);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const [activeFilter, setActiveFilter] = useState(null);

  useEffect(() => {
    setAssignedTasks(initialAssignedTasks || []);
  }, [initialAssignedTasks]);

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
      updateArrows(); // Initial check
    }

    return () => {
      if (ref) ref.removeEventListener("scroll", updateArrows);
    };
  }, [assignedTasks, activeFilter]);

  useEffect(() => {
    setCarouselPosition(0);
    if (carouselRef.current) {
      carouselRef.current.scrollTo({ left: 0, behavior: "smooth" });
    }
  }, [activeFilter]);

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
    const user = users.find((u) => u.id === createdBy);
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

  const handleRefresh = () => {
    if (externalRefreshTasks) {
      externalRefreshTasks();
    } else {
      setAssignedTasks([]);
      setTimeout(() => setAssignedTasks(initialAssignedTasks || []), 1000);
    }
  };

  const completedTasks = useMemo(() => 
    assignedTasks.filter(task => task.status === "verified" || task.status === "done"),
    [assignedTasks]
  );

  const pendingTasks = useMemo(() => 
    assignedTasks.filter(task => task.status !== "verified" && task.status !== "done"),
    [assignedTasks]
  );

  const summary = useMemo(() => ({
    total: assignedTasks.length,
    completed: completedTasks.length,
    inProgress: assignedTasks.filter(t => t.status === "in_progress").length,
    notStarted: assignedTasks.filter(t => t.status === "not_started").length,
    pendingVerification: assignedTasks.filter(t => t.status === "pending_verification").length,
  }), [assignedTasks]);

  const displayedCompleted = activeFilter === null || activeFilter === "completed";

  const displayedPending = useMemo(() => {
    if (activeFilter === "completed") return [];
    if (activeFilter === null) return pendingTasks;
    return pendingTasks.filter(task => task.status === activeFilter);
  }, [activeFilter, pendingTasks]);

  const hasContent = (displayedCompleted && completedTasks.length > 0) || displayedPending.length > 0;

  const getFilterLabel = () => {
    if (!activeFilter) return "";
    if (activeFilter === "completed") return "completed ";
    return `${activeFilter.replace("_", " ")} `;
  };

  const scrollCarousel = (direction) => {
    const scrollAmount = 304; // Adjusted for smaller card widths + gap (288 + 16)
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

  const summaryVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, delay: 0.1 } },
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="w-full h-full flex flex-col gap-4 bg-white p-4 rounded-3xl shadow-2xl"
    >
      <div className="flex justify-between items-center">
        <motion.button
          onClick={handleBack}
          className="flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-900 rounded-xl hover:bg-gray-100 transition-colors duration-200 shadow-sm text-sm"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </motion.button>
        <motion.button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-900 rounded-xl hover:bg-gray-100 transition-colors duration-200 shadow-sm text-sm"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </motion.button>
      </div>

      <h2 className="text-xl font-bold text-gray-900">Assigned Tasks</h2>

      <div className="flex-1 overflow-auto relative">
        <div 
          ref={carouselRef}
          className="overflow-x-auto snap-x snap-mandatory scrollbar-hide"
          style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
        >
          {isLoadingAssignedTasks ? (
            <div className="flex items-center justify-center h-40">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-8 h-8 border-4 border-t-indigo-500 border-gray-200 rounded-full"
              />
            </div>
          ) : !hasContent ? (
            <p className="text-sm text-gray-500 text-center py-8">
              No {getFilterLabel()}tasks assigned for {selectedDate}
            </p>
          ) : (
            <div className="flex gap-4 pb-4">
              {displayedCompleted && completedTasks.length > 0 && (
                <motion.div
                  key="completed"
                  custom={0}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  className="flex-shrink-0 w-72 bg-white rounded-3xl shadow-md p-4 border border-emerald-50 hover:shadow-xl transition-all duration-300"
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
                  <div className="grid grid-cols-3 gap-2">
                    {completedTasks.map((task, idx) => (
                      <motion.div
                        key={task.id}
                        className="aspect-square bg-emerald-50 rounded-2xl p-2 cursor-pointer hover:bg-emerald-100 transition-all duration-200 flex flex-col justify-between shadow-sm"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleTaskDetails(task)}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, transition: { delay: idx * 0.02 } }}
                      >
                        <p className="text-xs font-medium text-gray-900 truncate">
                          {task.title || "Untitled"}
                        </p>
                        <p className="text-xs text-gray-600 truncate">
                          {getAssignedBy(task.createdBy)}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
              {displayedPending.map((task, index) => {
                const colors = getStatusColor(task.status);
                const customIndex = (displayedCompleted && completedTasks.length > 0) ? index + 1 : index;
                return (
                  <motion.div
                    key={task.id}
                    custom={customIndex}
                    variants={cardVariants}
                    initial="hidden"
                    animate="visible"
                    className={`flex-shrink-0 w-64 bg-white rounded-3xl shadow-md p-4 border ${colors.border} hover:shadow-xl transition-all duration-300`}
                    whileHover={{ y: -4, scale: 1.01 }}
                  >
                    <div className="flex justify-between items-center mb-4">
                      <p className="text-sm font-semibold text-gray-900 truncate pr-4">
                        {task.title || "Untitled"}
                      </p>
                      <span className={`text-xs px-2 py-1 rounded-full ${colors.bg} ${colors.text} font-medium capitalize`}>
                        {(task.status || "not_started").replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mb-4">
                      Assigned By: {getAssignedBy(task.createdBy)}
                    </p>
                    {task.sprints && task.sprints.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-semibold text-gray-700 mb-2">Sprints:</p>
                        <div className="space-y-2">
                          {task.sprints.map((sprint) => {
                            const sprintColors = getStatusColor(sprint.status);
                            return (
                              <motion.div
                                key={sprint.id}
                                className={`p-2 rounded-2xl cursor-pointer hover:bg-gray-50 transition-all duration-200 border ${sprintColors.border} ${sprintColors.bg} shadow-sm`}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleSprintSelect(task, sprint)}
                              >
                                <p className="text-xs font-medium text-gray-900 truncate">
                                  {sprint.title || "Untitled Sprint"}
                                </p>
                                <p className={`text-xs ${sprintColors.text} capitalize`}>
                                  Status: {(sprint.status || "not_started").replace("_", " ")}
                                </p>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleTaskSelect(task)}
                        className={`flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-sm font-medium transition-all duration-200 shadow-sm ${
                          task.sprints && task.sprints.length > 0 ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                        disabled={task.sprints && task.sprints.length > 0}
                      >
                        Update Status
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleTaskDetails(task)}
                        className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-xl hover:bg-gray-800 text-sm font-medium transition-all duration-200 shadow-sm"
                      >
                        View Details
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
        {( (displayedCompleted && completedTasks.length > 1) || displayedPending.length > 1 ) && (
          <>
            {showLeftArrow && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => scrollCarousel("left")}
                className="absolute left-0 top-1/2 -translate-y-1/2 bg-white/90 text-gray-900 p-2 rounded-full shadow-lg hover:bg-white transition-all duration-200"
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
                className="absolute right-0 top-1/2 -translate-y-1/2 bg-white/90 text-gray-900 p-2 rounded-full shadow-lg hover:bg-white transition-all duration-200"
              >
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            )}
          </>
        )}
      </div>

      <motion.div
        className="grid grid-cols-2 md:grid-cols-5 gap-3"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
        }}
        initial="hidden"
        animate="visible"
      >
        {[
          { label: "Total", value: summary.total, color: "border-teal-100 bg-teal-50", text: "text-teal-700", key: "total" },
          { label: "Completed", value: summary.completed, color: "border-emerald-100 bg-emerald-50", text: "text-emerald-700", key: "completed" },
          { label: "In Progress", value: summary.inProgress, color: "border-amber-100 bg-amber-50", text: "text-amber-700", key: "in_progress" },
          { label: "Not Started", value: summary.notStarted, color: "border-red-100 bg-red-50", text: "text-red-700", key: "not_started" },
          { label: "Pending Verification", value: summary.pendingVerification, color: "border-indigo-100 bg-indigo-50", text: "text-indigo-700", key: "pending_verification" },
        ].map((item, index) => (
          <motion.div
            key={index}
            variants={summaryVariants}
            className={`p-4 rounded-3xl shadow-md text-center hover:shadow-xl transition-all duration-300 border ${item.color} bg-white cursor-pointer ${
              (item.key === "total" && activeFilter === null) || activeFilter === item.key ? "shadow-xl border-2" : ""
            }`}
            onClick={() => setActiveFilter(item.key === "total" ? null : item.key)}
          >
            <p className="text-sm font-medium text-gray-600">{item.label}</p>
            <p className={`text-2xl font-bold ${item.text}`}>{item.value}</p>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}