"use client";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  });

const formatTimeLeft = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

export default function GeneralDashboard() {
  const { data: session } = useSession();
  const [slots, setSlots] = useState([]);
  const [members, setMembers] = useState([]);
  const [currentSlot, setCurrentSlot] = useState(null);
  const [currentBlock, setCurrentBlock] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [showTutorialsModal, setShowTutorialsModal] = useState(false);
  const [showNMRIsModal, setShowNMRIsModal] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isLoadingSlots, setIsLoadingSlots] = useState(true);

  // Fetch slots
  const { data: slotData, error: slotError } = useSWR("/api/admin/manageMeedian?section=slots", fetcher);

  // Fetch members (users)
  const { data: userData, error: userError } = useSWR("/api/member/users", fetcher);

  useEffect(() => {
    if (slotData) {
      console.log("Fetched slots:", slotData.slots);
      setSlots(slotData.slots || []);
      setIsLoadingSlots(false);
    }
    if (slotError) {
      console.error("Slots fetch error:", slotError);
      setError("Failed to load slots. Using placeholders.");
      setTimeout(() => setError(null), 3000);
      setIsLoadingSlots(false);
    }

    if (userData) {
      console.log("Fetched user data:", userData);
      const users = Array.isArray(userData) ? userData : userData.users || [];
      setMembers(users);
      console.log("Set members:", users.length, "Users:", users);
    }
    if (userError) {
      console.error("Users fetch error:", userError);
      setError("Failed to load members. TOD names may not display.");
      setTimeout(() => setError(null), 3000);
      setMembers([]);
    }

    // Placeholder announcements
    setAnnouncements(["Announcement 1: School event tomorrow", "Announcement 2: Holiday next week"]);
  }, [slotData, slotError, userData, userError]);

  useEffect(() => {
    let intervalId = null;
    const now = new Date();
    let foundSlot = null;
    let foundBlock = null;

    slots.forEach((slot) => {
      const startTime = new Date(now.toDateString() + " " + slot.startTime);
      const endTime = new Date(now.toDateString() + " " + slot.endTime);
      if (now >= startTime && now < endTime) {
        foundSlot = slot;
      }
    });

    if (foundSlot) {
      const slotId = foundSlot.id;
      if (slotId >= 1 && slotId <= 6) foundBlock = `BLOCK 1: ${foundSlot.name}`;
      else if (slotId >= 7 && slotId <= 9) foundBlock = `BLOCK 2: ${foundSlot.name}`;
      else if (slotId >= 10 && slotId <= 11) foundBlock = `BLOCK 3: ${foundSlot.name}`;
      else if (slotId >= 12 && slotId <= 14) foundBlock = `BLOCK 4: ${foundSlot.name}`;
      else if (slotId >= 15 && slotId <= 16) foundBlock = `BLOCK 5: ${foundSlot.name}`;
      else if (slotId === 17) foundBlock = `BLOCK 6: ${foundSlot.name}`; // Updated for slot 17

      // Calculate initial time left
      const endTime = new Date(now.toDateString() + " " + foundSlot.endTime);
      const secondsLeft = Math.max(0, Math.floor((endTime - now) / 1000));
      setTimeLeft(secondsLeft);

      // Start countdown
      intervalId = setInterval(() => {
        const currentTime = new Date();
        const newSecondsLeft = Math.max(0, Math.floor((endTime - currentTime) / 1000));
        setTimeLeft(newSecondsLeft);
        if (newSecondsLeft <= 0) {
          clearInterval(intervalId);
          setCurrentSlot(null);
          setCurrentBlock(null);
          setTimeLeft(null);
        }
      }, 1000);
    } else {
      setTimeLeft(null);
    }

    setCurrentSlot(foundSlot);
    setCurrentBlock(foundBlock);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [slots]);

  if (!session) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-2xl font-semibold text-gray-700"
        >
          Loading...
        </motion.div>
      </div>
    );
  }

  const getTODName = (slot) => {
    if (!slot || !slot.assignedMemberId) return "Unassigned";
    console.log("Checking TOD for slot:", slot.id, "Assigned ID:", slot.assignedMemberId, "User ID:", session.user.id);
    if (String(slot.assignedMemberId) === String(session.user.id)) {
      return `${session.user.name}(you)`;
    }
    const member = Array.isArray(members) && members.find((m) => String(m.id) === String(slot.assignedMemberId));
    return member?.name || "Unassigned";
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 p-8 flex items-center justify-center"
    >
      <div className="w-full h-full bg-white rounded-2xl shadow-2xl p-8 flex flex-col gap-8 overflow-y-auto">
        {/* Error/Success Messages */}
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
          {success && (
            <motion.p
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 left-4 right-4 text-sm font-medium bg-green-50 text-green-600 p-4 rounded-lg shadow-md"
              onClick={() => setSuccess(null)}
            >
              {success} (Click to dismiss)
            </motion.p>
          )}
        </AnimatePresence>

        {/* Header */}
        <motion.div
          className="flex items-center gap-4"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <svg className="w-12 h-12 text-teal-600 hover:animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">General Dashboard</h1>
        </motion.div>

        {/* Top Horizontal Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div
            className="bg-white rounded-xl shadow-lg p-6 border border-teal-100 backdrop-blur-sm flex flex-col items-center justify-center min-h-[200px]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            whileHover={{ scale: 1.05, boxShadow: "0 10px 20px rgba(0, 128, 0, 0.2)" }}
            whileTap={{ scale: 0.98 }}
          >
            <motion.div
              className="text-center"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              {isLoadingSlots ? (
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-lg font-semibold text-gray-700 mt-2">Loading...</p>
                </div>
              ) : (
                <>
                  <div className="relative mb-4">
                    <p className="text-4xl font-bold text-teal-700 bg-teal-50 rounded-lg p-2">
                      {currentBlock || "No Active Block"}
                    </p>
                    <span className="absolute left-0 right-0 bottom-0 h-1 bg-gradient-to-r from-teal-400 to-blue-400 rounded-full" />
                  </div>
                  {currentSlot && (
                    <>
                      <p className="text-2xl font-semibold text-gray-800 mb-2">{`${currentSlot.startTime} - ${currentSlot.endTime}`}</p>
                      <p className="text-sm font-medium text-gray-700 mb-2">TOD: {getTODName(currentSlot)}</p>
                      <p className="text-lg font-semibold text-teal-600">{timeLeft !== null ? `${formatTimeLeft(timeLeft)} left` : "Ended"}</p>
                    </>
                  )}
                </>
              )}
            </motion.div>
          </motion.div>

          <motion.div
            className="bg-white rounded-xl shadow-lg p-6 border border-teal-100 backdrop-blur-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            whileHover={{ scale: 1.05, boxShadow: "0 10px 20px rgba(0, 128, 0, 0.2)" }}
            whileTap={{ scale: 0.98 }}
          >
            <h2 className="text-xl font-bold text-gray-800 mb-4">Today's Announcements</h2>
            <ul className="list-disc pl-5 text-sm font-medium text-gray-700">
              {announcements.map((ann, index) => (
                <li key={index}>{ann}</li>
              ))}
              {announcements.length === 0 && <p>No announcements today.</p>}
            </ul>
          </motion.div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div
            className="bg-white rounded-xl shadow-lg p-4 flex flex-col items-center justify-center min-h-[160px] cursor-pointer border border-teal-100 backdrop-blur-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            whileHover={{ scale: 1.05, boxShadow: "0 10px 20px rgba(0, 128, 0, 0.2)" }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowNMRIsModal(true)}
          >
            <svg className="w-12 h-12 text-blue-600 mb-3 hover:animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-xl font-bold text-gray-800 mb-1">View N-MRIs</h3>
            <p className="text-sm font-medium text-gray-700 text-center">Non-academic slots and allotments</p>
          </motion.div>

          <motion.div
            className="bg-white rounded-xl shadow-lg p-4 flex flex-col items-center justify-center min-h-[160px] cursor-pointer border border-teal-100 backdrop-blur-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            whileHover={{ scale: 1.05, boxShadow: "0 10px 20px rgba(0, 128, 0, 0.2)" }}
            whileTap={{ scale: 0.98 }}
          >
            <svg className="w-12 h-12 text-green-600 mb-3 hover:animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <h3 className="text-xl font-bold text-gray-800 mb-1">View MSPR</h3>
            <p className="text-sm font-medium text-gray-700 text-center">Meed School Program details</p>
          </motion.div>

          <motion.div
            className="bg-white rounded-xl shadow-lg p-4 flex flex-col items-center justify-center min-h-[160px] cursor-pointer border border-teal-100 backdrop-blur-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            whileHover={{ scale: 1.05, boxShadow: "0 10px 20px rgba(0, 128, 0, 0.2)" }}
            whileTap={{ scale: 0.98 }}
          >
            <svg className="w-12 h-12 text-purple-600 mb-3 hover:animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            <h3 className="text-xl font-bold text-gray-800 mb-1">View MHCP</h3>
            <p className="text-sm font-medium text-gray-700 text-center">Meed Hostel Coaching Program details</p>
          </motion.div>
        </div>

        {/* Tutorials Section */}
        <motion.div
          className="bg-white rounded-xl shadow-lg p-4 flex flex-col items-center justify-center min-h-[160px] border border-teal-100 backdrop-blur-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.0 }}
          whileHover={{ scale: 1.05, boxShadow: "0 10px 20px rgba(0, 128, 0, 0.2)" }}
          whileTap={{ scale: 0.98 }}
        >
          <svg className="w-12 h-12 text-teal-600 mb-3 hover:animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          <h3 className="text-xl font-bold text-gray-800 mb-1">Tutorials</h3>
          <p className="text-sm font-medium text-gray-700 text-center mb-4">View tutorial videos</p>
          <motion.button
            onClick={() => setShowTutorialsModal(true)}
            className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-semibold transition-all duration-200"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Show Tutorials
          </motion.button>
        </motion.div>

        {/* Tutorials Modal */}
        <AnimatePresence>
          {showTutorialsModal && (
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
                className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto border border-teal-100 backdrop-blur-sm"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-800">Tutorial Videos</h2>
                  <motion.button
                    onClick={() => setShowTutorialsModal(false)}
                    className="text-gray-600 hover:text-gray-800 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-200"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <X size={24} />
                  </motion.button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Iframe
                    width="100%"
                    height="315"
                    src="https://www.youtube.com/embed/dQw4w9WgXcQ"
                    title="Tutorial 1"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="rounded-lg shadow-md"
                  />
                  <Iframe
                    width="100%"
                    height="315"
                    src="https://www.youtube.com/embed/3tmd-ClpJxA"
                    title="Tutorial 2"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="rounded-lg shadow-md"
                  />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* N-MRIs Modal */}
        <AnimatePresence>
          {showNMRIsModal && (
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
                className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto border border-teal-100 backdrop-blur-sm"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-800">N-MRIs Slot Allotments</h2>
                  <motion.button
                    onClick={() => setShowNMRIsModal(false)}
                    className="text-gray-600 hover:text-gray-800 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-all duration-200"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <X size={24} />
                  </motion.button>
                </div>
                {isLoadingSlots ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center text-center"
                  >
                    <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm font-medium text-gray-700 mt-2">Loading slots...</p>
                  </motion.div>
                ) : (
                  <div className="space-y-8">
                    {[
                      "Block 1 (Slots 1-6)",
                      "Block 2 (Slots 7-9)",
                      "Block 3 (Slots 10-11)",
                      "Block 4 (Slots 12-14)",
                      "Block 5 (Slots 15-16)",
                      "Block 6 (Slot 17)", // Updated label
                    ].map((blockTitle, blockIndex) => (
                      <div key={blockIndex} className="mb-8">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">{blockTitle}</h3>
                        <div className="grid grid-cols-12 gap-4 mb-4 bg-teal-50 rounded-lg p-3">
                          <div className="col-span-2 font-semibold text-gray-800">Slot ID</div>
                          <div className="col-span-4 font-semibold text-gray-800">Slot Name</div>
                          <div className="col-span-3 font-semibold text-gray-800">Allotted TOD</div>
                          <div className="col-span-3 font-semibold text-gray-800">Time Slot</div>
                        </div>
                        {slots.length === 0 ? (
                          <p className="text-sm font-medium text-gray-700 text-center">No slots available for this block.</p>
                        ) : (
                          slots
                            .filter((slot) => {
                              if (blockTitle === "Block 1 (Slots 1-6)") return slot.id >= 1 && slot.id <= 6;
                              if (blockTitle === "Block 2 (Slots 7-9)") return slot.id >= 7 && slot.id <= 9;
                              if (blockTitle === "Block 3 (Slots 10-11)") return slot.id >= 10 && slot.id <= 11;
                              if (blockTitle === "Block 4 (Slots 12-14)") return slot.id >= 12 && slot.id <= 14;
                              if (blockTitle === "Block 5 (Slots 15-16)") return slot.id >= 15 && slot.id <= 16;
                              if (blockTitle === "Block 6 (Slot 17)") return slot.id === 17; // Updated for slot 17
                              return false;
                            })
                            .map((slot, index) => (
                              <motion.div
                                key={slot.id}
                                className="grid grid-cols-12 gap-4 items-center p-3 rounded-lg hover:bg-gray-50 transition-all duration-200"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2, delay: index * 0.1 }}
                              >
                                <div className="col-span-2 text-sm font-medium text-gray-700">Slot {slot.id}</div>
                                <div className="col-span-4 text-sm font-medium text-gray-700">{slot.name}</div>
                                <div className="col-span-3 text-sm font-medium text-gray-700">
                                  {getTODName(slot)}
                                </div>
                                <div className="col-span-3 text-sm font-medium text-gray-700">{`${slot.startTime} - ${slot.endTime}`}</div>
                              </motion.div>
                            ))
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// Iframe component to avoid React hydration errors
function Iframe(props) {
  return <iframe {...props} />;
}