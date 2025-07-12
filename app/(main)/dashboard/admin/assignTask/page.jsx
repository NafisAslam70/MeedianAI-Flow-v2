"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function AssignTask() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    taskType: "assigned",
    assignees: [],
    sprints: [{ title: "", description: "" }],
  });
  const [members, setMembers] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingMembers, setFetchingMembers] = useState(true);

  // Redirect if not admin
  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "admin") {
      router.push("/dashboard/member");
    }
  }, [status, session, router]);

  // Fetch team members
  useEffect(() => {
    async function fetchMembers() {
      setFetchingMembers(true);
      setError("");
      try {
        const response = await fetch("/api/admin/manageTeam");
        if (!response.ok) {
          throw new Error(`Failed to fetch members: ${response.status}`);
        }
        const data = await response.json();
        setMembers(data.users || []);
      } catch (err) {
        console.error("Fetch error:", err);
        setError("Failed to fetch team members.");
      } finally {
        setFetchingMembers(false);
      }
    }
    fetchMembers();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAssigneeChange = (e) => {
    const selected = Array.from(e.target.selectedOptions).map((option) => parseInt(option.value));
    setFormData((prev) => ({ ...prev, assignees: selected }));
  };

  const handleSprintChange = (index, field, value) => {
    const updatedSprints = [...formData.sprints];
    updatedSprints[index][field] = value;
    setFormData((prev) => ({ ...prev, sprints: updatedSprints }));
  };

  const addSprint = () => {
    setFormData((prev) => ({
      ...prev,
      sprints: [...prev.sprints, { title: "", description: "" }],
    }));
  };

  const removeSprint = (index) => {
    setFormData((prev) => ({
      ...prev,
      sprints: prev.sprints.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!formData.title || formData.assignees.length === 0) {
      setError("Task title and at least one assignee are required.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/assignTask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          taskType: formData.taskType,
          createdBy: session?.user?.id,
          assignees: formData.assignees,
          sprints: formData.sprints.filter((sprint) => sprint.title),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create task");
      }

      router.push("/dashboard/admin");
    } catch (err) {
      console.error("Submit error:", err);
      setError(err.message || "Failed to assign task. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || fetchingMembers) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-lg text-gray-600"
        >
          Loading...
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-7xl mx-auto p-6"
    >
      {/* <h1 className="text-3xl font-bold mb-8 text-gray-800">📋 Assign Task</h1> */}
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
      </AnimatePresence>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task Details */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-gray-700">Task Details</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                  Task Title
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="mt-1 w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  required
                />
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="mt-1 w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  rows={5}
                />
              </div>
              <div>
                <label htmlFor="taskType" className="block text-sm font-medium text-gray-700">
                  Task Type
                </label>
                <select
                  id="taskType"
                  name="taskType"
                  value={formData.taskType}
                  onChange={handleInputChange}
                  className="mt-1 w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                >
                  <option value="assigned">Assigned</option>
                  <option value="routine">Routine</option>
                </select>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-gray-700">Assignees</h2>
            <select
              id="assignees"
              multiple
              value={formData.assignees.map(String)}
              onChange={handleAssigneeChange}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              required
            >
              {members.length === 0 ? (
                <option disabled>No members available</option>
              ) : (
                members.map((member) => (
                  <motion.option
                    key={member.id}
                    value={member.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: member.id * 0.05 }}
                  >
                    {member.name} ({member.email})
                  </motion.option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Sprints */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">Sprints (Subtasks)</h2>
          <div className="space-y-4">
            <AnimatePresence>
              {formData.sprints.map((sprint, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="p-4 bg-gray-50 rounded-lg border"
                >
                  <input
                    type="text"
                    placeholder="Sprint Title"
                    value={sprint.title}
                    onChange={(e) => handleSprintChange(index, "title", e.target.value)}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 mb-2"
                  />
                  <textarea
                    placeholder="Sprint Description"
                    value={sprint.description}
                    onChange={(e) => handleSprintChange(index, "description", e.target.value)}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                    rows={3}
                  />
                  {formData.sprints.length > 1 && (
                    <motion.button
                      type="button"
                      onClick={() => removeSprint(index)}
                      className="mt-2 px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-200"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Remove Sprint
                    </motion.button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            <motion.button
              type="button"
              onClick={addSprint}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Add Sprint
            </motion.button>
          </div>
        </div>

        {/* Submit Button */}
        <div className="lg:col-span-2 flex justify-end">
          <motion.button
            type="submit"
            disabled={loading || members.length === 0}
            className={`px-6 py-3 rounded-lg text-white font-semibold transition-colors duration-200 ${
              loading || members.length === 0
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700 active:scale-95"
            }`}
            aria-label="Assign task"
            whileHover={{ scale: loading || members.length === 0 ? 1 : 1.05 }}
            whileTap={{ scale: loading || members.length === 0 ? 1 : 0.95 }}
          >
            {loading ? "Assigning..." : "Assign Task"}
          </motion.button>
        </div>
      </form>
    </motion.div>
  );
}