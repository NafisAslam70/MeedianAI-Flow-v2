import { motion, AnimatePresence } from "framer-motion";
import { useRef, useState, useEffect, useMemo } from "react";
import { ArrowLeft, ArrowRight, CheckCircle, Info, Calendar} from "lucide-react";
import { format } from "date-fns";
import useSWR from "swr";

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

  const { data: taskDetails } = useSWR(
    selectedTaskDetails ? `/api/member/assignedTasks?taskId=${selectedTaskDetails.id}&action=details` : null,
    fetcher
  );

  useEffect(() => {
    if (taskDetails) {
      setShowDetailsModal(true);
    }
  }, [taskDetails]);

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
        {/* Completed Tasks Card */}
        {completedTasks.length > 0 && (
          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            custom={0}
            className="flex-shrink-0 w-72 bg-white/80 backdrop-blur-md rounded-3xl shadow-md p-4 border border-emerald-50/50 hover:shadow-xl transition-all duration-300 snap-center"
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
                  className="aspect-square bg-emerald-50/80 rounded-2xl p-2 cursor-pointer hover:bg-emerald-100 transition-all duration-200 flex flex-col justify-between shadow-sm"
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

        {/* Past Deadline Tasks Card */}
        {pastDeadlineTasks.length > 0 && (
          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            custom={0}
            className="flex-shrink-0 w-72 bg-white/80 backdrop-blur-md rounded-3xl shadow-md p-4 border border-red-50/50 hover:shadow-xl transition-all duration-300 snap-center"
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
            <div className="grid grid-cols-3 gap-2">
              {pastDeadlineTasks.map((task, idx) => (
                <motion.div
                  key={task.id}
                  className="aspect-square bg-red-50/80 rounded-2xl p-2 cursor-pointer hover:bg-red-100 transition-all duration-200 flex flex-col justify-between shadow-sm"
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
          const daysLeft = calculateDaysLeft(task.deadline);
          const isNearDeadline = daysLeft !== null && daysLeft !== "Overdue" && daysLeft <= 3;
          const update = assignedTasksUpdates.find((u) => u.id === task.id);
          const colors = getStatusColor(task.status);

          return (
            <motion.div
              key={task.id}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              custom={index + 1}
              className={`flex-shrink-0 w-64 bg-white/80 backdrop-blur-md rounded-3xl shadow-md p-4 border ${colors.border}/50 hover:shadow-xl transition-all duration-300 snap-center`}
              whileHover={{ y: -4, scale: 1.01 }}
            >
              <div className="flex justify-between items-center mb-3">
                <p className="text-sm font-semibold text-gray-900 truncate pr-4">
                  {task.title || "Untitled"}
                </p>
                <span className={`text-xs px-2 py-1 rounded-full ${colors.bg} ${colors.text} font-medium capitalize`}>
                  {(task.status || "not_started").replace("_", " ")}
                </span>
              </div>
              <p className="text-xs text-gray-600 mb-2 flex items-center gap-1">
                <Calendar size={12} /> Days Left: {daysLeft ?? "No Deadline"}
              </p>
              <p className="text-xs text-gray-600 mb-3 flex items-center gap-1">
                <Info size={12} /> Assigned By: {task.createdBy ? `ID ${task.createdBy}` : "Unknown"}
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
        {showDetailsModal && taskDetails && (
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
              <div className="flex flex-row gap-4 mb-4">
                <div className="flex-1 space-y-3">
                  <p className="text-sm font-medium text-gray-700"><strong>Title:</strong> {taskDetails?.title || "Untitled Task"}</p>
                  <p className="text-sm font-medium text-gray-700"><strong>Description:</strong> {taskDetails?.description || "No description"}</p>
                  <p className="text-sm font-medium text-gray-700"><strong>Assigned By:</strong> {taskDetails?.createdBy ? `User ID ${taskDetails.createdBy}` : "Unknown"}</p>
                  <p className="text-sm font-medium text-gray-700"><strong>Status:</strong> {(taskDetails?.status || "not_started").replace("_", " ")}</p>
                  <p className="text-sm font-medium text-gray-700"><strong>Assigned Date:</strong> {taskDetails?.assignedDate ? new Date(taskDetails.assignedDate).toLocaleDateString() : "N/A"}</p>
                  <p className="text-sm font-medium text-gray-700"><strong>Deadline:</strong> {taskDetails?.deadline ? new Date(taskDetails.deadline).toLocaleDateString() : "No deadline"}</p>
                  <p className="text-sm font-medium text-gray-700"><strong>Resources:</strong> {taskDetails?.resources || "No resources"}</p>

                  {taskDetails.sprints?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700">Sprints</h3>
                      <ul className="space-y-2">
                        {taskDetails.sprints.map((s) => (
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
                    {(!taskDetails.logs || taskDetails.logs.length === 0) ? (
                      <p className="text-sm text-gray-500">No discussion yet.</p>
                    ) : (
                      taskDetails.logs.map((log) => {
                        const sprint = log.sprintId ? taskDetails.sprints?.find((s) => s.id === log.sprintId) : null;
                        const prefix = sprint ? `[${sprint.title || "Untitled Sprint"}] ` : "[Main] ";
                        return (
                          <div key={log.id} className="p-3 bg-gray-50 rounded-lg shadow-sm border border-gray-200">
                            <p className="text-xs text-gray-600">
                              {prefix}User ID {log.userId || "Unknown"} ({new Date(log.createdAt).toLocaleString()}):
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
                  onClick={() => setShowDetailsModal(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded-md text-sm font-medium"
                >
                  Close
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}