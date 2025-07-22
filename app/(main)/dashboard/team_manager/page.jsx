"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function TeamManagerDashboard() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [totalTasks, setTotalTasks] = useState(0);
  const [completedTasks, setCompletedTasks] = useState(0);
  const [inProgressTasks, setInProgressTasks] = useState(0);
  const [notStartedTasks, setNotStartedTasks] = useState(0);
  const [recentStatuses, setRecentStatuses] = useState([
    { id: 1, userName: "John Doe", task: "Sprint 2", status: "in_progress", userId: 1 },
    { id: 2, userName: "Jane Smith", task: "Sprint 3", status: "not_started", userId: 2 },
  ]);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "team_manager") {
      router.push(
        session?.user?.role === "admin" ? "/dashboard/admin" : "/dashboard/member"
      );
    }
  }, [status, session, router]);

  useEffect(() => {
    const fetchTaskSummary = async () => {
      try {
        const res = await fetch(`/api/team_manager/taskSummary?date=${selectedDate}`);
        const data = await res.json();
        if (res.ok) {
          setTotalTasks(data.totalTasks || 0);
          setCompletedTasks(data.completedTasks || 0);
          setInProgressTasks(data.inProgressTasks || 0);
          setNotStartedTasks(data.notStartedTasks || 0);
        } else {
          setError(data.error || "Failed to fetch task summary");
          setTimeout(() => setError(""), 3000);
        }
      } catch (err) {
        setError("Failed to fetch task summary");
        setTimeout(() => setError(""), 3000);
      }
    };
    fetchTaskSummary();
  }, [selectedDate]);

  const handleAssignTask = () => {
    router.push("/dashboard/managersCommon/assignTask");
  };

  const handleRoutineTaskStatus = () => {
    router.push("/dashboard/managersCommon/routineTasks");
  };

  const handleRemindUser = (userId, userName, task, status) => {
    let reminderMessage = "";
    switch (status) {
      case "in_progress":
        reminderMessage = `Reminder: ${userName}, your task "${task}" is in progress. Please continue!`;
        break;
      case "not_started":
        reminderMessage = `Reminder: ${userName}, your task "${task}" has not started. Please begin soon!`;
        break;
      case "done":
        reminderMessage = `Reminder: ${userName}, your task "${task}" is marked done. Verify if needed!`;
        break;
      default:
        reminderMessage = `Reminder: ${userName}, please check your task "${task}".`;
    }
    const event = new CustomEvent("sendReminder", {
      detail: { recipientId: userId, content: reminderMessage },
    });
    window.dispatchEvent(event);
    console.log(`Reminder sent to ${userName} for ${task}: ${reminderMessage}`);
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
        {/* Error Message */}
        <AnimatePresence>
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

        {/* Recent Status Carousel */}
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Recent Status</h2>
          <div className="overflow-x-auto whitespace-nowrap pb-2">
            {recentStatuses.map((status, index) => (
              <motion.div
                key={status.id}
                className="inline-block w-64 bg-white/90 rounded-lg shadow-md p-3 mr-3"
                initial={{ x: index * 100 }}
                animate={{ x: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <p className="text-sm font-medium text-gray-700">
                  {status.userName}: {status.task} - {status.status}
                </p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleRemindUser(status.userId, status.userName, status.task, status.status)}
                  className="mt-2 px-3 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                >
                  Remind
                </motion.button>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Task Overview */}
        <div className="flex-1">
          <div className="flex flex-row items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-gray-800">Task Overview</h2>
            <div className="flex-shrink-0">
              <label className="block text-sm font-medium text-gray-700">Time Period</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="mt-1 px-3 py-1 border rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div className="text-center p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg">
              <p className="text-sm font-medium text-gray-700">Total Tasks</p>
              <p className="text-4xl font-bold text-purple-800">{totalTasks}</p>
            </div>
            <div className="text-center p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg">
              <p className="text-sm font-medium text-gray-700">Completed</p>
              <p className="text-4xl font-bold text-green-700">{completedTasks}</p>
            </div>
            <div className="text-center p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg">
              <p className="text-sm font-medium text-gray-700">In Progress</p>
              <p className="text-4xl font-bold text-yellow-700">{inProgressTasks}</p>
            </div>
            <div className="text-center p-4 bg-gradient-to-r from-red-50 to-red-100 rounded-lg">
              <p className="text-sm font-medium text-gray-700">Not Started</p>
              <p className="text-4xl font-bold text-red-700">{notStartedTasks}</p>
            </div>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <motion.div
            whileHover={{ scale: 1.05, boxShadow: "0 10px 20px rgba(0, 128, 0, 0.2)" }}
            whileTap={{ scale: 0.98 }}
            onClick={handleAssignTask}
            className="bg-white/80 rounded-xl shadow-lg p-4 flex flex-col items-center justify-center min-h-[160px] cursor-pointer"
          >
            <svg
              className="w-12 h-12 text-purple-600 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
              ></path>
            </svg>
            <h3 className="text-xl font-bold text-gray-800 mb-1">Assign Task</h3>
            <p className="text-gray-600 text-sm text-center">Add new tasks</p>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.05, boxShadow: "0 10px 20px rgba(0, 128, 0, 0.2)" }}
            whileTap={{ scale: 0.98 }}
            onClick={handleRoutineTaskStatus}
            className="bg-white/80 rounded-xl shadow-lg p-4 flex flex-col items-center justify-center min-h-[160px] cursor-pointer"
          >
            <svg
              className="w-12 h-12 text-purple-600 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              ></path>
            </svg>
            <h3 className="text-xl font-bold text-gray-800 mb-1">Routine Task Status</h3>
            <p className="text-gray-600 text-sm text-center">View status</p>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}