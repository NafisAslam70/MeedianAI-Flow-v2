// components/member/MRISummary.jsx
"use client";
import { motion } from "framer-motion";
import useSWR from "swr";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  });

export default function MRISummary({ selectedDate, userId }) {
  const { data: mriData, error: mriError } = useSWR(
    userId ? `/api/member/myMRIs?section=today&userId=${userId}&date=${selectedDate}` : null,
    fetcher
  );

  // Define the rituals to display
  const rituals = [
    { id: "msp-d1", title: "MSP-D1", type: "A-MRI" },
    { id: "msp-d2", title: "MSP-D2", type: "A-MRI" },
    { id: "mhcp-1", title: "MHCP-1", type: "A-MRI" },
    { id: "mhcp-2", title: "MHCP-2", type: "A-MRI" },
    { id: "slots", title: "Slots", type: "N-MRI" },
  ];

  const handleRitualToggle = async (ritualId) => {
    if (ritualId === "slots") return; // Slots are read-only
    console.log("Toggle ritual:", { userId, ritualId, date: selectedDate });
    // TODO: Implement API call to update A-MRI status
    // Example: POST /api/member/mri-status { userId, date, ritualId, completed }
  };

  // Process A-MRIs to determine completion status
  const getRitualStatus = (ritualId) => {
    if (!mriData || !mriData.aMRIs) return false;
    const task = mriData.aMRIs.find((task) => task.title.toLowerCase() === ritualId);
    return task ? true : false; // Assume completed if task exists; adjust based on actual status field
  };

  // Get slot numbers for N-MRIs
  const getSlotNumbers = () => {
    if (!mriData || !mriData.nMRIs) return [];
    return mriData.nMRIs.map((slot) => slot.id);
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {mriError ? (
        <p className="text-base text-red-600 text-center">Failed to load MRIs summary</p>
      ) : !mriData ? (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-t-teal-600 border-teal-200 rounded-full mx-auto"
        />
      ) : (
        <>
          <div className="flex justify-between text-base text-gray-600 mb-3 px-2">
            <p>Day Opened: {mriData.dayOpenedAt ? new Date(mriData.dayOpenedAt).toLocaleTimeString() : "Not opened"}</p>
            <p>Day Ended: {mriData.dayClosedAt ? new Date(mriData.dayClosedAt).toLocaleTimeString() : "Not ended"}</p>
          </div>
          <div className="flex-1 grid grid-cols-5 gap-2">
            {rituals.map((ritual) => (
              <motion.div
                key={ritual.id}
                className={`flex-1 h-full p-3 rounded-lg shadow-md cursor-pointer ${
                  ritual.id === "slots"
                    ? getSlotNumbers().length > 0
                      ? "bg-green-100 border-green-200"
                      : "bg-gray-100 border-gray-200"
                    : getRitualStatus(ritual.id)
                    ? "bg-green-100 border-green-200"
                    : "bg-gray-100 border-gray-200"
                } flex flex-col items-center justify-center border-2`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleRitualToggle(ritual.id)}
              >
                <p className="text-base font-semibold text-gray-800">{ritual.title}</p>
                <p className="text-sm text-gray-600">
                  {ritual.id === "slots"
                    ? getSlotNumbers().length > 0
                      ? `Slots: ${getSlotNumbers().join(", ")}`
                      : "No Slots"
                    : getRitualStatus(ritual.id)
                    ? "Completed"
                    : "Pending"}
                </p>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}