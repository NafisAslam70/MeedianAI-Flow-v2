"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";

export default function ManageCalendar({
  calendar,
  loading,
  saving,
  onCalendarChange,
  onSaveCalendar,
  onAddEntry,
  onDeleteEntry,
  error,
  success,
  setError,
  setSuccess,
}) {
  const [editingEntry, setEditingEntry] = useState(null);
  const [newWeek, setNewWeek] = useState({ startDate: "", endDate: "", name: "General", majorTerm: "", minorTerm: "", weekNumber: "" });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const currentDate = new Date("2025-07-22");

  useEffect(() => {
    console.log("Calendar data received:", calendar);
  }, [calendar]);

  const handleChange = (field, value) => {
    setNewWeek((prev) => ({ ...prev, [field]: value }));
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setNewWeek({
      startDate: entry.startDate ? new Date(entry.startDate).toISOString().split("T")[0] : "",
      endDate: entry.endDate ? new Date(entry.endDate).toISOString().split("T")[0] : "",
      name: entry.name || "General",
      majorTerm: entry.majorTerm || "",
      minorTerm: entry.minorTerm || "",
      weekNumber: entry.weekNumber !== undefined && entry.weekNumber !== null ? entry.weekNumber.toString() : "",
    });
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditingEntry(null);
    setNewWeek({ startDate: "", endDate: "", name: "General", majorTerm: "", minorTerm: "", weekNumber: "" });
    setIsModalOpen(true);
  };

  const handleSaveEdit = () => {
    if (editingEntry && newWeek.startDate && newWeek.endDate && newWeek.name && newWeek.majorTerm && newWeek.minorTerm) {
      onCalendarChange(editingEntry.id, "startDate", newWeek.startDate);
      onCalendarChange(editingEntry.id, "endDate", newWeek.endDate);
      onCalendarChange(editingEntry.id, "name", newWeek.name);
      onCalendarChange(editingEntry.id, "majorTerm", newWeek.majorTerm);
      onCalendarChange(editingEntry.id, "minorTerm", newWeek.minorTerm);
      onCalendarChange(editingEntry.id, "weekNumber", newWeek.weekNumber ? parseInt(newWeek.weekNumber) : null);
      setEditingEntry(null);
      setNewWeek({ startDate: "", endDate: "", name: "General", majorTerm: "", minorTerm: "", weekNumber: "" });
      setIsModalOpen(false);
    }
  };

  const handleAddWeek = () => {
    if (newWeek.startDate && newWeek.endDate && newWeek.name && newWeek.majorTerm && newWeek.minorTerm) {
      onAddEntry({
        id: Date.now(),
        majorTerm: newWeek.majorTerm,
        minorTerm: newWeek.minorTerm,
        startDate: newWeek.startDate,
        endDate: newWeek.endDate,
        name: newWeek.name,
        weekNumber: newWeek.weekNumber ? parseInt(newWeek.weekNumber) : null,
        isMajorTermBoundary: false,
      });
      setNewWeek({ startDate: "", endDate: "", name: "General", majorTerm: "", minorTerm: "", weekNumber: "" });
      setIsModalOpen(false);
    }
  };

  const handleDelete = (id) => {
    onDeleteEntry(id);
  };

  const getWeekNumber = (entry) => {
    if (entry.weekNumber !== undefined && entry.weekNumber !== null) {
      return entry.weekNumber;
    }
    if (!entry.startDate) return 0;
    const d = new Date(entry.startDate);
    d.setHours(0, 0, 0, 0);
    const start = new Date("2025-04-07");
    const diff = d - start;
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    const week = Math.floor(diff / oneWeek);
    return week >= 0 ? week + 1 : 1;
  };

  const getWeekColor = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < currentDate) return "bg-red-100 text-red-800"; // Past weeks
    if (start <= currentDate && end >= currentDate) return "bg-green-100 text-green-800"; // Current week
    return "bg-white text-gray-800"; // Upcoming weeks
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "Not Set";
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  if (loading) return <p className="text-gray-600 text-center text-lg">Loading school calendar...</p>;

  if (!calendar || calendar.length === 0) {
    return (
      <p className="text-gray-600 text-center text-lg">
        No calendar data available. Please add entries or check the API.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        {/* SA1 Column (Term 1) */}
        <div className="flex-1 bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 rounded-2xl shadow-lg p-6">
          <h2 className="text-xl font-semibold text-teal-900 mb-4">SA1 (Term 1)</h2>
          <div className="space-y-4">
            {/* Before FA1 */}
            <div className="bg-white rounded-lg p-4 shadow-inner">
              <h3 className="font-medium text-gray-700 mb-2">Before FA1</h3>
              <motion.button
                onClick={handleAdd}
                className="w-full sm:w-auto px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all duration-200 mb-2"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
              >
                Add Week
              </motion.button>
              {calendar
                .filter((c) => c.majorTerm === "Term 1" && c.minorTerm === "Before FA1")
                .map((entry, index) => (
                  <motion.div
                    key={entry.id}
                    className={`rounded-lg p-2 mb-2 cursor-pointer flex justify-between items-center ${getWeekColor(entry.startDate, entry.endDate)}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div onClick={() => handleEdit(entry)}>
                      <p>
                        Week {getWeekNumber(entry)}: {formatDate(entry.startDate)} -{" "}
                        {formatDate(entry.endDate)} ({entry.name})
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <motion.button
                        onClick={() => handleEdit(entry)}
                        className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        Edit
                      </motion.button>
                      <motion.button
                        onClick={() => handleDelete(entry.id)}
                        className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        Delete
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
            </div>
            {/* After FA1 */}
            <div className="bg-white rounded-lg p-4 shadow-inner">
              <h3 className="font-medium text-gray-700 mb-2">After FA1</h3>
              <motion.button
                onClick={handleAdd}
                className="w-full sm:w-auto px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all duration-200 mb-2"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
              >
                Add Week
              </motion.button>
              {calendar
                .filter((c) => c.majorTerm === "Term 1" && c.minorTerm === "After FA1")
                .map((entry, index) => (
                  <motion.div
                    key={entry.id}
                    className={`rounded-lg p-2 mb-2 cursor-pointer flex justify-between items-center ${getWeekColor(entry.startDate, entry.endDate)}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div onClick={() => handleEdit(entry)}>
                      <p>
                        Week {getWeekNumber(entry)}: {formatDate(entry.startDate)} -{" "}
                        {formatDate(entry.endDate)} ({entry.name})
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <motion.button
                        onClick={() => handleEdit(entry)}
                        className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        Edit
                      </motion.button>
                      <motion.button
                        onClick={() => handleDelete(entry.id)}
                        className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        Delete
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
            </div>
          </div>
        </div>

        {/* SA2 Column (Term 2) */}
        <div className="flex-1 bg-gradient-to-br from-teal-50 via-blue-50 to-gray-100 rounded-2xl shadow-lg p-6">
          <h2 className="text-xl font-semibold text-teal-900 mb-4">SA2 (Term 2)</h2>
          <div className="space-y-4">
            {/* Before FA2 */}
            <div className="bg-white rounded-lg p-4 shadow-inner">
              <h3 className="font-medium text-gray-700 mb-2">Before FA2</h3>
              <motion.button
                onClick={handleAdd}
                className="w-full sm:w-auto px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all duration-200 mb-2"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
              >
                Add Week
              </motion.button>
              {calendar
                .filter((c) => c.majorTerm === "Term 2" && c.minorTerm === "Before FA2")
                .map((entry, index) => (
                  <motion.div
                    key={entry.id}
                    className={`rounded-lg p-2 mb-2 cursor-pointer flex justify-between items-center ${getWeekColor(entry.startDate, entry.endDate)}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div onClick={() => handleEdit(entry)}>
                      <p>
                        Week {getWeekNumber(entry)}: {formatDate(entry.startDate)} -{" "}
                        {formatDate(entry.endDate)} ({entry.name})
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <motion.button
                        onClick={() => handleEdit(entry)}
                        className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        Edit
                      </motion.button>
                      <motion.button
                        onClick={() => handleDelete(entry.id)}
                        className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        Delete
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
            </div>
            {/* After FA2 */}
            <div className="bg-white rounded-lg p-4 shadow-inner">
              <h3 className="font-medium text-gray-700 mb-2">After FA2</h3>
              <motion.button
                onClick={handleAdd}
                className="w-full sm:w-auto px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all duration-200 mb-2"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
              >
                Add Week
              </motion.button>
              {calendar
                .filter((c) => c.majorTerm === "Term 2" && c.minorTerm === "After FA2")
                .map((entry, index) => (
                  <motion.div
                    key={entry.id}
                    className={`rounded-lg p-2 mb-2 cursor-pointer flex justify-between items-center ${getWeekColor(entry.startDate, entry.endDate)}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div onClick={() => handleEdit(entry)}>
                      <p>
                        Week {getWeekNumber(entry)}: {formatDate(entry.startDate)} -{" "}
                        {formatDate(entry.endDate)} ({entry.name})
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <motion.button
                        onClick={() => handleEdit(entry)}
                        className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        Edit
                      </motion.button>
                      <motion.button
                        onClick={() => handleDelete(entry.id)}
                        className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        Delete
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal for Adding/Editing Weeks */}
      {isModalOpen && (
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
            <h2 className="text-xl font-bold text-gray-800 mb-4">{editingEntry ? "Edit Week" : "Add Week"}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Major Term</label>
                <select
                  value={newWeek.majorTerm}
                  onChange={(e) => handleChange("majorTerm", e.target.value)}
                  className="mt-1 w-full p-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-base"
                >
                  <option value="">Select Major Term</option>
                  <option value="Term 1">Term 1</option>
                  <option value="Term 2">Term 2</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Minor Term</label>
                <select
                  value={newWeek.minorTerm}
                  onChange={(e) => handleChange("minorTerm", e.target.value)}
                  className="mt-1 w-full p-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-base"
                >
                  <option value="">Select Minor Term</option>
                  <option value="Before FA1">Before FA1</option>
                  <option value="After FA1">After FA1</option>
                  <option value="Before FA2">Before FA2</option>
                  <option value="After FA2">After FA2</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Start Date</label>
                <input
                  type="date"
                  value={newWeek.startDate}
                  onChange={(e) => handleChange("startDate", e.target.value)}
                  className="mt-1 w-full p-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">End Date</label>
                <input
                  type="date"
                  value={newWeek.endDate}
                  onChange={(e) => handleChange("endDate", e.target.value)}
                  className="mt-1 w-full p-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Week Type</label>
                <select
                  value={newWeek.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className="mt-1 w-full p-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-base"
                >
                  <option value="General">General</option>
                  <option value="Exam">Exam</option>
                  <option value="Event">Event</option>
                  <option value="Holiday">Holiday</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Week Number (optional)</label>
                <input
                  type="number"
                  value={newWeek.weekNumber}
                  onChange={(e) => handleChange("weekNumber", e.target.value)}
                  className="mt-1 w-full p-2 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-base"
                  placeholder="Enter custom week number"
                  min="1"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <motion.button
                onClick={() => {
                  setEditingEntry(null);
                  setNewWeek({ startDate: "", endDate: "", name: "General", majorTerm: "", minorTerm: "", weekNumber: "" });
                  setIsModalOpen(false);
                }}
                className="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-all duration-200"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
              >
                Cancel
              </motion.button>
              <motion.button
                onClick={editingEntry ? handleSaveEdit : handleAddWeek}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
              >
                {editingEntry ? "Save Changes" : "Add Week"}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}

      <motion.button
        onClick={onSaveCalendar}
        disabled={saving || calendar.length === 0}
        className={`mt-6 w-full sm:w-auto px-6 py-3 rounded-2xl text-white font-semibold text-lg transition-all duration-200 bg-purple-600 hover:bg-purple-700 shadow-md ${
          saving || calendar.length === 0 ? "cursor-not-allowed opacity-50" : ""
        }`}
        whileHover={{ scale: saving || calendar.length === 0 ? 1 : 1.03 }}
        whileTap={{ scale: saving || calendar.length === 0 ? 1 : 0.95 }}
      >
        {saving ? "Saving..." : "Save Calendar"}
      </motion.button>
      {(error || success) && (
        <motion.p
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={`text-lg font-medium p-4 rounded-lg shadow-md ${
            error ? "bg-red-50 text-red-600" : "bg-teal-50 text-teal-600"
          }`}
          onClick={() => {
            setError("");
            setSuccess("");
          }}
        >
          {error || success} (Click to dismiss)
        </motion.p>
      )}
    </div>
  );
}