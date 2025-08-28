import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";

export default function RoutineTasksStepView({
  routineTasks,
  routineLog,
  ISRoutineLog,
  setISRoutineLog,
  handlePrevViewStep,
  handleNextViewStep,
}) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <CheckCircle size={18} className="text-teal-600" />
        Routine Tasks
      </h3>
      <div className="space-y-4">
        {(routineTasks || []).map((task) => (
          <div key={task.id} className="bg-gray-50/80 rounded-xl p-4">
            <p className="text-sm font-semibold text-gray-800">{task.description}</p>
            <p className="text-sm text-gray-600">Done: {task.done ? "Yes" : "No"}</p>
            <p className="text-sm text-gray-600">Comment: {task.comment || "None"}</p>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-800">User's Routine Task Log:</label>
        <p className="border p-2 rounded w-full text-sm bg-gray-50">{routineLog || "No log provided"}</p>
      </div>
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-800">Supervisor Comment:</label>
        <textarea
          value={ISRoutineLog}
          onChange={(e) => setISRoutineLog(e.target.value)}
          placeholder="Add your comments on the routine tasks..."
          className="border border-teal-200 p-3 rounded-xl w-full text-sm h-24 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200 bg-teal-50/50 resize-none"
        />
      </div>
      <div className="flex justify-between mt-6 gap-4">
        <motion.button
          onClick={handlePrevViewStep}
          className="flex-1 bg-gray-600 text-white py-3 rounded-xl font-semibold hover:bg-gray-500 transition-all duration-300"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Previous
        </motion.button>
        <motion.button
          onClick={handleNextViewStep}
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