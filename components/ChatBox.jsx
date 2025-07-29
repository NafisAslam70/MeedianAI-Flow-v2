"use client";
import { useEffect, useState, useRef } from "react";
import { ChatBubbleLeftRightIcon, PaperAirplaneIcon, ClockIcon } from "@heroicons/react/24/solid";
import { motion, AnimatePresence } from "framer-motion";
import ScheduleMeet from "@/components/ScheduleMeet";

export default function ChatBox({ userDetails }) {
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedRecipient, setSelectedRecipient] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [showChatbox, setShowChatbox] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState(null);
  const chatboxRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [chatboxPosition, setChatboxPosition] = useState({ x: 20, y: -20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [unreadCounts, setUnreadCounts] = useState({});
  const audioRef = useRef(null);
  const [hasUnread, setHasUnread] = useState(false);

  const fetchData = async () => {
    try {
      const usersRes = await fetch("/api/member/users");
      const usersData = await usersRes.json();
      if (usersData.error || !usersData.users) {
        console.error("Error fetching users:", usersData.error);
        setError("Failed to fetch users.");
        setUsers([]);
      } else {
        setUsers(usersData.users);
      }

      const messagesRes = await fetch(`/api/others/chat?userId=${userDetails.id}`);
      const messagesData = await messagesRes.json();
      if (messagesData.error || !Array.isArray(messagesData.messages)) {
        console.error("Error fetching messages:", messagesData.error);
        setError(messagesData.error || "Failed to fetch messages.");
        setMessages([]);
      } else {
        const newMessages = messagesData.messages;
        const previousLength = messages.length;
        setMessages(newMessages);
        if (newMessages.length > previousLength && !showChatbox && !showHistory) {
          playNotificationSound();
          updateUnreadCounts(newMessages);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setError(error.message || "Error fetching data. Please try again.");
      setUsers([]);
      setMessages([]);
    }
  };

  useEffect(() => {
    if (!userDetails?.id) return;
    fetchData();
    const interval = setInterval(fetchData, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [userDetails?.id]);

  useEffect(() => {
    audioRef.current = new Audio('/sms.mp3'); // Your local file path
    audioRef.current.preload = 'auto'; // Preload the audio
    return () => {
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0; // Reset to start to prevent overlapping
      audioRef.current.play().catch((err) => console.error("Audio play error:", err));
    }
  };

  const updateUnreadCounts = (newMessages) => {
    const unread = newMessages.reduce((acc, msg) => {
      if (msg.recipientId === parseInt(userDetails.id) && msg.status === "sent") {
        const senderId = msg.senderId;
        acc[senderId] = (acc[senderId] || 0) + 1;
      }
      return acc;
    }, {});
    setUnreadCounts(unread);
    const totalUnread = Object.values(unread).reduce((sum, count) => sum + count, 0);
    setHasUnread(totalUnread > 0);
  };

  const markAsRead = async (recipientId) => {
    try {
      const unreadMessages = messages.filter(
        (msg) => msg.senderId === parseInt(recipientId) && msg.recipientId === parseInt(userDetails.id) && msg.status === "sent"
      );

      for (const msg of unreadMessages) {
        await fetch("/api/others/chat", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageId: msg.id,
            status: "read",
          }),
        });
      }
      setUnreadCounts((prev) => ({ ...prev, [recipientId]: 0 }));
      const totalUnread = Object.values({...unreadCounts, [recipientId]: 0}).reduce((sum, count) => sum + count, 0);
      setHasUnread(totalUnread > 0);
      fetchData(); // Refresh messages
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedRecipient || !messageContent.trim()) {
      setError("Please select a recipient and enter a message.");
      return;
    }

    try {
      const newMessage = {
        senderId: parseInt(userDetails.id),
        recipientId: parseInt(selectedRecipient),
        content: messageContent,
        createdAt: new Date().toISOString(),
        status: "sent",
        id: `temp-${Date.now()}`,
      };

      setMessages((prev) => [...prev, newMessage]);
      setMessageContent("");
      setError(null);

      const res = await fetch("/api/others/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userDetails.id,
          recipientId: selectedRecipient,
          message: messageContent,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to send message");
      }

      const { message: serverMessage } = await res.json();
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === newMessage.id ? { ...msg, id: serverMessage.id } : msg
        )
      );
    } catch (error) {
      console.error("Error sending message:", error);
      setError(error.message || "Failed to send message.");
    }
  };

  const handleMouseDown = (e) => {
    if (e.target.closest(".chatbox-header")) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - chatboxPosition.x,
        y: e.clientY - chatboxPosition.y,
      });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setChatboxPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragStart]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getUserDisplayRole = (user) => {
    if (user.role === "admin") return "Admin";
    if (user.role === "team_manager") {
      return `Team Manager${user.team_manager_type ? ` (${user.team_manager_type.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")})` : ""}`;
    }
    return user.type
      ? user.type
          .split("_")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ")
      : "Member";
  };

  const getChatHistoryUsers = () => {
    const chattedUserIds = new Set(
      messages
        .filter(
          (msg) =>
            msg.senderId === parseInt(userDetails.id) ||
            msg.recipientId === parseInt(userDetails.id)
        )
        .map((msg) =>
          msg.senderId === parseInt(userDetails.id)
            ? msg.recipientId
            : msg.senderId
        )
        .filter((id) => id !== parseInt(userDetails.id))
    );

    return users
      .filter((user) => chattedUserIds.has(user.id))
      .map((user) => {
        const userMessages = messages
          .filter(
            (msg) =>
              (msg.senderId === parseInt(userDetails.id) &&
                msg.recipientId === user.id) ||
              (msg.senderId === user.id &&
                msg.recipientId === parseInt(userDetails.id))
          )
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return {
          ...user,
          lastMessage: userMessages[0],
          unread: unreadCounts[user.id] || 0,
        };
      });
  };

  const closeAllModals = () => {
    setShowChatbox(false);
    setShowHistory(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed z-50"
      style={{ right: `${chatboxPosition.x}px`, bottom: `${-chatboxPosition.y + 40}px` }}
      ref={chatboxRef}
    >
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="absolute top-4 left-4 right-4 text-red-600 text-sm font-medium bg-red-50 p-3 rounded-lg shadow-md z-10"
        >
          {error}
        </motion.p>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => {
            closeAllModals();
            setShowChatbox(true);
          }}
          className="p-4 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-full shadow-lg hover:from-teal-600 hover:to-cyan-700 transition-all duration-300 transform hover:scale-105"
          title="Open Chat"
        >
          <ChatBubbleLeftRightIcon className="h-6 w-6" />
        </button>
        <motion.button
          animate={hasUnread ? { rotate: [0, -10, 10, -10, 10, 0] } : {}}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          onClick={() => {
            closeAllModals();
            setShowHistory(true);
          }}
          className="p-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-full shadow-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105"
          title="Chat History"
        >
          <ClockIcon className="h-6 w-6" />
        </motion.button>
        <ScheduleMeet userDetails={userDetails} position={chatboxPosition} closeAllModals={closeAllModals} />
      </div>
      <AnimatePresence>
        {showChatbox && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-2xl shadow-2xl p-6 w-[400px] max-h-[70vh] overflow-hidden border border-teal-100 mt-4 flex flex-col"
          >
            <div
              className="chatbox-header flex justify-between items-center mb-4 cursor-move bg-gradient-to-r from-teal-500 to-cyan-600 text-white p-4 rounded-t-xl"
              onMouseDown={handleMouseDown}
            >
              <h3 className="text-xl font-semibold">Messages</h3>
              <button
                onClick={() => setShowChatbox(false)}
                className="text-white hover:text-gray-200 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="mb-4">
              <select
                className="p-3 border border-gray-200 rounded-lg w-full text-md bg-gray-50 focus:ring-2 focus:ring-teal-500 transition-all"
                value={selectedRecipient}
                onChange={(e) => setSelectedRecipient(e.target.value)}
              >
                <option value="">Select Recipient</option>
                {users
                  .filter((user) => user.id !== parseInt(userDetails.id))
                  .map((user) => (
                    <motion.option
                      key={user.id}
                      value={user.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      {user.name} ({getUserDisplayRole(user)})
                    </motion.option>
                  ))}
              </select>
            </div>
            <div className="flex-1 max-h-[50vh] overflow-y-auto pr-2">
              {messages.length === 0 || !selectedRecipient ? (
                <p className="text-gray-500 text-md text-center">
                  {selectedRecipient ? "No messages yet." : "Select a recipient to view messages."}
                </p>
              ) : (
                <ul className="space-y-3">
                  {messages
                    .filter(
                      (msg) =>
                        (msg.senderId === parseInt(userDetails.id) &&
                          msg.recipientId === parseInt(selectedRecipient)) ||
                        (msg.senderId === parseInt(selectedRecipient) &&
                          msg.recipientId === parseInt(userDetails.id))
                    )
                    .slice(-20)
                    .map((msg, index) => (
                      <motion.li
                        key={msg.id || index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className={`p-4 rounded-xl ${
                          msg.senderId === parseInt(userDetails.id)
                            ? "bg-teal-100 text-right ml-8"
                            : "bg-gray-100 text-left mr-8"
                        } border border-teal-100 relative`}
                      >
                        <p className="text-sm font-semibold text-teal-900">
                          {msg.senderId === parseInt(userDetails.id)
                            ? "You"
                            : users.find((u) => u.id === msg.senderId)?.name || "Unknown"}
                        </p>
                        <p className="text-sm">{msg.content}</p>
                        <div className="flex justify-between items-center mt-1">
                          <p className="text-xs text-gray-400">
                            {new Date(msg.createdAt).toLocaleTimeString()}
                          </p>
                          {msg.senderId === parseInt(userDetails.id) && (
                            <span className="text-xs text-gray-500">
                              {msg.status === "sent" ? "✓" : msg.status === "read" ? "✓✓" : ""}
                            </span>
                          )}
                        </div>
                      </motion.li>
                    ))}
                  <div ref={messagesEndRef} />
                </ul>
              )}
            </div>
            <div className="mt-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  className="p-3 border border-gray-200 rounded-lg flex-1 text-md bg-gray-50 focus:ring-2 focus:ring-teal-500 transition-all"
                  placeholder="Type your message..."
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                />
                <button
                  onClick={handleSendMessage}
                  className="p-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg hover:from-teal-600 hover:to-cyan-700 transition-all duration-300"
                >
                  <PaperAirplaneIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="fixed bg-white rounded-2xl shadow-2xl p-6 w-[400px] max-h-[60vh] overflow-y-auto border border-blue-100 mt-4 z-50"
            style={{ right: `${chatboxPosition.x}px`, bottom: `${-chatboxPosition.y + 100}px` }}
          >
            <div className="flex justify-between items-center mb-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-4 rounded-t-xl">
              <h3 className="text-xl font-semibold">Chat History</h3>
              <button
                onClick={() => setShowHistory(false)}
                className="text-white hover:text-gray-200 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              {getChatHistoryUsers().length === 0 ? (
                <p className="text-gray-500 text-md text-center">No chat history yet.</p>
              ) : (
                getChatHistoryUsers().map((user) => (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="p-4 bg-gray-50 rounded-lg border border-blue-100 cursor-pointer hover:bg-blue-50 transition-all"
                    onClick={() => {
                      setSelectedRecipient(user.id.toString());
                      closeAllModals();
                      setShowChatbox(true);
                      markAsRead(user.id);
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-semibold text-blue-900">
                          {user.name} ({getUserDisplayRole(user)})
                        </p>
                        <p className="text-xs text-gray-600 truncate max-w-[250px]">
                          {user.lastMessage?.content || "No messages"}
                        </p>
                      </div>
                      <p className="text-xs text-gray-400">
                        {user.lastMessage
                          ? new Date(user.lastMessage.createdAt).toLocaleDateString()
                          : ""}
                      </p>
                    </div>
                    {user.unread > 0 && (
                      <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold rounded-full px-2 py-1">
                        {user.unread}
                      </span>
                    )}
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}