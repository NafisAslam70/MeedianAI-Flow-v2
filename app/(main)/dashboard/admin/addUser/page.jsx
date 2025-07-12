"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function AddUser() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "member",
    type: "residential",
  });
  const [taskInput, setTaskInput] = useState("");
  const [addedTasks, setAddedTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newUserId, setNewUserId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [modalContext, setModalContext] = useState(null);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "admin") {
      router.push("/dashboard/member");
    } else if (status === "unauthenticated") {
      router.push("/login?role=admin");
    }

    const fetchUsers = async () => {
      try {
        const response = await fetch("/api/admin/manageMeedian?section=team");
        const data = await response.json();
        if (response.ok) {
          setUsers(data.users);
        } else {
          setError(data.error || "Failed to fetch users.");
        }
      } catch (err) {
        setError("Failed to fetch users. Please try again.");
      }
    };
    fetchUsers();
  }, [status, session, router]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTaskInputChange = (e) => {
    setTaskInput(e.target.value);
  };

  const handleAddTask = () => {
    setError("");
    if (!taskInput.trim()) {
      setError("Task description is required.");
      return;
    }
    if (addedTasks.length >= 10) {
      setError("Cannot add more than 10 routine tasks.");
      return;
    }
    setAddedTasks((prev) => [...prev, taskInput.trim()]);
    setTaskInput("");
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
    } catch (err) {
      console.error("Submit error:", err);
      setError(err.message || "Failed to add user. Please try again.");
      setLoading(false);
    }
  };

  const handleInsertRoutines = async (userId) => {
    setError("");
    setLoading(true);

    if (!userId) {
      setError("No user selected.");
      setLoading(false);
      return;
    }

    if (addedTasks.length < 5) {
      setError("Please add at least 5 routine tasks.");
      setLoading(false);
      return;
    }

    const validTasks = addedTasks.filter((desc) => desc && typeof desc === "string" && desc.trim() !== "");
    if (validTasks.length < 5) {
      setError("Please add at least 5 valid routine tasks.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/addUser", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          routineTasks: validTasks.map((description) => ({ description })),
          taskOnly: true,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `HTTP error ${response.status}`);
      }

      setShowTaskModal(false);
      setAddedTasks([]);
      setTaskInput("");
      setSuccess("Routine tasks inserted successfully!");
      setLoading(false);
      setModalContext(null);
      setTimeout(() => {
        router.push("/dashboard/admin");
      }, 500);
    } catch (err) {
      console.error("Insert routines error:", err);
      setError(err.message || "Failed to insert routine tasks. Please try again.");
      setLoading(false);
    }
  };

  const handleAddTasksNow = () => {
    setModalContext("newUser");
    setShowTaskModal(true);
  };

  const handleAddTasksLater = () => {
    router.push("/dashboard/admin");
  };

  const handleManageTasks = () => {
    if (!selectedUserId) {
      setError("Please select a user.");
      return;
    }
    setAddedTasks([]);
    setTaskInput("");
    setModalContext("manageTasks");
    setShowTaskModal(true);
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-blue-50">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-lg font-semibold text-gray-700 animate-pulse"
        >
          Loading...
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex flex-row space-x-6">
        {/* Add New User Section */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex-1 bg-white/80 p-8 rounded-lg shadow-lg backdrop-blur-sm border border-gray-100"
        >
          <h1 className="text-3xl font-bold mb-6 text-gray-800">👤 Add New User</h1>
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg"
              >
                {error}
              </motion.p>
            )}
            {success && !showTaskModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mb-6 p-4 bg-green-100 text-green-700 rounded-lg"
              >
                <p>{success}</p>
                {newUserId && (
                  <div className="mt-4 flex space-x-4">
                    <motion.button
                      onClick={handleAddTasksNow}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Add Routine Tasks
                    </motion.button>
                    <motion.button
                      onClick={handleAddTasksLater}
                      className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Add Later
                    </motion.button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
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
                  className="mt-1 w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
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
                  className="mt-1 w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
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
                  className="mt-1 w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
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
                  className="mt-1 w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label htmlFor="type" className="block text-sm font-medium text-gray-700">
                  User Type
                </label>
                <select
                  id="type"
                  name="type"
                  value={formData.type}
                  onChange={handleInputChange}
                  className="mt-1 w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="residential">Residential</option>
                  <option value="non_residential">Non Residential</option>
                  <option value="semi_residential">Semi Residential</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end">
              <motion.button
                type="submit"
                disabled={loading}
                className={`px-6 py-3 rounded-lg text-white font-semibold ${
                  loading ? "bg-gray-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"
                }`}
                whileHover={{ scale: loading ? 1 : 1.05 }}
                whileTap={{ scale: loading ? 1 : 0.95 }}
              >
                {loading ? "Adding..." : "Add User"}
              </motion.button>
            </div>
          </form>
        </motion.div>

        {/* Manage Routine Tasks Section */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex-1 bg-white/80 p-8 rounded-lg shadow-lg backdrop-blur-sm border border-gray-100"
        >
          <h1 className="text-3xl font-bold mb-6 text-gray-800">🛠 Manage Routine Tasks</h1>
          <div className="space-y-6">
            <div>
              <label htmlFor="manageUserId" className="block text-sm font-medium text-gray-700">
                Select User
              </label>
              <select
                id="manageUserId"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="mt-1 w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose a user</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end">
              <motion.button
                onClick={handleManageTasks}
                disabled={loading || !selectedUserId}
                className={`px-6 py-3 rounded-lg text-white font-semibold ${
                  loading || !selectedUserId ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
                }`}
                whileHover={{ scale: loading || !selectedUserId ? 1 : 1.05 }}
                whileTap={{ scale: loading || !selectedUserId ? 1 : 0.95 }}
              >
                Manage Tasks
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Routine Tasks Modal */}
      <AnimatePresence>
        {showTaskModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900/20 backdrop-blur-lg flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white/80 p-6 rounded-lg shadow-lg backdrop-blur-sm border border-gray-100 w-full max-w-4xl"
            >
              <h2 className="text-xl font-bold mb-4 text-gray-800">
                Add Routine Tasks for{' '}
                {modalContext === "newUser"
                  ? `${formData.name} (${userRole})`
                  : users.find((u) => u.id === Number(selectedUserId))?.name || `User ID: ${selectedUserId}`}
              </h2>
              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mb-4 p-2 bg-red-100 text-red-700 rounded-lg"
                >
                  {error}
                </motion.p>
              )}
              <div className="flex flex-row space-x-6 mb-4">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Add Task</h3>
                  <input
                    type="text"
                    value={taskInput}
                    onChange={handleTaskInputChange}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Task Description (e.g., Daily Check-in)"
                    disabled={loading || addedTasks.length >= 10}
                  />
                  <motion.button
                    type="button"
                    onClick={handleAddTask}
                    disabled={loading || addedTasks.length >= 10}
                    className={`mt-2 px-4 py-2 rounded-lg text-white font-semibold ${
                      loading || addedTasks.length >= 10
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-green-600 hover:bg-green-700"
                    }`}
                    whileHover={{ scale: loading || addedTasks.length >= 10 ? 1 : 1.05 }}
                    whileTap={{ scale: loading || addedTasks.length >= 10 ? 1 : 0.95 }}
                  >
                    Add
                  </motion.button>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Added Tasks ({addedTasks.length}/10)</h3>
                  <ul className="list-disc pl-5 max-h-64 overflow-y-auto">
                    {addedTasks.map((task, index) => (
                      <li key={index} className="text-gray-600">
                        {task}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="flex justify-end">
                <motion.button
                  type="button"
                  onClick={() => handleInsertRoutines(modalContext === "newUser" ? newUserId : selectedUserId)}
                  disabled={loading || addedTasks.length < 5}
                  className={`px-4 py-2 rounded-lg text-white font-semibold ${
                    loading || addedTasks.length < 5
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                  whileHover={{ scale: loading || addedTasks.length < 5 ? 1 : 1.05 }}
                  whileTap={{ scale: loading || addedTasks.length < 5 ? 1 : 0.95 }}
                >
                  {loading ? "Inserting..." : "Insert Routines"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}