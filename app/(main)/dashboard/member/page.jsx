"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  const [selectedSprint, setSelectedSprint] = useState("");
  const [sprints, setSprints] = useState([]);
  const [closeDayTasks, setCloseDayTasks] = useState([]);
  const [closeDayComment, setCloseDayComment] = useState("");
  const [carouselPosition, setCarouselPosition] = useState(0);
  const carouselRef = useRef(null);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "member") {
      router.push(
        session?.user?.role === "admin" ? "/dashboard/admin" : "/dashboard/team_manager"
      );
    }
  }, [status, session, router]);

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

  const fetchSprints = async (taskId, memberId) => {
    try {
      const res = await fetch(`/api/member/sprints?taskId=${taskId}&memberId=${memberId}`);
      const data = await res.json();
      if (res.ok) {
        setSprints(data.sprints || []);
      } else {
        setError(data.error || "Failed to fetch sprints");
        setTimeout(() => setError(""), 3000);
      }
    } catch (err) {
      setError("Failed to fetch sprints");
      setTimeout(() => setError(""), 3000);
    }
  };

  const notifyAssignees = async (taskId, messageContent) => {
    try {
      const res = await fetch(`/api/member/assignedTasks/assignees?taskId=${taskId}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch assignees");
      }

      const assignees = data.assignees || [];
      const promises = assignees
        .filter((assignee) => assignee.memberId !== parseInt(user.id))
        .map((assignee) =>
          fetch("/api/others/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: user.id,
              recipientId: assignee.memberId,
              message: messageContent,
            }),
          })
        );

      const results = await Promise.all(promises);
      results.forEach(async (res, index) => {
        if (!res.ok) {
          const errorData = await res.json();
          console.error(`Failed to send message to assignee ${assignees[index].memberId}:`, errorData.error);
        }
      });
    } catch (err) {
      console.error("Error notifying assignees:", err);
      setError("Failed to notify assignees");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleStatusUpdate = async () => {
    if (!selectedTask || !newStatus) return;

    try {
      let res;
      let messageContent;

      if (sprints.length > 0 && selectedSprint) {
        // Update sprint status
        res = await fetch("/api/member/sprints/status", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sprintId: selectedSprint,
            status: newStatus,
            taskId: selectedTask.id,
            memberId: user.id,
          }),
        });
        messageContent = `Task "${selectedTask.title}" sprint "${sprints.find(s => s.id === parseInt(selectedSprint))?.title}" updated to status: ${newStatus}`;
      } else {
        // Update task status directly
        res = await fetch("/api/member/assignedTasks/status", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId: selectedTask.id,
            status: newStatus,
            memberId: user.id,
          }),
        });
        messageContent = `Task "${selectedTask.title}" updated to status: ${newStatus}`;
      }

      const data = await res.json();
      if (res.ok) {
        // Update local task state
        setAssignedTasks((prev) =>
          prev.map((task) =>
            task.id === selectedTask.id ? { ...task, status: newStatus } : task
          )
        );

        // Update task summary
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

        // Log the update
        await fetch("/api/member/assignedTasks/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId: selectedTask.id,
            userId: user.id,
            action: "status_update",
            details: sprints.length > 0 && selectedSprint
              ? `Updated sprint ${sprints.find(s => s.id === parseInt(selectedSprint))?.title} to ${newStatus}`
              : `Updated task status to ${newStatus}`,
          }),
        });

        // Notify assignees
        await notifyAssignees(selectedTask.id, messageContent);

        setSuccess("Task status updated successfully!");
        setShowStatusModal(false);
        setSelectedTask(null);
        setNewStatus("");
        setSelectedSprint("");
        setSprints([]);
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

  const handleTaskSelect = async (task) => {
    setSelectedTask(task);
    setNewStatus(task.status);
    await fetchSprints(task.id, user.id);
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

  if (status === "loading") {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-100">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-2xl font-semibold text-gray-700"
        >
          Loading...
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 bg-gray-100 p-8 flex items-center justify-center"
    >
      <div className="w-full h-full bg-white rounded-2xl shadow-2xl p-8 flex flex-col gap-8 overflow-y-auto">
        {/* Error/Success Messages */}
        <AnimatePresence>
          {success && (
            <motion.p
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 left-4 right-4 text-green-600 text-sm font-medium bg-green-50 p-4 rounded-lg"
            >
              {success}
            </motion.p>
          )}
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 left-4 right-4 text-red-600 text-sm font-medium bg-red-50 p-4 rounded-lg"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Assigned Tasks Carousel */}
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Assigned Tasks</h2>
          <div className="relative">
            <div className="overflow-x-auto whitespace-nowrap pb-2" ref={carouselRef}>
              {assignedTasks.map((task, index) => (
                <motion.div
                  key={task.id}
                  className="inline-block w-64 bg-white/90 rounded-lg shadow-md p-3 mr-3"
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
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleCarouselScroll("left")}
                  className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-gray-600 text-white p-2 rounded-full"
                >
                  ←
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleCarouselScroll("right")}
                  className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-gray-600 text-white p-2 rounded-full"
                >
                  →
                </motion.button>
              </>
            )}
          </div>
        </div>

        {/* Task Summary */}
        <div className="flex-1">
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
            <div className="text-center p-4 bg-gradient-to-r from-teal-50 to-teal-100 rounded-lg">
              <p className="text-sm font-medium text-gray-700">Total Tasks</p>
              <p className="text-4xl font-bold text-teal-800">{assignedTaskSummary.total}</p>
            </div>
            <div className="text-center p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg">
              <p className="text-sm font-medium text-gray-700">Completed</p>
              <p className="text-4xl font-bold text-green-700">{assignedTaskSummary.completed}</p>
            </div>
            <div className="text-center p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg">
              <p className="text-sm font-medium text-gray-700">In Progress</p>
              <p className="text-4xl font-bold text-yellow-700">{assignedTaskSummary.inProgress}</p>
            </div>
            <div className="text-center p-4 bg-gradient-to-r from-red-50 to-red-100 rounded-lg">
              <p className="text-sm font-medium text-gray-700">Not Started</p>
              <p className="text-4xl font-bold text-red-700">{assignedTaskSummary.notStarted}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {canCloseDay && (
            <motion.div
              whileHover={{ scale: 1.05, boxShadow: "0 10px 20px rgba(0, 128, 0, 0.2)" }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowCloseDayModal(true)}
              className="bg-white/80 rounded-xl shadow-lg p-4 flex flex-col items-center justify-center min-h-[160px] cursor-pointer"
            >
              <svg className="w-12 h-12 text-teal-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
              </svg>
              <h3 className="text-xl font-bold text-gray-800 mb-1">Close Day</h3>
              <p className="text-gray-600 text-sm text-center">Close tasks for the day</p>
            </motion.div>
          )}
        </div>

        {/* Routine Tasks */}
        <div className="flex-1">
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
        </div>

        {/* Status Update Modal */}
        <AnimatePresence>
          {showStatusModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md"
              >
                <h2 className="text-lg font-bold text-gray-800 mb-2">Update Task Status</h2>
                {sprints.length > 0 ? (
                  <>
                    <select
                      value={selectedSprint}
                      onChange={(e) => setSelectedSprint(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg mb-3 bg-gray-50 focus:ring-2 focus:ring-teal-500 text-sm"
                    >
                      <option value="">Select Sprint</option>
                      {sprints.map((sprint) => (
                        <option key={sprint.id} value={sprint.id}>
                          {sprint.title}
                        </option>
                      ))}
                    </select>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg mb-3 bg-gray-50 focus:ring-2 focus:ring-teal-500 text-sm"
                      disabled={!selectedSprint}
                    >
                      <option value="">Select Status</option>
                      <option value="not_started">Not Started</option>
                      <option value="in_progress">In Progress</option>
                      <option value="pending_verification">Pending Verification</option>
                      <option value="done">Done</option>
                    </select>
                  </>
                ) : (
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg mb-3 bg-gray-50 focus:ring-2 focus:ring-teal-500 text-sm"
                  >
                    <option value="">Select Status</option>
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="pending_verification">Pending Verification</option>
                    <option value="done">Done</option>
                  </select>
                )}
                <div className="flex justify-end space-x-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setShowStatusModal(false);
                      setSelectedTask(null);
                      setNewStatus("");
                      setSelectedSprint("");
                      setSprints([]);
                    }}
                    className="px-3 py-1 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleStatusUpdate}
                    disabled={!newStatus || (sprints.length > 0 && !selectedSprint)}
                    className={`px-3 py-1 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm ${
                      !newStatus || (sprints.length > 0 && !selectedSprint) ? "opacity-50 cursor-not-allowed" : ""
                    }`}
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
              className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md"
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
      </div>
    </motion.div>
  );
}