"use client";
import { useEffect, useState, useRef } from "react";
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  ClockIcon,
} from "@heroicons/react/24/solid";
import { motion, AnimatePresence } from "framer-motion";
import ScheduleMeet from "@/components/ScheduleMeet";
import QuickCallInvite from "@/components/QuickCallInvite";
import { useRouter, usePathname } from "next/navigation";

const toTitle = (s = "") =>
  s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

const linkify = (raw = "") => {
  const txt = raw.replace(/\s+/g, " ").trim();
  const withUrls = txt.replace(
    /(https?:\/\/[^\s]+)/g,
    (url) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline break-all">${url}</a>`
  );
  return withUrls.replace(
    /\[task\s*:\s*(\d+)(?:\s+?sprint\s*:\s*(\d+))?\]/gi,
    (_m, taskId, sprintId) => {
      const label = sprintId ? "View Sprint in Task" : "View Task";
      return `<button class="task-link text-blue-600 underline font-medium hover:text-blue-800" data-task-id="${taskId}" data-sprint-id="${sprintId || ""}">${label}</button>`;
    }
  );
};

const getValidImageUrl = (url) => {
  if (!url || typeof url !== "string") return "https://via.placeholder.com/40";
  return url.match(/^https?:\/\//) || url.startsWith("/")
    ? url
    : "https://via.placeholder.com/40";
};

export default function ChatBox({ userDetails, isOpen = false, setIsOpen, recipientId }) {
  const pathname = usePathname();
  if (pathname.includes("/workTogether")) return null;

  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedRecipient, setSelectedRecipient] = useState(recipientId || "");
  const [messageContent, setMessageContent] = useState("");
  const [showChatbox, setShowChatbox] = useState(isOpen);
  const [showHistory, setShowHistory] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [hasUnread, setHasUnread] = useState(false);
  const [error, setError] = useState(null);
  const [showTaskDetailsModal, setShowTaskDetailsModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskLogs, setTaskLogs] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [showComingSoonModal, setShowComingSoonModal] = useState(false);
  const [recordLang, setRecordLang] = useState("hi-IN");

  const messagesEndRef = useRef(null);
  const audioRef = useRef(null);
  const sendAudioRef = useRef(null);
  const receiveAudioRef = useRef(null);
  const lastAlertedId = useRef(null);
  const prevMessageCount = useRef(0);
  const chatContainerRef = useRef(null);
  const historyContainerRef = useRef(null);
  const [jumpKey, setJumpKey] = useState(0);

  // position + drag (kept same, just slightly gentler default)
  const [pos, setPos] = useState({ x: 16, y: -16 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const router = useRouter();

  // Sync showChatbox with isOpen prop
  useEffect(() => {
    setShowChatbox(isOpen);
  }, [isOpen]);

  // Sync selectedRecipient with recipientId prop
  useEffect(() => {
    if (recipientId) setSelectedRecipient(String(recipientId));
  }, [recipientId]);

  const playSound = () => {
    if (!audioRef.current) return;
    audioRef.current.loop = true;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
  };
  const stopSound = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
  };
  const playSend = () => {
    if (!sendAudioRef.current) return;
    sendAudioRef.current.currentTime = 0;
    sendAudioRef.current.play().catch(() => {});
  };
  const playReceive = () => {
    if (!receiveAudioRef.current) return;
    receiveAudioRef.current.currentTime = 0;
    receiveAudioRef.current.play().catch(() => {});
  };

  const scrollBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  const closeAll = () => {
    setShowChatbox(false);
    setShowHistory(false);
    if (setIsOpen) setIsOpen(false);
  };

  const getRole = (u) => {
    if (u.role === "admin") return "Admin";
    if (u.role === "team_manager")
      return `Team Manager${u.team_manager_type ? ` (${toTitle(u.team_manager_type)})` : ""}`;
    return u.type ? toTitle(u.type) : "Member";
  };

  const fetchData = async () => {
    if (!userDetails?.id) return;
    try {
      const [uRes, mRes] = await Promise.all([
        fetch("/api/member/users"),
        fetch(`/api/others/chat?userId=${userDetails.id}`),
      ]);
      const { users: fetchedUsers = [] } = await uRes.json();
      const { messages: fetchedMsgs = [] } = await mRes.json();
      setUsers(fetchedUsers);
      setMessages(fetchedMsgs);

      const unread = fetchedMsgs.filter(
        (m) =>
          m.recipientId === Number(userDetails.id) &&
          m.senderId !== Number(userDetails.id) &&
          m.status === "sent"
      );
      setUnreadCounts(
        unread.reduce((acc, m) => {
          acc[m.senderId] = (acc[m.senderId] || 0) + 1;
          return acc;
        }, {})
      );
      setHasUnread(unread.length > 0);
      if (unread.length === 0) stopSound();

      const newest = unread.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      if (newest && newest.id !== lastAlertedId.current && !showChatbox && !showHistory) {
        playSound();
        setJumpKey(Date.now());
        lastAlertedId.current = newest.id;
      }
    } catch (e) {
      setError("Chat fetch error.");
    }
  };

  const markReadForPartner = async (partnerId) => {
    const toMark = messages.filter(
      (m) =>
        m.senderId === partnerId &&
        m.recipientId === Number(userDetails.id) &&
        m.status === "sent"
    );
    if (!toMark.length) return;

    setMessages((prev) =>
      prev.map((m) => (toMark.find((p) => p.id === m.id) ? { ...m, status: "read" } : m))
    );
    setUnreadCounts((prev) => {
      const copy = { ...prev };
      delete copy[partnerId];
      return copy;
    });
    setHasUnread(Object.keys(unreadCounts).length > 1);
    if (Object.keys(unreadCounts).length <= 1) stopSound();

    await Promise.all(
      toMark.map((m) =>
        fetch("/api/others/chat", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId: m.id, status: "read" }),
        })
      )
    );
  };

  const sendMessage = async () => {
    if (!selectedRecipient || !messageContent.trim()) {
      setError("Pick a recipient and write something.");
      return;
    }
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
    try {
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
    } catch {
      setError("Send failed.");
    }
  };

  const mouseDown = (e) => {
    if (e.target.closest(".chatbox-header")) {
      setDragging(true);
      dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    }
  };
  const mouseMove = (e) => {
    if (dragging) setPos({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  };
  const mouseUp = () => setDragging(false);

  const dispatchOpenTask = (taskId, sprintId) => {
    window.dispatchEvent(
      new CustomEvent("member-open-task", {
        detail: { taskId: Number(taskId), sprintId: sprintId ? Number(sprintId) : null },
      })
    );
  };

  useEffect(() => {
    const handleTaskClick = (e) => {
      if (!e.target.classList.contains("task-link")) return;

      const taskId = e.target.dataset.taskId;
      const sprintId = e.target.dataset.sprintId;

      const isManagerRole = ["admin", "team_manager"].includes(userDetails?.role);
      const isManagerPage = pathname === "/dashboard/managersCommon";

      if (isManagerRole) {
        if (isManagerPage) {
          dispatchOpenTask(taskId, sprintId);
        } else {
          const query = sprintId ? `?focusTask=${taskId}&focusSprint=${sprintId}` : `?focusTask=${taskId}`;
          router.push(`/dashboard/managersCommon${query}`);
        }
      } else {
        dispatchOpenTask(taskId, sprintId);
      }
      closeAll();
    };

    const chatEl = chatContainerRef.current;
    const historyEl = historyContainerRef.current;
    chatEl?.addEventListener("click", handleTaskClick);
    historyEl?.addEventListener("click", handleTaskClick);
    return () => {
      chatEl?.removeEventListener("click", handleTaskClick);
      historyEl?.removeEventListener("click", handleTaskClick);
    };
  }, [showHistory, userDetails?.role, pathname, router]);

  useEffect(() => {
    audioRef.current = new Audio("/sms.mp3");
    audioRef.current.loop = true;
    audioRef.current.preload = "auto";
    sendAudioRef.current = new Audio("/send.mp3");
    sendAudioRef.current.preload = "auto";
    receiveAudioRef.current = new Audio("/receive.mp3");
    receiveAudioRef.current.preload = "auto";
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 5000);
    return () => clearInterval(id);
  }, [userDetails?.id, showChatbox, showHistory]);

  useEffect(() => {
    if (showChatbox && selectedRecipient) markReadForPartner(Number(selectedRecipient));
  }, [showChatbox, selectedRecipient]);

  useEffect(() => {
    scrollBottom();
    if (prevMessageCount.current === 0) {
      prevMessageCount.current = messages.length;
      return;
    }
    if (messages.length > prevMessageCount.current) {
      const newMessages = messages.slice(prevMessageCount.current);
      newMessages.forEach((m) => {
        if (m.senderId === Number(userDetails.id)) {
          playSend();
        } else if (showChatbox && selectedRecipient === String(m.senderId)) {
          playReceive();
        }
      });
    }
    prevMessageCount.current = messages.length;
  }, [messages, showChatbox, selectedRecipient]);

  useEffect(() => {
    window.addEventListener("mousemove", mouseMove);
    window.addEventListener("mouseup", mouseUp);
    return () => {
      window.removeEventListener("mousemove", mouseMove);
      window.removeEventListener("mouseup", mouseUp);
    };
  }, [dragging]);

  const startVoiceRecording = () => {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = recordLang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setIsRecording(true);
    recognition.start();
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setMessageContent((prev) => (prev ? prev + " " + transcript : transcript));
      setIsRecording(false);
    };
    recognition.onerror = (event) => {
      setError(`Voice recognition error: ${event.error}`);
      setIsRecording(false);
    };
    recognition.onend = () => setIsRecording(false);
  };

  const handleTranslateMessage = () => setShowComingSoonModal(true);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed z-50"
      style={{ right: `${pos.x}px`, bottom: `${-pos.y + 40}px` }}
      onMouseDown={mouseDown}
    >
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

      {/* Launcher + History + (kept) Quick actions */}
      <div className="flex gap-2 items-center flex-wrap">
        <button
          onClick={() => {
            closeAll();
            setShowChatbox(true);
            if (setIsOpen) setIsOpen(true);
          }}
          className="p-3 sm:p-4 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-full shadow-lg hover:scale-105 transition-transform"
          title="Open Chat"
        >
          <ChatBubbleLeftRightIcon className="h-5 w-5 sm:h-6 sm:w-6" />
        </button>

        <motion.button
          key={jumpKey}
          initial={false}
          animate={
            hasUnread
              ? { y: [0, -40, 0], rotate: [0, -10, 10, -10, 10, 0], scale: [1, 1.15, 1] }
              : {}
          }
          transition={{ duration: 0.5, ease: "easeOut" }}
          onClick={() => {
            closeAll();
            setShowHistory(true);
          }}
          className="relative p-3 sm:p-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-full shadow-lg hover:scale-105 transition-transform"
          title="Chat History"
        >
          <ClockIcon className="h-5 w-5 sm:h-6 sm:w-6" />
          {hasUnread && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full px-2 py-[1px] shadow animate-pulse">
              NEW
            </span>
          )}
        </motion.button>

        {/* kept exactly like before (visible on all viewports) */}
        <ScheduleMeet userDetails={userDetails} position={pos} closeAllModals={closeAll} />
        <QuickCallInvite userDetails={userDetails} position={pos} closeAllModals={closeAll} />
      </div>

      {/* CHATBOX */}
      <AnimatePresence>
        {showChatbox && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25 }}
            className="
              bg-white rounded-2xl shadow-2xl border mt-3 flex flex-col z-50
              w-[92vw] sm:w-[380px] md:w-[400px]
              max-h-[70vh] sm:max-h-[72vh] overflow-hidden
            "
          >
            {/* header is drag handle */}
            <div className="chatbox-header flex justify-between items-center bg-gradient-to-r from-teal-500 to-cyan-600 text-white px-4 py-3 sm:px-5 sm:py-4">
              <h3 className="text-base sm:text-lg font-semibold">Messages</h3>
              <button
                onClick={() => {
                  setShowChatbox(false);
                  if (setIsOpen) setIsOpen(false);
                }}
                className="text-white/90 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 flex-1 flex flex-col overflow-hidden">
              <select
                className="p-2 sm:p-2.5 border rounded-lg w-full bg-gray-50 text-sm"
                value={selectedRecipient}
                onChange={(e) => setSelectedRecipient(e.target.value)}
              >
                <option value="">Select Recipient</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({getRole(u)})
                  </option>
                ))}
              </select>

              <div
                className="flex-1 overflow-y-auto pr-1 sm:pr-2"
                ref={chatContainerRef}
              >
                {selectedRecipient ? (
                  <ul className="space-y-2 sm:space-y-3">
                    {messages
                      .filter(
                        (m) =>
                          (m.senderId === Number(userDetails.id) &&
                            m.recipientId === Number(selectedRecipient)) ||
                          (m.senderId === Number(selectedRecipient) &&
                            m.recipientId === Number(userDetails.id))
                      )
                      .slice(-40) // show a few more but still compact
                      .map((m) => {
                        const sender = users.find((u) => u.id === m.senderId);
                        const isOwnMessage = m.senderId === Number(userDetails.id);
                        return (
                          <li
                            key={m.id}
                            className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`flex items-start gap-2 max-w-[86%] sm:max-w-[80%] p-2 sm:p-3 rounded-xl border ${
                                isOwnMessage ? "bg-teal-100 ml-6 sm:ml-8" : "bg-gray-100 mr-6 sm:mr-8"
                              }`}
                            >
                              {!isOwnMessage && (
                                <img
                                  src={getValidImageUrl(sender?.image)}
                                  alt={`${sender?.name || "User"}'s profile`}
                                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover flex-shrink-0"
                                  onError={(e) => {
                                    e.currentTarget.src = "https://via.placeholder.com/32";
                                  }}
                                />
                              )}
                              <div className="min-w-0">
                                <p className="text-[10px] sm:text-xs text-gray-500">
                                  {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </p>
                                <p
                                  className="text-sm sm:text-[15px] leading-snug break-words"
                                  dangerouslySetInnerHTML={{ __html: linkify(m.content) }}
                                />
                              </div>
                              {isOwnMessage && (
                                <img
                                  src={getValidImageUrl(userDetails?.image)}
                                  alt="Your profile"
                                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover flex-shrink-0"
                                  onError={(e) => {
                                    e.currentTarget.src = "https://via.placeholder.com/32";
                                  }}
                                />
                              )}
                            </div>
                          </li>
                        );
                      })}
                    <div ref={messagesEndRef} />
                  </ul>
                ) : (
                  <p className="text-gray-500 text-center mt-4 text-sm">
                    Select a recipient to start chatting.
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 p-2 sm:p-3 border rounded-lg bg-gray-50 text-sm"
                  placeholder="Type message..."
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                />
                <button
                  onClick={sendMessage}
                  className="p-2.5 sm:p-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg"
                  aria-label="Send"
                >
                  <PaperAirplaneIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="flex items-center mt-1 sm:mt-2 gap-2">
                <select
                  value={recordLang}
                  onChange={(e) => setRecordLang(e.target.value)}
                  className="p-1.5 border rounded-lg bg-gray-50 text-xs sm:text-sm"
                >
                  <option value="hi-IN">Hindi</option>
                  <option value="en-US">English</option>
                </select>
                <motion.button
                  onClick={startVoiceRecording}
                  disabled={isRecording}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium ${
                    isRecording ? "bg-gray-400 cursor-not-allowed text-white" : "bg-teal-600 text-white hover:bg-teal-700"
                  }`}
                  whileHover={{ scale: isRecording ? 1 : 1.04 }}
                  whileTap={{ scale: isRecording ? 1 : 0.96 }}
                >
                  {isRecording ? "Recording..." : "Record"}
                </motion.button>
                {recordLang === "hi-IN" && (
                  <motion.button
                    onClick={handleTranslateMessage}
                    className="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-purple-600 text-white hover:bg-purple-700"
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                  >
                    Translate → EN
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HISTORY */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25 }}
            className="
              fixed bg-white rounded-2xl shadow-2xl border z-50
              w-[92vw] sm:w-[360px] md:w-[380px]
              max-h-[62vh] overflow-y-auto mt-3
            "
            style={{ right: `${pos.x}px`, bottom: `${-pos.y + 96}px` }}
            ref={historyContainerRef}
          >
            <div className="flex justify-between items-center bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-3 sm:px-5 sm:py-4 rounded-t-2xl">
              <h3 className="text-base sm:text-lg font-semibold">Chat History</h3>
              <button
                onClick={() => setShowHistory(false)}
                className="text-white/90 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-3 sm:p-4">
              {(() => {
                const partnerIds = new Set(
                  messages
                    .filter(
                      (m) =>
                        m.senderId === Number(userDetails.id) ||
                        m.recipientId === Number(userDetails.id)
                    )
                    .map((m) =>
                      m.senderId === Number(userDetails.id) ? m.recipientId : m.senderId
                    )
                );

                const partners = users
                  .filter((u) => partnerIds.has(u.id))
                  .sort((a, b) => {
                    const lastTime = (id) =>
                      messages
                        .filter(
                          (m) =>
                            (m.senderId === id && m.recipientId === Number(userDetails.id)) ||
                            (m.senderId === Number(userDetails.id) && m.recipientId === id)
                        )
                        .sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt))[0]?.createdAt;
                    return new Date(lastTime(b) || 0) - new Date(lastTime(a) || 0);
                  });

                if (!partners.length)
                  return <p className="text-gray-500 text-center text-sm">No conversation history.</p>;

                return partners.map((u) => {
                  const lastMsg = messages
                    .filter(
                      (m) =>
                        (m.senderId === u.id && m.recipientId === Number(userDetails.id)) ||
                        (m.senderId === Number(userDetails.id) && m.recipientId === u.id)
                    )
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

                  return (
                    <div
                      key={u.id}
                      onClick={() => {
                        setSelectedRecipient(String(u.id));
                        closeAll();
                        setShowChatbox(true);
                        if (setIsOpen) setIsOpen(true);
                      }}
                      className="relative mb-2 sm:mb-3 p-2.5 sm:p-3 bg-gray-50 border rounded-lg cursor-pointer hover:bg-blue-50 flex items-center gap-2 sm:gap-3"
                    >
                      <img
                        src={getValidImageUrl(u.image)}
                        alt={`${u.name}'s profile`}
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = "https://via.placeholder.com/40";
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate text-sm">{u.name} ({getRole(u)})</p>
                        <p
                          className="text-xs text-gray-600 break-words"
                          style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
                          dangerouslySetInnerHTML={{
                            __html: linkify(lastMsg?.content || "No messages yet"),
                          }}
                        />
                      </div>
                      {unreadCounts[u.id] > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full px-1.5 py-[1px] shadow">
                          {unreadCounts[u.id]}
                        </span>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task Details Modal */}
      <AnimatePresence>
        {showTaskDetailsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="bg-white rounded-2xl shadow-2xl p-5 sm:p-6 w-full max-w-sm sm:max-w-md border border-teal-300 relative"
            >
              <button
                onClick={() => {
                  setShowTaskDetailsModal(false);
                  setSelectedTask(null);
                  setTaskLogs([]);
                }}
                className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-lg font-bold"
              >
                ×
              </button>
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
                Task Details
              </h2>
              <div className="space-y-2.5 sm:space-y-3">
                <p className="text-sm font-medium text-gray-700">
                  <strong>Title:</strong> {selectedTask?.title || "Untitled Task"}
                </p>
                <p className="text-sm font-medium text-gray-700">
                  <strong>Description:</strong> {selectedTask?.description || "No description"}
                </p>
                <p className="text-sm font-medium text-gray-700">
                  <strong>Assigned By:</strong>{" "}
                  {selectedTask?.createdBy
                    ? users.find((u) => u.id === selectedTask.createdBy)?.name || "Unknown"
                    : "Unknown"}
                </p>
                <p className="text-sm font-medium text-gray-700">
                  <strong>Status:</strong> {(selectedTask?.status || "not_started").replace("_", " ")}
                </p>
                <p className="text-sm font-medium text-gray-700">
                  <strong>Assigned Date:</strong>{" "}
                  {selectedTask?.assignedDate
                    ? new Date(selectedTask.assignedDate).toLocaleDateString()
                    : "N/A"}
                </p>
                <p className="text-sm font-medium text-gray-700">
                  <strong>Deadline:</strong>{" "}
                  {selectedTask?.deadline
                    ? new Date(selectedTask.deadline).toLocaleDateString()
                    : "No deadline"}
                </p>
                <p className="text-sm font-medium text-gray-700">
                  <strong>Resources:</strong> {selectedTask?.resources || "No resources"}
                </p>

                {selectedTask?.sprints?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700">Sprints</h3>
                    <ul className="space-y-2">
                      {selectedTask.sprints.map((s) => (
                        <li key={s.id} className="p-2 bg-gray-50 rounded border">
                          <p className="font-medium text-sm">{s.title || "Untitled Sprint"}</p>
                          <p className="text-xs text-gray-600">
                            Status: {s.status?.replace("_", " ") || "Unknown"}
                          </p>
                          <p className="text-xs text-gray-600">{s.description || "No description."}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Discussion</h3>
                  <div className="max-h-36 sm:max-h-40 overflow-y-auto space-y-2">
                    {taskLogs.length === 0 ? (
                      <p className="text-sm text-gray-500">No discussion yet.</p>
                    ) : (
                      taskLogs.map((log) => (
                        <div
                          key={log.id}
                          className="p-2.5 bg-gray-50 rounded-lg shadow-sm border border-gray-200"
                        >
                          <p className="text-[11px] sm:text-xs text-gray-600">
                            {users.find((u) => u.id === log.userId)?.name || "Unknown"} (
                            {new Date(log.createdAt).toLocaleString()}):
                          </p>
                          <p className="text-sm text-gray-700">{log.details}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      setShowTaskDetailsModal(false);
                      setSelectedTask(null);
                      setTaskLogs([]);
                    }}
                    className="px-4 py-2 bg-gray-500 text-white rounded-md text-sm font-medium"
                  >
                    Close
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Coming soon modal */}
      <AnimatePresence>
        {showComingSoonModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="bg-white rounded-2xl shadow-2xl p-5 sm:p-6 w-full max-w-sm border border-teal-300 relative"
            >
              <button
                onClick={() => setShowComingSoonModal(false)}
                className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-lg font-bold"
              >
                ×
              </button>
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">Coming Soon</h2>
              <p className="text-sm">Translation is coming soon.</p>
              <div className="flex justify-end mt-4">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setShowComingSoonModal(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded-md text-sm font-medium"
                >
                  Close
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
