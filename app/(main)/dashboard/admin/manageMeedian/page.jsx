"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function ManageTeamPage() {
  const [users, setUsers] = useState([]);
  const [appState, setAppState] = useState({
    residential: { dayOpenedAt: "08:00", dayClosedAt: "20:00", closingWindowStart: "19:30", closingWindowEnd: "20:00" },
    non_residential: { dayOpenedAt: "09:00", dayClosedAt: "21:00", closingWindowStart: "12:00", closingWindowEnd: "12:30" },
    semi_residential: { dayOpenedAt: "08:30", dayClosedAt: "20:30", closingWindowStart: "17:30", closingWindowEnd: "18:00" },
  });
  const [routineTasks, setRoutineTasks] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [newTask, setNewTask] = useState({ title: "", description: "" });
  const [loading, setLoading] = useState({ team: true, appState: false, tasks: false });
  const [saving, setSaving] = useState({ team: false, appState: false, tasks: false, newTask: false });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeModal, setActiveModal] = useState(null);
  const userTypes = ["residential", "non_residential", "semi_residential"];

  // Fetch users with retry logic
  useEffect(() => {
    const fetchWithRetry = async (url, retries = 3, delay = 1000) => {
      for (let i = 0; i < retries; i++) {
        try {
          const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || `HTTP ${res.status}`);
          }
          return await res.json();
        } catch (err) {
          if (i === retries - 1) throw err;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    };

    const fetchData = async () => {
      setError("");
      try {
        const userData = await fetchWithRetry("/api/admin/manageMeedian?section=team");
        setUsers(userData.users || []);
      } catch (err) {
        console.error("Fetch users error:", err);
        setError(`Failed to load users: ${err.message}. Check database, auth, or server logs.`);
      } finally {
        setLoading((prev) => ({ ...prev, team: false }));
      }
    };
    fetchData();
  }, []);

  // Fetch routine tasks for selected user
  useEffect(() => {
    if (activeModal !== "tasks" || !selectedUserId) return;

    const fetchTasks = async () => {
      setLoading((prev) => ({ ...prev, tasks: true }));
      setError("");
      try {
        const tasksData = await fetch(`/api/admin/manageMeedian?section=routineTasks&userId=${selectedUserId}`, {
          headers: { "Content-Type": "application/json" },
        });
        if (!tasksData.ok) {
          const errorData = await tasksData.json();
          throw new Error(errorData.error || `HTTP ${tasksData.status}`);
        }
        const { tasks } = await tasksData.json();
        setRoutineTasks(tasks || []);
      } catch (err) {
        console.error("Fetch tasks error:", err);
        setError(`Failed to load tasks: ${err.message}`);
      } finally {
        setLoading((prev) => ({ ...prev, tasks: false }));
      }
    };
    fetchTasks();
  }, [selectedUserId, activeModal]);

  // Handle user type change
  const handleUserTypeChange = (id, newType) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, type: newType } : u)));
  };

  // Save team changes
  const saveTeamChanges = async () => {
    setSaving((prev) => ({ ...prev, team: true }));
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: users.map(({ id, type }) => ({ id, type })) }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Save failed: ${res.status}`);
      }
      setSuccess("Team changes saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Save team error:", err);
      setError(`Error saving team: ${err.message}`);
    } finally {
      setSaving((prev) => ({ ...prev, team: false }));
    }
  };

  // Handle app state time changes
  const handleAppStateChange = (userType, field, value) => {
    setAppState((prev) => ({
      ...prev,
      [userType]: { ...(prev[userType] || {}), [field]: value },
    }));
  };

  // Save app state changes
  const saveAppStateChanges = async () => {
    setSaving((prev) => ({ ...prev, appState: true }));
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=appState", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appState }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Save failed: ${res.status}`);
      }
      setSuccess("Time changes saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Save times error:", err);
      setError(`Error saving times: ${err.message}`);
    } finally {
      setSaving((prev) => ({ ...prev, appState: false }));
    }
  };

  // Handle routine task assignment
  const handleTaskAssignment = (taskId, memberId) => {
    setRoutineTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, memberId: parseInt(memberId) } : task
      )
    );
  };

  // Handle new task input
  const handleNewTaskChange = (e) => {
    const { name, value } = e.target;
    setNewTask((prev) => ({ ...prev, [name]: value }));
  };

  // Add new routine task
  const addNewTask = async () => {
    if (!newTask.title || newTask.title.length > 255 || !selectedUserId) {
      setError("Title (max 255 characters) and user selection are required.");
      return;
    }
    setSaving((prev) => ({ ...prev, newTask: true }));
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/add-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskOnly: true,
          userId: parseInt(selectedUserId),
          routineTasks: [{ title: newTask.title }],
        }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Add task failed: ${res.status}`);
      }
      const newTaskObj = {
        id: Date.now(),
        title: newTask.title,
        memberId: parseInt(selectedUserId),
      };
      setRoutineTasks((prev) => [...prev, newTaskObj]);
      setNewTask({ title: "", description: "" });
      setSuccess("Task added successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Add task error:", err);
      setError(`Error adding task: ${err.message}`);
    } finally {
      setSaving((prev) => ({ ...prev, newTask: false }));
    }
  };

  // Save routine task changes
  const saveTaskChanges = async () => {
    setSaving((prev) => ({ ...prev, tasks: true }));
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=routineTasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: routineTasks }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Save failed: ${res.status}`);
      }
      setSuccess("Task changes saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Save tasks error:", err);
      setError(`Error saving tasks: ${err.message}`);
    } finally {
      setSaving((prev) => ({ ...prev, tasks: false }));
    }
  };

  // Modal component
  const Modal = ({ title, children, onClose }) => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
    >
      <motion.div
        initial={{ scale: 0.8, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.8, y: 20 }}
        transition={{ duration: 0.3 }}
        className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl border border-teal-200 max-h-[80vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-teal-900">{title}</h2>
          <motion.button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-800 p-2 rounded-full"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            ✕
          </motion.button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );

  // Card component
  const Card = ({ title, description, icon, onClick }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.03, boxShadow: "0 8px 16px rgba(0, 128, 128, 0.2)" }}
      whileTap={{ scale: 0.95 }}
      className="bg-white rounded-xl shadow-md p-6 flex flex-col items-center justify-center hover:bg-teal-50 transition-all duration-300 cursor-pointer border border-teal-200"
      onClick={onClick}
    >
      <div className="mb-4">{icon}</div>
      <h2 className="text-lg font-bold text-teal-900 mb-2 text-center">{title}</h2>
      <p className="text-sm text-gray-600 text-center">{description}</p>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center p-4 pt-1">
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-7xl flex flex-col">
        <h1 className="text-2xl sm:text-3xl font-bold text-center text-teal-900 mb-6">⚙️ Meedian Management Portal</h1>
        <AnimatePresence>
          {(error || success) && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`text-sm sm:text-base text-center mb-6 p-4 rounded-lg ${
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card
            title="Manage Meedian Team"
            description="Update team member types"
            icon={
              <svg className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v2h5m-2-2a3 3 0 005.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            }
            onClick={() => setActiveModal("team")}
          />
          <Card
            title="Manage Meedian Day Times"
            description="Set open/close times"
            icon={
              <svg className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            onClick={() => setActiveModal("times")}
          />
          <Card
            title="Manage Meedian Routine Tasks"
            description="Assign routine tasks to users"
            icon={
              <svg className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01m-.01 4h.01"
                />
              </svg>
            }
            onClick={() => setActiveModal("tasks")}
          />
        </div>

        {/* Manage Team Modal */}
        <AnimatePresence>
          {activeModal === "team" && (
            <Modal title="👥 Manage Meedian Team" onClose={() => setActiveModal(null)}>
              {loading.team ? (
                <p className="text-gray-600 text-center">Loading team members...</p>
              ) : (
                <div className="space-y-4">
                  {users.length === 0 ? (
                    <p className="text-gray-600 text-center">No users found. Please check the database or authentication.</p>
                  ) : (
                    users.map((user) => (
                      <div
                        key={user.id}
                        className="p-4 bg-white/80 rounded-lg border border-teal-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                      >
                        <div>
                          <p className="font-semibold text-teal-900">{user.name}</p>
                          <p className="text-sm text-gray-600">{user.email}</p>
                        </div>
                        <select
                          className="p-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 w-full sm:w-auto"
                          value={user.type}
                          onChange={(e) => handleUserTypeChange(user.id, e.target.value)}
                        >
                          {userTypes.map((type) => (
                            <option key={type} value={type}>
                              {type.replace("_", " ").toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))
                  )}
                  <motion.button
                    onClick={saveTeamChanges}
                    disabled={saving.team || users.length === 0}
                    className={`w-full sm:w-auto px-6 py-3 rounded-lg text-white font-semibold transition-all duration-200 ${
                      saving.team || users.length === 0
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-emerald-600 hover:bg-emerald-700"
                    }`}
                    whileHover={{ scale: saving.team || users.length === 0 ? 1 : 1.03 }}
                    whileTap={{ scale: saving.team || users.length === 0 ? 1 : 0.95 }}
                  >
                    {saving.team ? "Saving..." : "Save Team Changes"}
                  </motion.button>
                </div>
              )}
            </Modal>
          )}

          {/* Manage Day Times Modal */}
          {activeModal === "times" && (
            <Modal title="⏰ Manage Meedian Day Times" onClose={() => setActiveModal(null)}>
              <div className="grid grid-cols-1 gap-4">
                {userTypes.map((type) => (
                  <div key={type} className="p-4 bg-white/80 rounded-lg border border-teal-200">
                    <h2 className="font-semibold text-teal-900 capitalize mb-4">{type.replace("_", " ")}</h2>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Day Open Time</label>
                        <input
                          type="time"
                          value={appState[type]?.dayOpenedAt || ""}
                          onChange={(e) => handleAppStateChange(type, "dayOpenedAt", e.target.value)}
                          className="mt-1 w-full p-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Day Close Time</label>
                        <input
                          type="time"
                          value={appState[type]?.dayClosedAt || ""}
                          onChange={(e) => handleAppStateChange(type, "dayClosedAt", e.target.value)}
                          className="mt-1 w-full p-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Closing Window Start</label>
                        <input
                          type="time"
                          value={appState[type]?.closingWindowStart || ""}
                          onChange={(e) => handleAppStateChange(type, "closingWindowStart", e.target.value)}
                          className="mt-1 w-full p-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Closing Window End</label>
                        <input
                          type="time"
                          value={appState[type]?.closingWindowEnd || ""}
                          onChange={(e) => handleAppStateChange(type, "closingWindowEnd", e.target.value)}
                          className="mt-1 w-full p-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <motion.button
                onClick={saveAppStateChanges}
                disabled={saving.appState}
                className={`mt-6 w-full sm:w-auto px-6 py-3 rounded-lg text-white font-semibold transition-all duration-200 ${
                  saving.appState ? "bg-gray-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"
                }`}
                whileHover={{ scale: saving.appState ? 1 : 1.03 }}
                whileTap={{ scale: saving.appState ? 1 : 0.95 }}
              >
                {saving.appState ? "Saving..." : "Save Time Changes"}
              </motion.button>
            </Modal>
          )}

          {/* Manage Routine Tasks Modal */}
          {activeModal === "tasks" && (
            <Modal title="📋 Manage Meedian Routine Tasks" onClose={() => setActiveModal(null)}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select User</label>
                  <select
                    className="w-full p-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                  >
                    <option value="">Select User</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedUserId && (
                  <>
                    {loading.tasks ? (
                      <p className="text-gray-600 text-center">Loading routine tasks...</p>
                    ) : routineTasks.length === 0 ? (
                      <div className="space-y-4">
                        <p className="text-gray-600 text-center">No routine tasks found for this user.</p>
                        <div className="p-4 bg-white/80 rounded-lg border border-teal-200">
                          <h3 className="text-sm font-medium text-gray-700 mb-4">Add New Routine Task</h3>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Title</label>
                              <div className="flex flex-col sm:flex-row gap-4">
                                <input
                                  type="text"
                                  name="title"
                                  value={newTask.title}
                                  onChange={handleNewTaskChange}
                                  className="flex-1 p-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
                                  placeholder="Enter task title (e.g., Daily Check-in)"
                                />
                                <motion.button
                                  onClick={addNewTask}
                                  disabled={saving.newTask || !newTask.title}
                                  className={`w-full sm:w-auto px-4 py-2 rounded-lg text-white font-semibold transition-all duration-200 ${
                                    saving.newTask || !newTask.title
                                      ? "bg-gray-400 cursor-not-allowed"
                                      : "bg-emerald-600 hover:bg-emerald-700"
                                  }`}
                                  whileHover={{ scale: saving.newTask || !newTask.title ? 1 : 1.03 }}
                                  whileTap={{ scale: saving.newTask || !newTask.title ? 1 : 0.95 }}
                                >
                                  {saving.newTask ? "Adding..." : "Add"}
                                </motion.button>
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Description</label>
                              <textarea
                                name="description"
                                value={newTask.description}
                                onChange={handleNewTaskChange}
                                className="mt-1 w-full p-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
                                placeholder="Enter task description"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-sm font-medium text-gray-700 mb-4">Existing Tasks</h3>
                          {routineTasks.map((task) => (
                            <div
                              key={task.id}
                              className="p-4 bg-white/80 rounded-lg border border-teal-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                            >
                              <div>
                                <p className="font-semibold text-teal-900">{task.title}</p>
                                <p className="text-sm text-gray-600">{task.description || "No description"}</p>
                              </div>
                              <select
                                className="p-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 w-full sm:w-auto"
                                value={task.memberId || ""}
                                onChange={(e) => handleTaskAssignment(task.id, e.target.value)}
                              >
                                <option value="">Select User</option>
                                {users.map((user) => (
                                  <option key={user.id} value={user.id}>
                                    {user.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                        <div className="p-4 bg-white/80 rounded-lg border border-teal-200">
                          <h3 className="text-sm font-medium text-gray-700 mb-4">Add New Routine Task</h3>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Title</label>
                              <div className="flex flex-col sm:flex-row gap-4">
                                <input
                                  type="text"
                                  name="title"
                                  value={newTask.title}
                                  onChange={handleNewTaskChange}
                                  className="flex-1 p-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
                                  placeholder="Enter task title (e.g., Daily Check-in)"
                                />
                                <motion.button
                                  onClick={addNewTask}
                                  disabled={saving.newTask || !newTask.title}
                                  className={`w-full sm:w-auto px-4 py-2 rounded-lg text-white font-semibold transition-all duration-200 ${
                                    saving.newTask || !newTask.title
                                      ? "bg-gray-400 cursor-not-allowed"
                                      : "bg-emerald-600 hover:bg-emerald-700"
                                  }`}
                                  whileHover={{ scale: saving.newTask || !newTask.title ? 1 : 1.03 }}
                                  whileTap={{ scale: saving.newTask || !newTask.title ? 1 : 0.95 }}
                                >
                                  {saving.newTask ? "Adding..." : "Add"}
                                </motion.button>
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Description</label>
                              <textarea
                                name="description"
                                value={newTask.description}
                                onChange={handleNewTaskChange}
                                className="mt-1 w-full p-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
                                placeholder="Enter task description"
                              />
                            </div>
                          </div>
                        </div>
                        <motion.button
                          onClick={saveTaskChanges}
                          disabled={saving.tasks || routineTasks.length === 0}
                          className={`w-full sm:w-auto px-6 py-3 rounded-lg text-white font-semibold transition-all duration-200 ${
                            saving.tasks || routineTasks.length === 0
                              ? "bg-gray-400 cursor-not-allowed"
                              : "bg-emerald-600 hover:bg-emerald-700"
                          }`}
                          whileHover={{ scale: saving.tasks || routineTasks.length === 0 ? 1 : 1.03 }}
                          whileTap={{ scale: saving.tasks || routineTasks.length === 0 ? 1 : 0.95 }}
                        >
                          {saving.tasks ? "Saving..." : "Save Task Changes"}
                        </motion.button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </Modal>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}