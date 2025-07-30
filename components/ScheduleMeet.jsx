"use client";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

export default function ScheduleMeet({ userDetails, position, closeAllModals }) {
  /* UI state */
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    date: "",
    time: "",
    participants: "",
    description: "",
  });
  const [isBusy, setIsBusy] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [users, setUsers] = useState([]);

  /* fetch teammate emails once for convenience/autocomplete */
  useEffect(() => {
    fetch("/api/member/users")
      .then((r) => r.json())
      .then(({ users }) => setUsers(users || []))
      .catch(() => {});
  }, []);

  const today = format(new Date(), "yyyy-MM-dd");
  const clearMsg = () => setMsg({ type: "", text: "" });

  /* handle input */
  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  /* submit */
  const handleSubmit = async (e) => {
    e.preventDefault();
    clearMsg();
    if (!userDetails?.id) return setMsg({ type: "error", text: "Not authenticated" });
    setIsBusy(true);
    try {
      const res = await fetch("/api/others/schedule-meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, userId: userDetails.id }),
      });
      if (!res.ok) throw new Error("Failed to schedule meeting");
      const { meetingId } = await res.json();
      setMsg({ type: "success", text: `Meeting scheduled! ID: ${meetingId}` });
      setForm({ title: "", date: "", time: "", participants: "", description: "" });
      setIsOpen(false);
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setIsBusy(false);
    }
  };

  /* ============ UI ============ */
  return (
    <AnimatePresence>
      {/* floating scheduler FAB */}
      {!isOpen && (
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            closeAllModals();
            setIsOpen(true);
          }}
          title="Schedule a meeting"
          className="p-4 bg-gradient-to-r from-green-500 to-lime-600 text-white rounded-full shadow-lg hover:scale-105"
        >
          📅
        </motion.button>
      )}

      {/* panel */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed bg-white p-4 rounded-lg shadow-xl w-[400px] max-h-[65vh] overflow-y-auto border z-50"
          style={{ right: `${position.x}px`, bottom: `${-position.y + 160}px` }}
        >
          <div className="flex justify-between items-center mb-4 bg-green-600 text-white p-3 -m-4 rounded-t-lg">
            <h2 className="font-semibold">Schedule Meeting (Later)</h2>
            <button onClick={() => setIsOpen(false)}>✕</button>
          </div>

          {msg.text && (
            <p
              className={`text-sm mb-2 ${
                msg.type === "error" ? "text-red-600" : "text-green-600"
              }`}
            >
              {msg.text}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-2">
            <input
              name="title"
              placeholder="Title"
              value={form.title}
              onChange={handleChange}
              required
              className="w-full p-2 border rounded"
            />
            <input
              type="date"
              name="date"
              min={today}
              value={form.date}
              onChange={handleChange}
              required
              className="w-full p-2 border rounded"
            />
            <input
              type="time"
              name="time"
              value={form.time}
              onChange={handleChange}
              required
              className="w-full p-2 border rounded"
            />
            <input
              name="participants"
              placeholder="Emails (comma‑sep)"
              value={form.participants}
              onChange={handleChange}
              required
              className="w-full p-2 border rounded"
            />
            <textarea
              name="description"
              placeholder="Description (optional)"
              rows={3}
              value={form.description}
              onChange={handleChange}
              className="w-full p-2 border rounded"
            />

            <button
              disabled={isBusy}
              className="w-full p-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
            >
              {isBusy ? "Scheduling…" : "Schedule Meeting"}
            </button>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
