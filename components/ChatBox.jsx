"use client";
import { useEffect, useState, useRef } from "react";
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  ClockIcon,
} from "@heroicons/react/24/solid";
import { motion, AnimatePresence } from "framer-motion";
import ScheduleMeet from "@/components/ScheduleMeet";

/* ────────── helpers ────────── */
const toTitle = (str = "") =>
  str
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

export default function ChatBox({ userDetails }) {
  /*────────────────────── state ──────────────────────*/
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedRecipient, setSelectedRecipient] = useState("");
  const [messageContent, setMessageContent] = useState("");

  const [showChatbox, setShowChatbox] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const [unreadCounts, setUnreadCounts] = useState({});
  const [hasUnread, setHasUnread] = useState(false);

  const [error, setError] = useState(null);

  /*──── notification / shake tracking ────*/
  const [shakeKey, setShakeKey] = useState(0);
  const [lastNotifiedId, setLastNotifiedId] = useState(null); // stop repeat sound

  /*──── refs ────*/
  const audioRef          = useRef(null);
  const messagesEndRef    = useRef(null);

  /*──── floating position + drag ────*/
  const [pos, setPos]   = useState({ x: 20, y: -20 });
  const [dragging, setDragging] = useState(false);
  const dragStart       = useRef({ x: 0, y: 0 });

  /*────────────────────── helpers ──────────────────────*/
  const playSound = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(console.error);
  };

  const scrollBottom = () =>
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  const closeAll = () => {
    setShowChatbox(false);
    setShowHistory(false);
  };

  const getRole = (u) => {
    if (u.role === "admin") return "Admin";
    if (u.role === "team_manager")
      return `Team Manager${u.team_manager_type ? ` (${toTitle(u.team_manager_type)})` : ""}`;
    return u.type ? toTitle(u.type) : "Member";
  };

  /*────────────────────── polling ──────────────────────*/
  const fetchData = async () => {
    if (!userDetails?.id) return;
    try {
      /* users list */
      const usersRes = await fetch("/api/member/users");
      const { users: fetchedUsers = [] } = await usersRes.json();
      setUsers(fetchedUsers);

      /* messages list */
      const msgRes = await fetch(`/api/others/chat?userId=${userDetails.id}`);
      const { messages: fetchedMsgs = [] } = await msgRes.json();
      setMessages(fetchedMsgs);

      /* compute unread counts */
      const counts = fetchedMsgs.reduce((acc, m) => {
        if (
          m.recipientId === Number(userDetails.id) &&
          m.status === "sent"
        ) {
          acc[m.senderId] = (acc[m.senderId] || 0) + 1;
        }
        return acc;
      }, {});
      setUnreadCounts(counts);
      setHasUnread(Object.values(counts).some((c) => c > 0));

      /* latest incoming msg */
      const latestIncoming = fetchedMsgs
        .filter((m) => m.recipientId === Number(userDetails.id))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

      if (
        latestIncoming &&
        latestIncoming.id !== lastNotifiedId &&
        !showChatbox &&
        !showHistory
      ) {
        playSound();
        setShakeKey(Date.now());
        setLastNotifiedId(latestIncoming.id);
      }
    } catch (e) {
      console.error(e);
      setError("Chat fetch error.");
    }
  };

  /* mark ALL unread → read (bulk) */
  const markAllRead = async () => {
    const toMark = messages.filter(
      (m) =>
        m.recipientId === Number(userDetails.id) && m.status === "sent"
    );

    if (toMark.length) {
      await Promise.all(
        toMark.map((m) =>
          fetch("/api/others/chat", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageId: m.id, status: "read" }),
          })
        )
      );
    }
    setUnreadCounts({});
    setHasUnread(false);

    // ensure no repeat alert for the same batch
    const latest = toMark.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    )[0];
    if (latest) setLastNotifiedId(latest.id);
  };

  /*────────────────────── send ──────────────────────*/
  const sendMessage = async () => {
    if (!selectedRecipient || !messageContent.trim()) {
      setError("Pick a recipient and write something.");
      return;
    }
    try {
      const tempId = `tmp-${Date.now()}`;
      const optimistic = {
        id: tempId,
        senderId: Number(userDetails.id),
        recipientId: Number(selectedRecipient),
        content: messageContent,
        createdAt: new Date().toISOString(),
        status: "sent",
      };
      setMessages((p) => [...p, optimistic]);
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
      setMessages((p) => p.map((m) => (m.id === tempId ? saved : m)));
    } catch (e) {
      console.error(e);
      setError("Send failed.");
    }
  };

  /*────────────────────── drag ──────────────────────*/
  const mouseDown = (e) => {
    if (e.target.closest(".chatbox-header")) {
      setDragging(true);
      dragStart.current = {
        x: e.clientX - pos.x,
        y: e.clientY - pos.y,
      };
    }
  };
  const mouseMove = (e) => {
    if (dragging)
      setPos({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  };
  const mouseUp = () => setDragging(false);

  /*────────────────────── effects ──────────────────────*/
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

  /* clear badge + mark read when opening any chat UI */
  useEffect(() => {
    if ((showChatbox || showHistory) && hasUnread) markAllRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showChatbox, showHistory]);

  useEffect(() => {
    window.addEventListener("mousemove", mouseMove);
    window.addEventListener("mouseup", mouseUp);
    return () => {
      window.removeEventListener("mousemove", mouseMove);
      window.removeEventListener("mouseup", mouseUp);
    };
  }, [dragging]);

  useEffect(scrollBottom, [messages]);

  /*────────────────────── render ──────────────────────*/
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed z-50"
      style={{ right: `${pos.x}px`, bottom: `${-pos.y + 40}px` }}
      onMouseDown={mouseDown}
    >
      {/* error banner */}
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

      {/* action buttons */}
      <div className="flex gap-2">
        {/* open chat */}
        <button
          onClick={() => {
            closeAll();
            setShowChatbox(true);
          }}
          className="p-4 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-full shadow-lg hover:scale-105 transition-transform"
          title="Open Chat"
        >
          <ChatBubbleLeftRightIcon className="h-6 w-6" />
        </button>

        {/* history */}
        <motion.button
          key={shakeKey}
          initial={false}
          animate={hasUnread ? { rotate: [0, -12, 12, -12, 12, 0] } : {}}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          onClick={() => {
            closeAll();
            setShowHistory(true);
          }}
          className="relative p-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-full shadow-lg hover:scale-105 transition-transform"
          title="Chat History"
        >
          <ClockIcon className="h-6 w-6" />
          {hasUnread && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full px-2 py-[1px] shadow">
              NEW
            </span>
          )}
        </motion.button>

        {/* schedule meet */}
        <ScheduleMeet
          userDetails={userDetails}
          position={pos}
          closeAllModals={closeAll}
        />
      </div>

      {/* CHATBOX PANEL */}
      <AnimatePresence>
        {showChatbox && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-2xl shadow-2xl p-6 w-[400px] max-h-[70vh] overflow-hidden border mt-4 flex flex-col"
          >
            <div className="chatbox-header flex justify-between items-center mb-4 bg-gradient-to-r from-teal-500 to-cyan-600 text-white p-4 -mx-6 -mt-6 rounded-t-2xl">
              <h3 className="text-xl font-semibold">Messages</h3>
              <button
                onClick={() => setShowChatbox(false)}
                className="text-white hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            {/* recipient select */}
            <select
              className="p-3 border rounded-lg w-full mb-4 bg-gray-50"
              value={selectedRecipient}
              onChange={(e) => setSelectedRecipient(e.target.value)}
            >
              <option value="">Select Recipient</option>
              {users
                .filter((u) => u.id !== Number(userDetails.id))
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({getRole(u)})
                  </option>
                ))}
            </select>

            {/* msgs */}
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
                    .map((m) => (
                      <li
                        key={m.id}
                        className={`p-3 rounded-xl border ${
                          m.senderId === Number(userDetails.id)
                            ? "bg-teal-100 text-right ml-8"
                            : "bg-gray-100 text-left mr-8"
                        }`}
                      >
                        <p className="text-xs text-gray-500">
                          {new Date(m.createdAt).toLocaleTimeString()}
                        </p>
                        <p>{m.content}</p>
                      </li>
                    ))}
                  <div ref={messagesEndRef} />
                </ul>
              ) : (
                <p className="text-gray-500 text-center mt-5">
                  Select a recipient to start chatting.
                </p>
              )}
            </div>

            {/* input */}
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 p-3 border rounded-lg bg-gray-50"
                placeholder="Type message..."
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              />
              <button
                onClick={sendMessage}
                className="p-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg"
              >
                <PaperAirplaneIcon className="h-5 w-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HISTORY PANEL */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="fixed bg-white rounded-2xl shadow-2xl p-6 w-[400px] max-h-[60vh] overflow-y-auto border mt-4 z-50"
            style={{ right: `${pos.x}px`, bottom: `${-pos.y + 100}px` }}
          >
            <div className="flex justify-between items-center mb-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-4 -mx-6 -mt-6 rounded-t-2xl">
              <h3 className="text-xl font-semibold">Chat History</h3>
              <button
                onClick={() => setShowHistory(false)}
                className="text-white hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            {/* build history list */}
            {(() => {
              const partnerIds = new Set(
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
              const partners = users.filter((u) => partnerIds.has(u.id));
              if (!partners.length)
                return (
                  <p className="text-center text-gray-500">No history yet.</p>
                );

              return partners.map((u) => {
                const thread = messages.filter(
                  (m) =>
                    (m.senderId === Number(userDetails.id) &&
                      m.recipientId === u.id) ||
                    (m.senderId === u.id &&
                      m.recipientId === Number(userDetails.id))
                );
                const lastMsg = thread.sort(
                  (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
                )[0];

                return (
                  <div
                    key={u.id}
                    className="relative mb-3 p-3 bg-gray-50 rounded-lg border cursor-pointer hover:bg-blue-50"
                    onClick={() => {
                      setSelectedRecipient(u.id.toString());
                      closeAll();
                      setShowChatbox(true);
                    }}
                  >
                    <p className="font-semibold">
                      {u.name} ({getRole(u)})
                    </p>
                    <p className="text-xs text-gray-600 truncate">
                      {lastMsg?.content || "No messages"}
                    </p>
                    {unreadCounts[u.id] > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full px-1 py-[1px] shadow">
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
