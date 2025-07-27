// components/member/AssignedTaskCards.jsx
"use client";
import { motion } from "framer-motion";
import { useRef, useState } from "react";

export default function AssignedTaskCards({
  assignedTasks,
  isLoadingAssignedTasks,
  selectedDate,
  handleTaskSelect,
  handleSprintSelect,
  handleTaskDetails,
  users,
}) {
  const carouselRef = useRef(null);
  const [carouselPosition, setCarouselPosition] = useState(0);

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
    <div className="relative">
      <div className="overflow-x-auto whitespace-nowrap pb-4" ref={carouselRef}>
        {isLoadingAssignedTasks ? (
          <div className="flex items-center justify-center py-8">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-8 h-8 border-2 border-t-teal-600 border-teal-200 rounded-full"
            />
          </div>
        ) : assignedTasks.length === 0 ? (
          <p className="text-sm text-gray-600 text-center">No assigned tasks for {selectedDate}</p>
        ) : (
          assignedTasks.map((task, index) => (
            <motion.div
              key={task.id}
              className={`inline-block w-80 bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg p-6 mr-4 hover:shadow-xl transition-all duration-300 border-2 ${getStatusColor(task.status)}`}
              initial={{ x: index * 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <div className="flex justify-between items-start mb-2">
                <p className="text-base font-semibold text-gray-800 truncate">{task.title || "Untitled Task"}</p>
                <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(task.status)} capitalize`}>
                  {(task.status || "not_started").replace("_", " ")}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-2">Assigned By: {getAssignedBy(task.createdBy)}</p>
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
                        <p className="text-xs font-medium text-gray-800 truncate">{sprint.title || "Untitled Sprint"}</p>
                        <p className="text-xs text-gray-600 capitalize">Status: {(sprint.status || "not_started").replace("_", " ")}</p>
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
                  className={`flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium transition-colors duration-200 ${
                    task.sprints && task.sprints.length > 0 ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  disabled={task.sprints && task.sprints.length > 0}
                >
                  Update Status
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleTaskDetails(task)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors duration-200"
                >
                  View Details
                </motion.button>
              </div>
            </motion.div>
          ))
        )}
      </div>
      {assignedTasks.length > 2 && (
        <>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              const scrollAmount = 200;
              const newPosition = Math.max(carouselPosition - scrollAmount, 0);
              setCarouselPosition(newPosition);
              carouselRef.current.scrollTo({ left: newPosition, behavior: "smooth" });
            }}
            className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-teal-600 text-white p-3 rounded-full shadow-md hover:bg-teal-700 transition-colors duration-200"
          >
            ←
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              const scrollAmount = 200;
              const newPosition = Math.min(
                carouselPosition + scrollAmount,
                carouselRef.current.scrollWidth - carouselRef.current.clientWidth
              );
              setCarouselPosition(newPosition);
              carouselRef.current.scrollTo({ left: newPosition, behavior: "smooth" });
            }}
            className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-teal-600 text-white p-3 rounded-full shadow-md hover:bg-teal-700 transition-colors duration-200"
          >
            →
          </motion.button>
        </>
      )}
    </div>
  );
}