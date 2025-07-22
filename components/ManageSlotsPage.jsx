"use client";
import { useEffect } from "react";
import { motion } from "framer-motion";
import useSWR from "swr";

const fetcher = (url) => fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
  if (!res.ok) throw new Error("Failed to fetch slots");
  return res.json();
});

export default function ManageSlotsPage({
  slots,
  setSlots,
  loading,
  setLoading,
  saving,
  setSaving,
  error,
  setError,
  success,
  setSuccess,
}) {
  // Fetch slots with SWR for caching
  const { data: slotData, error: slotError } = useSWR("/api/admin/manageMeedian?section=slots", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
    revalidateOnReconnect: false,
  });

  // Update slots state when data is fetched
  useEffect(() => {
    if (slotData) {
      setSlots(slotData.slots || []);
      setLoading(false);
    }
    if (slotError) {
      setError(`Failed to load slots: ${slotError.message}. Check database, auth, or server logs.`);
      setLoading(false);
    }
  }, [slotData, slotError, setSlots, setError, setLoading]);

  // Handle slot detail changes
  const handleSlotChange = (id, field, value) => {
    setSlots((prev) =>
      prev.map((slot) => (slot.id === id ? { ...slot, [field]: value } : slot))
    );
  };

  // Save slot changes
  const saveSlotChanges = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/manageMeedian?section=slots", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: slots }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Save failed: ${res.status}`);
      }
      setSuccess("Slot changes saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Save slots error:", err);
      setError(`Error saving slots: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {loading ? (
        <p className="text-gray-600 text-center text-lg">Loading slots...</p>
      ) : (
        <>
          {slots.length === 0 ? (
            <p className="text-gray-600 text-center text-lg">No slots found. Please check the database.</p>
          ) : (
            slots.map((slot) => (
              <div
                key={slot.id}
                className="p-4 bg-white/80 rounded-lg border border-blue-200 space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Slot Name</label>
                    <input
                      type="text"
                      value={slot.name}
                      onChange={(e) => handleSlotChange(slot.id, "name", e.target.value)}
                      className="mt-1 w-full p-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                      placeholder="Enter slot name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Start Time</label>
                    <input
                      type="time"
                      value={new Date(slot.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
                      onChange={(e) => handleSlotChange(slot.id, "startTime", `1970-01-01T${e.target.value}:00Z`)}
                      className="mt-1 w-full p-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">End Time</label>
                    <input
                      type="time"
                      value={new Date(slot.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
                      onChange={(e) => handleSlotChange(slot.id, "endTime", `1970-01-01T${e.target.value}:00Z`)}
                      className="mt-1 w-full p-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Has Sub-Slots</label>
                    <input
                      type="checkbox"
                      checked={slot.hasSubSlots}
                      onChange={(e) => handleSlotChange(slot.id, "hasSubSlots", e.target.checked)}
                      className="mt-1 h-5 w-5 text-blue-600 border-blue-200 rounded focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            ))
          )}
          <motion.button
            onClick={saveSlotChanges}
            disabled={saving || slots.length === 0}
            className={`mt-6 w-full sm:w-auto px-6 py-3 rounded-lg text-white font-semibold text-lg transition-all duration-200 ${
              saving || slots.length === 0 ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
            }`}
            whileHover={{ scale: saving || slots.length === 0 ? 1 : 1.03 }}
            whileTap={{ scale: saving || slots.length === 0 ? 1 : 0.95 }}
          >
            {saving ? "Saving..." : "Save Slot Changes"}
          </motion.button>
        </>
      )}
    </div>
  );
}