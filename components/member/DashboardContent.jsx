"use client";
import { motion } from "framer-motion";
import MRISummary from "./MRISummary";

export default function DashboardContent({
  mriData,
  mriError,
  activeSlot,
  timeLeft,
  formatTimeLeft,
  session,
  getTODName,
  setActiveTab,
  assignedTaskSummary,
  routineTaskSummary,
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full h-full flex flex-col gap-6"
    >
      {/* Quick Glance Row with MRISummary */}
      <div className="h-[40%] bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg p-6 overflow-y-auto flex-1">
        {/* <h2 className="text-lg font-bold text-gray-800 mb-4">MRIs Summary</h2> */}
        <div className="grid grid-cols-1 gap-4 h-full">
          <MRISummary selectedDate={new Date().toISOString().split("T")[0]} userId={session?.user?.id} />
        </div>
      </div>

      {/* Perform Row */}
      <div className="h-[70%] flex gap-6">
        {/* Your Current MRI */}
        <div className="w-[30%] bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg p-6 flex flex-col items-center justify-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Your Current MRI</h2>
          {mriError ? (
            <p className="text-base text-red-600">Failed to load current MRI</p>
          ) : !mriData ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-8 h-8 border-2 border-t-teal-600 border-teal-200 rounded-full"
            />
          ) : activeSlot ? (
            <div className="text-center space-y-3">
              <p className="text-xl font-semibold text-gray-700">{activeSlot.name}</p>
              <p className="text-base text-gray-600">{activeSlot.time}</p>
              <p className="text-sm text-gray-600">
                Time Left: {timeLeft !== null ? formatTimeLeft(timeLeft) : "Ended"}
              </p>
              <p className="text-base text-gray-600">
                TOD: {getTODName(activeSlot.assignedMemberId)}
              </p>
              {activeSlot.assignedMemberId !== session?.user?.id && (
                <p className="text-base text-gray-600">No Current MRI for you</p>
              )}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`px-6 py-3 rounded-lg text-lg font-medium transition-colors duration-200 ${
                  activeSlot.assignedMemberId === session?.user?.id
                    ? "bg-teal-600 text-white hover:bg-teal-700"
                    : "bg-gray-400 text-white cursor-not-allowed"
                }`}
                disabled={activeSlot.assignedMemberId !== session?.user?.id}
                onClick={() => {
                  if (activeSlot.assignedMemberId === session?.user?.id) {
                    console.log("Perform MRI:", activeSlot);
                    // TODO: Implement actual action
                  }
                }}
              >
                Perform the Ritual
              </motion.button>
            </div>
          ) : (
            <div className="text-center space-y-3">
              <p className="text-base text-gray-600">No active MRI slot at the moment</p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 bg-gray-400 text-white rounded-lg text-lg font-medium cursor-not-allowed transition-colors duration-200"
                disabled
              >
                Perform the Ritual
              </motion.button>
            </div>
          )}
        </div>

        {/* Ad Hocs & Other Routine */}
        <div className="w-[70%] bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg p-6 flex flex-row gap-4 overflow-y-auto">
          <motion.div
            className="flex-1 bg-gradient-to-br from-teal-50 to-teal-100 rounded-xl shadow-md p-4 cursor-pointer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab('assigned')}
          >
            <h2 className="text-lg font-bold text-teal-800 mb-2">Assigned Tasks</h2>
            <div className="flex gap-2">
              <div className="flex-1 p-2 bg-teal-200 rounded-lg text-center">
                <p className="text-xs font-medium text-teal-700">Total</p>
                <p className="text-base font-bold text-teal-800">{assignedTaskSummary.total}</p>
              </div>
              <div className="flex-1 p-2 bg-green-200 rounded-lg text-center">
                <p className="text-xs font-medium text-green-700">Completed</p>
                <p className="text-base font-bold text-green-800">{assignedTaskSummary.completed}</p>
              </div>
              <div className="flex-1 p-2 bg-yellow-200 rounded-lg text-center">
                <p className="text-xs font-medium text-yellow-700">In Progress</p>
                <p className="text-base font-bold text-yellow-800">{assignedTaskSummary.inProgress}</p>
              </div>
              <div className="flex-1 p-2 bg-red-200 rounded-lg text-center">
                <p className="text-xs font-medium text-red-700">Not Started</p>
                <p className="text-base font-bold text-red-800">{assignedTaskSummary.notStarted}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="flex-1 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-md p-4 cursor-pointer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab('routine')}
          >
            <h2 className="text-lg font-bold text-blue-800 mb-2">Routine Tasks</h2>
            <div className="flex gap-2">
              <div className="flex-1 p-2 bg-teal-200 rounded-lg text-center">
                <p className="text-xs font-medium text-teal-700">Total</p>
                <p className="text-base font-bold text-teal-800">{routineTaskSummary.total}</p>
              </div>
              <div className="flex-1 p-2 bg-green-200 rounded-lg text-center">
                <p className="text-xs font-medium text-green-700">Completed</p>
                <p className="text-base font-bold text-green-800">{routineTaskSummary.completed}</p>
              </div>
              <div className="flex-1 p-2 bg-yellow-200 rounded-lg text-center">
                <p className="text-xs font-medium text-yellow-700">In Progress</p>
                <p className="text-base font-bold text-yellow-800">{routineTaskSummary.inProgress}</p>
              </div>
              <div className="flex-1 p-2 bg-red-200 rounded-lg text-center">
                <p className="text-xs font-medium text-red-700">Not Started</p>
                <p className="text-base font-bold text-red-800">{routineTaskSummary.notStarted}</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}