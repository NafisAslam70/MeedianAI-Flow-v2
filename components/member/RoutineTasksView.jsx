"use client";
import { motion } from "framer-motion";
import { ArrowLeft, X, CheckCircle } from "lucide-react";

export default function RoutineTasksView({
  handleBack,
  routineTasks,
  isLoadingRoutineTasks,
  selectedDate,
  canCloseDay,
  closeDayTasks,
  closeDayComment,
  setCloseDayTasks,
  setCloseDayComment,
  handleCloseDay,
  setShowCloseDayModal,
  routineTaskSummary,
}) {
  const summaryVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { delay: 0.2, duration: 0.4 } },
  };

  const taskVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: (index) => ({
      opacity: 1,
      x: 0,
      transition: { duration: 0.3, delay: index * 0.1, ease: "easeOut" },
    }),
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full h-full flex flex-col gap-3 bg-gradient-to-b from-gray-50 to-white"
    >
      <motion.button
        onClick={handleBack}
        className="group flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-full hover:from-teal-600 hover:to-teal-700 transition-all duration-300 shadow-md self-start"
        whileHover={{ scale: 1.05, boxShadow: "0 4px 15px rgba(0, 128, 128, 0.3)" }}
        whileTap={{ scale: 0.95 }}
      >
        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        Back
      </motion.button>
      
      <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">
        Routine Tasks
      </h2>
      
      <motion.div
        className="p-4 bg-gradient-to-r from-teal-50 to-teal-100 rounded-xl shadow-md"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <p className="text-sm font-semibold text-gray-700 mb-3">Routine Task Summary</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total", value: routineTaskSummary.total, color: "text-teal-800", bg: "bg-teal-50" },
            { label: "Completed", value: routineTaskSummary.completed, color: "text-green-800", bg: "bg-green-50" },
            { label: "In Progress", value: routineTaskSummary.inProgress, color: "text-yellow-800", bg: "bg-yellow-50" },
            { label: "Not Started", value: routineTaskSummary.notStarted, color: "text-red-800", bg: "bg-red-50" },
          ].map((item, index) => (
            <motion.div
              key={index}
              variants={summaryVariants}
              className={`p-3 rounded-lg text-center ${item.bg} shadow-sm hover:shadow-md transition-shadow duration-200`}
            >
              <p className="text-xs font-medium text-gray-600">{item.label}</p>
              <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
      
      {isLoadingRoutineTasks ? (
        <div className="flex items-center justify-center py-12">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-8 h-8 border-3 border-t-teal-500 border-gray-200 rounded-full"
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-teal-400 scrollbar-track-gray-100 space-y-3">
          {routineTasks.length === 0 ? (
            <p className="text-base text-gray-500 text-center py-8 tracking-tight">
              No routine tasks for {selectedDate}
            </p>
          ) : (
            routineTasks.map((task, index) => (
              <motion.div
                key={task.id}
                custom={index}
                variants={taskVariants}
                initial="hidden"
                animate="visible"
                className="p-3 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 border border-gray-200"
                whileHover={{ y: -3 }}
              >
                <p className="text-sm font-medium text-gray-700">
                  {task.description || "Untitled Task"}: <span className="capitalize font-semibold text-teal-700">{(task.status || "unknown").replace("_", " ")}</span>
                  {task.isLocked && <span className="text-red-600 text-xs ml-2">(Locked)</span>}
                </p>
              </motion.div>
            ))
          )}
        </div>
      )}
      
      {canCloseDay && (
        <motion.div
          className="mt-3 p-4 bg-white rounded-xl shadow-md"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h3 className="text-sm font-semibold text-gray-800 mb-3 tracking-tight">Close Day</h3>
          {closeDayTasks.map((task) => (
            <div key={task.id} className="flex items-center space-x-3 mb-3">
              <input
                type="checkbox"
                checked={task.markAsCompleted || false}
                onChange={(e) => {
                  setCloseDayTasks((prev) =>
                    prev.map((t) =>
                      t.id === task.id ? { ...t, markAsCompleted: e.target.checked } : t
                    )
                  );
                }}
                className="h-5 w-5 text-teal-600 focus:ring-teal-500 rounded border-gray-300 cursor-pointer"
                disabled={routineTasks.find((t) => t.id === task.id)?.isLocked}
              />
              <p className="text-sm text-gray-700">{task.description}</p>
            </div>
          ))}
          <textarea
            value={closeDayComment}
            onChange={(e) => setCloseDayComment(e.target.value)}
            placeholder="Add a comment (optional)"
            className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 focus:ring-2 focus:ring-teal-500 text-sm transition-all duration-200 resize-none h-24"
          />
          <div className="flex justify-end space-x-3 mt-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowCloseDayModal(false)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-full hover:from-gray-600 hover:to-gray-700 text-sm font-medium transition-all duration-200 shadow-sm"
            >
              <X className="w-4 h-4" />
              Cancel
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleCloseDay}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-full hover:from-teal-600 hover:to-teal-700 text-sm font-medium transition-all duration-200 shadow-sm"
            >
              <CheckCircle className="w-4 h-4" />
              Close Day
            </motion.button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}