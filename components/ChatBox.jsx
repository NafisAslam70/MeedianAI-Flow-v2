"use client";
import { useEffect, useState, useRef } from "react";
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  ClockIcon,
} from "@heroicons/react/24/solid";
import { motion, AnimatePresence } from "framer-motion";
import ScheduleMeet from "@/components/ScheduleMeet";

/** 🟢 Helper: convert enum / camel to Title‑Case */
const toTitle = (str = "") =>
  str
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

export default function ChatBox({ userDetails }) {
  /* ───────────────────────────────  STATE  ─────────────────────────────── */
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedRecipient, setSelectedRecipient] = useState("");
  const [messageContent, setMessageContent] = useState("");

  const [showChatbox, setShowChatbox] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const [unreadCounts, setUnreadCounts] = useState({});
  const [hasUnread, setHasUnread] = useState(false);

  const [error, setError] = useState(null);

  /* ───────────────────────────────  AUDIO  ─────────────────────────────── */
  const audioRef = useRef(null);

  /* ──────────────────────────────  DRAG & POS  ─────────────────────────── */
  const [chatboxPosition, setChatboxPosition] = useState({ x: 20, y: -20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  /* ───────────────────────────────  REFS  ──────────────────────────────── */
  const messagesEndRef = useRef(null);

  /* ───────────────────────────  INTERNAL BOOK‑KEEP  ────────────────────── */
  const [lastSeenMsgCount, setLastSeenMsgCount] = useState(0);
  const [shakeKey, setShakeKey] = useState(0); // changes to trigger shake animation

  /* ─────────────────────────────  HELPERS  ─────────────────────────────── */
  const playNotificationSound = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch((e) => console.error("Audio error:", e));
  };

  const scrollToBottom = () =>
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  const closeAllModals = () => {
    setShowChatbox(false);
    setShowHistory(false);
  };

  const getDisplayRole = (u) => {
    if (u.role === "admin") return "Admin";
    if (u.role === "team_manager")
      return `Team Manager${u.team_manager_type ? ` (${toTitle(u.team_manager_type)})` : ""}`;
    return u.type ? toTitle(u.type) : "Member";
  };

  /* ───────────────────────────  FETCH DATA  ────────────────────────────── */
  const fetchData = async () => {
    if (!userDetails?.id) return;
    try {
      /* Users list */
      const usersRes = await fetch("/api/member/users");
      const { users: fetchedUsers = [] } = await usersRes.json();
      setUsers(fetchedUsers);

      /* Messages */
      const msgRes = await fetch(`/api/others/chat?userId=${userDetails.id}`);
      const { messages: fetchedMsgs = [] } = await msgRes.json();

      /* Detect new messages */
      if (fetchedMsgs.length > lastSeenMsgCount) {
        setLastSeenMsgCount(fetchedMsgs.length);

        // Only alert if NOT already looking at chat UIs
        if (!showChatbox && !showHistory) {
          playNotificationSound();
          setShakeKey(Date.now()); // trigger one‑time shake
        }
      }
      setMessages(fetchedMsgs);
      updateUnreadCounts(fetchedMsgs);
    } catch (e) {
      console.error(e);
      setError("Failed fetching chat data.");
    }
  };

  /* ────────────────────────────  UNREAD LOGIC  ─────────────────────────── */
  const updateUnreadCounts = (allMsgs) => {
    const counts = allMsgs.reduce((acc, m) => {
      if (
        m.recipientId === Number(userDetails.id) &&
        m.status === "sent" // unread
      ) {
        acc[m.senderId] = (acc[m.senderId] || 0) + 1;
      }
      return acc;
    }, {});
    setUnreadCounts(counts);
    setHasUnread(Object.values(counts).some((c) => c > 0));
  };

  const markThreadRead = async (partnerId) => {
    const unreadInThread = messages.filter(
      (m) =>
        m.senderId === Number(partnerId) &&
        m.recipientId === Number(userDetails.id) &&
        m.status === "sent"
    );

    // Optimistic UI
    setUnreadCounts((prev) => ({ ...prev, [partnerId]: 0 }));
    setHasUnread(
      Object.values({ ...unreadCounts, [partnerId]: 0 }).some((c) => c > 0)
    );

    // Inform backend
    await Promise.all(
      unreadInThread.map((m) =>
        fetch("/api/others/chat", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId: m.id, status: "read" }),
        })
      )
    );
    await fetchData(); // refresh state
  };

  /* ─────────────────────────────  SEND  ────────────────────────────────── */
  const handleSendMessage = async () => {
    if (!selectedRecipient || !messageContent.trim()) {
      setError("Select a recipient and write a message.");
      return;
    }
    try {
      // Temp optimistic message
      const tempId = `tmp-${Date.now()}`;
      const optimistic = {
        id: tempId,
        senderId: Number(userDetails.id),
        recipientId: Number(selectedRecipient),
        content: messageContent,
        createdAt: new Date().toISOString(),
        status: "sent",
      };
      setMessages((prev) => [...prev, optimistic]);
      setMessageContent("");

      const res = await fetch("/api/others/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userDetails.id,
          recipientId: selectedRecipient,
          message: optimistic.content,
        }),
      });
      const { message: saved } = await res.json();
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...saved } : m))
      );
    } catch (e) {
      console.error(e);
      setError("Failed to send.");
    }
  };

  /* ─────────────────────────────  DRAG  ────────────────────────────────── */
  const mouseDown = (e) => {
    if (e.target.closest(".chatbox-header")) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - chatboxPosition.x,
        y: e.clientY - chatboxPosition.y,
      });
    }
  };
  const mouseMove = (e) => {
    if (isDragging)
      setChatboxPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
  };
  const mouseUp = () => setIsDragging(false);

  /* ───────────────────────────  EFFECTS  ───────────────────────────────── */
  useEffect(() => {
    audioRef.current = new Audio("/sms.mp3");
    audioRef.current.preload = "auto";
    audioRef.current.loop = false;
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 5000);
    return () => clearInterval(id);
  }, [userDetails?.id, showChatbox, showHistory]);

  useEffect(() => {
    window.addEventListener("mousemove", mouseMove);
    window.addEventListener("mouseup", mouseUp);
    return () => {
      window.removeEventListener("mousemove", mouseMove);
      window.removeEventListener("mouseup", mouseUp);
    };
  }, [isDragging, dragStart]);

  useEffect(scrollToBottom, [messages]);

  /* ─────────────────────────────  RENDER  ──────────────────────────────── */
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed z-50"
      style={{
        right: `${chatboxPosition.x}px`,
        bottom: `${-chatboxPosition.y + 40}px`,
      }}
      onMouseDown={mouseDown}
    >
      {/* ─── ERROR BANNER ─────────────────────────────────────────────── */}
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="absolute top-4 left-4 right-4 bg-red-50 text-red-600 text-sm p-3 rounded-md shadow"
        >
          {error}
        </motion.p>
      )}

      {/* ─── FLOATING ACTION BUTTONS ─────────────────────────────────── */}
      <div className="flex gap-2">
        {/* CHAT BOX BUTTON */}
        <button
          onClick={() => {
            closeAllModals();
            setShowChatbox(true);
          }}
          className="p-4 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-full shadow-lg hover:scale-105 transition-transform"
          title="Open Chat"
        >
          <ChatBubbleLeftRightIcon className="h-6 w-6" />
        </button>

        {/* HISTORY BUTTON */}
        <motion.button
          key={shakeKey}                 // re‑mount to trigger shake once per batch
          initial={false}
          animate={hasUnread ? { rotate: [0, -12, 12, -12, 12, 0] } : {}}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          onClick={() => {
            closeAllModals();
            setShowHistory(true);
          }}
          className="relative p-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-full shadow-lg hover:scale-105 transition-transform"
          title="Chat History"
        >
          <ClockIcon className="h-6 w-6" />

          {/* 🔴 badge shows NEW when unread messages exist */}
          {hasUnread && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full px-2 py-[1px] shadow">
              NEW
            </span>
          )}
        </motion.button>


        {/* MEET SCHEDULER */}
        <ScheduleMeet
          userDetails={userDetails}
          position={chatboxPosition}
          closeAllModals={closeAllModals}
        />
      </div>

      {/* ─────────────────── CHATBOX ──────────────────────── */}
      <AnimatePresence>
        {showChatbox && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-2xl shadow-2xl p-6 w-[400px] max-h-[70vh] overflow-hidden border mt-4 flex flex-col"
          >
            {/* Header */}
            <div className="chatbox-header flex justify-between items-center mb-4 bg-gradient-to-r from-teal-500 to-cyan-600 text-white p-4 -mx-6 -mt-6 rounded-t-2xl">
              <h3 className="text-xl font-semibold">Messages</h3>
              <button
                onClick={() => setShowChatbox(false)}
                className="text-white hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            {/* Recipient Select */}
            <select
              className="p-3 border rounded-lg w-full mb-4 bg-gray-50"
              value={selectedRecipient}
              onChange={(e) => {
                setSelectedRecipient(e.target.value);
                if (e.target.value) markThreadRead(e.target.value);
              }}
            >
              <option value="">Select Recipient</option>
              {users
                .filter((u) => u.id !== Number(userDetails.id))
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({getDisplayRole(u)})
                  </option>
                ))}
            </select>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto pr-2 mb-2">
              {selectedRecipient ? (
                <ul className="space-y-3">
                  {messages
                    .filter(
                      (m) =>
                        (m.senderId === Number(userDetails.id) &&
                          m.recipientId === Number(selectedRecipient)) ||
                        (m.senderId === Number(selectedRecipient) &&
                          m.recipientId === Number(userDetails.id))
                    )
                    .slice(-20)
                    .map((m, idx) => (
                      <motion.li
                        key={m.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className={`p-3 rounded-xl border ${m.senderId === Number(userDetails.id)
                            ? "bg-teal-100 text-right ml-8"
                            : "bg-gray-100 text-left mr-8"
                          }`}
                      >
                        <p className="text-xs text-gray-600">
                          {new Date(m.createdAt).toLocaleTimeString()}
                        </p>
                        <p>{m.content}</p>
                      </motion.li>
                    ))}
                  <div ref={messagesEndRef} />
                </ul>
              ) : (
                <p className="text-gray-500 text-center mt-5">
                  Select a recipient to start chatting.
                </p>
              )}
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 p-3 border rounded-lg bg-gray-50"
                placeholder="Type message..."
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              />
              <button
                onClick={handleSendMessage}
                className="p-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg"
              >
                <PaperAirplaneIcon className="h-5 w-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─────────────────── CHAT HISTORY ───────────────────── */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="fixed bg-white rounded-2xl shadow-2xl p-6 w-[400px] max-h-[60vh] overflow-y-auto border mt-4 z-50"
            style={{
              right: `${chatboxPosition.x}px`,
              bottom: `${-chatboxPosition.y + 100}px`,
            }}
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-4 -mx-6 -mt-6 rounded-t-2xl">
              <h3 className="text-xl font-semibold">Chat History</h3>
              <button
                onClick={() => setShowHistory(false)}
                className="text-white hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            {/* History list */}
            {(() => {
              const chattedIds = new Set(
                messages
                  .filter(
                    (m) =>
                      m.senderId === Number(userDetails.id) ||
                      m.recipientId === Number(userDetails.id)
                  )
                  .map((m) =>
                    m.senderId === Number(userDetails.id)
                      ? m.recipientId
                      : m.senderId
                  )
              );
              const historyUsers = users.filter((u) => chattedIds.has(u.id));
              if (historyUsers.length === 0)
                return (
                  <p className="text-center text-gray-500">No history yet.</p>
                );

              return historyUsers.map((u) => {
                const threadMsgs = messages.filter(
                  (m) =>
                    (m.senderId === Number(userDetails.id) &&
                      m.recipientId === u.id) ||
                    (m.senderId === u.id &&
                      m.recipientId === Number(userDetails.id))
                );
                const last = threadMsgs.sort(
                  (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
                )[0];
                return (
                  <div
                    key={u.id}
                    className="relative mb-3 p-3 bg-gray-50 rounded-lg border cursor-pointer hover:bg-blue-50"
                    onClick={() => {
                      setSelectedRecipient(u.id.toString());
                      setShowHistory(false);
                      setShowChatbox(true);
                      markThreadRead(u.id);
                    }}
                  >
                    <p className="font-semibold">
                      {u.name} ({getDisplayRole(u)})
                    </p>
                    <p className="text-xs text-gray-600 truncate">
                      {last?.content || "No messages"}
                    </p>
                    {unreadCounts[u.id] > 0 && (
                      <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow">
                        {unreadCounts[u.id]}
                      </span>
                    )}
                  </div>
                );
              });
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
