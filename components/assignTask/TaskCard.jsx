import { motion } from "framer-motion";

function getInitials(name = "?") {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function timeAgo(dateString) {
  if (!dateString) return "";
  const then = new Date(dateString).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function dueBadge(deadline) {
  if (!deadline) return { label: "No deadline", tone: "bg-gray-100 text-gray-600" };
  const diff = new Date(deadline).getTime() - Date.now();
  const hours = Math.ceil(diff / 36e5);
  if (hours < 0) return { label: "Overdue", tone: "bg-red-100 text-red-700" };
  if (hours <= 24) return { label: "Due soon", tone: "bg-amber-100 text-amber-700" };
  if (hours <= 72) return { label: "In 3 days", tone: "bg-yellow-100 text-yellow-700" };
  return { label: "Scheduled", tone: "bg-teal-100 text-teal-700" };
}

function sprintProgress(sprints = []) {
  if (!Array.isArray(sprints) || sprints.length === 0) return 0;
  const done = sprints.filter((s) => ["done", "verified"].includes(s.status)).length;
  return Math.round((done / sprints.length) * 100);
}

const statusLabel = (status) => {
  switch (status) {
    case "not_started":
      return "Not Started";
    case "in_progress":
      return "In Progress";
    case "pending_verification":
      return "Pending Review";
    case "verified":
    case "done":
      return "Done";
    default:
      return status || "Unknown";
  }
};

const TaskCard = ({ task, selectedTaskIds, setSelectedTaskIds, setSelectedTask, setShowModal, getStatusColor, members }) => {
  const assignedBy = members ? members.find((m) => m.id === task.createdBy)?.name || "you" : "Loading...";
  const assignees = Array.isArray(task.assignees) ? task.assignees : [];
  const progress = sprintProgress(task.sprints);
  const due = dueBadge(task.deadline);
  const updated = timeAgo(task.updatedAt || task.createdAt);

  return (
    <div className="relative group">
      <div className="absolute -left-6 top-3">
        <input
          type="checkbox"
          aria-label="Select task"
          checked={selectedTaskIds.includes(task.id)}
          onChange={(e) => {
            setSelectedTaskIds((prev) => (e.target.checked ? [...prev, task.id] : prev.filter((id) => id !== task.id)));
          }}
          className="mt-1 h-4 w-4 sm:h-5 sm:w-5 accent-teal-600 cursor-pointer"
        />
      </div>
      <motion.div
        key={`task-${task.id}`}
        className="bg-white/90 backdrop-blur rounded-2xl border border-teal-50 shadow-sm p-4 sm:p-5 mb-4 cursor-pointer transition-all hover:shadow-teal-100"
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => {
          setSelectedTask(task);
          setShowModal("taskDetails");
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-block w-2.5 h-2.5 rounded-sm ${getStatusColor(task.status || "not_started")}`} />
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                {statusLabel(task.status || "not_started")}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${due.tone}`}>{due.label}</span>
            </div>
            <h4 className="text-sm sm:text-base font-semibold text-gray-800 truncate">{task.title}</h4>
            {!!task.description && (
              <p className="text-xs text-gray-500 line-clamp-2 mt-1">{task.description}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] text-gray-400">Updated {updated}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex -space-x-2">
            {assignees.slice(0, 4).map((a, idx) => (
              <div
                key={`${task.id}-assignee-${idx}-${a?.id || a?.name}`}
                title={a?.name}
                className="inline-flex items-center justify-center h-7 w-7 rounded-full ring-2 ring-white bg-teal-100 text-teal-700 text-[10px] font-semibold"
              >
                {getInitials(a?.name)}
              </div>
            ))}
            {assignees.length > 4 && (
              <div className="inline-flex items-center justify-center h-7 w-7 rounded-full ring-2 ring-white bg-gray-100 text-gray-700 text-[10px] font-semibold">
                +{assignees.length - 4}
              </div>
            )}
          </div>
          <div className="flex-1 mx-2 hidden sm:block">
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-teal-500" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-[10px] text-gray-500 mt-1">{progress}% complete</p>
          </div>
          <div className="text-[11px] text-gray-500 shrink-0">
            <span>Sprints: {task.sprints?.length || 0}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500">
          <span>By {assignedBy}</span>
          {task.deadline && <span>{new Date(task.deadline).toLocaleDateString()}</span>}
        </div>
      </motion.div>
    </div>
  );
};

export default TaskCard;
