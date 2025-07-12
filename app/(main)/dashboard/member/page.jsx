"use client";
import { useEffect, useState } from "react";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { motion, AnimatePresence } from "framer-motion";

const closingWindows = {
  residential: { start: "19:30", end: "20:00" },
  non_residential: { start: "12:00", end: "12:30" },
  semi_residential: { start: "17:30", end: "18:00" },
};

function getClosingWindow(type) {
  const today = new Date().toISOString().split("T")[0];
  const { start, end } = closingWindows[type] || closingWindows.residential;
  return {
    startTime: new Date(`${today}T${start}:00`),
    endTime: new Date(`${today}T${end}:00`),
  };
}

export default function MemberDashboard() {
  const [routineTasks, setRoutineTasks] = useState([]);
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedRecipient, setSelectedRecipient] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [memberType, setMemberType] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [isDayClosed, setIsDayClosed] = useState(false);
  const [userDetails, setUserDetails] = useState({ name: "", email: "", id: null });
  const [showRoutineView, setShowRoutineView] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const sessionRes = await fetch("/api/auth/session");
      const session = await sessionRes.json();
      if (!session.user || session.user.role !== "member") {
        console.error("Unauthorized access");
        setLoading(false);
        return;
      }
      setUserDetails({
        name: session.user.name || "Member",
        email: session.user.email || "N/A",
        id: session.user.id || null,
      });
      setMemberType(session.user.type || "residential");

      const routineRes = await fetch("/api/member/routine-status");
      const routineData = await routineRes.json();
      if (routineData.error) {
        console.error("Error fetching routine tasks:", routineData.error);
        setRoutineTasks([]);
      } else {
        setRoutineTasks(routineData.tasks || []);
        setLocked(routineData.locked || false);
        setIsDayClosed(routineData.isDayClosed || false);
      }

      const assignedRes = await fetch("/api/member/assigned-tasks");
      const assignedData = await assignedRes.json();
      if (assignedData.error) {
        console.error("Error fetching assigned tasks:", assignedData.error);
        setAssignedTasks([]);
      } else {
        setAssignedTasks(assignedData.tasks || []);
      }

      const usersRes = await fetch("/api/member/users");
      const usersData = await usersRes.json();
      if (usersData.error) {
        console.error("Error fetching users:", usersData.error);
        setUsers([]);
      } else {
        setUsers(usersData.users || []);
      }

      const messagesRes = await fetch("/api/member/messages");
      const messagesData = await messagesRes.json();
      if (messagesData.error) {
        console.error("Error fetching messages:", messagesData.error);
        setMessages([]);
      } else {
        setMessages(messagesData.messages || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setRoutineTasks([]);
      setAssignedTasks([]);
      setUsers([]);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRoutineStatusChange = async (id, newStatus) => {
    try {
      const res = await fetch("/api/member/routine-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });

      if (res.ok) {
        setRoutineTasks((prev) =>
          prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t))
        );
      } else {
        console.error("Error updating routine task status");
        alert("Failed to update task status.");
      }
    } catch (error) {
      console.error("Error updating routine task status:", error);
      alert("Failed to update task status.");
    }
  };

  const handleAssignedStatusChange = async (id, newStatus) => {
    try {
      const res = await fetch("/api/member/assigned-tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });

      if (res.ok) {
        setAssignedTasks((prev) =>
          prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t))
        );
      } else {
        console.error("Error updating assigned task status");
        alert("Failed to update task status.");
      }
    } catch (error) {
      console.error("Error updating assigned task status:", error);
      alert("Failed to update task status.");
    }
  };

  const handleDayClose = async () => {
    try {
      const res = await fetch("/api/member/day-close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        setIsDayClosed(true);
        setLocked(true);
        alert("Day closed successfully!");
      } else {
        console.error("Error closing day");
        alert("Failed to close day.");
      }
    } catch (error) {
      console.error("Error closing day:", error);
      alert("Failed to close day.");
    }
  };

  const handleSendMessage = async () => {
    if (!selectedRecipient || !messageContent.trim()) {
      alert("Please select a recipient and enter a message.");
      return;
    }

    try {
      const res = await fetch("/api/member/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: selectedRecipient,
          content: messageContent,
        }),
      });

      if (res.ok) {
        const newMessage = await res.json();
        setMessages((prev) => [...prev, newMessage.message]);
        setMessageContent("");
        alert("Message sent successfully!");
      } else {
        console.error("Error sending message");
        alert("Failed to send message.");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message.");
    }
  };

  useEffect(() => {
    fetchData();

    const interval = setInterval(() => {
      const now = new Date();
      if (memberType) {
        const { startTime, endTime } = getClosingWindow(memberType);
        const timeToClose = Math.max(0, endTime - now);
        setTimeLeft(timeToClose > 0 ? Math.floor(timeToClose / 1000) : 0);

        if (now >= startTime && now <= endTime && !locked) {
          fetchData();
        }
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [memberType, locked]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen bg-gray-50 flex items-start justify-center p-4 pt-1"
    >
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-7xl flex flex-col">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6 text-center"
        >
          <h2 className="text-3xl font-bold text-teal-900">
            Welcome, {userDetails.name}!
          </h2>
          <p className="text-sm text-gray-600 mt-2">
            Email: {userDetails.email} | Type: {memberType || "N/A"}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Today: {new Date().toLocaleDateString()}
          </p>
        </motion.div>

        {/* Closing Window */}
        {memberType && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="mb-6 text-sm text-gray-600 bg-teal-50 p-4 rounded-lg shadow border border-teal-200"
          >
            <p>
              <strong>Closing Window ({memberType}):</strong>{" "}
              {closingWindows[memberType]?.start} to {closingWindows[memberType]?.end}
            </p>
            {timeLeft !== null && timeLeft > 0 && (
              <p className="text-green-600 mt-1">
                ⏳ Time left: {Math.floor(timeLeft / 60)}m {timeLeft % 60}s
              </p>
            )}
          </motion.div>
        )}

        {/* Tasks Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Routine Tasks */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="bg-white rounded-xl shadow-md p-6 border border-teal-200"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-teal-900">Routine Tasks</h3>
              <button
                onClick={() => setShowRoutineView(true)}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all duration-300 text-sm font-semibold"
              >
                Show My Routine
              </button>
            </div>
            {loading ? (
              <p className="text-gray-500">Loading...</p>
            ) : routineTasks.length === 0 ? (
              <p className="text-gray-500">No routine tasks assigned for today.</p>
            ) : (
              <ul className="space-y-4">
                {routineTasks.slice(0, 5).map((task, index) => (
                  <motion.li
                    key={task.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className="flex items-center justify-between bg-teal-50 p-4 rounded-lg border border-teal-200 hover:bg-teal-100 transition-all duration-300"
                  >
                    <div className="flex items-center">
                      {task.status === "done" ? (
                        <CheckCircleIcon className="h-6 w-6 text-green-500 mr-2" />
                      ) : (
                        <div className="h-6 w-6 border-2 border-gray-300 rounded-full mr-2" />
                      )}
                      <div>
                        <p className="font-semibold text-teal-900">{task.title}</p>
                        <p className="text-sm text-gray-500">{task.description}</p>
                      </div>
                    </div>
                    <select
                      disabled={locked || isDayClosed || task.isLocked}
                      className="p-2 border rounded text-sm"
                      value={task.status}
                      onChange={(e) => handleRoutineStatusChange(task.id, e.target.value)}
                    >
                      <option value="not_started">⛔ Not Started</option>
                      <option value="in_progress">🔄 In Progress</option>
                      <option value="done">✅ Done</option>
                    </select>
                  </motion.li>
                ))}
              </ul>
            )}
          </motion.div>

          {/* Assigned Tasks */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="bg-white rounded-xl shadow-md p-6 border border-teal-200"
          >
            <h3 className="text-lg font-semibold text-teal-900 mb-4">Assigned Tasks</h3>
            {loading ? (
              <p className="text-gray-500">Loading...</p>
            ) : assignedTasks.length === 0 ? (
              <p className="text-gray-500">No assigned tasks for today.</p>
            ) : (
              <ul className="space-y-4">
                {assignedTasks.map((task, index) => (
                  <motion.li
                    key={task.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className="flex items-center justify-between bg-teal-50 p-4 rounded-lg border border-teal-200 hover:bg-teal-100 transition-all duration-300"
                  >
                    <div>
                      <p className="font-semibold text-teal-900">{task.title}</p>
                      <p className="text-sm text-gray-500">{task.description}</p>
                    </div>
                    <select
                      disabled={locked || isDayClosed}
                      className="p-2 border rounded text-sm"
                      value={task.status}
                      onChange={(e) => handleAssignedStatusChange(task.id, e.target.value)}
                    >
                      <option value="not_started">⛔ Not Started</option>
                      <option value="in_progress">🔄 In Progress</option>
                      <option value="done">✅ Done</option>
                    </select>
                  </motion.li>
                ))}
              </ul>
            )}
          </motion.div>
        </div>

        {/* Routine Tasks Full View */}
        <AnimatePresence>
          {showRoutineView && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4"
            >
              <motion.div
                className="bg-white rounded-xl shadow-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto border border-teal-200"
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-teal-900">My Routine Tasks</h3>
                  <button
                    onClick={() => setShowRoutineView(false)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-300 text-sm font-semibold"
                  >
                    Close (Current Time: {new Date().toLocaleTimeString()})
                  </button>
                </div>
                {loading ? (
                  <p className="text-gray-500">Loading...</p>
                ) : routineTasks.length === 0 ? (
                  <p className="text-gray-500">No routine tasks assigned.</p>
                ) : (
                  <ul className="space-y-4">
                    {routineTasks.map((task, index) => (
                      <motion.li
                        key={task.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                        className="flex items-center justify-between bg-teal-50 p-4 rounded-lg border border-teal-200 hover:bg-teal-100 transition-all duration-300"
                      >
                        <div className="flex items-center">
                          {task.status === "done" ? (
                            <CheckCircleIcon className="h-6 w-6 text-green-500 mr-2" />
                          ) : (
                            <div className="h-6 w-6 border-2 border-gray-300 rounded-full mr-2" />
                          )}
                          <div>
                            <p className="font-semibold text-teal-900">{task.title}</p>
                            <p className="text-sm text-gray-500">{task.description}</p>
                          </div>
                        </div>
                        <select
                          disabled={locked || isDayClosed || task.isLocked}
                          className="p-2 border rounded text-sm"
                          value={task.status}
                          onChange={(e) => handleRoutineStatusChange(task.id, e.target.value)}
                        >
                          <option value="in_progress">🔄 In Progress</option>
                          <option value="done">✅ Done</option>
                        </select>
                      </motion.li>
                    ))}
                  </ul>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messaging Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          className="bg-white rounded-xl shadow-md p-6 mb-6 border border-teal-200"
        >
          <h3 className="text-lg font-semibold text-teal-900 mb-4">Messages</h3>
          {loading ? (
            <p className="text-gray-500">Loading...</p>
          ) : (
            <>
              <div className="mb-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <select
                    className="p-2 border rounded w-full sm:w-1/3 text-sm"
                    value={selectedRecipient}
                    onChange={(e) => setSelectedRecipient(e.target.value)}
                  >
                    <option value="">Select Recipient</option>
                    {users.map((user) => (
                      <motion.option
                        key={user.id}
                        value={user.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                      >
                        {user.name} ({user.role === "admin" ? "Admin" : user.type})
                      </motion.option>
                    ))}
                  </select>
                  <input
                    type="text"
                    className="p-2 border rounded w-full sm:w-2/3 text-sm"
                    placeholder="Type your message..."
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                  />
                  <button
                    onClick={handleSendMessage}
                    className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all duration-300 text-sm font-semibold"
                  >
                    Send
                  </button>
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto border-t pt-4">
                {messages.length === 0 ? (
                  <p className="text-gray-500">No messages yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {messages.map((msg, index) => (
                      <motion.li
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                        className={`p-2 rounded ${
                          msg.senderId === parseInt(userDetails.id)
                            ? "bg-blue-100 text-right"
                            : "bg-gray-100 text-left"
                        } border border-teal-200`}
                      >
                        <p className="text-sm font-semibold text-teal-900">
                          {msg.senderId === parseInt(userDetails.id)
                            ? "You"
                            : msg.senderName || "Unknown"}
                          {" → "}
                          {msg.recipientId === parseInt(userDetails.id) ? "You" : "Other"}
                        </p>
                        <p className="text-sm">{msg.content}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(msg.createdAt).toLocaleString()}
                        </p>
                      </motion.li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </motion.div>

        {/* Lock Warning and Day Close Button */}
        {locked && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="text-sm text-red-500 mb-4 text-center"
          >
            Task updates are locked for today.
          </motion.p>
        )}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.5 }}
          className="text-center"
        >
          <button
            onClick={handleDayClose}
            disabled={isDayClosed || locked}
            className={`px-6 py-2 rounded-lg text-sm font-semibold ${
              isDayClosed || locked
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-teal-600 text-white hover:bg-teal-700 hover:shadow-lg transition-all duration-300"
            }`}
          >
            Close Day
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}