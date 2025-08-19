"use client";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, AlertCircle } from "lucide-react";

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
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <CheckCircle size={18} className="text-teal-600" />
        Routine Tasks
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-64 overflow-y-auto pr-2">
        {(routineTasksData?.tasks || []).map((task) => {
          const status = routineTasksStatuses.find((s) => s.id === task.id);
          return (
            <motion.div
              key={task.id}
              className="bg-white/80 backdrop-blur-md rounded-2xl p-4 shadow-md border border-teal-100/50 hover:shadow-xl transition-all duration-300"
              whileHover={{ scale: 1.02 }}
            >
              <p className="text-sm font-semibold text-gray-800 mb-2">{task.description}</p>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status:</label>
              <select
                value={status?.done ? "done" : "could_not_complete"}
                onChange={(e) => handleUpdateRoutineStatus(task.id, e.target.value === "done")}
                className="border border-teal-200 p-2 rounded-xl w-full text-xs focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200 bg-teal-50/50"
              >
                <option value="done">Done</option>
                <option value="could_not_complete">Could not complete</option>
              </select>
            </motion.div>
          );
        })}
      </div>
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-800 mb-1">Routine Task Log (common for all tasks):</label>
        <textarea
          value={routineLog}
          onChange={(e) => setRoutineLog(e.target.value)}
          className="border border-teal-200 p-3 rounded-xl w-full text-sm h-24 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200 bg-teal-50/50 resize-none"
          placeholder="Add any overall comments for routine tasks"
        />
      </div>
      <div className="flex justify-between mt-6 gap-4">
        <motion.button
          onClick={handlePrevStep}
          className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-all duration-300 shadow-sm"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Previous
        </motion.button>
        <motion.button
          onClick={handleNextStep}
          className="flex-1 bg-teal-600 text-white py-3 rounded-xl font-semibold hover:bg-teal-700 transition-all duration-300 shadow-md"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Next
        </motion.button>
      </div>
    </div>
  );
}