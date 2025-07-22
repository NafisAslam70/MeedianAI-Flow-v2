"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function MemberDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [routineTasks, setRoutineTasks] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [openCloseTimes, setOpenCloseTimes] = useState(null);
  const [canCloseDay, setCanCloseDay] = useState(false);
  const [assignedTaskSummary, setAssignedTaskSummary] = useState({
    total: 0,
    notStarted: 0,
    inProgress: 0,
    pendingVerification: 0,
    completed: 0,
  });
  const [routineTaskSummary, setRoutineTaskSummary] = useState({
    total: 0,
    notStarted: 0,
    inProgress: 0,
    pendingVerification: 0,
    completed: 0,
  });
  const [selectedTask, setSelectedTask] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showCloseDayModal, setShowCloseDayModal] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [closeDayTasks, setCloseDayTasks] = useState([]);
  const [closeDayComment, setCloseDayComment] = useState("");
  const [carouselPosition, setCarouselPosition] = useState(0);
  const carouselRef = useRef(null);

  // Redirect if not member
  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "member") {
      router.push(
        session?.user?.role === "admin" ? "/dashboard/admin" : "/dashboard/team_manager"
      );
    }
  }, [status, session, router]);

  // Fetch user data, tasks, and open/close times
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const res = await fetch("/api/member/profile");
        const data = await res.json();
        if (res.ok) {
          setUser(data.user);
          fetchOpenCloseTimes(data.user.type);
        } else {
          setError(data.error || "Failed to fetch user data");
          setTimeout(() => setError(""), 3000);
        }
      } catch (err) {
        setError("Failed to fetch user data");
        setTimeout(() => setError(""), 3000);
      }
    };

    const fetchOpenCloseTimes = async (userType) => {
      if (!userType) {
        console.error("User type is undefined while fetching open/close times");
        setError("User type is missing");
        return;
      }

      try {
        const res = await fetch(`/api/member/openCloseTimes?userType=${userType}`);
        const data = await res.json();

        if (res.ok) {
          setOpenCloseTimes(data.times);
          checkClosingWindow(data.times);
        } else {
          setError(data.error || "Failed to fetch open/close times");
          setTimeout(() => setError(""), 3000);
        }
      } catch (err) {
        console.error("Fetch open/close error:", err);
        setError("Failed to fetch open/close times");
        setTimeout(() => setError(""), 3000);
      }
    };

    const fetchAssignedTasks = async () => {
      try {
        const res = await fetch(`/api/member/assignedTasks?date=${selectedDate}`);
        const data = await res.json();
        if (res.ok) {
          const tasks = data.tasks || [];
          setAssignedTasks(tasks);
          const summary = tasks.reduce(
            (acc, task) => {
              acc.total += 1;
              if (task.status === "not_started") acc.notStarted += 1;
              if (task.status === "in_progress") acc.inProgress += 1;
              if (task.status === "pending_verification") acc.pendingVerification += 1;
              if (task.status === "verified" || task.status === "done") acc.completed += 1;
              return acc;
            },
            { total: 0, notStarted: 0, inProgress: 0, pendingVerification: 0, completed: 0 }
          );
          setAssignedTaskSummary(summary);
        } else {
          setError(data.error || "Failed to fetch assigned tasks");
          setTimeout(() => setError(""), 3000);
        }
      } catch (err) {
        setError("Failed to fetch assigned tasks");
        setTimeout(() => setError(""), 3000);
      }
    };

    const fetchRoutineTasks = async () => {
      try {
        const res = await fetch(`/api/member/routine-tasks?action=routineTasks&date=${selectedDate}`);
        const data = await res.json();
        if (res.ok) {
          const tasks = data.tasks || [];
          setRoutineTasks(tasks);
          const summary = tasks.reduce(
            (acc, task) => {
              acc.total += 1;
              if (task.status === "not_started") acc.notStarted += 1;
              if (task.status === "in_progress") acc.inProgress += 1;
              if (task.status === "pending_verification") acc.pendingVerification += 1;
              if (task.status === "verified" || task.status === "done") acc.completed += 1;
              return acc;
            },
            { total: 0, notStarted: 0, inProgress: 0, pendingVerification: 0, completed: 0 }
          );
          setRoutineTaskSummary(summary);
          setCloseDayTasks(tasks.map((task) => ({ id: task.id, description: task.description, markAsCompleted: false })));
        } else {
          setError(data.error || "Failed to fetch routine tasks");
          setTimeout(() => setError(""), 3000);
        }
      } catch (err) {
        setError("Failed to fetch routine tasks");
        setTimeout(() => setError(""), 3000);
      }
    };

    const checkClosingWindow = (times) => {
      const now = new Date();
      const closingStart = new Date(times.closingWindowStart);
      const closingEnd = new Date(times.closingWindowEnd);
      setCanCloseDay(now >= closingStart && now <= closingEnd);
    };

    fetchUserData();
    fetchAssignedTasks();
    fetchRoutineTasks();
  }, [selectedDate]);

  const handleStatusUpdate = async () => {
    if (!selectedTask || !newStatus) return;

    try {
      const res = await fetch("/api/member/assignedTasks/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: selectedTask.id, status: newStatus }),
      });
      const data = await res.json();
      if (res.ok) {
        setAssignedTasks((prev) =>
          prev.map((task) =>
            task.id === selectedTask.id ? { ...task, status: newStatus } : task
          )
        );
        setAssignedTaskSummary((prev) => {
          const updatedTasks = assignedTasks.map((task) =>
            task.id === selectedTask.id ? { ...task, status: newStatus } : task
          );
          return updatedTasks.reduce(
            (acc, task) => {
              acc.total += 1;
              if (task.status === "not_started") acc.notStarted += 1;
              if (task.status === "in_progress") acc.inProgress += 1;
              if (task.status === "pending_verification") acc.pendingVerification += 1;
              if (task.status === "verified" || task.status === "done") acc.completed += 1;
              return acc;
            },
            { total: 0, notStarted: 0, inProgress: 0, pendingVerification: 0, completed: 0 }
          );
        });
        setSuccess("Task status updated successfully!");
        setShowStatusModal(false);
        setSelectedTask(null);
        setNewStatus("");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.error || "Failed to update task status");
        setTimeout(() => setError(""), 3000);
      }
    } catch (err) {
      setError("Failed to update task status");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleCloseDay = async () => {
    try {
      const res = await fetch("/api/member/routine-tasks?action=closeDay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          date: selectedDate,
          tasks: closeDayTasks,
          comment: closeDayComment,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess("Day closed successfully!");
        setCanCloseDay(false);
        setShowCloseDayModal(false);
        setCloseDayTasks([]);
        setCloseDayComment("");
        setRoutineTasks((prev) =>
          prev.map((task) => {
            const taskUpdate = closeDayTasks.find((t) => t.id === task.id);
            return taskUpdate && taskUpdate.markAsCompleted
              ? { ...task, status: "completed", isLocked: true }
              : { ...task, isLocked: true };
          })
        );
        setRoutineTaskSummary((prev) => {
          const updatedTasks = routineTasks.map((task) => {
            const taskUpdate = closeDayTasks.find((t) => t.id === task.id);
            return taskUpdate && taskUpdate.markAsCompleted
              ? { ...task, status: "completed", isLocked: true }
              : { ...task, isLocked: true };
          });
          return updatedTasks.reduce(
            (acc, task) => {
              acc.total += 1;
              if (task.status === "not_started") acc.notStarted += 1;
              if (task.status === "in_progress") acc.inProgress += 1;
              if (task.status === "pending_verification") acc.pendingVerification += 1;
              if (task.status === "verified" || task.status === "done" || task.status === "completed") acc.completed += 1;
              return acc;
            },
            { total: 0, notStarted: 0, inProgress: 0, pendingVerification: 0, completed: 0 }
          );
        });
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.error || "Failed to close day");
        setTimeout(() => setError(""), 3000);
      }
    } catch (err) {
      setError("Failed to close day");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleTaskSelect = (task) => {
    setSelectedTask(task);
    setNewStatus(task.status);
    setShowStatusModal(true);
  };

  const handleCarouselScroll = (direction) => {
    const container = carouselRef.current;
    if (!container) return;
    const scrollAmount = 200;
    const newPosition =
      direction === "left"
        ? Math.max(carouselPosition - scrollAmount, 0)
        : Math.min(carouselPosition + scrollAmount, container.scrollWidth - container.clientWidth);
    setCarouselPosition(newPosition);
    container.scrollTo({ left: newPosition, behavior: "smooth" });
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-teal-50 to-gray-100 p-3">
      {/* Assigned Tasks Carousel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-4 mb-1"
      >
        <h2 className="text-xl font-bold text-gray-800 mb-2">Assigned Tasks</h2>
        <div className="relative">
          <div className="overflow-x-auto whitespace-nowrap pb-2" ref={carouselRef}>
            {assignedTasks.map((task, index) => (
              <motion.div
                key={task.id}
                className="inline-block w-64 bg-white/90 backdrop-blur-sm rounded-lg shadow-md p-3 mr-3"
                initial={{ x: index * 100 }}
                animate={{ x: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <p className="text-sm font-medium text-gray-700">
                  {task.title}: {task.status}
                </p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleTaskSelect(task)}
                  className="mt-2 px-3 py-1 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm"
                >
                  Update Status
                </motion.button>
              </motion.div>
            ))}
          </div>
          {assignedTasks.length > 3 && (
            <>
              <button
                onClick={() => handleCarouselScroll("left")}
                className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-gray-600 text-white p-2 rounded-full"
              >
                ←
              </button>
              <button
                onClick={() => handleCarouselScroll("right")}
                className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-gray-600 text-white p-2 rounded-full"
              >
                →
              </button>
            </>
          )}
        </div>
      </motion.div>

      {/* Task Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-4 mb-1 z-10"
      >
        <div className="flex flex-row items-center justify-between mb-3">
          <h2 className="text-xl font-bold text-gray-800">Task Summary</h2>
          <div className="flex-shrink-0">
            <label className="block text-sm font-medium text-gray-700">Time Period</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="mt-1 px-3 py-1 border rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <div className="text-center p-4 bg-gradient-to-r from-teal-50 to-teal-100 rounded-lg backdrop-blur-sm">
            <p className="text-sm font-medium text-gray-700">Total Tasks</p>
            <p className="text-4xl font-bold text-teal-800">{assignedTaskSummary.total}</p>
          </div>
          <div className="text-center p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg backdrop-blur-sm">
            <p className="text-sm font-medium text-gray-700">Completed</p>
            <p className="text-4xl font-bold text-green-700">{assignedTaskSummary.completed}</p>
          </div>
          <div className="text-center p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg backdrop-blur-sm">
            <p className="text-sm font-medium text-gray-700">In Progress</p>
            <p className="text-4xl font-bold text-yellow-700">{assignedTaskSummary.inProgress}</p>
          </div>
          <div className="text-center p-4 bg-gradient-to-r from-red-50 to-red-100 rounded-lg backdrop-blur-sm">
            <p className="text-sm font-medium text-gray-700">Not Started</p>
            <p className="text-4xl font-bold text-red-700">{assignedTaskSummary.notStarted}</p>
          </div>
        </div>
      </motion.div>

      {/* Routine Tasks */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-4 mb-1"
      >
        <h2 className="text-xl font-bold text-gray-800 mb-2">Routine Tasks</h2>
        <div className="space-y-2">
          {routineTasks.map((task) => (
            <div key={task.id} className="p-2 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700">
                {task.description}: {task.status}
                {task.isLocked && " (Locked)"}
              </p>
            </div>
          ))}
        </div>
        {canCloseDay && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCloseDayModal(true)}
            className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm"
          >
            Close Day
          </motion.button>
        )}
      </motion.div>

      {/* Status Update Modal */}
      <AnimatePresence>
        {showStatusModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900/60 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-4 w-full max-w-md"
            >
              <h2 className="text-lg font-bold text-gray-800 mb-2">Update Task Status</h2>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg mb-3 bg-gray-50 focus:ring-2 focus:ring-teal-500 text-sm"
              >
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="pending_verification">Pending Verification</option>
                <option value="done">Done</option>
              </select>
              <div className="flex justify-end space-x-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowStatusModal(false)}
                  className="px-3 py-1 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleStatusUpdate}
                  disabled={!newStatus}
                  className={`px-3 py-1 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm ${!newStatus ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  Update
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Close Day Modal */}
      <AnimatePresence>
        {showCloseDayModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900/60 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-4 w-full max-w-md"
            >
              <h2 className="text-lg font-bold text-gray-800 mb-2">Close Day</h2>
              <p className="text-sm text-gray-600 mb-3">Mark tasks as completed for {selectedDate}</p>
              {routineTasks.map((task) => (
                <div key={task.id} className="flex items-center space-x-2 mb-2">
                  <input
                    type="checkbox"
                    checked={closeDayTasks.find((t) => t.id === task.id)?.markAsCompleted || false}
                    onChange={(e) => {
                      setCloseDayTasks((prev) =>
                        prev.map((t) =>
                          t.id === task.id ? { ...t, markAsCompleted: e.target.checked } : t
                        )
                      );
                    }}
                    className="h-4 w-4 text-teal-600"
                    disabled={task.isLocked}
                  />
                  <p className="text-sm text-gray-700">{task.description}</p>
                </div>
              ))}
              <textarea
                value={closeDayComment}
                onChange={(e) => setCloseDayComment(e.target.value)}
                placeholder="Add a comment (optional)"
                className="w-full px-3 py-2 border rounded-lg mb-3 bg-gray-50 focus:ring-2 focus:ring-teal-500 text-sm"
              />
              <div className="flex justify-end space-x-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowCloseDayModal(false)}
                  className="px-3 py-1 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCloseDay}
                  className="px-3 py-1 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm"
                >
                  Close Day
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success/Error Messages */}
      <AnimatePresence>
        {success && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-sm text-green-500 mt-1 text-center absolute bottom-2 w-full"
          >
            {success}
          </motion.p>
        )}
        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-sm text-red-500 mt-1 text-center absolute bottom-2 w-full"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}