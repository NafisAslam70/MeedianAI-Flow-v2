import { motion } from "framer-motion";

const TaskCard = ({ task, selectedTaskIds, setSelectedTaskIds, setSelectedTask, setShowModal, getStatusColor, members }) => {
  const assignedBy = members ? members.find((m) => m.id === task.createdBy)?.name || "Unknown" : "Loading...";

  return (
    <div className="flex items-start gap-2">
      <input
        type="checkbox"
        checked={selectedTaskIds.includes(task.id)}
        onChange={(e) => {
          setSelectedTaskIds((prev) =>
            e.target.checked ? [...prev, task.id] : prev.filter((id) => id !== task.id)
          );
        }}
        className="mt-1 accent-teal-600"
      />
      <motion.div
        key={`task-${task.id}`}
        className="bg-white rounded-xl shadow-md p-3 sm:p-4 mb-3 cursor-pointer flex-1"
        whileHover={{ scale: 1.02, boxShadow: "0 6px 12px rgba(0, 128, 128, 0.15)" }}
        whileTap={{ scale: 0.98 }}
        onClick={() => {
          setSelectedTask(task);
          setShowModal("taskDetails");
        }}
      >
        <div className={`w-3 h-3 rounded-sm mb-2 ${getStatusColor(task.status || "not_started")}`} />
        <div>
          <h4 className="text-sm sm:text-base font-semibold text-gray-700 truncate">{task.title}</h4>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Assignees: {task.assignees?.map((a) => a.name).join(", ") || "None"}
          </p>
          <p className="text-xs sm:text-sm text-gray-500">Sprints: {task.sprints?.length || 0}</p>
          <p className="text-xs sm:text-sm text-gray-500">Status: {task.status || "not_started"}</p>
          <p className="text-xs sm:text-sm text-gray-500">Assigned By: {assignedBy}</p>
        </div>
      </motion.div>
    </div>
  );
};

export default TaskCard;