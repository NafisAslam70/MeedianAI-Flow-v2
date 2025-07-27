"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { format } from "date-fns";
import useSWR from "swr";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  });

export default function MyMRIs() {
  const { data: session } = useSession();
  const [isAssignedTasksModalOpen, setIsAssignedTasksModalOpen] = useState(false);
  const [isRoutineTasksModalOpen, setIsRoutineTasksModalOpen] = useState(false);
  const [isAMRIsModalOpen, setIsAMRIsModalOpen] = useState(false);
  const [isNMRIsModalOpen, setIsNMRIsModalOpen] = useState(false);
  const [error, setError] = useState(null);
  const [todayAMRIs, setTodayAMRIs] = useState([]);
  const [todayNMRIs, setTodayNMRIs] = useState([]);
  const [weeklyAMRIs, setWeeklyAMRIs] = useState([]);
  const [weeklyNMRIs, setWeeklyNMRIs] = useState([]);

  // Fetch today's and weekly MRIs
  const { data: todayMRIsData, error: todayMRIsError } = useSWR("/api/member/myMeedRituals/today", fetcher);
  const { data: weeklyMRIsData, error: weeklyMRIsError } = useSWR("/api/member/myMeedRituals/weekly", fetcher);

  useEffect(() => {
    if (todayMRIsData) {
      setTodayAMRIs(todayMRIsData.aMRIs || ["Prepare daily report", "Team sync meeting", "Review project updates"]);
      setTodayNMRIs(todayMRIsData.nMRIs || ["Update task tracker", "Send client emails"]);
    }
    if (todayMRIsError) {
      setError("Failed to load today's MRIs. Using placeholders.");
      setTimeout(() => setError(null), 3000);
    }

    if (weeklyMRIsData) {
      setWeeklyAMRIs(
        weeklyMRIsData.aMRIs || [
          { day: "Monday", tasks: ["Task A1", "Task A2", "Task A3"] },
          { day: "Tuesday", tasks: ["Task A4", "Task A5"] },
          { day: "Wednesday", tasks: ["Task A6", "Task A7"] },
          { day: "Thursday", tasks: ["Task A8", "Task A9"] },
          { day: "Friday", tasks: ["Task A10"] },
        ]
      );
      setWeeklyNMRIs(
        weeklyMRIsData.nMRIs || [
          { day: "Monday", tasks: ["Task N1", "Task N2"] },
          { day: "Tuesday", tasks: ["Task N3"] },
          { day: "Wednesday", tasks: ["Task N4", "Task N5"] },
          { day: "Thursday", tasks: ["Task N6"] },
          { day: "Friday", tasks: ["Task N7", "Task N8"] },
        ]
      );
    }
    if (weeklyMRIsError) {
      setError("Failed to load weekly MRIs. Using placeholders.");
      setTimeout(() => setError(null), 3000);
    }
  }, [todayMRIsData, todayMRIsError, weeklyMRIsData, weeklyMRIsError]);

  const today = format(new Date(), "EEEE, MMMM d, yyyy");

  if (!session) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-2xl font-semibold text-gray-700"
        >
          Loading...
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100"
    >
      <div className="w-full h-full bg-white rounded-none shadow-none p-4 flex flex-col gap-4 overflow-y-auto">
        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 left-4 right-4 text-sm font-medium bg-red-50 text-red-600 p-4 rounded-lg shadow-md"
              onClick={() => setError(null)}
            >
              {error} (Click to dismiss)
            </motion.p>
          )}
        </AnimatePresence>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full w-full">
          {/* Today's MRIs Column (Narrower) */}
          <div className="bg-white rounded-xl shadow-lg p-4 border border-teal-100 backdrop-blur-sm h-full flex flex-col lg:col-span-1">
            <motion.h2
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="text-xl font-bold text-gray-800 mb-4"
            >
              My Today's MRIs
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="text-sm font-medium text-gray-700 mb-4"
            >
              {today}
            </motion.p>

            {/* A-MRIs */}
            <div className="mb-6 flex-1">
              <motion.h3
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className="text-lg font-semibold text-gray-800 mb-2"
              >
                A-MRIs
              </motion.h3>
              <ul className="list-disc pl-5 text-sm font-medium text-gray-700">
                {todayAMRIs.length === 0 ? (
                  <li>No A-MRIs for today</li>
                ) : (
                  todayAMRIs.map((task, index) => (
                    <motion.li
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 + 0.3 }}
                    >
                      {task}
                    </motion.li>
                  ))
                )}
              </ul>
            </div>

            {/* N-MRIs */}
            <div className="mb-6 flex-1">
              <motion.h3
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.4 }}
                className="text-lg font-semibold text-gray-800 mb-2"
              >
                N-MRIs
              </motion.h3>
              <ul className="list-disc pl-5 text-sm font-medium text-gray-700">
                {todayNMRIs.length === 0 ? (
                  <li>No N-MRIs for today</li>
                ) : (
                  todayNMRIs.map((task, index) => (
                    <motion.li
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 + 0.5 }}
                    >
                      {task}
                    </motion.li>
                  ))
                )}
              </ul>
            </div>

            {/* Assigned Tasks */}
            <motion.div
              className="mb-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.6 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <button
                onClick={() => setIsAssignedTasksModalOpen(true)}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 px-4 rounded-lg font-semibold transition-all duration-200"
              >
                View Assigned Tasks
              </button>
            </motion.div>

            {/* Routine Tasks */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.7 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <button
                onClick={() => setIsRoutineTasksModalOpen(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-semibold transition-all duration-200"
              >
                View Routine Tasks
              </button>
            </motion.div>
          </div>

          {/* My All Rituals Column (Wider) */}
          <div className="bg-white rounded-xl shadow-lg p-4 border border-teal-100 backdrop-blur-sm h-full flex flex-col lg:col-span-2">
            <motion.h2
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="text-xl font-bold text-gray-800 mb-4"
            >
              My All Rituals
            </motion.h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
              {/* A-MRIs Card */}
              <motion.div
                className="bg-white rounded-lg shadow-lg p-4 border border-teal-100 backdrop-blur-sm flex flex-col items-center justify-center cursor-pointer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                whileHover={{ scale: 1.05, boxShadow: "0 10px 20px rgba(0, 128, 0, 0.2)" }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setIsAMRIsModalOpen(true)}
              >
                <svg
                  className="w-12 h-12 text-teal-600 mb-3 hover:animate-pulse"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <h3 className="text-lg font-bold text-gray-800 mb-1">A-MRIs</h3>
                <p className="text-sm font-medium text-gray-700 text-center">
                  View all A-MRIs for the week
                </p>
              </motion.div>

              {/* N-MRIs Card */}
              <motion.div
                className="bg-white rounded-lg shadow-lg p-4 border border-teal-100 backdrop-blur-sm flex flex-col items-center justify-center cursor-pointer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.6 }}
                whileHover={{ scale: 1.05, boxShadow: "0 10px 20px rgba(0, 128, 0, 0.2)" }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setIsNMRIsModalOpen(true)}
              >
                <svg
                  className="w-12 h-12 text-blue-600 mb-3 hover:animate-pulse"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 6h16M4 10h16M4 14h16M4 18h16"
                  />
                </svg>
                <h3 className="text-lg font-bold text-gray-800 mb-1">N-MRIs</h3>
                <p className="text-sm font-medium text-gray-700 text-center">
                  View all N-MRIs for the week
                </p>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Modals */}
        <AnimatePresence>
          {isAssignedTasksModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
                className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto border border-teal-100 backdrop-blur-sm"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-800">Assigned Tasks</h2>
                  <motion.button
                    onClick={() => setIsAssignedTasksModalOpen(false)}
                    className="text-gray-600 hover:text-gray-800 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-200"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <X size={24} />
                  </motion.button>
                </div>
                <p className="text-sm font-medium text-gray-700 mb-6">
                  List of assigned tasks will be displayed here.
                </p>
                <motion.button
                  onClick={() => setIsAssignedTasksModalOpen(false)}
                  className="w-full bg-gray-600 hover:bg-gray-500 text-white py-2 px-4 rounded-lg font-semibold transition-all duration-200"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Close
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isRoutineTasksModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
                className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto border border-teal-100 backdrop-blur-sm"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-800">Routine Tasks</h2>
                  <motion.button
                    onClick={() => setIsRoutineTasksModalOpen(false)}
                    className="text-gray-600 hover:text-gray-800 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-200"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <X size={24} />
                  </motion.button>
                </div>
                <p className="text-sm font-medium text-gray-700 mb-6">
                  List of routine tasks will be displayed here.
                </p>
                <motion.button
                  onClick={() => setIsRoutineTasksModalOpen(false)}
                  className="w-full bg-gray-600 hover:bg-gray-500 text-white py-2 px-4 rounded-lg font-semibold transition-all duration-200"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Close
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isAMRIsModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
                className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto border border-teal-100 backdrop-blur-sm"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-800">Weekly A-MRIs</h2>
                  <motion.button
                    onClick={() => setIsAMRIsModalOpen(false)}
                    className="text-gray-600 hover:text-gray-800 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-200"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <X size={24} />
                  </motion.button>
                </div>
                <div className="space-y-4">
                  {weeklyAMRIs.length === 0 ? (
                    <p className="text-sm font-medium text-gray-700">No A-MRIs available for this week.</p>
                  ) : (
                    weeklyAMRIs.map((day, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                      >
                        <h3 className="text-md font-semibold text-gray-800">{day.day}</h3>
                        <ul className="list-disc pl-5 text-sm font-medium text-gray-700">
                          {day.tasks.map((task, taskIndex) => (
                            <li key={taskIndex}>{task}</li>
                          ))}
                        </ul>
                      </motion.div>
                    ))
                  )}
                </div>
                <motion.button
                  onClick={() => setIsAMRIsModalOpen(false)}
                  className="w-full bg-gray-600 hover:bg-gray-500 text-white py-2 px-4 rounded-lg font-semibold transition-all duration-200 mt-6"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Close
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isNMRIsModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
                className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto border border-teal-100 backdrop-blur-sm"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-800">Weekly N-MRIs</h2>
                  <motion.button
                    onClick={() => setIsNMRIsModalOpen(false)}
                    className="text-gray-600 hover:text-gray-800 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-200"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <X size={24} />
                  </motion.button>
                </div>
                <div className="space-y-4">
                  {weeklyNMRIs.length === 0 ? (
                    <p className="text-sm font-medium text-gray-700">No N-MRIs available for this week.</p>
                  ) : (
                    weeklyNMRIs.map((day, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                      >
                        <h3 className="text-md font-semibold text-gray-800">{day.day}</h3>
                        <ul className="list-disc pl-5 text-sm font-medium text-gray-700">
                          {day.tasks.map((task, taskIndex) => (
                            <li key={taskIndex}>{task}</li>
                          ))}
                        </ul>
                      </motion.div>
                    ))
                  )}
                </div>
                <motion.button
                  onClick={() => setIsNMRIsModalOpen(false)}
                  className="w-full bg-gray-600 hover:bg-gray-500 text-white py-2 px-4 rounded-lg font-semibold transition-all duration-200 mt-6"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Close
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}