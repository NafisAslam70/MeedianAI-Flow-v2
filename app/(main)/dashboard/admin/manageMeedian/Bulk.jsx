"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ManageCalendar from "@/components/manageMeedian/ManageCalendar";
import ManageDayClose from "@/components/manageMeedian/ManageDayClose";
import ManageSlots from "@/components/manageMeedian/ManageSlots";

export default function Bulk({
  slots,
  setSlots,
  members,
  calendar,
  setCalendar,
  loading,
  saving,
  setSaving,
  error,
  success, // Added success prop
  setError,
  setSuccess,
  editSlot,
  setEditSlot,
  showBulkModal,
  setShowBulkModal,
  bulkAssignments,
  setBulkAssignments,
  showConfirmModal,
  setShowConfirmModal,
  showManageTimingsModal,
  setShowManageTimingsModal,
  editTimingsSlot,
  setEditTimingsSlot,
  saveSlotAssignment,
  deleteSlotAssignment,
  saveSlotTimings,
  handleCalendarChange,
  saveCalendarChanges,
  addCalendarEntry,
  deleteCalendarEntry,
}) {
  const [activeSubSection, setActiveSubSection] = useState(null);

  const saveBulkAssignments = async () => {
    setSaving((p) => ({ ...p, slots: true }));
    setError("");
    setSuccess("");
    try {
      const updates = Object.entries(bulkAssignments)
        .filter(([_, memberId]) => memberId !== null)
        .map(([slotId, memberId]) => ({ slotId: parseInt(slotId), memberId }));
      const res = await fetch("/api/admin/manageMeedian?section=slots", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error || `Save failed: ${res.status}`);
      setSlots((prev) =>
        prev.map((s) => ({
          ...s,
          assignedMemberId: bulkAssignments[s.id] ?? null,
        }))
      );
      setSuccess("Bulk TOD assignments saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
      setShowBulkModal(false);
      setShowConfirmModal(false);
    } catch (err) {
      setError(`Error saving bulk assignments: ${err.message}. Check server logs for details.`);
    } finally {
      setSaving((p) => ({ ...p, slots: false }));
    }
  };

  return (
    <div className="w-full h-full flex flex-col gap-4">
      <div className="flex gap-4 flex-wrap">
        {["n-mris", "mspr", "mhcp", "calendar", "times"].map((section) => (
          <motion.div
            key={section}
            onClick={() => setActiveSubSection(section)}
            className={`flex-1 min-w-[150px] bg-white rounded-lg shadow-md p-4 flex flex-col justify-center cursor-pointer ${
              activeSubSection === section ? "bg-teal-600 text-white" : "hover:bg-teal-50"
            }`}
            whileHover={{ scale: 1.05, boxShadow: "0 6px 12px rgba(0, 128, 128, 0.2)" }}
            whileTap={{ scale: 0.95 }}
          >
            <h2 className="text-lg font-semibold text-center">{section.toUpperCase()}</h2>
          </motion.div>
        ))}
      </div>
      <AnimatePresence mode="wait">
        {activeSubSection === null ? (
          <motion.div
            key="main"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-4"
          >
            <p className="text-gray-600 text-center text-lg">Select a section to manage slots, calendar, or day-close times.</p>
          </motion.div>
        ) : (
          <motion.div
            key={activeSubSection}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="w-full h-full flex flex-col gap-4"
          >
            {activeSubSection === "n-mris" && (
              <>
                <motion.button
                  onClick={() => setShowBulkModal(true)}
                  className="w-full sm:w-auto px-6 py-3 rounded-lg text-white font-semibold text-lg bg-purple-600 hover:bg-purple-700 transition-all duration-200"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Manage All Allotments
                </motion.button>
                <div className="space-y-4 mt-4">
                  <h3 className="text-xl font-semibold text-gray-800 text-center">Current Allotted TODs</h3>
                  {[
                    "Block 1 (Slots 1-6)",
                    "Block 2 (Slots 7-9)",
                    "Block 3 (Slots 10-11)",
                    "Block 4 (Slots 12-14)",
                    "Block 5 (Slots 15-16)",
                    "Block 6 (Slot 145)",
                  ].map((blockTitle, blockIndex) => (
                    <div key={blockIndex} className="mb-8">
                      <h4 className="text-lg font-medium text-gray-700 mb-4 text-center">{blockTitle}</h4>
                      <div className="grid grid-cols-12 gap-4 mb-6">
                        <div className="col-span-2 font-medium text-gray-700">Slot ID</div>
                        <div className="col-span-6 font-medium text-gray-700">Slot Name</div>
                        <div className="col-span-4 font-medium text-gray-700">Allotted TOD</div>
                      </div>
                      {slots
                        .filter((slot) => {
                          if (blockTitle === "Block 1 (Slots 1-6)") return slot.id >= 1 && slot.id <= 6;
                          if (blockTitle === "Block 2 (Slots 7-9)") return slot.id >= 7 && slot.id <= 9;
                          if (blockTitle === "Block 3 (Slots 10-11)") return slot.id >= 10 && slot.id <= 11;
                          if (blockTitle === "Block 4 (Slots 12-14)") return slot.id >= 12 && slot.id <= 14;
                          if (blockTitle === "Block 5 (Slots 15-16)") return slot.id >= 15 && slot.id <= 16;
                          if (blockTitle === "Block 6 (Slot 145)") return slot.id === 145;
                          return false;
                        })
                        .map((slot) => (
                          <div key={slot.id} className="grid grid-cols-12 gap-4 items-center mb-4">
                            <div className="col-span-2 text-gray-700">Slot {slot.id}</div>
                            <div className="col-span-6 text-gray-700">{slot.name}</div>
                            <div className="col-span-4 text-gray-700">
                              {members.find((m) => m.id === slot.assignedMemberId)?.name || "Unassigned"}
                            </div>
                          </div>
                        ))}
                    </div>
                  ))}
                </div>
                <motion.button
                  onClick={() => setShowManageTimingsModal(true)}
                  className="w-full sm:w-auto px-6 py-3 rounded-lg text-white font-semibold text-lg bg-green-600 hover:bg-green-700 transition-all duration-200"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Manage Slot Timings
                </motion.button>
                <ManageSlots
                  slots={slots}
                  setSlots={setSlots}
                  loading={loading.slots}
                  saving={saving.slots}
                  editSlot={editSlot}
                  setEditSlot={setEditSlot}
                  saveSlotAssignment={saveSlotAssignment}
                  deleteSlotAssignment={deleteSlotAssignment}
                  members={members}
                />
              </>
            )}
            {activeSubSection === "times" && <ManageDayClose setError={setError} setSuccess={setSuccess} />}
            {activeSubSection === "mspr" && (
              <div className="space-y-4 h-full">
                <div className="grid grid-cols-2 gap-4 h-full">
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold text-gray-800 mb-2 text-center">Pre-Primary Column</h2>
                  </div>
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold text-gray-800 mb-2 text-center">Primary Column</h2>
                  </div>
                </div>
              </div>
            )}
            {activeSubSection === "mhcp" && (
              <div className="space-y-4">
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-gray-800">HW Urgencies (6:30 - 7:30 PM)</h2>
                  <div className="grid grid-cols-4 gap-4">
                    {["T2T3 (Mon-Thu)", "T2T3 (Sat)", "T1", "T4"].map((schedule, index) => (
                      <motion.div
                        key={index}
                        className="bg-white rounded-lg shadow-md p-4 flex flex-col justify-between h-48"
                        whileHover={{ scale: 1.05, boxShadow: "0 6px 12px rgba(0, 128, 128, 0.2)" }}
                        transition={{ duration: 0.2 }}
                      >
                        <h3 className="font-semibold text-teal-900 mb-2">{schedule}</h3>
                      </motion.div>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-gray-800">Beyond Potential (7:30 - 8:30 PM)</h2>
                  <div className="grid grid-cols-4 gap-4">
                    {["T1", "T2T3", "T4", "T4Jr"].map((schedule, index) => (
                      <motion.div
                        key={index}
                        className="bg-white rounded-lg shadow-md p-4 flex flex-col justify-between h-48"
                        whileHover={{ scale: 1.05, boxShadow: "0 6px 12px rgba(0, 128, 128, 0.2)" }}
                        transition={{ duration: 0.2 }}
                      >
                        <h3 className="font-semibold text-teal-900 mb-2">{schedule}</h3>
                      </motion.div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-4">
                  <motion.button
                    onClick={() => setActiveSubSection("mhcp1")}
                    className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                      activeSubSection === "mhcp1" ? "bg-teal-600 text-white" : "bg-teal-500 text-white hover:bg-teal-600"
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Manage MSPR
                  </motion.button>
                  <motion.button
                    onClick={() => setActiveSubSection("mhcp2")}
                    className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                      activeSubSection === "mhcp2" ? "bg-teal-600 text-white" : "bg-teal-500 text-white hover:bg-teal-600"
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Manage MHCP
                  </motion.button>
                </div>
              </div>
            )}
            {activeSubSection === "calendar" && (
              <ManageCalendar
                calendar={calendar}
                loading={loading.calendar}
                saving={saving.calendar}
                onCalendarChange={handleCalendarChange}
                onSaveCalendar={saveCalendarChanges}
                onAddEntry={addCalendarEntry}
                onDeleteEntry={deleteCalendarEntry}
                error={error}
                success={success}
                setError={setError}
                setSuccess={setSuccess}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showBulkModal && (
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
              transition={{ duration: 0.3 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-5xl max-h-[80vh] overflow-y-auto"
            >
              <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Manage All Allotments</h2>
              {[
                "Block 1 (Slots 1-6)",
                "Block 2 (Slots 7-9)",
                "Block 3 (Slots 10-11)",
                "Block 4 (Slots 12-14)",
                "Block 5 (Slots 15-16)",
                "Block 6 (Slot 145)",
              ].map((blockTitle, blockIndex) => (
                <div key={blockIndex} className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-700 mb-4 text-center">{blockTitle}</h3>
                  <div className="grid grid-cols-12 gap-4 mb-6">
                    <div className="col-span-2 font-medium text-gray-700">Slot ID</div>
                    <div className="col-span-6 font-medium text-gray-700">Slot Name</div>
                    <div className="col-span-4 font-medium text-gray-700">TOD Allotment</div>
                  </div>
                  {slots
                    .filter((slot) => {
                      if (blockTitle === "Block 1 (Slots 1-6)") return slot.id >= 1 && slot.id <= 6;
                      if (blockTitle === "Block 2 (Slots 7-9)") return slot.id >= 7 && slot.id <= 9;
                      if (blockTitle === "Block 3 (Slots 10-11)") return slot.id >= 10 && slot.id <= 11;
                      if (blockTitle === "Block 4 (Slots 12-14)") return slot.id >= 12 && slot.id <= 14;
                      if (blockTitle === "Block 5 (Slots 15-16)") return slot.id >= 15 && slot.id <= 16;
                      if (blockTitle === "Block 6 (Slot 145)") return slot.id === 145;
                      return false;
                    })
                    .map((slot) => (
                      <div key={slot.id} className="grid grid-cols-12 gap-4 items-center mb-4">
                        <div className="col-span-2 text-gray-700">Slot {slot.id}</div>
                        <div className="col-span-6 text-gray-700">{slot.name}</div>
                        <select
                          value={bulkAssignments[slot.id] || ""}
                          onChange={(e) =>
                            setBulkAssignments((prev) => ({
                              ...prev,
                              [slot.id]: e.target.value ? parseInt(e.target.value) : null,
                            }))
                          }
                          className="col-span-4 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                        >
                          <option value="">Unassigned</option>
                          {members.map((member) => (
                            <option key={member.id} value={member.id}>
                              {member.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                </div>
              ))}
              <div className="mt-6 flex justify-end gap-2">
                <motion.button
                  onClick={() => setShowBulkModal(false)}
                  className="px-6 py-3 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-all duration-200"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  onClick={() => setShowConfirmModal(true)}
                  className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all duration-200"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={saving.slots}
                >
                  {saving.slots ? "Saving..." : "Bulk Allot TODs"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {showConfirmModal && (
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
              transition={{ duration: 0.3 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md"
            >
              <h2 className="text-xl font-bold text-gray-800 mb-4">Confirm TOD Allotments</h2>
              <p className="text-gray-600 mb-4">Are you sure you want to apply these TOD assignments?</p>
              <div className="flex justify-end gap-2">
                <motion.button
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-all duration-200"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  onClick={saveBulkAssignments}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all duration-200"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={saving.slots}
                >
                  {saving.slots ? "Confirming..." : "Confirm"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {showManageTimingsModal && (
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
              transition={{ duration: 0.3 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-5xl max-h-[80vh] overflow-y-auto"
            >
              <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Manage Slot Timings</h2>
              {[
                "Block 1 (Slots 1-6)",
                "Block 2 (Slots 7-9)",
                "Block 3 (Slots 10-11)",
                "Block 4 (Slots 12-14)",
                "Block 5 (Slots 15-16)",
                "Block 6 (Slot 145)",
              ].map((blockTitle, blockIndex) => (
                <div key={blockIndex} className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-700 mb-4 text-center">{blockTitle}</h3>
                  <div className="grid grid-cols-12 gap-4 mb-6">
                    <div className="col-span-2 font-medium text-gray-700">Slot ID</div>
                    <div className="col-span-4 font-medium text-gray-700">Slot Name</div>
                    <div className="col-span-3 font-medium text-gray-700">Start Time</div>
                    <div className="col-span-3 font-medium text-gray-700">End Time</div>
                  </div>
                  {slots
                    .filter((slot) => {
                      if (blockTitle === "Block 1 (Slots 1-6)") return slot.id >= 1 && slot.id <= 6;
                      if (blockTitle === "Block 2 (Slots 7-9)") return slot.id >= 7 && slot.id <= 9;
                      if (blockTitle === "Block 3 (Slots 10-11)") return slot.id >= 10 && slot.id <= 11;
                      if (blockTitle === "Block 4 (Slots 12-14)") return slot.id >= 12 && slot.id <= 14;
                      if (blockTitle === "Block 5 (Slots 15-16)") return slot.id >= 15 && slot.id <= 16;
                      if (blockTitle === "Block 6 (Slot 145)") return slot.id === 145;
                      return false;
                    })
                    .map((slot) => (
                      <div key={slot.id} className="grid grid-cols-12 gap-4 items-center mb-4">
                        <div className="col-span-2 text-gray-700">Slot {slot.id}</div>
                        <div className="col-span-4 text-gray-700">{slot.name}</div>
                        <input
                          type="time"
                          value={editTimingsSlot === slot.id ? slots.find((s) => s.id === slot.id).startTime || "" : slot.startTime}
                          onChange={(e) => {
                            setEditTimingsSlot(slot.id);
                            setSlots((prev) => prev.map((s) => (s.id === slot.id ? { ...s, startTime: e.target.value } : s)));
                          }}
                          className="col-span-3 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                        />
                        <input
                          type="time"
                          value={editTimingsSlot === slot.id ? slots.find((s) => s.id === slot.id).endTime || "" : slot.endTime}
                          onChange={(e) => {
                            setEditTimingsSlot(slot.id);
                            setSlots((prev) => prev.map((s) => (s.id === slot.id ? { ...s, endTime: e.target.value } : s)));
                          }}
                          className="col-span-3 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                        />
                      </div>
                    ))}
                </div>
              ))}
              <div className="mt-6 flex justify-end gap-2">
                <motion.button
                  onClick={() => setShowManageTimingsModal(false)}
                  className="px-6 py-3 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-all duration-200"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  onClick={() => {
                    slots.forEach((slot) => {
                      if (slot.startTime && slot.endTime) {
                        saveSlotTimings(slot.id, slot.startTime, slot.endTime);
                      }
                    });
                  }}
                  className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all duration-200"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={saving.slots}
                >
                  {saving.slots ? "Saving..." : "Save Timings"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}