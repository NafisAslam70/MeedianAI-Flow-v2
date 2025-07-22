"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function AdminDashboard() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isOpening, setIsOpening] = useState(false);
  const [dayOpened, setDayOpened] = useState(false);
  const [error, setError] = useState("");
  const [closingType, setClosingType] = useState("default");
  const [customTime, setCustomTime] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [totalTasks, setTotalTasks] = useState(0);
  const [completedTasks, setCompletedTasks] = useState(0);
  const [inProgressTasks, setInProgressTasks] = useState(0);
  const [notStartedTasks, setNotStartedTasks] = useState(0);
  const [memberTypeFilter, setMemberTypeFilter] = useState("all");
  const [users, setUsers] = useState([]);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showOpenDayModal, setShowOpenDayModal] = useState(false);
  const [selectedUserType, setSelectedUserType] = useState("");
  const [recentStatuses, setRecentStatuses] = useState([
    { id: 1, userName: "John Doe", task: "Sprint 2", status: "in_progress", userId: 1 },
    { id: 2, userName: "Jane Smith", task: "Sprint 3", status: "not_started", userId: 2 },
  ]);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "admin") {
      router.push(
        session?.user?.role === "teamManager" ? "/dashboard/teamManager" : "/dashboard/member"
      );
    }
  }, [status, session, router]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch("/api/member/users");
        const data = await res.json();
        if (res.ok) {
          setUsers(data.users);
        } else {
          setError(data.error || "Failed to fetch users");
        }
      } catch (err) {
        setError("Failed to fetch users");
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    const fetchTaskSummary = async () => {
      try {
        const res = await fetch(
          `/api/admin/taskSummary?memberType=${memberTypeFilter}&date=${selectedDate}`
        );
        const data = await res.json();
        if (res.ok) {
          setTotalTasks(data.totalTasks);
          setCompletedTasks(data.completedTasks);
          setInProgressTasks(data.inProgressTasks);
          setNotStartedTasks(data.notStartedTasks);
        } else {
          setError(data.error || "Failed to fetch task summary");
        }
      } catch (err) {
        setError("Failed to fetch task summary");
      }
    };
    fetchTaskSummary();
  }, [memberTypeFilter, selectedDate]);

  const handleDayOpen = async () => {
    if (!selectedUserType) {
      setError("Please select a user type");
      return;
    }
    setIsOpening(true);
    setError("");

    try {
      const body = {
        userType: selectedUserType,
        closingWindowType: closingType,
        ...(closingType === "custom" && customTime && { customClosingTime: `${selectedDate}T${customTime}:00` }),
      };

      const res = await fetch("/api/admin/day-open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        setDayOpened(true);
        setShowOpenDayModal(false);
        console.log("✅ Day opened successfully for", selectedUserType);
      } else {
        setError(data.message || "Something went wrong.");
        setDayOpened(false);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to open day.");
      setDayOpened(false);
    }

    setIsOpening(false);
  };

  const handleAssignTask = () => {
    router.push("/dashboard/managersCommon/assignTask");
  };

  const handleRoutineTaskStatus = () => {
    router.push("/dashboard/managersCommon/routineTasks");
  };

  const handleAddMember = () => {
    router.push("/dashboard/admin/addUser");
  };

  const handleManageMeedian = () => {
    router.push("/dashboard/admin/manageMeedian");
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
                  className="mt-2 px-3 py-1 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm"
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
            <div className="flex items-center space-x-2">
              <div className="flex-shrink-0">
                <label className="block text-sm font-medium text-gray-700">Time Period</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="mt-1 px-3 py-1 border rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"
                />
              </div>
              <div className="relative flex-shrink-0">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                  className="px-3 py-1 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm"
                >
                  Filter
                </motion.button>
                <AnimatePresence>
                  {showFilterDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute right-0 mt-2 w-60 bg-white/90 rounded-lg shadow-lg p-3 z-20"
                    >
                      <p className="text-sm font-medium text-gray-700 mb-2">Member Type</p>
                      <button
                        onClick={() => { setMemberTypeFilter("all"); setShowFilterDropdown(false); }}
                        className={`w-full text-left px-2 py-1 rounded text-sm ${memberTypeFilter === "all" ? "bg-teal-100" : ""}`}
                      >
                        All Members
                      </button>
                      <button
                        onClick={() => { setMemberTypeFilter("admins"); setShowFilterDropdown(false); }}
                        className={`w-full text-left px-2 py-1 rounded text-sm ${memberTypeFilter === "admins" ? "bg-teal-100" : ""}`}
                      >
                        Admins Only
                      </button>
                      <button
                        onClick={() => { setMemberTypeFilter("members"); setShowFilterDropdown(false); }}
                        className={`w-full text-left px-2 py-1 rounded text-sm ${memberTypeFilter === "members" ? "bg-teal-100" : ""}`}
                      >
                        Members Only
                      </button>
                      <p className="text-sm font-medium text-gray-700 mt-3 mb-2">Individual Member</p>
                      {users.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => { setMemberTypeFilter(user.id.toString()); setShowFilterDropdown(false); }}
                          className={`w-full text-left px-2 py-1 rounded text-sm ${memberTypeFilter === user.id.toString() ? "bg-teal-100" : ""}`}
                        >
                          {user.name} ({user.email})
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div className="text-center p-4 bg-gradient-to-r from-teal-50 to-teal-100 rounded-lg">
              <p className="text-sm font-medium text-gray-700">Total Tasks</p>
              <p className="text-4xl font-bold text-teal-800">{totalTasks}</p>
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <motion.div
            whileHover={{ scale: 1.05, boxShadow: "0 10px 20px rgba(0, 128, 0, 0.2)" }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowOpenDayModal(true)}
            className="bg-white/80 rounded-xl shadow-lg p-4 flex flex-col items-center justify-center min-h-[160px] cursor-pointer"
          >
            <svg className="w-12 h-12 text-teal-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
            <h3 className="text-xl font-bold text-gray-800 mb-1">Open Day</h3>
            <p className="text-gray-600 text-sm text-center">Open sections</p>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.05, boxShadow: "0 10px 20px rgba(0, 128, 0, 0.2)" }}
            whileTap={{ scale: 0.98 }}
            onClick={handleAssignTask}
            className="bg-white/80 rounded-xl shadow-lg p-4 flex flex-col items-center justify-center min-h-[160px] cursor-pointer"
          >
            <svg className="w-12 h-12 text-teal-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
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
            <svg className="w-12 h-12 text-teal-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
            </svg>
            <h3 className="text-xl font-bold text-gray-800 mb-1">Routine Task Status</h3>
            <p className="text-gray-600 text-sm text-center">View status</p>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.05, boxShadow: "0 10px 20px rgba(0, 128, 0, 0.2)" }}
            whileTap={{ scale: 0.98 }}
            onClick={handleAddMember}
            className="bg-white/80 rounded-xl shadow-lg p-4 flex flex-col items-center justify-center min-h-[160px] cursor-pointer"
          >
            <svg className="w-12 h-12 text-teal-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path>
            </svg>
            <h3 className="text-xl font-bold text-gray-800 mb-1">Add Member</h3>
            <p className="text-gray-600 text-sm text-center">Add new users</p>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.05, boxShadow: "0 10px 20px rgba(0, 128, 0, 0.2)" }}
            whileTap={{ scale: 0.98 }}
            onClick={handleManageMeedian}
            className="bg-white/80 rounded-xl shadow-lg p-4 flex flex-col items-center justify-center min-h-[160px] cursor-pointer"
          >
            <svg className="w-12 h-12 text-teal-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"></path>
            </svg>
            <h3 className="text-xl font-bold text-gray-800 mb-1">Manage Meedian</h3>
            <p className="text-gray-600 text-sm text-center">Manage settings</p>
          </motion.div>
        </div>
      </div>

      {/* Open Day Modal */}
      <AnimatePresence>
        {showOpenDayModal && (
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
              className="bg-white rounded-2xl p-6 w-full max-w-md"
            >
              <h2 className="text-lg font-bold text-gray-800 mb-2">Select User Type</h2>
              <select
                value={selectedUserType}
                onChange={(e) => setSelectedUserType(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg mb-3 bg-gray-50 focus:ring-2 focus:ring-teal-500 text-sm"
              >
                <option value="">Select User Type</option>
                <option value="residential">Residential</option>
                <option value="non_residential">Non Residential</option>
                <option value="semi_residential">Semi Residential</option>
              </select>
              <motion.select
                value={closingType}
                onChange={(e) => setClosingType(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg mb-3 bg-gray-50 focus:ring-2 focus:ring-teal-500 text-sm"
              >
                <option value="default">Default</option>
                <option value="custom">Custom</option>
              </motion.select>
              {closingType === "custom" && (
                <motion.input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg mb-3 bg-gray-50 focus:ring-2 focus:ring-teal-500 text-sm"
                />
              )}
              <div className="flex justify-end space-x-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowOpenDayModal(false)}
                  className="px-3 py-1 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleDayOpen}
                  disabled={!selectedUserType || isOpening}
                  className={`px-3 py-1 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm ${!selectedUserType || isOpening ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {isOpening ? "Opening..." : "Open Day"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}