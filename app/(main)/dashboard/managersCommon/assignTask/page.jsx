"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { debounce } from "lodash";
import useSWR from "swr";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import TaskList from "@/components/assignTask/TaskList";
import TaskForm from "@/components/assignTask/TaskForm";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then(async (res) => {
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(`HTTP ${res.status}: ${errorData.error || res.statusText}`);
    }
    return res.json();
  });

const ManageTasksModal = ({ tasks, members, onClose, onEditTask, onManageSprints }) => {
  return (
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
        className="bg-white rounded-2xl shadow-2xl p-4 sm:p-6 w-full max-w-2xl"
      >
        <h3 className="text-lg sm:text-2xl font-bold text-gray-800 mb-4">Manage All Assigned Tasks</h3>
        <div className="max-h-96 overflow-y-auto space-y-4">
          {tasks.length === 0 ? (
            <p className="text-gray-500 text-base text-center">No tasks available.</p>
          ) : (
            tasks.map((task) => (
              <motion.div
                key={`manage-task-${task.id}`}
                className="bg-white rounded-xl shadow-md p-4"
                whileHover={{ scale: 1.02, boxShadow: "0 6px 12px rgba(0, 128, 128, 0.15)" }}
              >
                <h4 className="text-base sm:text-lg font-semibold text-gray-700">{task.title}</h4>
                <p className="text-sm text-gray-500">Assignees: {task.assignees?.map((a) => a.name).join(", ") || "None"}</p>
                <p className="text-sm text-gray-500">Sprints: {task.sprints?.length || 0}</p>
                <p className="text-sm text-gray-500">Status: {task.status || "not_started"}</p>
                <p className="text-sm text-gray-500">Deadline: {task.deadline ? new Date(task.deadline).toLocaleString() : "Not set"}</p>
                <p className="text-sm text-gray-500">
                  Assigned By: {members ? members.find((m) => m.id === task.createdBy)?.name || "Unknown" : "Loading..."}
                </p>
                <div className="flex gap-2 mt-2">
                  <motion.button
                    onClick={() => onEditTask(task)}
                    className="px-3 py-1 sm:px-4 sm:py-2 bg-yellow-600 text-white rounded-lg text-xs sm:text-sm hover:bg-yellow-700"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Edit
                  </motion.button>
                  <motion.button
                    onClick={() => onManageSprints(task)}
                    className="px-3 py-1 sm:px-4 sm:py-2 bg-purple-600 text-white rounded-lg text-xs sm:text-sm hover:bg-purple-700"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Manage Sprints
                  </motion.button>
                </div>
              </motion.div>
            ))
          )}
        </div>
        <motion.button
          onClick={onClose}
          className="mt-4 w-full px-4 py-2 sm:px-6 sm:py-3 bg-gray-200 text-gray-800 rounded-lg text-sm sm:text-base font-semibold hover:bg-gray-300"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.95 }}
        >
          Close
        </motion.button>
      </motion.div>
    </motion.div>
  );
};

export default function AssignTask() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    taskType: "assigned",
    assignees: [],
    sprints: [],
    deadline: null,
    resources: "",
  });
  const [members, setMembers] = useState(null);
  const [previousTasks, setPreviousTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState("");
  const [fetchingTasks, setFetchingTasks] = useState(true);
  const [showModal, setShowModal] = useState(null);
  const [tempAssignees, setTempAssignees] = useState([]);
  const [newTask, setNewTask] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [inputMode, setInputMode] = useState("text");
  const [voiceInput, setVoiceInput] = useState({ title: "", description: "", recording: "title" });
  const [isRecording, setIsRecording] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationSuccess, setTranslationSuccess] = useState(false);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [filterMember, setFilterMember] = useState("");
  const [dateRange, setDateRange] = useState([null, null]);
  const [deleteTaskId, setDeleteTaskId] = useState(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [deleting, setDeleting] = useState(false);

  const { data: membersData, error: membersError } = useSWR("/api/managersCommon/users", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
    revalidateOnReconnect: false,
  });
  const { data: tasksData, error: tasksError, mutate: mutateTasks } = useSWR("/api/managersCommon/assign-tasks", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
    revalidateOnReconnect: false,
  });

  useEffect(() => {
    if (status === "authenticated" && !["admin", "team_manager"].includes(session?.user?.role)) {
      router.push("/dashboard/member");
    }
  }, [status, session, router]);

  useEffect(() => {
    if (membersData?.users) {
      const uniqueMembers = Array.from(new Map(membersData.users.map((m) => [m.id, m])).values());
      setMembers(uniqueMembers);
    } else if (membersError) {
      console.error("Members fetch error:", membersError);
      setError(
        session?.user?.role === "admin"
          ? "No team members found. Add members in the admin dashboard."
          : "No team members found. Contact an admin."
      );
      if (session?.user?.role === "admin") router.push("/dashboard/admin/addUser");
    }
  }, [membersData, membersError, session, router]);

  useEffect(() => {
    if (tasksData?.assignedTasks) {
      const sortedTasks = [...tasksData.assignedTasks].sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt);
        const dateB = new Date(b.updatedAt || b.createdAt);
        return dateB - dateA;
      });
      setPreviousTasks(sortedTasks);
      setFetchingTasks(false);
    } else if (tasksError) {
      console.error("Tasks fetch error:", tasksError);
      setError(`Failed to fetch tasks: ${tasksError.message}`);
      setFetchingTasks(false);
    }
  }, [tasksData, tasksError]);

  const filteredTasks = previousTasks.filter((task) => {
    if (!showAllTasks && formData.assignees.length > 0) {
      if (!task.assignees?.some((assignee) => formData.assignees.includes(assignee.id))) {
        return false;
      }
    }
    if (filterMember && !task.assignees?.some((assignee) => assignee.id === parseInt(filterMember))) {
      return false;
    }
    if (dateRange[0] && dateRange[1]) {
      const taskDate = new Date(task.createdAt || task.updatedAt);
      return taskDate >= dateRange[0] && taskDate <= dateRange[1];
    }
    if (filterType === "recentlyAssigned") {
      return new Date(task.createdAt) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    } else if (filterType === "recentlyUpdated") {
      return new Date(task.updatedAt) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }
    return true;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case "not_started":
        return "bg-gray-400";
      case "in_progress":
        return "bg-blue-500";
      case "pending_verification":
        return "bg-yellow-500";
      case "done":
      case "verified":
        return "bg-green-500";
      default:
        return "bg-gray-400";
    }
  };

  const refreshTasks = async () => {
    setFetchingTasks(true);
    try {
      await mutateTasks();
    } catch (err) {
      console.error("Refresh tasks error:", err);
      setError("Failed to refresh tasks. Please try again.");
    } finally {
      setFetchingTasks(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditingTask((prev) => ({ ...prev, [name]: value }));
  };

  const handleAssigneeSelect = debounce((memberId) => {
    setTempAssignees((prev) => {
      if (prev.includes(memberId)) {
        return prev.filter((id) => id !== memberId);
      }
      return [...prev, memberId];
    });
  }, 300);

  const confirmAssignees = () => {
    const uniqueAssignees = Array.from(new Set(tempAssignees));
    if (editingTask) {
      setEditingTask((prev) => ({ ...prev, assignees: uniqueAssignees }));
    } else {
      setFormData((prev) => ({ ...prev, assignees: uniqueAssignees }));
    }
    setShowModal(null);
    setSuccessMessage("Assignees updated successfully");
    setTimeout(() => setSuccessMessage(""), 3000);
    // Log the assignee update
    fetch("/api/managersCommon/general-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: session?.user?.id,
        action: "assignees_updated",
        details: `Assignees updated for ${editingTask ? `task ID ${editingTask.id}` : "new task"} by ${session?.user?.name || "Unknown"}`,
        createdAt: new Date().toISOString(),
      }),
    });
  };

  const addSprint = () => {
    if (formData.sprints.length < 3) {
      setFormData((prev) => ({
        ...prev,
        sprints: [...prev.sprints, { title: "", description: "", status: "not_started" }],
      }));
    }
  };

  const handleSprintChange = (index, field, value) => {
    const updatedSprints = [...formData.sprints];
    updatedSprints[index] = { ...updatedSprints[index], [field]: value };
    setFormData((prev) => ({ ...prev, sprints: updatedSprints }));
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
    setLoadingAction("Assigning...");

    if (!formData.title || formData.assignees.length === 0) {
      setError("Task title and at least one assignee are required.");
      setLoading(false);
      setLoadingAction("");
      return;
    }

    try {
      const response = await fetch("/api/managersCommon/assign-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          taskType: formData.taskType,
          createdBy: session?.user?.id,
          assignees: formData.assignees,
          sprints: [],
          createdAt: new Date().toISOString(),
          deadline: formData.deadline ? new Date(formData.deadline).toISOString() : null,
          resources: formData.resources,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const { taskId } = await response.json();
      const newTaskData = {
        id: taskId,
        title: formData.title,
        description: formData.description,
        taskType: formData.taskType,
        assignees: members ? formData.assignees.map((id) => members.find((m) => m.id === id)).filter(Boolean) : [],
        sprints: [],
        status: "not_started",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: session?.user?.id,
        deadline: formData.deadline,
        resources: formData.resources,
      };
      setPreviousTasks((prev) => [newTaskData, ...prev]);
      setNewTask(newTaskData);
      setShowModal("postAssign");
      setFormData((prev) => ({ ...prev, title: "", description: "", sprints: [], deadline: null, resources: "" }));
      setSuccessMessage("Task assigned successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
      await mutateTasks();
      // Log the creation
      await fetch("/api/managersCommon/assigned-task-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          userId: session?.user?.id,
          action: "created",
          details: `Task "${formData.title}" created by ${session?.user?.name || "Unknown"} with ${formData.assignees.length} assignees`,
          createdAt: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.error("Submit error:", err);
      setError(`Error assigning task: ${err.message}`);
    } finally {
      setLoading(false);
      setLoadingAction("");
    }
  };

  const handleEditTask = async (taskId) => {
    if (!editingTask?.title || editingTask.assignees.length === 0) {
      setError("Task title and at least one assignee are required.");
      return;
    }

    setLoading(true);
    setLoadingAction("Saving...");

    try {
      const response = await fetch(`/api/managersCommon/assign-tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editingTask.title,
          description: editingTask.description,
          assignees: editingTask.assignees,
          sprints: editingTask.sprints,
          updatedAt: new Date().toISOString(),
          deadline: editingTask.deadline ? new Date(editingTask.deadline).toISOString() : null,
          resources: editingTask.resources,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const updatedTask = { ...editingTask, updatedAt: new Date().toISOString(), createdBy: editingTask.createdBy || session?.user?.id };
      setPreviousTasks((prev) => {
        const updatedTasks = prev.map((task) => (task.id === taskId ? updatedTask : task));
        return updatedTasks.sort((a, b) => {
          const dateA = new Date(a.updatedAt || a.createdAt);
          const dateB = new Date(b.updatedAt || b.createdAt);
          return dateB - dateA;
        });
      });
      setEditingTask(null);
      setShowModal(null);
      setSuccessMessage("Task updated successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
      await mutateTasks();
      // Log the update
      await fetch("/api/managersCommon/assigned-task-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          userId: session?.user?.id,
          action: "updated",
          details: `Task "${editingTask.title}" updated by ${session?.user?.name || "Unknown"}`,
          createdAt: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.error("Edit task error:", err);
      setError(`Error updating task: ${err.message}`);
    } finally {
      setLoading(false);
      setLoadingAction("");
    }
  };

  const handleDeleteTask = async () => {
    setLoading(true);
    setLoadingAction("Deleting...");
    const taskIdsToDelete = selectedTaskIds.length > 0 ? selectedTaskIds : [deleteTaskId];

    try {
      for (const taskId of taskIdsToDelete) {
        const task = previousTasks.find((t) => t.id === taskId);
        const response = await fetch(`/api/managersCommon/assign-tasks/${taskId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText || "Failed to delete task"}`);
        }

        // Log the deletion
        await fetch("/api/managersCommon/assigned-task-logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId,
            userId: session?.user?.id,
            action: "deleted",
            details: `Task "${task?.title || taskId}" deleted by ${session?.user?.name || "Unknown"}`,
            createdAt: new Date().toISOString(),
          }),
        });
      }

      setPreviousTasks((prev) => prev.filter((task) => !taskIdsToDelete.includes(task.id)));
      if (newTask && taskIdsToDelete.includes(newTask.id)) setNewTask(null);
      if (selectedTask && taskIdsToDelete.includes(selectedTask.id)) setSelectedTask(null);
      if (editingTask && taskIdsToDelete.includes(editingTask.id)) setEditingTask(null);
      setShowModal(null);
      setDeleteTaskId(null);
      setSelectedTaskIds([]);
      setSuccessMessage(`${taskIdsToDelete.length} task${taskIdsToDelete.length > 1 ? "s" : ""} deleted successfully`);
      setTimeout(() => setSuccessMessage(""), 3000);
      await mutateTasks();
    } catch (err) {
      console.error("Delete task error:", err);
      setError(`Error deleting task${taskIdsToDelete.length > 1 ? "s" : ""}: ${err.message}. Please check if the DELETE endpoint is correctly configured at /api/managersCommon/assign-tasks/[taskId].`);
    } finally {
      setLoading(false);
      setLoadingAction("");
      setDeleting(false);
    }
  };

  const handleBulkDelete = () => {
    if (selectedTaskIds.length === 0) return;
    setShowModal("deleteConfirm");
  };

  const handleUpdateSprints = async (taskId) => {
    const validSprints = formData.sprints.filter((sprint) => sprint.title);
    if (validSprints.length === 0) {
      setError("At least one sprint with a title is required.");
      return;
    }

    setLoading(true);
    setLoadingAction("Updating...");

    try {
      const response = await fetch(`/api/managersCommon/assign-tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sprints: validSprints, updatedAt: new Date().toISOString() }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const updatedTask = {
        ...editingTask || newTask || previousTasks.find((t) => t.id === taskId),
        sprints: validSprints,
        status: validSprints.some((s) => s.status === "in_progress" || s.status === "pending_verification")
          ? "in_progress"
          : validSprints.every((s) => s.status === "verified" || s.status === "done")
            ? "done"
            : "not_started",
        updatedAt: new Date().toISOString(),
      };

      setPreviousTasks((prev) => {
        const updatedTasks = prev.map((task) => (task.id === taskId ? updatedTask : task));
        return updatedTasks.sort((a, b) => {
          const dateA = new Date(a.updatedAt || a.createdAt);
          const dateB = new Date(b.updatedAt || b.createdAt);
          return dateB - dateA;
        });
      });
      if (newTask?.id === taskId) setNewTask(updatedTask);
      if (selectedTask?.id === taskId) setSelectedTask(updatedTask);
      if (editingTask?.id === taskId) setEditingTask(updatedTask);
      setShowModal("taskDetails");
      setFormData((prev) => ({ ...prev, sprints: [] }));
      setSuccessMessage("Sprints updated successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
      await mutateTasks();
      // Log the sprint update
      await fetch("/api/managersCommon/assigned-task-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          userId: session?.user?.id,
          action: "sprints_updated",
          details: `Sprints updated for task ID ${taskId} by ${session?.user?.name || "Unknown"}`,
          createdAt: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.error("Update sprints error:", err);
      setError(`Error updating sprints: ${err.message}`);
    } finally {
      setLoading(false);
      setLoadingAction("");
    }
  };

  const startVoiceInput = (field) => {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "hi-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setIsRecording(true);
    setLoading(true);
    setLoadingAction("Recording...");

    recognition.start();

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setIsRecording(false);
      setLoading(false);
      setLoadingAction("");
      setVoiceInput((prev) => ({
        ...prev,
        [field]: transcript,
        recording: field === "title" ? "description" : null,
      }));
    };

    recognition.onerror = (event) => {
      console.error("Voice recognition error:", event.error);
      setError(`Voice recognition error: ${event.error}`);
      setIsRecording(false);
      setLoading(false);
      setLoadingAction("");
    };

    recognition.onend = () => {
      setIsRecording(false);
      setLoading(false);
      setLoadingAction("");
    };
  };

  const handleTranslate = async () => {
    setIsTranslating(true);
    setLoading(true);
    setLoadingAction("Translating...");

    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: voiceInput.title, description: voiceInput.description }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const { success, translatedTitle, translatedDescription } = await response.json();
      if (!success) throw new Error("Translation failed");

      setTranslationSuccess(translatedTitle !== voiceInput.title || translatedDescription !== voiceInput.description);
      setVoiceInput((prev) => ({ ...prev, title: translatedTitle, description: translatedDescription }));
      setShowModal("translation");
    } catch (err) {
      console.error("Translation error:", err);
      setError(`Failed to translate voice input: ${err.message}`);
    } finally {
      setIsTranslating(false);
      setLoading(false);
      setLoadingAction("");
    }
  };

  const handleTranslationConfirm = () => {
    setFormData((prev) => ({ ...prev, title: voiceInput.title, description: voiceInput.description }));
    setShowModal(null);
    setVoiceInput({ title: "", description: "", recording: "title" });
    setTranslationSuccess(false);
    setSuccessMessage("Voice input translated and confirmed");
    setTimeout(() => setSuccessMessage(""), 3000);
    // Log the translation confirmation
    fetch("/api/managersCommon/general-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: session?.user?.id,
        action: "translation_confirmed",
        details: `Voice input translated and confirmed for task creation by ${session?.user?.name || "Unknown"}`,
        createdAt: new Date().toISOString(),
      }),
    });
  };

  const filteredMembers = members
    ? members.filter(
        (member) =>
          member.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          member.email?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  if (status === "loading" || !membersData) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100"
      >
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-lg sm:text-2xl font-semibold text-gray-700">
          Loading...
        </motion.div>
      </motion.div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className={`fixed inset-0 bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 p-4 sm:p-6 flex items-center justify-center ${loading ? "blur-sm" : ""}`}
      >
        <div className="w-full h-full bg-white rounded-2xl shadow-xl p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:gap-6">
          <AnimatePresence>
            {(error || successMessage) && (
              <motion.p
                key={error ? "error" : "success"}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`absolute top-4 left-4 right-4 text-sm sm:text-base font-medium p-3 sm:p-4 rounded-lg shadow-md z-50 ${error ? "bg-red-50 text-red-600" : "bg-teal-50 text-teal-600"}`}
                onClick={() => {
                  setError("");
                  setSuccessMessage("");
                }}
              >
                {error || successMessage} (Click to dismiss)
              </motion.p>
            )}
          </AnimatePresence>
          <TaskList
            filteredTasks={filteredTasks}
            fetchingTasks={fetchingTasks}
            filterType={filterType}
            setFilterType={setFilterType}
            filterMember={filterMember}
            setFilterMember={setFilterMember}
            members={members}
            dateRange={dateRange}
            setDateRange={setDateRange}
            showAllTasks={showAllTasks}
            setShowAllTasks={setShowAllTasks}
            setShowModal={setShowModal}
            selectedTaskIds={selectedTaskIds}
            setSelectedTaskIds={setSelectedTaskIds}
            handleBulkDelete={handleBulkDelete}
            deleting={deleting}
            getStatusColor={getStatusColor}
            setSelectedTask={setSelectedTask}
            refreshTasks={refreshTasks}
          />
          <TaskForm
            formData={formData}
            setFormData={setFormData}
            members={members}
            loading={loading}
            isRecording={isRecording}
            isTranslating={isTranslating}
            handleSubmit={handleSubmit}
            inputMode={inputMode}
            setInputMode={setInputMode}
            setShowModal={setShowModal}
            setVoiceInput={setVoiceInput}
            setTempAssignees={setTempAssignees}
          />
        </div>
      </motion.div>
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-60"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl p-4 sm:p-6 flex items-center justify-center"
            >
              <svg className="animate-spin h-6 sm:h-8 w-6 sm:w-8 mr-3 text-teal-600" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="text-base sm:text-lg font-semibold text-gray-800">{loadingAction}</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showModal && (
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
              className="bg-white rounded-2xl shadow-2xl p-4 sm:p-6 w-full max-w-lg"
            >
              {showModal === "assignee" && (
                <>
                  <h3 className="text-lg sm:text-2xl font-bold text-gray-800 mb-4">Select Assignees</h3>
                  <input
                    type="text"
                    placeholder="Search by name or email"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full p-2 sm:p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs sm:text-base mb-4"
                  />
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {filteredMembers.length === 0 ? (
                      <p className="text-gray-500 text-sm sm:text-base text-center">No members found</p>
                    ) : (
                      filteredMembers.map((member) => (
                        <motion.div
                          key={`member-${member.id}`}
                          className="flex items-center p-2 hover:bg-teal-50 rounded-lg"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          <input
                            type="checkbox"
                            id={`member-${member.id}`}
                            checked={tempAssignees.includes(member.id)}
                            onChange={() => handleAssigneeSelect(member.id)}
                            className="h-4 sm:h-5 w-4 sm:w-5 text-teal-600 border-teal-200 rounded focus:ring-teal-500"
                          />
                          <label htmlFor={`member-${member.id}`} className="ml-2 sm:ml-3 text-xs sm:text-base text-gray-700">
                            {member.name} ({member.email}, {member.role})
                          </label>
                        </motion.div>
                      ))
                    )}
                  </div>
                  <div className="flex gap-3 mt-4">
                    <motion.button
                      onClick={() => {
                        setShowModal(null);
                        setTempAssignees(editingTask ? editingTask.assignees : formData.assignees);
                        setSearchQuery("");
                      }}
                      className="flex-1 px-3 py-2 sm:px-6 sm:py-3 bg-gray-200 text-gray-800 rounded-lg text-xs sm:text-base font-semibold hover:bg-gray-300"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      onClick={confirmAssignees}
                      disabled={tempAssignees.length === 0}
                      className={`flex-1 px-3 py-2 sm:px-6 sm:py-3 rounded-lg text-xs sm:text-base font-semibold ${tempAssignees.length === 0 ? "bg-gray-400 cursor-not-allowed" : "bg-teal-600 text-white hover:bg-teal-700"}`}
                      whileHover={{ scale: tempAssignees.length === 0 ? 1 : 1.03 }}
                      whileTap={{ scale: tempAssignees.length === 0 ? 1 : 0.95 }}
                    >
                      Confirm
                    </motion.button>
                  </div>
                </>
              )}
              {showModal === "taskDetails" && (selectedTask || newTask) && (
                <>
                  <h3 className="text-lg sm:text-2xl font-bold text-gray-800 mb-4">
                    {newTask ? "Task Added Successfully" : selectedTask?.title}
                  </h3>
                  <p className="text-gray-500 text-xs sm:text-base mb-2">
                    <strong>Title:</strong> {(newTask || selectedTask).title}
                  </p>
                  <p className="text-gray-500 text-xs sm:text-base mb-2">
                    <strong>Description:</strong> {(newTask || selectedTask).description || "Not provided"}
                  </p>
                  <p className="text-gray-500 text-xs sm:text-base mb-2">
                    <strong>Assignees:</strong>{" "}
                    {(newTask || selectedTask).assignees?.map((a) => a.name).join(", ") || "None"}
                  </p>
                  <p className="text-gray-500 text-xs sm:text-base mb-2">
                    <strong>Sprints:</strong>{" "}
                    {(newTask || selectedTask).sprints?.length > 0
                      ? (newTask || selectedTask).sprints.map((s) => `${s.title} (${s.status})`).join(", ")
                      : "None"}
                  </p>
                  <p className="text-gray-500 text-xs sm:text-base mb-2">
                    <strong>Deadline:</strong>{" "}
                    {(newTask || selectedTask).deadline ? new Date((newTask || selectedTask).deadline).toLocaleString() : "Not set"}
                  </p>
                  <p className="text-gray-500 text-xs sm:text-base mb-2">
                    <strong>Assigned By:</strong>{" "}
                    {members ? members.find((m) => m.id === (newTask || selectedTask).createdBy)?.name || "Unknown" : "Loading..."}
                  </p>
                  <p className="text-gray-500 text-xs sm:text-base mb-4">
                    <strong>Resources:</strong> {(newTask || selectedTask).resources || "None"}
                  </p>
                  <div className="flex gap-3">
                    <motion.button
                      onClick={() => {
                        setEditingTask({
                          ...selectedTask,
                          assignees: Array.from(new Set(selectedTask.assignees?.map((a) => a.id) || [])),
                        });
                        setFormData((prev) => ({ ...prev, sprints: selectedTask.sprints || [] }));
                        setShowModal("editTask");
                      }}
                      className="flex-1 px-3 py-2 sm:px-6 sm:py-3 bg-yellow-600 text-white rounded-lg text-xs sm:text-base font-semibold hover:bg-yellow-700"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Edit Task
                    </motion.button>
                    <motion.button
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, sprints: (newTask || selectedTask).sprints || [] }));
                        setShowModal("sprints");
                      }}
                      className="flex-1 px-3 py-2 sm:px-6 sm:py-3 bg-purple-600 text-white rounded-lg text-xs sm:text-base font-semibold hover:bg-purple-700"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Manage Sprints
                    </motion.button>
                    <motion.button
                      onClick={() => {
                        setDeleteTaskId((newTask || selectedTask).id);
                        setShowModal("deleteConfirm");
                      }}
                      disabled={loading}
                      className={`flex-1 px-3 py-2 sm:px-6 sm:py-3 rounded-lg text-xs sm:text-base font-semibold ${loading ? "bg-gray-400 cursor-not-allowed" : "bg-red-600 text-white hover:bg-red-700"}`}
                      whileHover={{ scale: loading ? 1 : 1.03 }}
                      whileTap={{ scale: loading ? 1 : 0.95 }}
                    >
                      Delete Task
                    </motion.button>
                    <motion.button
                      onClick={() => setShowModal(null)}
                      className="flex-1 px-3 py-2 sm:px-6 sm:py-3 bg-gray-200 text-gray-800 rounded-lg text-xs sm:text-base font-semibold hover:bg-gray-300"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Close
                    </motion.button>
                  </div>
                </>
              )}
              {showModal === "editTask" && editingTask && (
                <>
                  <h3 className="text-lg sm:text-2xl font-bold text-gray-800 mb-4">Update Assigned Task</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700">Task Title</label>
                      <input
                        type="text"
                        name="title"
                        value={editingTask.title}
                        onChange={handleEditInputChange}
                        className="mt-1 w-full p-2 sm:p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs sm:text-base"
                        placeholder="Enter task title"
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700">Task Description</label>
                      <textarea
                        name="description"
                        value={editingTask.description || ""}
                        onChange={handleEditInputChange}
                        className="mt-1 w-full p-2 sm:p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs sm:text-base"
                        placeholder="Enter task description"
                        rows={4}
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700">Deadline</label>
                      <DatePicker
                        selected={editingTask.deadline}
                        onChange={(date) => setEditingTask((prev) => ({ ...prev, deadline: date }))}
                        showTimeSelect
                        timeFormat="HH:mm"
                        timeIntervals={15}
                        dateFormat="MMMM d, yyyy h:mm aa"
                        className="mt-1 w-full p-2 sm:p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs sm:text-base"
                        placeholderText="Select deadline"
                      />
                    </div>
                    <div>
                      <label                       className="block text-xs sm:text-sm font-medium text-gray-700">Resources (Links or Notes)</label>
                      <textarea
                        name="resources"
                        value={editingTask.resources || ""}
                        onChange={handleEditInputChange}
                        className="mt-1 w-full p-2 sm:p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs sm:text-base"
                        placeholder="Enter links or suggestive notes"
                        rows={3}
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700">Assignees</label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {editingTask.assignees.map((assigneeId, index) => {
                          const member = members ? members.find((m) => m.id === assigneeId) : null;
                          return (
                            member && (
                              <span
                                key={`assignee-${assigneeId}-${index}`}
                                className="px-2 py-1 bg-teal-100 text-teal-800 rounded-full text-xs sm:text-sm font-medium flex items-center"
                              >
                                {member.name}
                                <button
                                  onClick={() =>
                                    setEditingTask((prev) => ({
                                      ...prev,
                                      assignees: prev.assignees.filter((id) => id !== assigneeId),
                                    }))
                                  }
                                  className="ml-2 text-red-600 hover:text-red-800"
                                >
                                  ×
                                </button>
                              </span>
                            )
                          );
                        })}
                        <motion.button
                          onClick={() => {
                            setTempAssignees(editingTask.assignees);
                            setShowModal("assignee");
                          }}
                          className="px-2 py-1 bg-teal-100 text-teal-800 rounded-full text-xs sm:text-sm font-medium hover:bg-teal-200"
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          Edit Assignees
                        </motion.button>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <motion.button
                      onClick={() => handleEditTask(editingTask.id)}
                      disabled={loading || !editingTask.title || editingTask.assignees.length === 0}
                      className={`flex-1 px-3 py-2 sm:px-6 sm:py-3 rounded-lg text-xs sm:text-base font-semibold ${loading || !editingTask.title || editingTask.assignees.length === 0 ? "bg-gray-400 cursor-not-allowed" : "bg-teal-600 text-white hover:bg-teal-700"}`}
                      whileHover={{ scale: loading || !editingTask.title || editingTask.assignees.length === 0 ? 1 : 1.03 }}
                      whileTap={{ scale: loading || !editingTask.title || editingTask.assignees.length === 0 ? 1 : 0.95 }}
                    >
                      Save
                    </motion.button>
                    <motion.button
                      onClick={() => {
                        setEditingTask(null);
                        setShowModal(null);
                      }}
                      className="flex-1 px-3 py-2 sm:px-6 sm:py-3 bg-gray-200 text-gray-800 rounded-lg text-xs sm:text-base font-semibold hover:bg-gray-300"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Cancel
                    </motion.button>
                  </div>
                </>
              )}
              {showModal === "postAssign" && (
                <>
                  <h3 className="text-lg sm:text-2xl font-bold text-gray-800 mb-4">Task Assigned Successfully</h3>
                  <p className="text-gray-500 text-xs sm:text-base mb-4">Would you like to add sprints for this task now or view details?</p>
                  <div className="flex gap-3">
                    <motion.button
                      onClick={() => {
                        setShowModal("sprints");
                        setEditingTask(newTask);
                        addSprint();
                      }}
                      className="flex-1 px-3 py-2 sm:px-6 sm:py-3 bg-purple-600 text-white rounded-lg text-xs sm:text-base font-semibold hover:bg-purple-700"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Add Sprints
                    </motion.button>
                    <motion.button
                      onClick={() => setShowModal("taskDetails")}
                      className="flex-1 px-3 py-2 sm:px-6 sm:py-3 bg-teal-600 text-white rounded-lg text-xs sm:text-base font-semibold hover:bg-teal-700"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      View Details
                    </motion.button>
                    <motion.button
                      onClick={() => setShowModal(null)}
                      className="flex-1 px-3 py-2 sm:px-6 sm:py-3 bg-gray-200 text-gray-800 rounded-lg text-xs sm:text-base font-semibold hover:bg-gray-300"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Close
                    </motion.button>
                  </div>
                </>
              )}
              {showModal === "sprints" && (
                <>
                  <h3 className="text-lg sm:text-2xl font-bold text-gray-800 mb-4">
                    Manage Sprints for Task: {(editingTask || newTask || selectedTask)?.title || "New Task"}
                  </h3>
                  <div className="max-h-64 overflow-y-auto space-y-3">
                    {formData.sprints.map((sprint, index) => (
                      <motion.div
                        key={`sprint-${(editingTask || newTask || selectedTask)?.id}-${index}`}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-3 bg-white rounded-xl shadow-md"
                      >
                        <input
                          type="text"
                          placeholder="Sprint Title"
                          value={sprint.title}
                          onChange={(e) => handleSprintChange(index, "title", e.target.value)}
                          className="w-full p-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs sm:text-base"
                        />
                        <textarea
                          placeholder="Sprint Description"
                          value={sprint.description}
                          onChange={(e) => handleSprintChange(index, "description", e.target.value)}
                          className="w-full p-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs sm:text-base mt-2"
                          rows={3}
                        />
                        {formData.sprints.length > 1 && (
                          <motion.button
                            onClick={() => removeSprint(index)}
                            className="mt-2 px-3 py-1 bg-red-600 text-white rounded-lg text-xs sm:text-sm hover:bg-red-700"
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            Remove
                          </motion.button>
                        )}
                      </motion.div>
                    ))}
                  </div>
                  {formData.sprints.length < 3 && (
                    <motion.button
                      onClick={addSprint}
                      className="w-full px-3 py-2 sm:px-6 sm:py-3 bg-purple-600 text-white rounded-lg text-xs sm:text-base font-semibold hover:bg-purple-700 mt-4"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Add Sprint
                    </motion.button>
                  )}
                  <div className="flex gap-3 mt-4">
                    <motion.button
                      onClick={() => handleUpdateSprints((editingTask || newTask || selectedTask)?.id)}
                      disabled={loading || formData.sprints.filter((s) => s.title).length === 0}
                      className={`flex-1 px-3 py-2 sm:px-6 sm:py-3 rounded-lg text-xs sm:text-base font-semibold ${loading || formData.sprints.filter((s) => s.title).length === 0 ? "bg-gray-400 cursor-not-allowed" : "bg-teal-600 text-white hover:bg-teal-700"}`}
                      whileHover={{ scale: loading || formData.sprints.filter((s) => s.title).length === 0 ? 1 : 1.03 }}
                      whileTap={{ scale: loading || formData.sprints.filter((s) => s.title).length === 0 ? 1 : 0.95 }}
                    >
                      Save Sprints
                    </motion.button>
                    <motion.button
                      onClick={() => setShowModal(null)}
                      className="flex-1 px-3 py-2 sm:px-6 sm:py-3 bg-gray-200 text-gray-800 rounded-lg text-xs sm:text-base font-semibold hover:bg-gray-300"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Cancel
                    </motion.button>
                  </div>
                </>
              )}
              {showModal === "voice" && (
                <>
                  <h3 className="text-lg sm:text-2xl font-bold text-gray-800 mb-4">Record Task in Hindi</h3>
                  <p className="text-gray-500 text-xs sm:text-base mb-4">
                    {voiceInput.recording === "title"
                      ? "Record the task title in Hindi."
                      : voiceInput.recording === "description"
                        ? "Record the task description in Hindi."
                        : "Review and translate the recorded inputs."}
                  </p>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700">Title</label>
                      <input
                        type="text"
                        value={voiceInput.title}
                        onChange={(e) => setVoiceInput((prev) => ({ ...prev, title: e.target.value }))}
                        className="mt-1 w-full p-2 sm:p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs sm:text-base"
                        placeholder="Recorded title will appear here"
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700">Description</label>
                      <textarea
                        value={voiceInput.description}
                        onChange={(e) => setVoiceInput((prev) => ({ ...prev, description: e.target.value }))}
                        className="mt-1 w-full p-2 sm:p-3 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs sm:text-base"
                        placeholder="Recorded description will appear here"
                        rows={4}
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    {voiceInput.recording && (
                      <motion.button
                        onClick={() => startVoiceInput(voiceInput.recording)}
                        disabled={isRecording}
                        className={`flex-1 px-3 py-2 sm:px-6 sm:py-3 rounded-lg text-xs sm:text-base font-semibold ${isRecording ? "bg-gray-400 cursor-not-allowed" : "bg-teal-600 text-white hover:bg-teal-700"}`}
                        whileHover={{ scale: isRecording ? 1 : 1.03 }}
                        whileTap={{ scale: isRecording ? 1 : 0.95 }}
                      >
                        Record {voiceInput.recording === "title" ? "Title" : "Description"}
                      </motion.button>
                    )}
                    {!voiceInput.recording && (
                      <motion.button
                        onClick={handleTranslate}
                        disabled={isTranslating || !voiceInput.title || !voiceInput.description}
                        className={`flex-1 px-3 py-2 sm:px-6 sm:py-3 rounded-lg text-xs sm:text-base font-semibold ${isTranslating || !voiceInput.title || !voiceInput.description ? "bg-gray-400 cursor-not-allowed" : "bg-teal-600 text-white hover:bg-teal-700"}`}
                        whileHover={{ scale: isTranslating || !voiceInput.title || !voiceInput.description ? 1 : 1.03 }}
                        whileTap={{ scale: isTranslating || !voiceInput.title || !voiceInput.description ? 1 : 0.95 }}
                      >
                        Translate to English
                      </motion.button>
                    )}
                    <motion.button
                      onClick={() => {
                        setShowModal(null);
                        setVoiceInput({ title: "", description: "", recording: "title" });
                        setTranslationSuccess(false);
                      }}
                      className="flex-1 px-3 py-2 sm:px-6 sm:py-3 bg-gray-200 text-gray-800 rounded-lg text-xs sm:text-base font-semibold hover:bg-gray-300"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Cancel
                    </motion.button>
                    {!voiceInput.recording && (
                      <motion.button
                        onClick={handleTranslationConfirm}
                        disabled={isTranslating || !voiceInput.title}
                        className={`flex-1 px-3 py-2 sm:px-6 sm:py-3 rounded-lg text-xs sm:text-base font-semibold ${isTranslating || !voiceInput.title ? "bg-gray-400 cursor-not-allowed" : "bg-teal-600 text-white hover:bg-teal-700"}`}
                        whileHover={{ scale: isTranslating || !voiceInput.title ? 1 : 1.03 }}
                        whileTap={{ scale: isTranslating || !voiceInput.title ? 1 : 0.95 }}
                      >
                        Confirm
                      </motion.button>
                    )}
                  </div>
                </>
              )}
              {showModal === "translation" && (
                <>
                  <h3 className="text-lg sm:text-2xl font-bold text-gray-800 mb-4">Review Translated Text</h3>
                  <p className="text-gray-500 text-xs sm:text-base mb-4">
                    {translationSuccess
                      ? "Translation successful! Review the translated task title and description."
                      : "Translation completed, but the text may not have changed. Review below."}
                  </p>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700">Translated Title</label>
                      <input
                        type="text"
                        value={voiceInput.title}
                        readOnly
                        className="mt-1 w-full p-2 sm:p-3 border border-teal-200 rounded-lg bg-gray-100 text-xs sm:text-base"
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700">Translated Description</label>
                      <textarea
                        value={voiceInput.description}
                        readOnly
                        className="mt-1 w-full p-2 sm:p-3 border border-teal-200 rounded-lg bg-gray-100 text-xs sm:text-base"
                        rows={4}
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <motion.button
                      onClick={() => {
                        setShowModal(null);
                        setVoiceInput({ title: "", description: "", recording: "title" });
                        setTranslationSuccess(false);
                      }}
                      className="flex-1 px-3 py-2 sm:px-6 sm:py-3 bg-gray-200 text-gray-800 rounded-lg text-xs sm:text-base font-semibold hover:bg-gray-300"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      onClick={handleTranslationConfirm}
                      className="flex-1 px-3 py-2 sm:px-6 sm:py-3 bg-teal-600 text-white rounded-lg text-xs sm:text-base font-semibold hover:bg-teal-700"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Confirm
                    </motion.button>
                  </div>
                </>
              )}
              {showModal === "manageTasks" && (
                <ManageTasksModal
                  tasks={previousTasks}
                  members={members}
                  onClose={() => setShowModal(null)}
                  onEditTask={(task) => {
                    setEditingTask({ ...task, assignees: Array.from(new Set(task.assignees?.map((a) => a.id) || [])) });
                    setFormData((prev) => ({ ...prev, sprints: task.sprints || [] }));
                    setShowModal("editTask");
                  }}
                  onManageSprints={(task) => {
                    setSelectedTask(task);
                    setFormData((prev) => ({ ...prev, sprints: task.sprints || [] }));
                    setShowModal("sprints");
                  }}
                />
              )}
              {showModal === "deleteConfirm" && (
                <>
                  <h3 className="text-lg sm:text-2xl font-bold text-gray-800 mb-4">Confirm Deletion</h3>
                  <p className="text-gray-500 text-xs sm:text-base mb-4">
                    Are you sure you want to delete {selectedTaskIds.length > 0 ? `${selectedTaskIds.length} tasks` : "this task"}? This action cannot be undone.
                  </p>
                  <div className="flex gap-3">
                    <motion.button
                      onClick={handleDeleteTask}
                      className="flex-1 px-3 py-2 sm:px-6 sm:py-3 bg-red-600 text-white rounded-lg text-xs sm:text-base font-semibold hover:bg-red-700"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Delete
                    </motion.button>
                    <motion.button
                      onClick={() => {
                        setShowModal(null);
                        setDeleteTaskId(null);
                        setSelectedTaskIds([]);
                      }}
                      className="flex-1 px-3 py-2 sm:px-6 sm:py-3 bg-gray-200 text-gray-800 rounded-lg text-xs sm:text-base font-semibold hover:bg-gray-300"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Cancel
                    </motion.button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
