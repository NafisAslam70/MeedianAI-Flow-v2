"use client";
import React, { useEffect, useState, useCallback, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { debounce } from "lodash";
import useSWR from "swr";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });

// Lazy-load ManageTasksModal
const ManageTasksModal = React.lazy(() => import("@/components/ManageRoutineModal"));

export default function RoutineTaskStatus() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [tempUserId, setTempUserId] = useState(""); // Temporary user selection
  const [routineTasks, setRoutineTasks] = useState([]);
  const [routineTaskStatuses, setRoutineTaskStatuses] = useState([]);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState("");
  const [showManageTasksModal, setShowManageTasksModal] = useState(false);
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [editingTask, setEditingTask] = useState(null);

  // SWR for fetching users and tasks/statuses
  const { data: usersData, error: usersError } = useSWR("/api/managersCommon/users", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
    revalidateOnReconnect: false,
  });
  const { data: tasksData, error: tasksError, mutate: mutateTasks } = useSWR(
    selectedUserId ? `/api/managersCommon/routine-tasks?memberId=${selectedUserId}&limit=50` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
      revalidateOnReconnect: false,
    }
  );

  // Redirect if not authorized
  useEffect(() => {
    if (status === "authenticated" && !["admin", "team_manager"].includes(session?.user?.role)) {
      router.push("/dashboard/member");
    }
  }, [status, session, router]);

  // Update users state with deduplication
  const [users, setUsers] = useState([]);
  useEffect(() => {
    if (usersData?.users && session?.user) {
      const uniqueUsers = Array.from(new Map(usersData.users.map((u) => [u.id, u])).values());
      const currentUser = {
        id: session.user.id,
        name: session.user.name,
        role: session.user.role,
      };
      const isCurrentUserIncluded = uniqueUsers.some((u) => u.id === currentUser.id);
      if (!isCurrentUserIncluded) {
        uniqueUsers.push(currentUser);
      }
      setUsers(uniqueUsers);
    }
    if (usersError) {
      setError(`Failed to fetch users: ${usersError.message}`);
    }
  }, [usersData, usersError, session]);

  // Update tasks and statuses
  useEffect(() => {
    if (tasksData) {
      setRoutineTasks(tasksData.tasks || []);
      setRoutineTaskStatuses(tasksData.statuses || []);
      setIsLoading(false);
    }
    if (tasksError) {
      setError(`Failed to fetch tasks: ${tasksError.message}`);
      setIsLoading(false);
    }
  }, [tasksData, tasksError]);

  // Debounced user selection
  const handleUserSelect = useCallback(
    debounce((userId) => {
      if (userId) {
        setSelectedUserId(userId);
        setTempUserId("");
      } else {
        setError("Please select a valid user.");
      }
    }, 300),
    []
  );

  // Handle adding a new routine task
  const handleAddTask = async () => {
    if (!selectedUserId) {
      setError("Please select a user before adding a task.");
      return;
    }
    if (!newTaskDescription.trim()) {
      setError("Task description is required.");
      return;
    }

    setIsLoading(true);
    setLoadingAction("add");
    try {
      const response = await fetch("/api/managersCommon/routine-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: selectedUserId,
          description: newTaskDescription,
          status: "not_started",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add routine task");
      }

      const { taskId } = await response.json();
      setRoutineTasks((prev) => [
        ...prev,
        { id: taskId, description: newTaskDescription, memberId: selectedUserId },
      ]);
      setRoutineTaskStatuses((prev) => [
        ...prev,
        {
          routineTaskId: taskId,
          memberId: selectedUserId,
          status: "not_started",
          updatedAt: new Date().toISOString(),
          comment: null,
        },
      ]);
      setNewTaskDescription("");
      setError("");
      setSuccessMessage("Task added successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
      mutateTasks();
    } catch (err) {
      setError(`Error adding task: ${err.message}`);
    } finally {
      setIsLoading(false);
      setLoadingAction("");
    }
  };

  // Handle editing a routine task
  const handleEditTask = async (taskId) => {
    if (!newTaskDescription.trim()) {
      setError("Task description is required.");
      return;
    }

    setIsLoading(true);
    setLoadingAction("edit");
    try {
      const response = await fetch("/api/managersCommon/routine-tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          description: newTaskDescription,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update routine task");
      }

      setRoutineTasks((prev) =>
        prev.map((task) =>
          task.id === taskId ? { ...task, description: newTaskDescription } : task
        )
      );
      setNewTaskDescription("");
      setEditingTask(null);
      setError("");
      setSuccessMessage("Task updated successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
      mutateTasks();
    } catch (err) {
      setError(`Error updating task: ${err.message}`);
    } finally {
      setIsLoading(false);
      setLoadingAction("");
    }
  };

  // Handle deleting a routine task
  const handleDeleteTask = async (taskId) => {
    setIsLoading(true);
    setLoadingAction("delete");
    try {
      const response = await fetch("/api/managersCommon/routine-tasks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete routine task");
      }

      setRoutineTasks((prev) => prev.filter((task) => task.id !== taskId));
      setRoutineTaskStatuses((prev) => prev.filter((status) => status.routineTaskId !== taskId));
      setError("");
      setSuccessMessage("Task deleted successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
      mutateTasks();
    } catch (err) {
      setError(`Error deleting task: ${err.message}`);
    } finally {
      setIsLoading(false);
      setLoadingAction("");
    }
  };

  // Categorize users
  const admins = users.filter((user) => user.role === "admin");
  const teamManagers = users.filter((user) => user.role === "team_manager");
  const teamMembers = users.filter((user) => !["admin", "team_manager"].includes(user.role));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 p-6 flex items-center justify-center"
    >
      <div className="w-full h-full bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 rounded-2xl shadow-2xl p-8 flex flex-col gap-8 overflow-y-auto">
        {/* Error/Success Messages */}
        <AnimatePresence>
          {(error || successMessage) && (
            <motion.p
              key={error ? "error" : "success"}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`absolute top-4 left-4 right-4 text-lg font-medium p-4 rounded-lg shadow-md ${
                error ? "bg-red-50 text-red-600" : "bg-teal-50 text-teal-600"
              }`}
              onClick={() => {
                setError("");
                setSuccessMessage("");
              }}
            >
              {error || successMessage} (Click to dismiss)
            </motion.p>
          )}
        </AnimatePresence>

        {/* User Selection */}
        {!selectedUserId && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="w-full flex flex-col gap-6"
          >
            <div className="flex items-center gap-4">
              <svg className="w-12 h-12 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v2h5m-2-2a3 3 0 005.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">Select a Team Member</h2>
            </div>
            {!usersData ? (
              <p className="text-lg text-gray-600 text-center">Loading users...</p>
            ) : (
              <div className="flex flex-col gap-6">
                {/* Admins */}
                {admins.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-700 mb-2">Admins</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {admins.map((user, index) => (
                        <motion.div
                          key={`admin-${user.id}-${index}`}
                          className={`relative p-4 rounded-2xl shadow-lg cursor-pointer transition-all duration-300 ${
                            isLoading || tempUserId === user.id
                              ? "bg-teal-50"
                              : "bg-white hover:bg-teal-50 hover:shadow-xl"
                          } flex flex-col items-center justify-center h-32`}
                          whileHover={{ scale: isLoading ? 1 : 1.03, boxShadow: isLoading ? null : "0 8px 16px rgba(0, 128, 128, 0.2)" }}
                          whileTap={{ scale: isLoading ? 1 : 0.95 }}
                          onClick={() => !isLoading && setTempUserId(user.id)}
                        >
                          <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-teal-500"></div>
                          <h4 className="text-lg font-semibold text-gray-800 text-center">{user.name}</h4>
                          <p className="text-sm text-gray-600 text-center">Admin</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Team Managers */}
                {teamManagers.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-700 mb-2">Team Managers</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {teamManagers.map((user, index) => (
                        <motion.div
                          key={`manager-${user.id}-${index}`}
                          className={`relative p-4 rounded-2xl shadow-lg cursor-pointer transition-all duration-300 ${
                            isLoading || tempUserId === user.id
                              ? "bg-teal-50"
                              : "bg-white hover:bg-teal-50 hover:shadow-xl"
                          } flex flex-col items-center justify-center h-32`}
                          whileHover={{ scale: isLoading ? 1 : 1.03, boxShadow: isLoading ? null : "0 8px 16px rgba(0, 128, 128, 0.2)" }}
                          whileTap={{ scale: isLoading ? 1 : 0.95 }}
                          onClick={() => !isLoading && setTempUserId(user.id)}
                        >
                          <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-teal-500"></div>
                          <h4 className="text-lg font-semibold text-gray-800 text-center">{user.name}</h4>
                          <p className="text-sm text-gray-600 text-center">Team Manager</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Team Members */}
                {teamMembers.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-700 mb-2">Team Members</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {teamMembers.map((user, index) => (
                        <motion.div
                          key={`member-${user.id}-${index}`}
                          className={`relative p-4 rounded-2xl shadow-lg cursor-pointer transition-all duration-300 ${
                            isLoading || tempUserId === user.id
                              ? "bg-teal-50"
                              : "bg-white hover:bg-teal-50 hover:shadow-xl"
                          } flex flex-col items-center justify-center h-32`}
                          whileHover={{ scale: isLoading ? 1 : 1.03, boxShadow: isLoading ? null : "0 8px 16px rgba(0, 128, 128, 0.2)" }}
                          whileTap={{ scale: isLoading ? 1 : 0.95 }}
                          onClick={() => !isLoading && setTempUserId(user.id)}
                        >
                          <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-teal-500"></div>
                          <h4 className="text-lg font-semibold text-gray-800 text-center">{user.name}</h4>
                          <p className="text-sm text-gray-600 text-center">{user.type}</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
                <motion.button
                  onClick={() => handleUserSelect(tempUserId)}
                  disabled={!tempUserId || isLoading}
                  className={`w-full px-6 py-3 rounded-2xl text-lg font-semibold ${
                    !tempUserId || isLoading
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-teal-600 text-white hover:bg-teal-700"
                  } mt-6`}
                  whileHover={{ scale: !tempUserId || isLoading ? 1 : 1.03 }}
                  whileTap={{ scale: !tempUserId || isLoading ? 1 : 0.95 }}
                >
                  Select User
                </motion.button>
              </div>
            )}
          </motion.div>
        )}

        {/* Task and Status Columns */}
        {selectedUserId && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="w-full flex flex-col md:flex-row gap-8"
          >
            {/* Left Column: Routine Tasks */}
            <div className="w-full md:w-1/2 flex flex-col gap-6 h-full">
              <div className="flex items-center gap-4">
                <svg className="w-12 h-12 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">Routine Tasks</h2>
              </div>
              <div className="flex flex-row items-center gap-4 flex-wrap">
                <select
                  value={selectedUserId}
                  onChange={(e) => handleUserSelect(e.target.value)}
                  className="p-3 border border-teal-200 rounded-lg text-lg focus:ring-2 focus:ring-teal-500"
                  disabled={isLoading}
                >
                  <option value="">Select a member</option>
                  {users.map((user, index) => (
                    <option key={`user-${user.id}-${index}`} value={user.id}>
                      {user.name} ({user.role === "admin" ? "Admin" : user.role === "team_manager" ? "Team Manager" : user.type})
                    </option>
                  ))}
                </select>
                <motion.button
                  onClick={() => setShowManageTasksModal(true)}
                  className="px-6 py-3 bg-teal-600 text-white rounded-2xl text-lg font-semibold hover:bg-teal-700 shadow-md"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={isLoading}
                >
                  Manage Routine
                </motion.button>
              </div>
              <div className="flex-1 overflow-y-auto pr-4">
                {isLoading ? (
                  <Skeleton count={5} height={80} className="mb-4" />
                ) : routineTasks.length === 0 ? (
                  <p className="text-lg text-gray-600 text-center">No routine tasks assigned to this user.</p>
                ) : (
                  <ul className="space-y-4">
                    {routineTasks.map((task, index) => (
                      <motion.li
                        key={`task-${task.id}`}
                        className="bg-teal-50 p-4 rounded-2xl shadow-lg hover:bg-teal-100 transition-colors duration-200"
                        whileHover={{ scale: 1.03, boxShadow: "0 8px 16px rgba(0, 128, 128, 0.2)" }}
                      >
                        <p className="text-lg text-gray-800" title={task.description}>
                          {index + 1}. {task.description}
                        </p>
                      </motion.li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Right Column: Task Statuses */}
            <div className="w-full md:w-1/2 flex flex-col gap-6 h-full">
              <div className="flex items-center gap-4">
                <svg className="w-12 h-12 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">Task Statuses</h2>
              </div>
              <div className="flex-1 overflow-y-auto pr-4">
                {isLoading ? (
                  <Skeleton count={5} height={120} className="mb-4" />
                ) : routineTaskStatuses.length === 0 ? (
                  <p className="text-lg text-gray-600 text-center">No status updates for this user.</p>
                ) : (
                  <ul className="space-y-4">
                    {routineTasks.map((task, index) => {
                      const status = routineTaskStatuses.find((s) => s.routineTaskId === task.id);
                      return (
                        <motion.li
                          key={`status-${task.id}`}
                          className="bg-teal-50 p-4 rounded-2xl shadow-lg hover:bg-teal-100 transition-colors duration-200"
                          whileHover={{ scale: 1.03, boxShadow: "0 8px 16px rgba(0, 128, 128, 0.2)" }}
                        >
                          <p className="text-lg font-semibold text-gray-800 truncate" title={task.description}>
                            {index + 1}. {task.description}
                          </p>
                          {status ? (
                            <div className="ml-4 mt-2 text-base">
                              <p>
                                <strong>Status:</strong>{" "}
                                <span className="text-teal-600">{status.status}</span>
                              </p>
                              <p>
                                <strong>Last Updated:</strong>{" "}
                                {new Date(status.updatedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}
                              </p>
                              <p>
                                <strong>Comment:</strong>{" "}
                                {status.comment || "No comment"}
                              </p>
                            </div>
                          ) : (
                            <p className="ml-4 text-base text-gray-600">No status available</p>
                          )}
                        </motion.li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Manage Routine Modal */}
        <Suspense fallback={<p className="text-center text-lg text-gray-600">Loading modal...</p>}>
          <AnimatePresence>
            {showManageTasksModal && selectedUserId && users.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
              >
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 rounded-2xl shadow-2xl p-6 w-full max-w-4xl"
                >
                  <ManageTasksModal
                    users={users}
                    selectedUserId={selectedUserId}
                    routineTasks={routineTasks}
                    isLoading={isLoading}
                    loadingAction={loadingAction}
                    setLoadingAction={setLoadingAction}
                    newTaskDescription={newTaskDescription}
                    editingTask={editingTask}
                    setShowManageTasksModal={setShowManageTasksModal}
                    setNewTaskDescription={setNewTaskDescription}
                    setEditingTask={setEditingTask}
                    setSuccessMessage={setSuccessMessage}
                    successMessage={successMessage}
                    setError={setError}
                    handleAddTask={handleAddTask}
                    handleEditTask={handleEditTask}
                    handleDeleteTask={handleDeleteTask}
                  />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </Suspense>
      </div>
    </motion.div>
  );
}