import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

export default function ManageRoutineModal({
  users = [], // Default to empty array to prevent undefined
  selectedUserId,
  routineTasks,
  isLoading,
  loadingAction,
  setLoadingAction,
  newTaskDescription,
  editingTask,
  setShowManageTasksModal,
  setNewTaskDescription,
  setEditingTask,
  setSuccessMessage,
  successMessage = "",
  setError,
  handleAddTask,
  handleEditTask,
  handleDeleteTask,
}) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmTaskId, setConfirmTaskId] = useState(null);

  const openConfirmModal = (action, taskId = null) => {
    setConfirmAction(action);
    setConfirmTaskId(taskId);
    setShowConfirmModal(true);
  };

  const handleConfirm = async () => {
    setShowConfirmModal(false);
    if (confirmAction === "add") {
      await handleAddTask();
    } else if (confirmAction === "edit") {
      await handleEditTask(confirmTaskId);
    } else if (confirmAction === "delete") {
      await handleDeleteTask(confirmTaskId);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-4 sm:p-6 w-full max-w-5xl max-h-[60vh] overflow-y-auto">
        {/* Success Message */}
        <AnimatePresence>
          {successMessage && (
            <motion.p
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 left-4 right-4 text-green-600 text-xs sm:text-sm md:text-lg font-medium bg-green-50 p-3 sm:p-4 rounded-lg shadow-md z-10"
            >
              {successMessage}
            </motion.p>
          )}
        </AnimatePresence>

        <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-800 mb-3 sm:mb-4">
          Manage Routine for{" "}
          {users.find((u) => u.id === selectedUserId)?.name || "Selected User"}
        </h3>
        <div className="flex flex-col md:flex-row gap-4 sm:gap-6">
          {/* Left: Existing Tasks */}
          <div className="w-full md:w-1/2 flex flex-col gap-3 sm:gap-4">
            {routineTasks.length > 0 ? (
              <div className="space-y-2 sm:space-y-3">
                <h4 className="text-sm sm:text-base md:text-lg font-semibold text-gray-700">Current Tasks</h4>
                {routineTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-2 sm:p-3 bg-teal-50/50 rounded-lg gap-2"
                  >
                    {editingTask?.id === task.id ? (
                      <input
                        type="text"
                        value={newTaskDescription}
                        onChange={(e) => setNewTaskDescription(e.target.value)}
                        className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs sm:text-sm md:text-base"
                        placeholder="Edit task description"
                      />
                    ) : (
                      <p className="flex-1 text-xs sm:text-sm md:text-base truncate" title={task.description}>
                        {task.description}
                      </p>
                    )}
                    <div className="flex gap-2">
                      {editingTask?.id === task.id ? (
                        <>
                          <motion.button
                            onClick={() => openConfirmModal("edit", task.id)}
                            disabled={isLoading || !newTaskDescription.trim()}
                            className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-lg ${
                              isLoading || !newTaskDescription.trim()
                                ? "bg-gray-400 cursor-not-allowed"
                                : "bg-blue-600 text-white hover:bg-blue-700"
                            }`}
                            whileHover={{ scale: isLoading || !newTaskDescription.trim() ? 1 : 1.05 }}
                            whileTap={{ scale: isLoading || !newTaskDescription.trim() ? 1 : 0.95 }}
                          >
                            {isLoading && loadingAction === "edit" ? "Updating..." : "Save"}
                          </motion.button>
                          <motion.button
                            onClick={() => {
                              setEditingTask(null);
                              setNewTaskDescription("");
                            }}
                            className="px-2 sm:px-3 py-1 bg-gray-200 text-gray-800 text-xs sm:text-sm rounded-lg hover:bg-gray-300"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            Cancel
                          </motion.button>
                        </>
                      ) : (
                        <>
                          <motion.button
                            onClick={() => {
                              setEditingTask(task);
                              setNewTaskDescription(task.description);
                            }}
                            className="px-2 sm:px-3 py-1 bg-yellow-600 text-white text-xs sm:text-sm rounded-lg hover:bg-yellow-700"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            Edit
                          </motion.button>
                          <motion.button
                            onClick={() => openConfirmModal("delete", task.id)}
                            className="px-2 sm:px-3 py-1 bg-red-600 text-white text-xs sm:text-sm rounded-lg hover:bg-red-700"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            {isLoading && loadingAction === "delete" ? "Deleting..." : "Delete"}
                          </motion.button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs sm:text-sm md:text-base text-gray-600">No routine tasks assigned.</p>
            )}
          </div>

          {/* Right: Add New Task */}
          <div className="w-full md:w-1/2 flex flex-col gap-3 sm:gap-4 pt-3 sm:pt-4 border-t md:border-t-0 md:border-l md:pl-4">
            <h4 className="text-sm sm:text-base md:text-lg font-semibold text-gray-700">Add New Task</h4>
            <input
              type="text"
              value={newTaskDescription}
              onChange={(e) => setNewTaskDescription(e.target.value)}
              className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs sm:text-sm md:text-lg"
              placeholder="Enter new task description"
              disabled={!!editingTask}
            />
            <div className="flex gap-2 sm:gap-4">
              <motion.button
                onClick={() => openConfirmModal("add")}
                disabled={isLoading || !newTaskDescription.trim() || !!editingTask}
                className={`flex-1 p-2 sm:p-3 rounded-lg text-xs sm:text-sm md:text-lg ${
                  isLoading || !newTaskDescription.trim() || !!editingTask
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-green-600 text-white hover:bg-green-700"
                }`}
                whileHover={{ scale: isLoading || !newTaskDescription.trim() || !!editingTask ? 1 : 1.05 }}
                whileTap={{ scale: isLoading || !newTaskDescription.trim() || !!editingTask ? 1 : 0.95 }}
              >
                {isLoading && loadingAction === "add" ? "Adding..." : "Add Task"}
              </motion.button>
              <motion.button
                onClick={() => {
                  setShowManageTasksModal(false);
                  setNewTaskDescription("");
                  setEditingTask(null);
                  setSuccessMessage("");
                }}
                className="flex-1 p-2 sm:p-3 bg-gray-200 text-gray-800 rounded-lg text-xs sm:text-sm md:text-lg hover:bg-gray-300 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Close
              </motion.button>
            </div>
          </div>
        </div>

        {/* Confirmation Modal */}
        <AnimatePresence>
          {showConfirmModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-60">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl p-4 sm:p-6 w-full max-w-5xl max-h-[60vh]"
              >
                <h4 className="text-base sm:text-lg md:text-xl font-bold text-gray-800 mb-3 sm:mb-4">
                  Confirm {confirmAction.charAt(0).toUpperCase() + confirmAction.slice(1)} Task
                </h4>
                <p className="text-xs sm:text-sm md:text-base text-gray-600 mb-4">
                  Are you sure you want to {confirmAction} this task?
                  {confirmAction === "add" && ` Description: "${newTaskDescription}"`}
                  {confirmAction === "edit" && ` Description: "${newTaskDescription}"`}
                  {confirmAction === "delete" &&
                    ` Description: "${
                      routineTasks.find((t) => t.id === confirmTaskId)?.description || "Unknown"
                    }"`}
                </p>
                <div className="flex gap-2 sm:gap-4">
                  <motion.button
                    onClick={handleConfirm}
                    className="flex-1 p-2 sm:p-3 bg-green-600 text-white rounded-lg text-xs sm:text-sm md:text-lg hover:bg-green-700 transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Confirm
                  </motion.button>
                  <motion.button
                    onClick={() => setShowConfirmModal(false)}
                    className="flex-1 p-2 sm:p-3 bg-gray-200 text-gray-800 rounded-lg text-xs sm:text-sm md:text-lg hover:bg-gray-300 transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Cancel
                  </motion.button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}