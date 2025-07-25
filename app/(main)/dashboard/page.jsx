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

export default function GeneralDashboard() {
  const { data: session } = useSession();
  const [slots, setSlots] = useState([]);
  const [members, setMembers] = useState([]);
  const [currentSlot, setCurrentSlot] = useState(null);
  const [currentBlock, setCurrentBlock] = useState(null);
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
      console.log("Fetched slots:", slotData.slots); // Debug
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
      console.log("Fetched user data:", userData); // Debug
      const users = Array.isArray(userData) ? userData : userData.users || [];
      setMembers(users);
      console.log("Set members:", users.length);
    }
    if (userError) {
      console.error("Users fetch error:", userError);
      setError("Failed to load members. TOD names may not display.");
      setTimeout(() => setError(null), 3000);
      setMembers([]); // Ensure members is an array
    }

    // Placeholder announcements
    setAnnouncements(["Announcement 1: School event tomorrow", "Announcement 2: Holiday next week"]);
  }, [slotData, slotError, userData, userError]);

  useEffect(() => {
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
      if (slotId >= 1 && slotId <= 6) foundBlock = "Block 1";
      else if (slotId >= 7 && slotId <= 9) foundBlock = "Block 2";
      else if (slotId >= 10 && slotId <= 11) foundBlock = "Block 3";
      else if (slotId >= 12 && slotId <= 14) foundBlock = "Block 4";
      else if (slotId >= 15 && slotId <= 16) foundBlock = "Block 5";
      else if (slotId === 145) foundBlock = "Block 6";
    }

    setCurrentSlot(foundSlot);
    setCurrentBlock(foundBlock);
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
            className="bg-white rounded-xl shadow-lg p-6 border border-teal-100 backdrop-blur-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            whileHover={{ scale: 1.05, boxShadow: "0 10px 20px rgba(0, 128, 0, 0.2)" }}
            whileTap={{ scale: 0.98 }}
          >
            <h2 className="text-xl font-bold text-gray-800 mb-4">Current Block & Slot</h2>
            <p className="text-sm font-medium text-gray-700">Current Block: {currentBlock || "No active block"}</p>
            <p className="text-sm font-medium text-gray-700">
              Current Slot: {currentSlot ? `${currentSlot.name} (${currentSlot.startTime} - ${currentSlot.endTime})` : "No active slot"}
            </p>
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
                  <iframe
                    width="100%"
                    height="315"
                    src="https://www.youtube.com/embed/dQw4w9WgXcQ"
                    title="Tutorial 1"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="rounded-lg shadow-md"
                  ></iframe>
                  <iframe
                    width="100%"
                    height="315"
                    src="https://www.youtube.com/embed/3tmd-ClpJxA"
                    title="Tutorial 2"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="rounded-lg shadow-md"
                  ></iframe>
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
                    className="text-center text-sm font-medium text-gray-700"
                  >
                    Loading slots...
                  </motion.div>
                ) : (
                  <div className="space-y-8">
                    {[
                      "Block 1 (Slots 1-6)",
                      "Block 2 (Slots 7-9)",
                      "Block 3 (Slots 10-11)",
                      "Block 4 (Slots 12-14)",
                      "Block 5 (Slots 15-16)",
                      "Block 6 (Slot 145)",
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
                              if (blockTitle === "Block 6 (Slot 145)") return slot.id === 145;
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
                                  {Array.isArray(members) && members.find((m) => m.id === slot.assignedMemberId)?.name || "Unassigned"}
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