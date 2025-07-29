"use client";
import { motion } from "framer-motion";
import { useRef, useState, useEffect } from "react";
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

  useEffect(() => {
    setAssignedTasks(initialAssignedTasks || []);
  }, [initialAssignedTasks]);

  const getStatusColor = (status) => {
    switch (status) {
      case "not_started": return "bg-red-100 border-red-200";
      case "in_progress": return "bg-yellow-100 border-yellow-200";
      case "pending_verification": return "bg-blue-100 border-blue-200";
      case "verified": case "done": return "bg-green-100 border-green-200";
      default: return "bg-gray-100 border-gray-200";
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

  const summaryVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { delay: 0.2, duration: 0.4 } },
  };

  const cardVariants = {
    hidden: { opacity: 0, x: 50 },
    visible: (index) => ({
      opacity: 1,
      x: 0,
      transition: { duration: 0.4, delay: index * 0.1, ease: "easeOut" },
    }),
  };

  const handleRefresh = () => {
    if (externalRefreshTasks) {
      externalRefreshTasks();
    } else {
      // Simulate refresh or fetch data if no external function is provided
      setAssignedTasks([]);
      setTimeout(() => {
        setAssignedTasks(initialAssignedTasks || []);
      }, 1000); // Simulated delay
    }
  };

  const pendingTasks = assignedTasks.filter(task => task.status !== "verified" && task.status !== "done");
  const completedTasks = assignedTasks.filter(task => task.status === "verified" || task.status === "done");

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full h-full flex flex-col gap-2 bg-white p-6"
    >
      <div className="flex justify-between items-center">
        <motion.button
          onClick={handleBack}
          className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-all duration-300"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </motion.button>
        <motion.button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-all duration-300"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <RefreshCw className="w-5 h-5" />
          Refresh
        </motion.button>
      </div>

      <h2 className="text-2xl font-semibold text-gray-900">
        Assigned Tasks
      </h2>

      <div className="flex-1 overflow-y-auto relative">
        <div className="overflow-x-auto whitespace-nowrap pb-2" ref={carouselRef}>
          {isLoadingAssignedTasks ? (
            <div className="flex items-center justify-center py-12">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-10 h-10 border-4 border-t-blue-500 border-gray-200 rounded-full"
              />
            </div>
          ) : assignedTasks.length === 0 ? (
            <p className="text-base text-gray-500 text-center py-8">
              No tasks assigned for {selectedDate}
            </p>
          ) : (
            <div className="flex gap-4">
              {completedTasks.length > 0 && (
                <motion.div
                  key="completed-card"
                  custom={0}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  className="inline-block w-[448px] bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg p-6 mr-4 hover:shadow-xl transition-all duration-300 border-2 bg-green-100 border-green-200"
                  whileHover={{ y: -5, transition: { duration: 0.2 } }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-base font-semibold text-gray-800">
                      Completed Tasks ({completedTasks.length})
                    </p>
                    <span className="text-xs px-2 py-1 rounded-full bg-green-100 border-green-200 capitalize">
                      Done
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-3 mt-3">
                    {completedTasks.map((task) => (
                      <motion.div
                        key={task.id}
                        className="w-16 h-16 bg-green-50 rounded-lg p-2 m-1 cursor-pointer hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleTaskDetails(task)}
                      >
                        <p className="text-xs font-medium text-gray-800 truncate">
                          {task.title || "Untitled Task"}
                        </p>
                        <p className="text-xs text-gray-600 truncate">
                          {getAssignedBy(task.createdBy).slice(0, 8)}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
              {pendingTasks.map((task, index) => (
                <motion.div
                  key={task.id}
                  custom={completedTasks.length > 0 ? index + 1 : index}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  className={`inline-block w-80 bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg p-6 mr-4 hover:shadow-xl transition-all duration-300 border-2 ${getStatusColor(
                    task.status
                  )}`}
                  whileHover={{ y: -5, transition: { duration: 0.2 } }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-base font-semibold text-gray-800 truncate pr-2">
                      {task.title || "Untitled Task"}
                    </p>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${getStatusColor(
                        task.status
                      )} capitalize`}
                    >
                      {(task.status || "not_started").replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    Assigned By: {getAssignedBy(task.createdBy)}
                  </p>
                  {task.sprints && task.sprints.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-gray-700 mb-2">Sprints:</p>
                      <div className="space-y-2">
                        {task.sprints.map((sprint) => (
                          <motion.div
                            key={sprint.id}
                            className={`p-2 rounded-lg cursor-pointer hover:shadow-md transition-all duration-200 ${getStatusColor(sprint.status)}`}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleSprintSelect(task, sprint)}
                          >
                            <p className="text-xs font-medium text-gray-800 truncate">
                              {sprint.title || "Untitled Sprint"}
                            </p>
                            <p className="text-xs text-gray-600 capitalize">
                              Status: {(sprint.status || "not_started").replace("_", " ")}
                            </p>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 mt-4">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleTaskSelect(task)}
                      className={`flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-all duration-200 ${
                        task.sprints && task.sprints.length > 0
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      }`}
                      disabled={task.sprints && task.sprints.length > 0}
                    >
                      Update Status
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleTaskDetails(task)}
                      className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm font-medium transition-all duration-200"
                    >
                      View Details
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
        {assignedTasks.length > 2 && (
          <>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                const scrollAmount = 320;
                const newPosition = Math.max(carouselPosition - scrollAmount, 0);
                setCarouselPosition(newPosition);
                carouselRef.current.scrollTo({ left: newPosition, behavior: "smooth" });
              }}
              className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-white text-gray-800 p-3 rounded-full shadow-md hover:bg-gray-100 transition-all duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                const scrollAmount = 320;
                const newPosition = Math.min(
                  carouselPosition + scrollAmount,
                  carouselRef.current.scrollWidth - carouselRef.current.clientWidth
                );
                setCarouselPosition(newPosition);
                carouselRef.current.scrollTo({ left: newPosition, behavior: "smooth" });
              }}
              className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-white text-gray-800 p-3 rounded-full shadow-md hover:bg-gray-100 transition-all duration-200"
            >
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          </>
        )}
      </div>

      <motion.div
        className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-0"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
        }}
        initial="hidden"
        animate="visible"
      >
        {[
          { label: "Total", value: assignedTaskSummary.total, color: "border-teal-300 bg-teal-50", text: "text-teal-900" },
          { label: "Completed", value: assignedTaskSummary.completed, color: "border-green-300 bg-green-50", text: "text-green-900" },
          { label: "In Progress", value: assignedTaskSummary.inProgress, color: "border-yellow-300 bg-yellow-50", text: "text-yellow-900" },
          { label: "Not Started", value: assignedTaskSummary.notStarted, color: "border-red-300 bg-red-50", text: "text-red-900" },
        ].map((item, index) => (
          <motion.div
            key={index}
            variants={summaryVariants}
            className={`flex-1 p-6 rounded-xl shadow-md text-center hover:shadow-lg transition-shadow duration-300 border ${item.color} bg-white`}
          >
            <p className="text-base font-medium text-gray-600">{item.label}</p>
            <p className={`text-3xl font-bold ${item.text}`}>{item.value}</p>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}