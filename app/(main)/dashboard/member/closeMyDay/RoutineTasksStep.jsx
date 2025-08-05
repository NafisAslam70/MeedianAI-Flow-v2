// app/(main)/dashboard/member/closeMyDay/RoutineTasksStep.jsx
import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";

export default function RoutineTasksStep({
  routineTasksData,
  routineTasksStatuses,
  handleUpdateRoutineStatus,
  routineLog,
  setRoutineLog,
  handlePrevStep,
  handleNextStep,
}) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <CheckCircle size={18} className="text-teal-600" />
        Routine Tasks
      </h3>
      <div className="space-y-4">
        {(routineTasksData?.tasks || []).map((task) => {
          const status = routineTasksStatuses.find((s) => s.id === task.id);
          return (
            <div key={task.id} className="bg-gray-50/80 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-800">{task.description}</p>
              <label className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  checked={status?.done || false}
                  onChange={(e) => handleUpdateRoutineStatus(task.id, e.target.checked, status?.comment || "")}
                  className="h-4 w-4"
                />
                <span className="text-sm text-gray-600">Done</span>
              </label>
              <div className="mt-2">
                <label className="block text-sm">Comment:</label>
                <textarea
                  value={status?.comment || ""}
                  onChange={(e) => handleUpdateRoutineStatus(task.id, status?.done || false, e.target.value)}
                  className="border p-2 rounded w-full text-sm"
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-800">Routine Task Log:</label>
        <textarea
          value={routineLog}
          onChange={(e) => setRoutineLog(e.target.value)}
          className="border p-2 rounded w-full text-sm"
          placeholder="Add any overall comments for routine tasks"
        />
      </div>
      <div className="flex justify-between mt-6 gap-4">
        <motion.button
          onClick={handlePrevStep}
          className="flex-1 bg-gray-600 text-white py-3 rounded-xl font-semibold hover:bg-gray-500 transition-all duration-300"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Previous
        </motion.button>
        <motion.button
          onClick={handleNextStep}
          className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-all duration-300"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Next
        </motion.button>
      </div>
    </div>
  );
}