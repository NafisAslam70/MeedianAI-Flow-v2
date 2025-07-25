"use client";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  });

export default function GeneralDashboard() {
  const { data: session } = useSession();
  const [slots, setSlots] = useState([]);
  const [currentSlot, setCurrentSlot] = useState(null);
  const [currentBlock, setCurrentBlock] = useState(null);
  const [announcements, setAnnouncements] = useState([]); // Placeholder; fetch if added to API
  const [showTutorialsModal, setShowTutorialsModal] = useState(false);
  const [error, setError] = useState(null);

  // Fetch slots
  const { data: slotData, error: slotError } = useSWR("/api/admin/manageMeedian?section=slots", fetcher);

  useEffect(() => {
    if (slotData) {
      setSlots(slotData.slots || []);
    }
    if (slotError) {
      console.error("Slots fetch error:", slotError);
      setError("Failed to load slots. Using placeholders.");
    }

    // Placeholder announcements; fetch from API if implemented
    setAnnouncements(["Announcement 1: School event tomorrow", "Announcement 2: Holiday next week"]);
  }, [slotData, slotError]);

  useEffect(() => {
    const now = new Date(); // Real-time current date/time
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
      else if (slotId >= 15 && slotId <= 17) foundBlock = "Block 5";
    }

    setCurrentSlot(foundSlot);
    setCurrentBlock(foundBlock);
  }, [slots]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 p-6 flex items-center justify-center"
    >
      <div className="w-full h-full bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 rounded-2xl shadow-2xl p-8 flex flex-col gap-8 overflow-y-auto">
        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 left-4 right-4 text-lg font-medium p-4 rounded-lg shadow-md bg-red-50 text-red-600"
              onClick={() => setError(null)}
            >
              {error} (Click to dismiss)
            </motion.p>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-4">
          <svg className="w-12 h-12 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">General Dashboard</h1>
        </div>

        {/* Top Horizontal Row */}
        <div className="flex flex-col md:flex-row gap-6">
          {/* Current Block and Slot */}
          <motion.div
            className="flex-1 bg-white rounded-2xl shadow-lg p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-xl font-semibold text-gray-700 mb-4">Current Block & Slot</h2>
            <p className="text-gray-600">Current Block: {currentBlock || "No active block"}</p>
            <p className="text-gray-600">Current Slot: {currentSlot ? `${currentSlot.name} (${currentSlot.startTime} - ${currentSlot.endTime})` : "No active slot"}</p>
          </motion.div>

          {/* Today's Announcements */}
          <motion.div
            className="flex-1 bg-white rounded-2xl shadow-lg p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h2 className="text-xl font-semibold text-gray-700 mb-4">Today's Announcements</h2>
            <ul className="list-disc pl-5 text-gray-600">
              {announcements.map((ann, index) => (
                <li key={index}>{ann}</li>
              ))}
              {announcements.length === 0 && <p>No announcements today.</p>}
            </ul>
          </motion.div>
        </div>

        {/* Bottom Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* View MSPR */}
          <motion.div
            className="bg-white rounded-2xl shadow-lg p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <h2 className="text-xl font-semibold text-gray-700 mb-4">View MSPR (Meed School Program)</h2>
            <p className="text-gray-600 mb-4">Access the Meed School Program details here.</p>
            <button className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">View MSPR</button> {/* Add link or logic if needed */}
          </motion.div>

          {/* View MHCP */}
          <motion.div
            className="bg-white rounded-2xl shadow-lg p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <h2 className="text-xl font-semibold text-gray-700 mb-4">View MHCP</h2>
            <p className="text-gray-600 mb-4">Access the MHCP details here.</p>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">View MHCP</button> {/* Add link or logic if needed */}
          </motion.div>
        </div>

        {/* Tutorials Section */}
        <motion.div
          className="bg-white rounded-2xl shadow-lg p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Tutorials</h2>
          <p className="text-gray-600 mb-4">Click below to view tutorial videos.</p>
          <motion.button
            onClick={() => setShowTutorialsModal(true)}
            className="px-6 py-3 bg-purple-600 text-white rounded-2xl text-lg font-semibold hover:bg-purple-700 shadow-md"
            whileHover={{ scale: 1.03 }}
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
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 rounded-2xl shadow-2xl p-6 w-full max-w-4xl overflow-y-auto max-h-[80vh]"
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-gray-800">Tutorial Videos</h2>
                  <button onClick={() => setShowTutorialsModal(false)} className="text-gray-600 hover:text-gray-800">
                    <X size={24} />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Placeholder YouTube embeds; replace with actual video IDs */}
                  <iframe
                    width="100%"
                    height="315"
                    src="https://www.youtube.com/embed/dQw4w9WgXcQ"
                    title="Tutorial 1"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                  <iframe
                    width="100%"
                    height="315"
                    src="https://www.youtube.com/embed/3tmd-ClpJxA"
                    title="Tutorial 2"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                  {/* Add more iframes as needed */}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}