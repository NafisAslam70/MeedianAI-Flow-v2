// app/(main)/dashboard/member/closeMyDay/AssignedTasksStep.jsx
import { motion } from "framer-motion";
import { useRef, useState, useEffect, useMemo } from "react";
import { ArrowLeft, ArrowRight, CheckCircle } from "lucide-react";
import { format } from "date-fns";

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

  const completedTasks = useMemo(() =>
    (assignedTasksData?.tasks || []).filter(task => task.status === "verified" || task.status === "done"),
    [assignedTasksData]
  );

  const pendingTasks = useMemo(() =>
    (assignedTasksData?.tasks || []).filter(task => task.status !== "verified" && task.status !== "done"),
    [assignedTasksData]
  );

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

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <CheckCircle size={18} className="text-teal-600" />
        Assigned Tasks
      </h3>
      <div className="overflow-x-auto flex gap-4 pb-4 relative" ref={carouselRef}>
        {/* Completed Tasks Card */}
        {completedTasks.length > 0 && (
          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            custom={0}
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
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { delay: idx * 0.02 } }}
                >
                  <p className="text-xs font-medium text-gray-900 truncate">
                    {task.title || "Untitled"}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Pending Tasks Cards */}
        {pendingTasks.map((task, index) => {
          const today = new Date();
          const deadline = task.deadline ? new Date(task.deadline) : null;
          const isPastOrToday = deadline && deadline <= today;
          const update = assignedTasksUpdates.find((u) => u.id === task.id);
          const colors = getStatusColor(task.status);

          return (
            <motion.div
              key={task.id}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              custom={index + 1}
              className={`flex-shrink-0 w-64 bg-white rounded-3xl shadow-md p-4 border ${colors.border} hover:shadow-xl transition-all duration-200`}
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
                Assigned By: {task.createdBy ? `ID ${task.createdBy}` : "Unknown"}
              </p>
              {task.sprints && task.sprints.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Sprints:</p>
                  <div className="space-y-2">
                    {task.sprints.map((sprint) => {
                      const sprintColors = getStatusColor(sprint.status);
                      return (
                        <div key={sprint.id} className={`p-2 rounded-2xl border ${sprintColors.border} ${sprintColors.bg} shadow-sm`}>
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
              {isPastOrToday && (
                <div className="mt-2">
                  <label className="block text-sm">Transfer Deadline To:</label>
                  <input
                    type="date"
                    value={update?.newDeadline || ""}
                    onChange={(e) => handleUpdateAssignedTask(task.id, "newDeadline", e.target.value)}
                    className="border p-2 rounded w-full text-sm"
                    min={format(new Date(today.getTime() + 86400000), "yyyy-MM-dd")}
                  />
                </div>
              )}
              <div className="mt-2">
                <label className="block text-sm">Update Status:</label>
                <select
                  value={update?.statusUpdate || task.status}
                  onChange={(e) => handleUpdateAssignedTask(task.id, "statusUpdate", e.target.value)}
                  className="border p-2 rounded w-full text-sm"
                >
                  <option value="not_started">Not Started</option>
                  <option value="in_progress">In Progress</option>
                  <option value="pending_verification">Pending Verification</option>
                  <option value="done">Done</option>
                </select>
              </div>
              <div className="mt-2">
                <label className="block text-sm">Comment:</label>
                <textarea
                  value={update?.comment || ""}
                  onChange={(e) => handleUpdateAssignedTask(task.id, "comment", e.target.value)}
                  className="border p-2 rounded w-full text-sm"
                />
              </div>
            </motion.div>
          );
        })}
      </div>
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
      <div className="flex justify-between mt-6 gap-4">
        <motion.button
          onClick={handlePrevStep}
          className="flex-1 bg-gray-600 text-white py-3 rounded-xl font-semibold hover:bg-gray-500 transition-all duration-300"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Previous
        </motion.button>
        <motion.button
          onClick={handleNextStep}
          className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-all duration-300"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Next
        </motion.button>
      </div>
    </div>
  );
}