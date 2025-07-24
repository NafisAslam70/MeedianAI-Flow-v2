import { motion } from "framer-motion";

const TaskDetailsModal = ({ task, members, setEditingTask, setFormData, setShowModal, setDeleteTaskId }) => {
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
        className="bg-white rounded-2xl shadow-2xl p-4 sm:p-6 w-full max-w-lg"
      >
        <h3 className="text-lg sm:text-2xl font-bold text-gray-800 mb-4">
          {task ? "Task Added Successfully" : task.title}
        </h3>
        <div className="space-y-2">
          <p className="text-gray-500 text-xs sm:text-base">
            <strong>Title:</strong> {task.title}
          </p>
          <p className="text-gray-500 text-xs sm:text-base">
            <strong>Description:</strong> {task.description || "Not provided"}
          </p>
          <p className="text-gray-500 text-xs sm:text-base">
            <strong>Assignees:</strong>{" "}
            {task.assignees?.map((a) => a.name).join(", ") || "None"}
          </p>
          <p className="text-gray-500 text-xs sm:text-base">
            <strong>Assigned By:</strong>{" "}
            {members.find((m) => m.id === task.createdBy)?.name || "Unknown"}
          </p>
          <p className="text-gray-500 text-xs sm:text-base">
            <strong>Sprints:</strong>{" "}
            {task.sprints?.length > 0
              ? task.sprints.map((s) => `${s.title} (${s.status})`).join(", ")
              : "None"}
          </p>
          <p className="text-gray-500 text-xs sm:text-base">
            <strong>Deadline:</strong>{" "}
            {task.deadline ? new Date(task.deadline).toLocaleString() : "Not set"}
          </p>
          <p className="text-gray-500 text-xs sm:text-base">
            <strong>Resources:</strong> {task.resources || "None"}
          </p>
        </div>
        <div className="flex gap-3 mt-4">
          <motion.button
            onClick={() => {
              setEditingTask({
                ...task,
                assignees: Array.from(new Set(task.assignees?.map((a) => a.id) || [])),
              });
              setFormData((prev) => ({ ...prev, sprints: task.sprints || [] }));
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
              setFormData((prev) => ({ ...prev, sprints: task.sprints || [] }));
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
              setDeleteTaskId(task.id);
              setShowModal("deleteConfirm");
            }}
            className="flex-1 px-3 py-2 sm:px-6 sm:py-3 bg-red-600 text-white rounded-lg text-xs sm:text-base font-semibold hover:bg-red-700"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
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
      </motion.div>
    </motion.div>
  );
};

export default TaskDetailsModal;