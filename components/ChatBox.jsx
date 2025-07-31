"use client";
import { useEffect, useState, useRef } from "react";
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  ClockIcon,
} from "@heroicons/react/24/solid";
import { motion, AnimatePresence } from "framer-motion";
import ScheduleMeet    from "@/components/ScheduleMeet";
import QuickCallInvite from "@/components/QuickCallInvite";

/* ───────── helpers ───────── */
const toTitle = (s = "") =>
  s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

const linkify = (raw = "") => {
  // 0️⃣ normalise all whitespace (NBSP, tabs, etc.)
  const txt = raw.replace(/\s+/g, " ").trim();

  // 1️⃣ URLs → anchor
  const withUrls = txt.replace(
    /(https?:\/\/[^\s]+)/g,
    (url) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline break-all">${url}</a>`
  );

  // 2️⃣ [task:114]  or  [task:114 sprint:3] → button
  return withUrls.replace(
    /\[task\s*:\s*(\d+)(?:\s+?sprint\s*:\s*(\d+))?\]/gi,
    (_m, taskId, sprintId) => {
      const label = sprintId ? "View Sprint in Task" : "View Task";
      return `<button class="task-link text-blue-600 underline font-medium hover:text-blue-800" data-task-id="${taskId}" data-sprint-id="${sprintId || ""}">${label}</button>`;
    }
  );
};

/* ───────── component ───────── */
export default function ChatBox({ userDetails }) {
  /* ------------ state ------------- */
  const [messages, setMessages]       = useState([]);
  const [users, setUsers]             = useState([]);
  const [selectedRecipient, setSelectedRecipient] = useState("");
  const [messageContent, setMessageContent]       = useState("");

  const [showChatbox, setShowChatbox] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const [unreadCounts, setUnreadCounts] = useState({});
  const [hasUnread, setHasUnread]       = useState(false);

  const [error, setError] = useState(null);

  /* admin-fallback task modal (unchanged) */
  const [showTaskDetailsModal, setShowTaskDetailsModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskLogs, setTaskLogs]         = useState([]);

  const messagesEndRef  = useRef(null);
  const audioRef        = useRef(null);
  const sendAudioRef    = useRef(null);
  const receiveAudioRef = useRef(null);
  const lastAlertedId   = useRef(null);
  const [jumpKey, setJumpKey] = useState(0);

  const chatContainerRef = useRef(null);
  const historyContainerRef = useRef(null);

  /* drag-n-drop */
  const [pos, setPos]     = useState({ x: 20, y: -20 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const [isRecording, setIsRecording] = useState(false);
  const [showComingSoonModal, setShowComingSoonModal] = useState(false);
  const [recordLang, setRecordLang] = useState("hi-IN");

  const prevMessageCount = useRef(0);

  /* ------------ utils ------------- */
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

  const scrollBottom = () =>
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  const closeAll = () => { setShowChatbox(false); setShowHistory(false); };
  const getRole = (u) => {
    if (u.role === "admin") return "Admin";
    if (u.role === "team_manager")
      return `Team Manager${u.team_manager_type ? ` (${toTitle(u.team_manager_type)})` : ""}`;
    return u.type ? toTitle(u.type) : "Member";
  };

  /* ------------ polling ------------ */
  const fetchData = async () => {
    if (!userDetails?.id) return;
    try {
      const [uRes, mRes] = await Promise.all([
        fetch("/api/member/users"),
        fetch(`/api/others/chat?userId=${userDetails.id}`),
      ]);
      const { users: fetchedUsers = [] }   = await uRes.json();
      const { messages: fetchedMsgs = [] } = await mRes.json();
      setUsers(fetchedUsers);
      setMessages(fetchedMsgs);

      const unread = fetchedMsgs.filter(
        (m) =>
          m.recipientId === Number(userDetails.id) &&
          m.senderId   !== Number(userDetails.id) &&
          m.status      === "sent"
      );
      setUnreadCounts(
        unread.reduce((acc, m) => {
          acc[m.senderId] = (acc[m.senderId] || 0) + 1;
          return acc;
        }, {})
      );
      setHasUnread(unread.length > 0);

      if (unread.length === 0) stopSound();

      const newest = unread
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

      if (newest &&
          newest.id !== lastAlertedId.current &&
          !showChatbox && !showHistory) {
        playSound();
        setJumpKey(Date.now());
        lastAlertedId.current = newest.id;
      }
    } catch (e) {
      console.error(e);
      setError("Chat fetch error.");
    }
  };

  /* ------------ mark-as-read ---------- */
  const markReadForPartner = async (partnerId) => {
    const toMark = messages.filter(
      (m) =>
        m.senderId === partnerId &&
        m.recipientId === Number(userDetails.id) &&
        m.status === "sent"
    );
    if (!toMark.length) return;

    setMessages((prev) =>
      prev.map((m) =>
        toMark.find((p) => p.id === m.id) ? { ...m, status: "read" } : m
      )
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

  /* ------------ send message ---------- */
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

  /* ------------ drag helpers ---------- */
  const mouseDown = (e) => {
    if (e.target.closest(".chatbox-header")) {
      setDragging(true);
      dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    }
  };
  const mouseMove = (e) => {
    if (dragging)
      setPos({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  };
  const mouseUp = () => setDragging(false);

  /* ------------ member dispatch ------- */
  const dispatchOpenTask = (taskId, sprintId) => {
    window.dispatchEvent(
      new CustomEvent("member-open-task", {
        detail: { taskId: Number(taskId), sprintId: sprintId ? Number(sprintId) : null },
      })
    );
  };

  /* ------------ single click-handler --- */
  useEffect(() => {
    const handleTaskClick = (e) => {
      if (!e.target.classList.contains("task-link")) return;

      const taskId   = e.target.dataset.taskId;
      const sprintId = e.target.dataset.sprintId;

      console.log("Task link clicked:", { taskId, sprintId });

      if (userDetails?.role === "admin") {
        window.open(`/dashboard/admin?focusTask=${taskId}`, "_blank");
      } else {
        dispatchOpenTask(taskId, sprintId);
        closeAll();
      }
    };

    const chatEl = chatContainerRef.current;
    const historyEl = historyContainerRef.current;

    chatEl?.addEventListener("click", handleTaskClick);
    historyEl?.addEventListener("click", handleTaskClick);

    return () => {
      chatEl?.removeEventListener("click", handleTaskClick);
      historyEl?.removeEventListener("click", handleTaskClick);
    };
  }, [showHistory, userDetails?.role]);

  /* ------------ life-cycle ------------ */
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
    window.addEventListener("mousemove", mouseMove);
    window.addEventListener("mouseup", mouseUp);
    return () => {
      window.removeEventListener("mousemove", mouseMove);
      window.removeEventListener("mouseup", mouseUp);
    };
  }, [dragging]);

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
      setMessageContent(prev => prev ? prev + ' ' + transcript : transcript);
      setIsRecording(false);
    };

    recognition.onerror = (event) => {
      console.error("Voice recognition error:", event.error);
      setError(`Voice recognition error: ${event.error}`);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };
  };

  const handleTranslateMessage = () => {
    setShowComingSoonModal(true);
  };

  /* ------------ render (UI unchanged) -- */
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

      <div className="flex gap-2">
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

        <motion.button
          key={jumpKey}
          initial={false}
          animate={
            hasUnread
              ? { y: [0, -40, 0], rotate: [0, -10, 10, -10, 10, 0], scale: [1, 1.25, 1] }
              : {}
          }
          transition={{ duration: 0.5, ease: "easeOut" }}
          onClick={() => {
            closeAll();
            setShowHistory(true);
          }}
          className="relative p-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-full shadow-lg hover:scale-105 transition-transform"
          title="Chat History"
        >
          <ClockIcon className="h-6 w-6" />
          {hasUnread && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full px-2 py-[1px] shadow animate-pulse">
              NEW
            </span>
          )}
        </motion.button>

        <ScheduleMeet userDetails={userDetails} position={pos} closeAllModals={closeAll} />
        <QuickCallInvite userDetails={userDetails} position={pos} closeAllModals={closeAll} />
      </div>

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
              <button onClick={() => setShowChatbox(false)} className="text-white hover:text-gray-200">
                ✕
              </button>
            </div>

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

            <div className="flex-1 overflow-y-auto pr-2 mb-2" ref={chatContainerRef}>
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
                        <p className="text-xs text-gray-500">{new Date(m.createdAt).toLocaleTimeString()}</p>
                        <p className="break-words" dangerouslySetInnerHTML={{ __html: linkify(m.content) }} />
                      </li>
                    ))}
                  <div ref={messagesEndRef} />
                </ul>
              ) : (
                <p className="text-gray-500 text-center mt-5">Select a recipient to start chatting.</p>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 p-3 border rounded-lg bg-gray-50"
                placeholder="Type message..."
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              />
              <button onClick={sendMessage} className="p-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg">
                <PaperAirplaneIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center mt-2 gap-2">
              <select
                value={recordLang}
                onChange={(e) => setRecordLang(e.target.value)}
                className="p-1 border rounded-lg bg-gray-50 text-sm"
              >
                <option value="hi-IN">Hindi</option>
                <option value="en-US">English</option>
              </select>
              <motion.button
                onClick={startVoiceRecording}
                disabled={isRecording}
                className={`px-3 py-1 rounded-lg text-sm font-medium ${isRecording ? "bg-gray-400 cursor-not-allowed" : "bg-teal-600 text-white hover:bg-teal-700"}`}
                whileHover={{ scale: isRecording ? 1 : 1.05 }}
                whileTap={{ scale: isRecording ? 1 : 0.95 }}
              >
                {isRecording ? "Recording..." : "Record Message"}
              </motion.button>
              {recordLang === "hi-IN" && (
                <motion.button
                  onClick={handleTranslateMessage}
                  className="px-3 py-1 rounded-lg text-sm font-medium bg-purple-600 text-white hover:bg-purple-700"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Translate to English
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="fixed bg-white rounded-2xl shadow-2xl p-6 w-[400px] max-h-[60vh] overflow-y-auto border mt-4 z-50"
            style={{ right: `${pos.x}px`, bottom: `${-pos.y + 100}px` }}
            ref={historyContainerRef}
          >
            <div className="flex justify-between items-center mb-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-4 -mx-6 -mt-6 rounded-t-2xl">
              <h3 className="text-xl font-semibold">Chat History</h3>
              <button onClick={() => setShowHistory(false)} className="text-white hover:text-gray-200">
                ✕
              </button>
            </div>

            {(() => {
              const partnerIds = new Set(
                messages
                  .filter(
                    (m) =>
                      m.senderId === Number(userDetails.id) ||
                      m.recipientId === Number(userDetails.id)
                  )
                  .map((m) => (m.senderId === Number(userDetails.id) ? m.recipientId : m.senderId))
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
                return <p className="text-gray-500 text-center">No conversation history.</p>;

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
                    }}
                    className="relative mb-3 p-3 bg-gray-50 border rounded-lg cursor-pointer hover:bg-blue-50"
                  >
                    <p className="font-semibold">
                      {u.name} ({getRole(u)})
                    </p>
                    <p
                      className="text-xs text-gray-600 truncate break-words"
                      dangerouslySetInnerHTML={{
                        __html: linkify(lastMsg?.content || "No messages yet"),
                      }}
                    />
                    {unreadCounts[u.id] > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full px-1 py-[1px] shadow animate-pulse">
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

      <AnimatePresence>
        {showTaskDetailsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-teal-300 relative"
            >
              <button
                onClick={() => {
                  setShowTaskDetailsModal(false);
                  setSelectedTask(null);
                  setTaskLogs([]);
                }}
                className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-xl font-bold"
              >
                X
              </button>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Task Details</h2>
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700"><strong>Title:</strong> {selectedTask?.title || "Untitled Task"}</p>
                <p className="text-sm font-medium text-gray-700"><strong>Description:</strong> {selectedTask?.description || "No description"}</p>
                <p className="text-sm font-medium text-gray-700"><strong>Assigned By:</strong> {selectedTask?.createdBy ? users.find((u) => u.id === selectedTask.createdBy)?.name || "Unknown" : "Unknown"}</p>
                <p className="text-sm font-medium text-gray-700"><strong>Status:</strong> {(selectedTask?.status || "not_started").replace("_", " ")}</p>
                <p className="text-sm font-medium text-gray-700"><strong>Assigned Date:</strong> {selectedTask?.assignedDate ? new Date(selectedTask.assignedDate).toLocaleDateString() : "N/A"}</p>
                <p className="text-sm font-medium text-gray-700"><strong>Deadline:</strong> {selectedTask?.deadline ? new Date(selectedTask.deadline).toLocaleDateString() : "No deadline"}</p>
                <p className="text-sm font-medium text-gray-700"><strong>Resources:</strong> {selectedTask?.resources || "No resources"}</p>

                {selectedTask.sprints?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700">Sprints</h3>
                    <ul className="space-y-2">
                      {selectedTask.sprints.map((s) => (
                        <li key={s.id} className="p-2 bg-gray-50 rounded border">
                          <p className="font-medium">{s.title || "Untitled Sprint"}</p>
                          <p className="text-sm text-gray-600">Status: {s.status.replace("_", " ")}</p>
                          <p className="text-sm text-gray-600">{s.description || "No description."}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Discussion</h3>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {taskLogs.length === 0 ? (
                      <p className="text-sm text-gray-500">No discussion yet.</p>
                    ) : (
                      taskLogs.map((log) => (
                        <div key={log.id} className="p-3 bg-gray-50 rounded-lg shadow-sm border border-gray-200">
                          <p className="text-xs text-gray-600">
                            {users.find((u) => u.id === log.userId)?.name || "Unknown"} ({new Date(log.createdAt).toLocaleString()}):
                          </p>
                          <p className="text-sm text-gray-700">{log.details}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
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

      <AnimatePresence>
        {showComingSoonModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-teal-300 relative"
            >
              <button
                onClick={() => setShowComingSoonModal(false)}
                className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-xl font-bold"
              >
                X
              </button>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Coming Soon</h2>
              <p>Translation is coming soon.</p>
              <div className="flex justify-end mt-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
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