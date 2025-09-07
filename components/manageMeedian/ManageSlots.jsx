"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function ManageSlots({
  slots,
  setSlots,
  loading,
  saving,
  setEditSlot,
  editSlot,
  saveSlotAssignment,
  deleteSlotAssignment,
  members,
}) {
  const confirmEdit = (slot) => {
    console.log("Editing slot:", slot); // Debug: Log the slot being edited
    setEditSlot(slot);
  };

  const cancelEdit = () => {
    console.log("Canceling edit for slot:", editSlot); // Debug: Log cancel action
    setEditSlot(null);
  };

  const handleSave = () => {
    if (!editSlot?.id) {
      console.error("No slotId provided for saving assignment");
      alert("Error: No slot selected.");
      return;
    }
    if (!editSlot?.assignedMemberId) {
      console.error("No memberId provided for saving assignment");
      alert("Error: Please select a member for TOD assignment.");
      return;
    }

    console.log("Saving slot assignment with payload:", {
      slotId: editSlot.id,
      memberId: editSlot.assignedMemberId,
    });

    saveSlotAssignment(editSlot.id, editSlot.assignedMemberId);
  };

  const handleDelete = () => {
    if (!editSlot?.id) {
      console.error("No slotId provided for deleting assignment");
      alert("Error: No slot selected.");
      return;
    }

    console.log("Deleting slot assignment for slotId:", editSlot.id);
    deleteSlotAssignment(editSlot.id);
  };

  const isSpecialSlot = () => false; // MSPR/MHCP management removed; all slots editable

  if (loading) {
    return <p className="text-gray-600 text-center text-lg">Loading slots...</p>;
  }

  return (
    <div className="space-y-4 h-full">
      <div className="grid grid-cols-2 gap-4 h-full">
        <div className="space-y-4">
          <div className="bg-green-100 rounded-2xl shadow-lg p-4 h-full">
            <h3 className="font-semibold text-gray-700 mb-2">Block 1 (Slots 1-6)</h3>
            {slots
              .filter((slot) => slot.id >= 1 && slot.id <= 6)
              .map((slot) => (
                <motion.div
                  key={slot.id}
                  className="bg-white rounded-lg p-2 mb-2"
                  whileHover={{ scale: 1.02, boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)" }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex justify-between items-center">
                    <div onClick={() => confirmEdit(slot)}>
                      <p>Slot {slot.id}: {slot.name}</p>
                      <p>{slot.startTime} - {slot.endTime}</p>
                      <p>TOD: {members.find((m) => m.id === slot.assignedMemberId)?.name || "Unassigned"}</p>
                    </div>
                    {/* Special program management removed */}
                  </div>
                </motion.div>
              ))}
          </div>
          <div className="bg-green-100 rounded-2xl shadow-lg p-4 h-full">
            <h3 className="font-semibold text-gray-700 mb-2">Block 3 (Slots 10-11)</h3>
            {slots
              .filter((slot) => slot.id >= 10 && slot.id <= 11)
              .map((slot) => (
                <motion.div
                  key={slot.id}
                  className="bg-white rounded-lg p-2 mb-2"
                  whileHover={{ scale: 1.02, boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)" }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex justify-between items-center">
                    <div onClick={() => confirmEdit(slot)}>
                      <p>Slot {slot.id}: {slot.name}</p>
                      <p>{slot.startTime} - {slot.endTime}</p>
                      <p>TOD: {members.find((m) => m.id === slot.assignedMemberId)?.name || "Unassigned"}</p>
                    </div>
                    {/* Special program management removed */}
                  </div>
                </motion.div>
              ))}
          </div>
          <div className="bg-green-100 rounded-2xl shadow-lg p-4 h-full">
            <h3 className="font-semibold text-gray-700 mb-2">Block 6 (Slot 145)</h3>
            {slots
              .filter((slot) => !slot.mspDivision && !slot.mhcpDivision && slot.id === 145)
              .map((slot) => (
                <motion.div
                  key={slot.id}
                  className="bg-white rounded-lg p-2 mb-2"
                  whileHover={{ scale: 1.02, boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)" }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex justify-between items-center">
                    <div onClick={() => !isSpecialSlot(slot.name) && confirmEdit(slot)}>
                      <p>Slot {slot.id}: {slot.name}</p>
                      <p>{slot.startTime} - {slot.endTime}</p>
                      <p>TOD: {members.find((m) => m.id === slot.assignedMemberId)?.name || "Unassigned"}</p>
                    </div>
                    {isSpecialSlot(slot.name) && (
                      <motion.button
                        className="px-3 py-1 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all duration-200"
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => console.log(`Manage ${slot.name.includes("MSP") ? "MSPR" : "MHCP"} for slot ${slot.id}`)} // Placeholder
                      >
                        Manage {slot.name.includes("MSP") ? "MSPR" : "MHCP"}
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              ))}
          </div>
          <div className="bg-green-100 rounded-2xl shadow-lg p-4 h-full">
            <h3 className="font-semibold text-gray-700 mb-2">Block 6 (Slot 17)</h3>
            {slots
              .filter((slot) => slot.id === 17)
              .map((slot) => (
                <motion.div
                  key={slot.id}
                  className="bg-white rounded-lg p-2 mb-2"
                  whileHover={{ scale: 1.02, boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)" }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex justify-between items-center">
                    <div onClick={() => confirmEdit(slot)}>
                      <p>Slot {slot.id}: {slot.name}</p>
                      <p>{slot.startTime} - {slot.endTime}</p>
                      <p>TOD: {members.find((m) => m.id === slot.assignedMemberId)?.name || "Unassigned"}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            {slots.filter((s) => s.id === 17).length === 0 && (
              <div className="text-sm text-gray-700">Slot 17 not found in DB. Use template under N‑MRI.</div>
            )}
          </div>
        </div>
        <div className="space-y-4">
          <div className="bg-green-100 rounded-2xl shadow-lg p-4 h-full">
            <h3 className="font-semibold text-gray-700 mb-2">Block 2 (Slots 7-9)</h3>
            {slots
              .filter((slot) => slot.id >= 7 && slot.id <= 9)
              .map((slot) => (
                <motion.div
                  key={slot.id}
                  className="bg-white rounded-lg p-2 mb-2"
                  whileHover={{ scale: 1.02, boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)" }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex justify-between items-center">
                    <div onClick={() => confirmEdit(slot)}>
                      <p>Slot {slot.id}: {slot.name}</p>
                      <p>{slot.startTime} - {slot.endTime}</p>
                      <p>TOD: {members.find((m) => m.id === slot.assignedMemberId)?.name || "Unassigned"}</p>
                    </div>
                    {/* Special program management removed */}
                  </div>
                </motion.div>
              ))}
          </div>
          <div className="bg-green-100 rounded-2xl shadow-lg p-4 h-full">
            <h3 className="font-semibold text-gray-700 mb-2">Block 4 (Slots 12-14)</h3>
            {slots
              .filter((slot) => slot.id >= 12 && slot.id <= 14)
              .map((slot) => (
                <motion.div
                  key={slot.id}
                  className="bg-white rounded-lg p-2 mb-2"
                  whileHover={{ scale: 1.02, boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)" }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex justify-between items-center">
                    <div onClick={() => confirmEdit(slot)}>
                      <p>Slot {slot.id}: {slot.name}</p>
                      <p>{slot.startTime} - {slot.endTime}</p>
                      <p>TOD: {members.find((m) => m.id === slot.assignedMemberId)?.name || "Unassigned"}</p>
                    </div>
                    {/* Special program management removed */}
                  </div>
                </motion.div>
              ))}
          </div>
          <div className="bg-green-100 rounded-2xl shadow-lg p-4 h-full">
            <h3 className="font-semibold text-gray-700 mb-2">Block 5 (Slots 15-16)</h3>
            {slots
              .filter((slot) => slot.id >= 15 && slot.id <= 16)
              .map((slot) => (
                <motion.div
                  key={slot.id}
                  className="bg-white rounded-lg p-2 mb-2"
                  whileHover={{ scale: 1.02, boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)" }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex justify-between items-center">
                    <div onClick={() => confirmEdit(slot)}>
                      <p>Slot {slot.id}: {slot.name}</p>
                      <p>{slot.startTime} - {slot.endTime}</p>
                      <p>TOD: {members.find((m) => m.id === slot.assignedMemberId)?.name || "Unassigned"}</p>
                    </div>
                    {/* Special program management removed */}
                  </div>
                </motion.div>
              ))}
          </div>
        </div>
      </div>
      <AnimatePresence>
        {editSlot && !isSpecialSlot(editSlot.name) && (
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
              className="bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 rounded-2xl shadow-2xl p-6 w-full max-w-md"
            >
              <h2 className="text-xl font-bold text-gray-800 mb-4">Edit Slot Assignment</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Slot Name</label>
                  <input
                    type="text"
                    value={editSlot.name}
                    disabled
                    className="mt-1 w-full p-2 border border-teal-200 rounded-lg bg-gray-100 text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Start Time</label>
                  <input
                    type="time"
                    value={editSlot.startTime}
                    disabled
                    className="mt-1 w-full p-2 border border-teal-200 rounded-lg bg-gray-100 text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">End Time</label>
                  <input
                    type="time"
                    value={editSlot.endTime}
                    disabled
                    className="mt-1 w-full p-2 border border-teal-200 rounded-lg bg-gray-100 text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">TOD Allotment</label>
                  <select
                    value={editSlot.assignedMemberId || ""}
                    onChange={(e) =>
                      setEditSlot({
                        ...editSlot,
                        assignedMemberId: e.target.value ? parseInt(e.target.value) : null,
                      })
                    }
                    className="mt-1 w-full p-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-base"
                  >
                    <option value="">Unassigned</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <motion.button
                  onClick={cancelEdit}
                  className="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-all duration-200"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Cancel
                </motion.button>
                {editSlot.assignedMemberId && (
                  <motion.button
                    onClick={handleDelete}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.95 }}
                    disabled={saving}
                  >
                    {saving ? "Deleting..." : "Delete Assignment"}
                  </motion.button>
                )}
                <motion.button
                  onClick={handleSave}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all duration-200"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
