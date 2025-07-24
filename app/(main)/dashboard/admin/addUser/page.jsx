"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import React, { useState, useEffect, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

export default function AddUser() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "member",
    type: "residential",
    team_manager_type: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newUserId, setNewUserId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [routineTasks, setRoutineTasks] = useState([]);
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [editingTask, setEditingTask] = useState(null);
  const [loadingAction, setLoadingAction] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [tempUserId, setTempUserId] = useState("");

  // SWR for fetching users and tasks
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

  // Update users state with deduplication
  const [users, setUsers] = useState([]);
  useEffect(() => {
    if (usersData?.users) {
      const uniqueUsers = Array.from(new Map(usersData.users.map((u) => [u.id, u])).values());
      setUsers(uniqueUsers);
    }
    if (usersError) {
      setError(`Failed to fetch users: ${usersError.message}`);
    }
  }, [usersData, usersError]);

  // Update tasks
  useEffect(() => {
    if (tasksData) {
      setRoutineTasks(tasksData.tasks || []);
      setLoading(false);
    }
    if (tasksError) {
      setError(`Failed to fetch tasks: ${tasksError.message}`);
      setLoading(false);
    }
  }, [tasksData, tasksError]);

  // Redirect if not admin, but skip during session loading
  useEffect(() => {
    if (status === "loading") return; // Prevent redirects during session loading
    if (status === "authenticated" && session?.user?.role !== "admin") {
      router.push("/dashboard/member");
    } else if (status === "unauthenticated") {
      router.push("/login?role=admin");
    }
  }, [status, session, router]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleUserSelect = () => {
    if (tempUserId) {
      setSelectedUserId(tempUserId);
      setTempUserId("");
      setFormData({
        name: "",
        email: "",
        password: "",
        role: "member",
        type: "residential",
        team_manager_type: "",
      });
      setNewUserId(null);
      setShowTaskModal(false);
    } else {
      setError("Please select a valid user.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (!formData.name || !formData.email || !formData.password) {
      setError("Name, email, and password are required.");
      setLoading(false);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError("Invalid email format.");
      setLoading(false);
      return;
    }
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long.");
      setLoading(false);
      return;
    }
    if (formData.role === "team_manager" && !formData.team_manager_type) {
      setError("Team manager type is required for team manager role.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/addUser", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `HTTP error ${response.status}`);
      }

      setSuccess(`User added successfully as ${data.role}!`);
      setNewUserId(data.userId);
      setUserRole(data.role);
      setLoading(false);
      setShowTaskModal(true);
    } catch (err) {
      console.error("Submit error:", err);
      setError(err.message || "Failed to add user. Please try again.");
      setLoading(false);
    }
  };

  // Handle adding a new routine task
  const handleAddTask = async () => {
    if (!newUserId && !selectedUserId) {
      setError("No user selected.");
      return;
    }
    if (!newTaskDescription.trim()) {
      setError("Task description is required.");
      return;
    }
    if (routineTasks.length >= 10) {
      setError("Cannot add more than 10 routine tasks.");
      return;
    }

    setLoading(true);
    setLoadingAction("add");
    try {
      const response = await fetch("/api/managersCommon/routine-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: newUserId || selectedUserId,
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
        { id: taskId, description: newTaskDescription, memberId: newUserId || selectedUserId },
      ]);
      setNewTaskDescription("");
      setError("");
      setSuccess("Task added successfully");
      setTimeout(() => setSuccess(""), 3000);
      mutateTasks();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingAction("");
    }
  };

  // Handle editing a routine task
  const handleEditTask = async (taskId) => {
    if (!newTaskDescription.trim()) {
      setError("Task description is required.");
      return;
    }

    setLoading(true);
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
      setSuccess("Task updated successfully");
      setTimeout(() => setSuccess(""), 3000);
      mutateTasks();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingAction("");
    }
  };

  // Handle deleting a routine task
  const handleDeleteTask = async (taskId) => {
    setLoading(true);
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
      setError("");
      setSuccess("Task deleted successfully");
      setTimeout(() => setSuccess(""), 3000);
      mutateTasks();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingAction("");
    }
  };

  const handleAddTasksLater = () => {
    router.push("/dashboard/admin");
  };

  // Categorize users
  const admins = users.filter((user) => user.role === "admin");
  const teamManagers = users.filter((user) => user.role === "team_manager");
  const teamMembers = users.filter((user) => !["admin", "team_manager"].includes(user.role));

  if (status === "loading" || !usersData) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="fixed inset-0 bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 flex items-center justify-center"
      >
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-2xl font-semibold text-gray-700">
          Loading...
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 p-6 flex items-center justify-center"
    >
      <div className="w-full h-full bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 rounded-2xl shadow-2xl p-8 flex flex-col gap-8 overflow-y-auto">
        {/* Error and Success Messages */}
        <AnimatePresence>
          {(error || success) && (
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
                setSuccess("");
              }}
            >
              {error || success} (Click to dismiss)
            </motion.p>
          )}
        </AnimatePresence>

        {/* User Selection */}
        {!selectedUserId && !newUserId && (
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
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">Select a Team Member or Add New</h2>
            </div>
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
                          loading || tempUserId === user.id
                            ? "bg-teal-50"
                            : "bg-white hover:bg-teal-50 hover:shadow-xl"
                        } flex flex-col items-center justify-center h-32`}
                        whileHover={{ scale: loading ? 1 : 1.03, boxShadow: loading ? null : "0 8px 16px rgba(0, 128, 128, 0.2)" }}
                        whileTap={{ scale: loading ? 1 : 0.95 }}
                        onClick={() => !loading && setTempUserId(user.id)}
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
                          loading || tempUserId === user.id
                            ? "bg-teal-50"
                            : "bg-white hover:bg-teal-50 hover:shadow-xl"
                        } flex flex-col items-center justify-center h-32`}
                        whileHover={{ scale: loading ? 1 : 1.03, boxShadow: loading ? null : "0 8px 16px rgba(0, 128, 128, 0.2)" }}
                        whileTap={{ scale: loading ? 1 : 0.95 }}
                        onClick={() => !loading && setTempUserId(user.id)}
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
                          loading || tempUserId === user.id
                            ? "bg-teal-50"
                            : "bg-white hover:bg-teal-50 hover:shadow-xl"
                        } flex flex-col items-center justify-center h-32`}
                        whileHover={{ scale: loading ? 1 : 1.03, boxShadow: loading ? null : "0 8px 16px rgba(0, 128, 128, 0.2)" }}
                        whileTap={{ scale: loading ? 1 : 0.95 }}
                        onClick={() => !loading && setTempUserId(user.id)}
                      >
                        <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-teal-500"></div>
                        <h4 className="text-lg font-semibold text-gray-800 text-center">{user.name}</h4>
                        <p className="text-sm text-gray-600 text-center">{user.type}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-4">
                <motion.button
                  onClick={() => {
                    setTempUserId("");
                    setSelectedUserId("new");
                  }}
                  className="flex-1 px-6 py-3 bg-teal-600 text-white rounded-2xl text-lg font-semibold hover:bg-teal-700 shadow-md"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={loading}
                >
                  Add New User
                </motion.button>
                <motion.button
                  onClick={handleUserSelect}
                  disabled={!tempUserId || loading}
                  className={`flex-1 px-6 py-3 rounded-2xl text-lg font-semibold ${
                    !tempUserId || loading ? "bg-gray-400 cursor-not-allowed" : "bg-teal-600 text-white hover:bg-teal-700"
                  }`}
                  whileHover={{ scale: !tempUserId || loading ? 1 : 1.03 }}
                  whileTap={{ scale: !tempUserId || loading ? 1 : 0.95 }}
                >
                  Select User
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Add User Form or Task Management */}
        {(selectedUserId || newUserId) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="w-full flex flex-col gap-8"
          >
            {selectedUserId === "new" && !newUserId ? (
              <div>
                <div className="flex items-center gap-4">
                  <svg className="w-12 h-12 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Add New User</h1>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6 mt-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                        Name
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="mt-1 w-full p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-lg"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                        Email
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="mt-1 w-full p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-lg"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                        Password
                      </label>
                      <input
                        type="password"
                        id="password"
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        className="mt-1 w-full p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-lg"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                        Role
                      </label>
                      <select
                        id="role"
                        name="role"
                        value={formData.role}
                        onChange={handleInputChange}
                        className="mt-1 w-full p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-lg"
                      >
                        <option value="member">Member</option>
                        <option value="team_manager">Team Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    {formData.role === "team_manager" && (
                      <div>
                        <label htmlFor="team_manager_type" className="block text-sm font-medium text-gray-700">
                          Team Manager Type
                        </label>
                        <select
                          id="team_manager_type"
                          name="team_manager_type"
                          value={formData.team_manager_type}
                          onChange={handleInputChange}
                          className="mt-1 w-full p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-lg"
                          required
                        >
                          <option value="">Select Type</option>
                          <option value="head_incharge">Head Incharge</option>
                          <option value="coordinator">Coordinator</option>
                          <option value="accountant">Accountant</option>
                          <option value="chief_counsellor">Chief Counsellor</option>
                          <option value="hostel_incharge">Hostel Incharge</option>
                          <option value="principal">Principal</option>
                        </select>
                      </div>
                    )}
                    <div>
                      <label htmlFor="type" className="block text-sm font-medium text-gray-700">
                        User Type
                      </label>
                      <select
                        id="type"
                        name="type"
                        value={formData.type}
                        onChange={handleInputChange}
                        className="mt-1 w-full p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-lg"
                      >
                        <option value="residential">Residential</option>
                        <option value="non_residential">Non Residential</option>
                        <option value="semi_residential">Semi Residential</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-4">
                    <motion.button
                      type="button"
                      onClick={() => setSelectedUserId("")}
                      className="px-6 py-3 bg-gray-200 text-gray-800 rounded-2xl text-lg font-semibold hover:bg-gray-300"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                      disabled={loading}
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      type="submit"
                      disabled={loading}
                      className={`px-6 py-3 rounded-2xl text-lg font-semibold text-white ${
                        loading ? "bg-gray-400 cursor-not-allowed" : "bg-teal-600 hover:bg-teal-700"
                      }`}
                      whileHover={{ scale: loading ? 1 : 1.03 }}
                      whileTap={{ scale: loading ? 1 : 0.95 }}
                    >
                      {loading ? "Adding..." : "Add User"}
                    </motion.button>
                  </div>
                </form>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-4">
                  <svg className="w-12 h-12 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
                    Routine Tasks for {users.find((u) => u.id === (newUserId || selectedUserId))?.name || "New User"}
                  </h1>
                </div>
                <div className="flex justify-end gap-4 mt-6">
                  <motion.button
                    onClick={() => setShowTaskModal(true)}
                    className="px-6 py-3 bg-teal-600 text-white rounded-2xl text-lg font-semibold hover:bg-teal-700 shadow-md"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.95 }}
                    disabled={loading}
                  >
                    Manage Routine Tasks
                  </motion.button>
                  <motion.button
                    onClick={handleAddTasksLater}
                    className="px-6 py-3 bg-gray-200 text-gray-800 rounded-2xl text-lg font-semibold hover:bg-gray-300"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.95 }}
                    disabled={loading}
                  >
                    Add Later
                  </motion.button>
                </div>
                <div className="mt-6">
                  {loading ? (
                    <Skeleton count={5} height={80} className="mb-4" />
                  ) : routineTasks.length === 0 ? (
                    <p className="text-lg text-gray-600 text-center">No routine tasks assigned.</p>
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
            )}
          </motion.div>
        )}

        {/* Routine Tasks Modal */}
        <Suspense fallback={<p className="text-center text-lg text-gray-600">Loading modal...</p>}>
          <AnimatePresence>
            {showTaskModal && (newUserId || selectedUserId) && (
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
                    users={newUserId ? [{ id: newUserId, name: formData.name, role: userRole }] : users}
                    selectedUserId={newUserId || selectedUserId}
                    routineTasks={routineTasks}
                    isLoading={loading}
                    loadingAction={loadingAction}
                    setLoadingAction={setLoadingAction}
                    newTaskDescription={newTaskDescription}
                    editingTask={editingTask}
                    setShowManageTasksModal={setShowTaskModal}
                    setNewTaskDescription={setNewTaskDescription}
                    setEditingTask={setEditingTask}
                    setSuccessMessage={setSuccess}
                    successMessage={success}
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