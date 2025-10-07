"use client";
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { debounce } from "lodash";
import useSWR from "swr";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import TaskList from "@/components/assignTask/TaskList";
import TaskForm from "@/components/assignTask/TaskForm";

const STATIC_DEFAULT_OBSERVER_IDS = [43, 49];

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
    observers: [],
    distribution: "shared",
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
  const [assigneesChanged, setAssigneesChanged] = useState(false);
  const [transferInfo, setTransferInfo] = useState({ taskId: null, fromMemberId: null, toMemberId: null });
  const [isTransferring, setIsTransferring] = useState(false);
  const [activeTab, setActiveTab] = useState("create");

  const transferTask = useMemo(() => {
    if (!transferInfo.taskId) return null;
    if (selectedTask && selectedTask.id === transferInfo.taskId) return selectedTask;
    return previousTasks.find((task) => task.id === transferInfo.taskId) || null;
  }, [transferInfo.taskId, selectedTask, previousTasks]);

  // Stable cache buster to prevent excessive fetching
  const cacheBuster = useMemo(() => new Date().getTime(), []);
  const role = session?.user?.role;
  const userId = session?.user?.id ? parseInt(session.user.id) : null;
  const isManager = useMemo(() => ["admin", "team_manager"].includes(role), [role]);

  const shouldFetchTasks = status === "authenticated";
  const membersEndpoint =
    status === "authenticated"
      ? isManager
        ? `/api/managersCommon/users?cb=${cacheBuster}`
        : `/api/member/users?cb=${cacheBuster}`
      : null;

  const { data: membersData, error: membersError } = useSWR(membersEndpoint, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
    revalidateOnReconnect: false,
    refreshInterval: 0, // Disable polling
  });

  const { data: tasksData, error: tasksError, mutate: mutateTasks } = useSWR(shouldFetchTasks ? `/api/managersCommon/assign-tasks?cb=${cacheBuster}` : null, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
    revalidateOnReconnect: false,
    refreshInterval: 0, // Disable polling
  });

  useEffect(() => {
    if (!session?.user) return;

    const selfId = Number.isNaN(userId) ? null : userId;
    const baseUsers = Array.isArray(membersData?.users) ? membersData.users : [];

    if (baseUsers.length) {
      const baseSelf = selfId != null ? baseUsers.find((m) => Number(m.id) === selfId) : null;
      const seeded = baseSelf
        ? baseUsers
        : [
            {
              id: selfId ?? Number(session.user.id),
              name: session.user.name,
              email: session.user.email,
              role: session.user.role,
              immediate_supervisor: session.user.immediate_supervisor ?? null,
            },
            ...baseUsers,
          ];

      const uniqueMembers = Array.from(
        new Map(seeded.map((m) => [Number(m.id), { ...m, id: Number(m.id) }])).values()
      );

      setMembers(uniqueMembers);

      // Ensure non-managers keep themselves as the sole doer
      if (!isManager && selfId !== null) {
        setFormData((prev) => {
          const normalizedAssignees = prev.assignees.map((id) => Number(id));
          if (normalizedAssignees.length === 1 && normalizedAssignees[0] === selfId) {
            return prev;
          }
          return { ...prev, assignees: [selfId] };
        });
      }

      const selfMember = selfId != null
        ? uniqueMembers.find((member) => Number(member.id) === selfId)
        : null;
      const supervisorId = selfMember?.immediate_supervisor
        ? Number(selfMember.immediate_supervisor)
        : null;
      const fallbackManager = uniqueMembers.find(
        (member) =>
          member.role !== "member" &&
          (selfId === null || Number(member.id) !== Number(selfId))
      );

      // Set a sensible default observer list if one is missing
      setFormData((prev) => {
        const existingObservers = Array.isArray(prev.observers) ? prev.observers : [];
        if (existingObservers.length) return prev;

        const staticDefaultObservers = STATIC_DEFAULT_OBSERVER_IDS.filter((id) =>
          uniqueMembers.some((member) => Number(member.id) === Number(id))
        );

        const defaults = [...staticDefaultObservers];
        if (isManager && selfId !== null) {
          defaults.push(selfId);
        } else if (supervisorId) {
          defaults.push(supervisorId);
        } else if (fallbackManager) {
          defaults.push(Number(fallbackManager.id));
        }

        return defaults.length
          ? { ...prev, observers: Array.from(new Set(defaults)) }
          : prev;
      });
    } else if (membersError) {
      console.error("Members fetch error:", membersError);
      if (isManager) {
        setError(
          session?.user?.role === "admin"
            ? "No team members found. Add members in the admin dashboard."
            : "No team members found. Contact an admin."
        );
        if (session?.user?.role === "admin") router.push("/dashboard/admin/addUser");
      }
    }
  }, [membersData, membersError, session, router, isManager, userId]);

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
      await mutateTasks(undefined, { revalidate: true });
      window.location.reload();
    } catch (err) {
      console.error("Refresh tasks error:", err);
      setError("Failed to refresh tasks. Please try again.");
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
    setAssigneesChanged(true);
  }, 300);

  const confirmAssignees = () => {
    const uniqueAssignees = Array.from(new Set(tempAssignees));
    if (editingTask) {
      setEditingTask((prev) => ({ ...prev, assignees: uniqueAssignees }));
      setShowModal("editTask");
    } else {
      setFormData((prev) => ({ ...prev, assignees: uniqueAssignees }));
      setShowModal(null);
    }
    setSuccessMessage("Assignees updated successfully");
    setTimeout(() => setSuccessMessage(""), 3000);
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

    const creatorId = Number.isNaN(userId) ? null : userId;
    const dedupedAssignees = Array.from(
      new Set(
        (formData.assignees || []).map((id) => {
          const parsed = parseInt(id);
          return Number.isNaN(parsed) ? null : parsed;
        }).filter((id) => id !== null)
      )
    );
    const sanitizedAssignees = isManager
      ? dedupedAssignees
      : creatorId !== null
        ? [creatorId]
        : [];
    const observerIds = Array.from(
      new Set(
        (formData.observers || [])
          .map((id) => {
            const parsed = parseInt(id);
            return Number.isNaN(parsed) ? null : parsed;
          })
          .filter((id) => id !== null)
      )
    );
    const distributionMode = isManager && formData.distribution === "individual" ? "individual" : "shared";

    if (!formData.title || sanitizedAssignees.length === 0 || creatorId === null) {
      setError("Task title and at least one assignee are required.");
      setLoading(false);
      setLoadingAction("");
      return;
    }

    if (observerIds.length === 0) {
      setError("Please select at least one observer for this task.");
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
          createdBy: creatorId,
          assignees: sanitizedAssignees,
          sprints: [],
          createdAt: new Date().toISOString(),
          deadline: formData.deadline ? new Date(formData.deadline).toISOString() : null,
          resources: formData.resources,
          observers: observerIds,
          distributionMode,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      if (Array.isArray(result.taskIds) && result.taskIds.length > 0) {
        setNewTask(null);
        setSuccessMessage(`Task created individually for ${result.taskIds.length} member(s).`);
      } else if (result.taskId) {
        const observerEntries = observerIds.map((id) => {
          const member = members ? members.find((m) => Number(m.id) === Number(id)) : null;
          return member ? { id: Number(member.id), name: member.name } : { id, name: `Observer ${id}` };
        });
        const primaryObserver = observerEntries[0] || null;
        const newTaskData = {
          id: result.taskId,
          title: formData.title,
          description: formData.description,
          taskType: formData.taskType,
          assignees: members ? sanitizedAssignees.map((id) => members.find((m) => Number(m.id) === Number(id))).filter(Boolean) : [],
          sprints: [],
          status: "not_started",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: creatorId,
          deadline: formData.deadline,
          resources: formData.resources,
          observerId: primaryObserver?.id ?? null,
          observerName: primaryObserver?.name || null,
          observer: primaryObserver,
          observers: observerEntries,
        };
        setPreviousTasks((prev) => [newTaskData, ...prev]);
        setNewTask(newTaskData);
        setSuccessMessage("Task assigned successfully");
        setShowModal("postAssign");
      }
      if (!result.taskId) {
        setShowModal(null);
      }
      setFormData((prev) => ({
        ...prev,
        title: "",
        description: "",
        sprints: [],
        deadline: null,
        resources: "",
        observers: [],
      }));
      setTimeout(() => setSuccessMessage(""), 3000);
      await mutateTasks();
      await fetch("/api/managersCommon/assigned-task-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: Array.isArray(result.taskIds) ? result.taskIds[0] : result.taskId,
          userId: session?.user?.id,
          action: "created",
          details: `Task "${formData.title}" created by ${session?.user?.name || "Unknown"} with ${Array.isArray(result.taskIds) ? result.taskIds.length : sanitizedAssignees.length} assignee(s)` ,
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
      setLoading(false);
      setLoadingAction("");
      return;
    }

    setLoading(true);
    setLoadingAction("Saving...");

    try {
      const body = {
        title: editingTask.title,
        description: editingTask.description,
        sprints: editingTask.sprints,
        updatedAt: new Date().toISOString(),
        deadline: editingTask.deadline ? new Date(editingTask.deadline).toISOString() : null,
        resources: editingTask.resources,
      };
      if (assigneesChanged) {
        body.assignees = Array.from(new Set(editingTask.assignees)); // Deduplicate assignees
      }

      const response = await fetch(`/api/managersCommon/assign-tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const updatedTask = {
        ...editingTask,
        assignees: members ? Array.from(new Set(editingTask.assignees)).map((id) => members.find((m) => m.id === id)).filter(Boolean) : [],
        updatedAt: new Date().toISOString(),
        createdBy: parseInt(session?.user?.id),
      };

      // Update client-side cache with the new task data
      await mutateTasks(
        (current) => ({
          ...current,
          assignedTasks: current.assignedTasks.map((task) => (task.id === taskId ? updatedTask : task)),
        }),
        { revalidate: true }
      );

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
      setAssigneesChanged(false);
      setSuccessMessage("Task updated successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
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

      // Trigger page reload after update
      setTimeout(() => {
        window.location.reload();
      }, 1500); // Increased delay for server commit
    } catch (err) {
      console.error("Edit task error:", err);
      setError(`Error updating task: ${err.message}`);
    } finally {
      setLoading(false);
      setLoadingAction("");
    }
  };

  const handleTransfer = async () => {
    if (!transferInfo.taskId || !transferInfo.fromMemberId || !transferInfo.toMemberId) {
      setError("Select both the current doer and the new doer to transfer.");
      return;
    }

    if (transferInfo.fromMemberId === transferInfo.toMemberId) {
      setError("Choose a different member to transfer the task.");
      return;
    }

    setIsTransferring(true);
    try {
      const response = await fetch("/api/managersCommon/assign-tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "transfer",
          taskId: transferInfo.taskId,
          fromMemberId: transferInfo.fromMemberId,
          toMemberId: transferInfo.toMemberId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      await mutateTasks();

      const replacementAssignee = members?.find((m) => Number(m.id) === Number(transferInfo.toMemberId));

      const updateAssignees = (task) => {
        if (!Array.isArray(task.assignees)) return task.assignees;
        return task.assignees.map((assignee) =>
          Number(assignee.id) === Number(transferInfo.fromMemberId)
            ? replacementAssignee
              ? { ...replacementAssignee }
              : { id: transferInfo.toMemberId, name: `Member ${transferInfo.toMemberId}` }
            : assignee
        );
      };

      setPreviousTasks((prev) =>
        prev.map((task) =>
          task.id === transferInfo.taskId
            ? { ...task, assignees: updateAssignees(task) }
            : task
        )
      );

      setSelectedTask((prev) =>
        prev && prev.id === transferInfo.taskId
          ? { ...prev, assignees: updateAssignees(prev) }
          : prev
      );

      setSuccessMessage("Task transferred successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
      setShowModal(null);
      setTransferInfo({ taskId: null, fromMemberId: null, toMemberId: null });
    } catch (err) {
      console.error("Transfer error:", err);
      setError(`Error transferring task: ${err.message}`);
    } finally {
      setIsTransferring(false);
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
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText || "Failed to delete task"}`);
        }

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
        body: JSON.stringify({
          sprints: validSprints,
          updatedAt: new Date().toISOString(),
          createdBy: parseInt(session?.user?.id),
        }),
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
        createdBy: parseInt(session?.user?.id),
      };

      await mutateTasks(
        (current) => ({
          ...current,
          assignedTasks: current.assignedTasks.map((task) => (task.id === taskId ? updatedTask : task)),
        }),
        { revalidate: true }
      );

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
      <AnimatePresence>
        {(error || successMessage) && (
          <motion.div
            key={error ? "error" : "success"}
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className={`fixed top-6 left-1/2 z-[80] w-[90vw] max-w-md -translate-x-1/2 rounded-2xl border p-4 text-sm sm:text-base shadow-xl backdrop-blur ${
              error
                ? "bg-rose-50/90 border-rose-200 text-rose-700"
                : "bg-emerald-50/90 border-emerald-200 text-emerald-700"
            }`}
            onClick={() => {
              setError("");
              setSuccessMessage("");
            }}
          >
            {error || successMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-sky-50 to-white px-4 py-8 sm:px-8 lg:px-12"
      >
        <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-8">
          <div className="pointer-events-none absolute -top-24 right-0 h-64 w-64 rounded-full bg-sky-200/40 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-10 h-72 w-72 rounded-full bg-teal-200/40 blur-3xl" />

          <div className="relative z-10">
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-800">Assign, observe, and unblock with ease</h1>
          </div>

          <div
            className={`relative z-10 flex flex-col gap-4 ${
              loading ? "pointer-events-none opacity-60" : ""
            }`}
          >
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/80 p-2 shadow-sm">
              <motion.button
                onClick={() => setActiveTab("create")}
                className={`flex-1 min-w-[140px] rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-colors ${
                  activeTab === "create"
                    ? "bg-teal-600 text-white shadow"
                    : "bg-white text-slate-600 border border-slate-200"
                }`}
                whileHover={{ scale: activeTab === "create" ? 1 : 1.02 }}
                whileTap={{ scale: activeTab === "create" ? 1 : 0.98 }}
              >
                Create Task
              </motion.button>
              <motion.button
                onClick={() => setActiveTab("history")}
                className={`flex-1 min-w-[140px] rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-colors ${
                  activeTab === "history"
                    ? "bg-sky-600 text-white shadow"
                    : "bg-white text-slate-600 border border-slate-200"
                }`}
                whileHover={{ scale: activeTab === "history" ? 1 : 1.02 }}
                whileTap={{ scale: activeTab === "history" ? 1 : 0.98 }}
              >
                Task History
              </motion.button>
            </div>
            <div className="relative">
              <AnimatePresence mode="wait">
                {activeTab === "create" ? (
                  <motion.div
                    key="create-tab"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="flex"
                  >
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
                      autoObserverIds={STATIC_DEFAULT_OBSERVER_IDS}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="history-tab"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="flex"
                  >
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
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
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
                          className={`flex items-center p-2 rounded-lg ${tempAssignees.includes(member.id) ? "bg-teal-100" : "hover:bg-teal-50"}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          <input
                            type="checkbox"
                            id={`member-${member.id}`}
                            checked={tempAssignees.includes(member.id)}
                            onChange={() => handleAssigneeSelect(member.id)}
                            className="h-4 sm:h-5 w-4 sm:w-5 text-teal-600 border-teal-200 rounded focus:ring-teal-500"
                            disabled={tempAssignees.includes(member.id)}
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
                        setShowModal(editingTask ? "editTask" : null);
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
                    {(newTask || selectedTask).deadline
                      ? new Date((newTask || selectedTask).deadline).toLocaleString()
                      : "Not set"}
                  </p>
                  <p className="text-gray-500 text-xs sm:text-base mb-2">
                    <strong>Assigned By:</strong>{" "}
                    {members ? members.find((m) => m.id === (newTask || selectedTask).createdBy)?.name || "You" : "Loading..."}
                  </p>
                  <p className="text-gray-500 text-xs sm:text-base mb-2">
                    <strong>Observers:</strong>{" "}
                    {(() => {
                      const task = newTask || selectedTask;
                      const observers = Array.isArray(task?.observers) ? task.observers : [];
                      if (observers.length) return observers.map((o) => o.name || `Observer ${o.id}`).join(", ");
                      const observerId = task?.observerId || task?.observer?.id;
                      if (observerId) {
                        const member = members?.find((m) => Number(m.id) === Number(observerId));
                        if (member) return member.name;
                      }
                      return "Not assigned";
                    })()}
                  </p>
                  <p className="text-gray-500 text-xs sm:text-base mb-4">
                    <strong>Resources:</strong> {(newTask || selectedTask).resources || "None"}
                  </p>
                  <div className="flex gap-3 flex-wrap">
                    <motion.button
                      onClick={() => {
                        setEditingTask({
                          ...selectedTask,
                          assignees: Array.from(new Set(selectedTask.assignees?.map((a) => a.id) || [])),
                          deadline: selectedTask.deadline ? new Date(selectedTask.deadline) : null,
                        });
                        setFormData((prev) => ({ ...prev, sprints: selectedTask.sprints || [] }));
                        setAssigneesChanged(false);
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
                    {(() => {
                      const task = newTask || selectedTask;
                      const observerIdsSet = new Set(
                        Array.isArray(task?.observers)
                          ? task.observers.map((observer) => Number(observer.id))
                          : []
                      );
                      if (task?.observerId) observerIdsSet.add(Number(task.observerId));
                      const isObserver = observerIdsSet.has(Number(session?.user?.id));
                      const canTransfer =
                        session?.user?.role === "admin" ||
                        session?.user?.role === "team_manager" ||
                        isObserver;
                      return canTransfer && task?.assignees?.length ? (
                        <motion.button
                          onClick={() => {
                            const defaultAssignee = task.assignees?.[0]?.id ? Number(task.assignees[0].id) : null;
                            setTransferInfo({
                              taskId: task.id,
                              fromMemberId: defaultAssignee,
                              toMemberId: null,
                            });
                            setShowModal("transfer");
                          }}
                          className="flex-1 px-3 py-2 sm:px-6 sm:py-3 bg-blue-600 text-white rounded-lg text-xs sm:text-base font-semibold hover:bg-blue-700"
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          Transfer Task
                        </motion.button>
                      ) : null;
                    })()}
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
                      <label className="block text-xs sm:text-sm font-medium text-gray-700">Resources (Links or Notes)</label>
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
                                  onClick={() => {
                                    setEditingTask((prev) => ({
                                      ...prev,
                                      assignees: prev.assignees.filter((id) => id !== assigneeId),
                                    }));
                                    setAssigneesChanged(true);
                                  }}
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
                        setAssigneesChanged(false);
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
              {showModal === "transfer" && transferTask && (
                <>
                  <h3 className="text-lg sm:text-2xl font-bold text-gray-800 mb-4">Transfer Task</h3>
                  <p className="text-gray-500 text-xs sm:text-base mb-2">
                    <strong>Task:</strong> {transferTask.title}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700">Current Doer</label>
                      <select
                        value={transferInfo.fromMemberId ?? ""}
                        onChange={(e) =>
                          setTransferInfo((prev) => ({
                            ...prev,
                            fromMemberId: e.target.value ? parseInt(e.target.value) : null,
                            toMemberId: prev.toMemberId === (e.target.value ? parseInt(e.target.value) : null)
                              ? null
                              : prev.toMemberId,
                          }))
                        }
                        className="mt-1 w-full px-3 py-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs sm:text-sm bg-white"
                      >
                        {transferTask.assignees?.map((assignee) => (
                          <option key={`from-${assignee.id}`} value={assignee.id}>
                            {assignee.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700">Transfer To</label>
                      <select
                        value={transferInfo.toMemberId ?? ""}
                        onChange={(e) =>
                          setTransferInfo((prev) => ({
                            ...prev,
                            toMemberId: e.target.value ? parseInt(e.target.value) : null,
                          }))
                        }
                        className="mt-1 w-full px-3 py-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs sm:text-sm bg-white"
                      >
                        <option value="">Select member</option>
                        {(members || [])
                          .filter((member) => {
                            const takenIds = new Set(
                              (transferTask.assignees || []).map((assignee) => Number(assignee.id))
                            );
                            takenIds.delete(Number(transferInfo.fromMemberId));
                            return !takenIds.has(Number(member.id));
                          })
                          .map((member) => (
                            <option key={`to-${member.id}`} value={member.id}>
                              {member.name}
                            </option>
                          ))}
                      </select>
                      <p className="text-[11px] text-gray-500 mt-1">
                        The new doer will start from the beginning of the workflow.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <motion.button
                      onClick={() => {
                        setShowModal(null);
                        setTransferInfo({ taskId: null, fromMemberId: null, toMemberId: null });
                      }}
                      className="flex-1 px-3 py-2 sm:px-6 sm:py-3 bg-gray-200 text-gray-800 rounded-lg text-xs sm:text-base font-semibold hover:bg-gray-300"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      onClick={handleTransfer}
                      disabled={isTransferring || !transferInfo.toMemberId}
                      className={`flex-1 px-3 py-2 sm:px-6 sm:py-3 rounded-lg text-xs sm:text-base font-semibold ${
                        isTransferring || !transferInfo.toMemberId
                          ? "bg-gray-400 cursor-not-allowed"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                      whileHover={{ scale: isTransferring || !transferInfo.toMemberId ? 1 : 1.03 }}
                      whileTap={{ scale: isTransferring || !transferInfo.toMemberId ? 1 : 0.95 }}
                    >
                      {isTransferring ? "Transferring..." : "Confirm Transfer"}
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
                    setEditingTask({
                      ...task,
                      assignees: Array.from(new Set(task.assignees?.map((a) => a.id) || [])),
                      deadline: task.deadline ? new Date(task.deadline) : null,
                    });
                    setFormData((prev) => ({ ...prev, sprints: task.sprints || [] }));
                    setAssigneesChanged(false);
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
