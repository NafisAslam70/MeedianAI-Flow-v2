"use client";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  ClockIcon,
  DocumentTextIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
} from "@heroicons/react/24/solid";
import { motion, AnimatePresence } from "framer-motion";
import QuickCallInvite from "@/components/QuickCallInvite";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

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
      `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-cyan-600 underline break-all hover:text-cyan-800">${url}</a>`
  );
  return withUrls.replace(
    /\[task\s*:\s*(\d+)(?:\s+?sprint\s*:\s*(\d+))?\]/gi,
    (_m, taskId, sprintId) => {
      const label = sprintId ? "View Sprint in Task" : "View Task";
      return `<button class="task-link text-cyan-600 underline font-medium hover:text-cyan-800" data-task-id="${taskId}" data-sprint-id="${sprintId || ""}">${label}</button>`;
    }
  );
};

const getValidImageUrl = (url) => {
  if (!url || typeof url !== "string") return "/default-avatar.png";
  const clean = url.trim();
  if (!clean || clean.toLowerCase() === "null" || clean.toLowerCase() === "undefined") {
    return "/default-avatar.png";
  }
  return clean;
};

const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

export default function ChatBox({ userDetails, isOpen = false, setIsOpen, recipientId, socket }) {
  const MAX_RENDER_MESSAGES = 200; // cap DOM to last N messages for perf
  const pathname = usePathname();
  if (pathname.includes("/workTogether")) return null;

  const { data: session } = useSession();

  const userRole = userDetails?.role || session?.user?.role || "member";
  const muteStorageKey = userDetails?.id ? `chat-mute-${userDetails.id}` : null;

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
  const [isMobile, setIsMobile] = useState(false);
  // Collapsible dock for bottom chat tools
  const [dockExpanded, setDockExpanded] = useState(false);
  // Typing indicators per userId
  const [typingMap, setTypingMap] = useState({});
  const typingTimeoutRef = useRef(null);

  const [isMuted, setIsMuted] = useState(() => {
    if (typeof window === "undefined" || !muteStorageKey) return false;
    try {
      return localStorage.getItem(muteStorageKey) === "true";
    } catch {
      return false;
    }
  });
  const [canMute, setCanMute] = useState(false);
  const [muteConfigLoaded, setMuteConfigLoaded] = useState(false);

  // position + drag
  const [pos, setPos] = useState({ x: 16, y: -16 });
  const [dragging, setDragging] = useState(false);
  const dragRAF = useRef(null);
  const dragStart = useRef({ x: 0, y: 0 });

  const router = useRouter();

  // Keep my freshest image (users list → userDetails → session → default)
  const myImage = useMemo(() => {
    const fromUsers = users.find(u => u.id === Number(userDetails?.id))?.image;
    const src =
      fromUsers ||
      userDetails?.image ||
      session?.user?.image ||
      "/default-avatar.png";
    return getValidImageUrl(src);
  }, [users, userDetails?.id, userDetails?.image, session?.user?.image]);

  // Sync showChatbox with isOpen prop
  useEffect(() => {
    // Track mobile vs desktop to anchor history modal appropriately
    const onResize = () => {
      try { setIsMobile(window.innerWidth <= 640); } catch {}
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    setShowChatbox(isOpen);
  }, [isOpen]);

  // Sync selectedRecipient with recipientId prop
  useEffect(() => {
    if (recipientId) setSelectedRecipient(String(recipientId));
  }, [recipientId]);

  useEffect(() => {
    let active = true;
    const loadMuteSettings = async () => {
      try {
        const res = await fetch("/api/others/chat/settings", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const cfg = await res.json();
        if (!active) return;
        const allowed =
          (userRole === "admin" && cfg.allowAdmins) ||
          (userRole === "team_manager" && cfg.allowManagers) ||
          (userRole === "member" && cfg.allowMembers);
        setCanMute(!!allowed);
      } catch (err) {
        if (active) {
          console.error("Failed to load chat mute settings:", err);
          setCanMute(false);
        }
      } finally {
        if (active) setMuteConfigLoaded(true);
      }
    };

    loadMuteSettings();
    return () => {
      active = false;
    };
  }, [userRole]);

  useEffect(() => {
    if (!muteConfigLoaded) return;
    if (!canMute) {
      if (isMuted) setIsMuted(false);
      if (typeof window !== "undefined" && muteStorageKey) {
        try {
          localStorage.removeItem(muteStorageKey);
        } catch {}
      }
      return;
    }

    if (!muteStorageKey || typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(muteStorageKey);
      if (stored === null) return;
      const next = stored === "true";
      if (isMuted !== next) setIsMuted(next);
    } catch {}
  }, [canMute, isMuted, muteConfigLoaded, muteStorageKey]);

  const playSound = useCallback(() => {
    if (!audioRef.current || isMuted) return;
    audioRef.current.loop = true;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
  }, [isMuted]);

  const stopSound = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
  }, []);

  const toggleMute = useCallback(() => {
    if (!canMute) return;
    setIsMuted((prev) => {
      const next = !prev;
      if (typeof window !== "undefined" && muteStorageKey) {
        try {
          if (next) {
            localStorage.setItem(muteStorageKey, "true");
          } else {
            localStorage.removeItem(muteStorageKey);
          }
        } catch {}
      }
      if (next) stopSound();
      return next;
    });
  }, [canMute, muteStorageKey, stopSound]);

  useEffect(() => {
    if (!muteConfigLoaded) return;
    if (isMuted) {
      stopSound();
      return;
    }
    if (hasUnread && !showChatbox && !showHistory) {
      playSound();
    }
  }, [isMuted, muteConfigLoaded, hasUnread, showChatbox, showHistory, playSound, stopSound]);

  const playSend = useCallback(() => {
    if (!sendAudioRef.current) return;
    sendAudioRef.current.currentTime = 0;
    sendAudioRef.current.play().catch(() => {});
  }, []);

  const playReceive = useCallback(() => {
    if (!receiveAudioRef.current || isMuted) return;
    receiveAudioRef.current.currentTime = 0;
    receiveAudioRef.current.play().catch(() => {});
  }, [isMuted]);

  const scrollBottom = useCallback(() => {
    if (!messagesEndRef.current) return;
    const behavior = prevMessageCount.current > 80 ? "auto" : "smooth";
    requestAnimationFrame(() => {
      try { messagesEndRef.current.scrollIntoView({ behavior }); } catch {}
    });
  }, []);

  const closeAll = useCallback(() => {
    setShowChatbox(false);
    setShowHistory(false);
    if (setIsOpen) setIsOpen(false);
  }, [setIsOpen]);

  const getRole = useCallback((u) => {
    if (!u) return "Unknown";
    if (u.role === "admin") return "Admin";
    if (u.role === "team_manager")
      return `Team Manager${u.team_manager_type ? ` (${toTitle(u.team_manager_type)})` : ""}`;
    return u.type ? toTitle(u.type) : "Member";
  }, []);

  const fetchData = useCallback(async () => {
    if (!userDetails?.id) {
      setError("User details missing.");
      console.error("No userDetails.id provided");
      return;
    }
    try {
      const ctl = new AbortController();
      const timeout = setTimeout(() => ctl.abort(), 15000);
      const [uRes, mRes] = await Promise.allSettled([
        fetch("/api/member/users", { headers: { "Content-Type": "application/json" }, cache: "no-store", signal: ctl.signal }),
        fetch(`/api/others/chat?userId=${encodeURIComponent(userDetails.id)}` , { headers: { "Content-Type": "application/json" }, cache: "no-store", signal: ctl.signal }),
      ]);
      clearTimeout(timeout);

      let fetchedUsers = [];
      if (uRes.status === "fulfilled") {
        try {
          const uj = await uRes.value.json();
          fetchedUsers = uj?.users || [];
        } catch {}
      }
      let fetchedMsgs = [];
      if (mRes.status === "fulfilled") {
        if (mRes.value.ok) {
          try {
            const mj = await mRes.value.json();
            fetchedMsgs = mj?.messages || [];
          } catch {}
        } else {
          // surface server error text for debugging in dev
          if (process.env.NODE_ENV !== "production") {
            console.warn("/api/others/chat non-OK:", mRes.value.status);
          }
        }
      }
      setUsers(fetchedUsers);
      setMessages(fetchedMsgs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));

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
      console.error("Fetch data error:", e);
    }
  }, [userDetails?.id, showChatbox, showHistory, playSound, stopSound]);

  const markReadForPartner = useCallback(async (partnerId) => {
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
      const stillHasUnread = Object.keys(copy).length > 0;
      setHasUnread(stillHasUnread);
      if (!stillHasUnread) stopSound();
      return copy;
    });

    await Promise.all(
      toMark.map((m) =>
        fetch("/api/others/chat", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId: m.id, status: "read" }),
        })
      )
    );
  }, [messages, userDetails?.id, stopSound]);

  const sendMessage = useCallback(async () => {
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
    scrollBottom();
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
      playSend();
    } catch {
      setError("Send failed.");
    }
  }, [selectedRecipient, messageContent, userDetails?.id, scrollBottom, playSend]);

  const mouseDown = useCallback((e) => {
    // Start dragging only from the explicit handle to avoid confusion with clicks
    if (e.button !== 0) return;
    setDragging(true);
    dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  }, [pos]);

  const mouseMove = useCallback((e) => {
    if (!dragging) return;
    const newX = Math.max(0, Math.min(e.clientX - dragStart.current.x, window.innerWidth - 380));
    const newY = Math.max(-window.innerHeight + 72, Math.min(e.clientY - dragStart.current.y, -40));
    if (dragRAF.current) return; // throttle to next frame
    dragRAF.current = requestAnimationFrame(() => {
      setPos({ x: newX, y: newY });
      dragRAF.current = null;
    });
  }, [dragging]);

  const mouseUp = useCallback(() => {
    setDragging(false);
    if (dragRAF.current) {
      cancelAnimationFrame(dragRAF.current);
      dragRAF.current = null;
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const myId = Number(userDetails.id);
    const toMark = messages.filter((m) => m.recipientId === myId && m.status === "sent");
    if (toMark.length === 0) {
      setHasUnread(false);
      setUnreadCounts({});
      stopSound();
      return;
    }
    // Optimistic UI updates
    setMessages((prev) => prev.map((m) => (m.recipientId === myId && m.status === 'sent' ? { ...m, status: 'read' } : m)));
    setUnreadCounts({});
    setHasUnread(false);
    stopSound();
    try {
      await Promise.all(
        toMark.map((m) =>
          fetch("/api/others/chat", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageId: m.id, status: "read" }),
          })
        )
      );
    } catch {}
  }, [messages, userDetails?.id, stopSound]);

  const dispatchOpenTask = useCallback((taskId, sprintId) => {
    window.dispatchEvent(
      new CustomEvent("member-open-task", {
        detail: { taskId: Number(taskId), sprintId: sprintId ? Number(sprintId) : null },
      })
    );
  }, []);

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
        const memberDashboardPath = "/dashboard/member";
        if (pathname !== memberDashboardPath) {
          const query = sprintId ? `?focusTask=${taskId}&focusSprint=${sprintId}` : `?focusTask=${taskId}`;
          try {
            const payload = {
              taskId: Number(taskId),
              sprintId: sprintId ? Number(sprintId) : null,
              ts: Date.now(),
            };
            sessionStorage.setItem("sharedDashboardFocusTask", JSON.stringify(payload));
          } catch {}
          router.push(`${memberDashboardPath}${query}`);
        } else {
          dispatchOpenTask(taskId, sprintId);
        }
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
  }, [showHistory, userDetails?.role, pathname, router, dispatchOpenTask, closeAll]);

  // Initial fetch + periodic refresh (slower refresh if realtime socket connected)
  useEffect(() => {
    fetchData();
    const intervalMs = socket?.connected ? 60000 : 10000;
    const id = setInterval(fetchData, intervalMs);
    return () => clearInterval(id);
  }, [fetchData, socket?.connected]);

  // Socket realtime bindings
  useEffect(() => {
    if (!socket || !userDetails?.id) return;
    const myId = Number(userDetails.id);
    const onMessage = (m) => {
      if (m.senderId !== myId && m.recipientId !== myId) return;

      let inserted = false;
      setMessages((prev) => {
        if (prev.some((x) => x.id === m.id)) return prev;
        inserted = true;
        return [...prev, m];
      });

      const partnerId = m.senderId === myId ? m.recipientId : m.senderId;
      const isIncoming = m.recipientId === myId && m.senderId !== myId;
      const isFocusedPartner = showChatbox && String(partnerId) === String(selectedRecipient);

      if (isIncoming && isFocusedPartner) {
        setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, status: "read" } : x)));
        fetch("/api/others/chat", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId: m.id, status: "read" }),
        }).catch(() => {});
      }

      if (isIncoming && inserted && !isFocusedPartner) {
        setUnreadCounts((prev) => {
          const copy = { ...prev, [m.senderId]: (prev[m.senderId] || 0) + 1 };
          setHasUnread(true);
          return copy;
        });
        if (!showChatbox && !showHistory && lastAlertedId.current !== m.id) {
          lastAlertedId.current = m.id;
          if (!isMuted) playSound();
        }
      }
    };
    const onTyping = ({ userId, isTyping }) => {
      setTypingMap((prev) => ({ ...prev, [userId]: !!isTyping }));
    };
    socket.on("message", onMessage);
    socket.on("typing", onTyping);
    return () => {
      socket.off("message", onMessage);
      socket.off("typing", onTyping);
    };
  }, [socket, userDetails?.id, showChatbox, selectedRecipient, showHistory, isMuted, playSound]);

  // Emit typing events when composing
  const emitTyping = useCallback((isTyping) => {
    try {
      if (!socket || !selectedRecipient) return;
      socket.emit("typing", { userId: Number(userDetails.id), isTyping });
    } catch {}
  }, [socket, selectedRecipient, userDetails?.id]);

  useEffect(() => {
    if (showChatbox && selectedRecipient) markReadForPartner(Number(selectedRecipient));
  }, [showChatbox, selectedRecipient, markReadForPartner]);

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
    if (showChatbox && selectedRecipient) {
      scrollBottom();
    }
  }, [showChatbox, selectedRecipient, scrollBottom]);

  useEffect(() => {
    const chatRef = chatContainerRef.current;
    if (!chatRef) return;

    const newLength = messages.length;
    const oldLength = prevMessageCount.current;

    if (newLength > oldLength) {
      const newMessages = messages.slice(oldLength);
      newMessages.forEach((m) => {
        if (m.senderId === Number(userDetails.id)) {
          playSend();
        } else if (showChatbox && selectedRecipient === String(m.senderId)) {
          playReceive();
        }
      });
      scrollBottom();
    }

    prevMessageCount.current = newLength;
  }, [messages, showChatbox, selectedRecipient, userDetails?.id, playSend, playReceive, scrollBottom]);

  useEffect(() => {
    window.addEventListener("mousemove", mouseMove);
    window.addEventListener("mouseup", mouseUp);
    return () => {
      window.removeEventListener("mousemove", mouseMove);
      window.removeEventListener("mouseup", mouseUp);
    };
  }, [mouseMove, mouseUp]);

  useEffect(() => {
    const handleProfileUpdate = () => {
      fetchData();
    };
    const onMessage = (event) => {
      if (event.data?.type === "PROFILE_UPDATED") handleProfileUpdate();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [fetchData]);

  const startVoiceRecording = useCallback(() => {
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
  }, [recordLang]);

  const handleTranslateMessage = useCallback(() => setShowComingSoonModal(true), []);

  const filteredMessages = useMemo(() => {
    if (!selectedRecipient) return [];
    return messages
      .filter(
        (m) =>
          (m.senderId === Number(userDetails.id) &&
            m.recipientId === Number(selectedRecipient)) ||
          (m.senderId === Number(selectedRecipient) &&
            m.recipientId === Number(userDetails.id))
      )
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .slice(-MAX_RENDER_MESSAGES);
  }, [messages, selectedRecipient, userDetails?.id]);

  return (
    <>
      <style jsx global>{`
        @media (max-width: 640px) {
          .chatbox-container {
            width: auto !important;
            max-width: calc(100vw - 24px) !important;
            /* Pin dock cluster to bottom-right on mobile */
            left: auto !important;
            right: 12px !important;
            bottom: 12px !important;
          }
          .history-container {
            width: 95vw !important;
            max-height: 75vh !important;
          }
          .modal-container {
            max-width: 90vw !important;
            padding: 1rem !important;
          }
        }
      `}</style>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed z-50 chatbox-container"
        style={{ right: `${pos.x}px`, bottom: `${-pos.y + 40}px`, willChange: 'right, bottom' }}
      >
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-4 left-4 right-4 bg-red-50 text-red-700 text-xs p-2 rounded-md shadow"
          >
            {error}
          </motion.p>
        )}

        <div className="flex gap-2 items-center flex-wrap">
          {/* Drag handle (explicit, avoids conflict with buttons) */}
          <div
            className={`drag-handle select-none inline-flex items-center justify-center w-9 h-9 rounded-full border ${dragging ? 'bg-gray-200 border-gray-300' : 'bg-white border-gray-200 hover:bg-gray-50'} shadow cursor-${dragging ? 'grabbing' : 'grab'}`}
            title="Drag dock"
            aria-label="Drag dock"
            onMouseDown={mouseDown}
            role="button"
            tabIndex={0}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
              <circle cx="9" cy="7" r="1"></circle>
              <circle cx="15" cy="7" r="1"></circle>
              <circle cx="9" cy="12" r="1"></circle>
              <circle cx="15" cy="12" r="1"></circle>
              <circle cx="9" cy="17" r="1"></circle>
              <circle cx="15" cy="17" r="1"></circle>
            </svg>
          </div>
          {/* Dock toggle (always visible) */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setDockExpanded((v) => !v)}
            className={`p-2.5 sm:p-3 rounded-full shadow-lg transition-transform min-w-[44px] min-h-[44px] border ${dockExpanded ? 'bg-gray-900 text-white border-gray-800' : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-50'}`}
            title={dockExpanded ? 'Hide chat tools' : 'Show chat tools'}
            aria-label={dockExpanded ? 'Hide chat tools' : 'Show chat tools'}
          >
            {dockExpanded ? '×' : '⋯'}
          </motion.button>

          {dockExpanded && (
            <>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              closeAll();
              setShowChatbox(true);
              if (setIsOpen) setIsOpen(true);
            }}
            className="p-2.5 sm:p-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-full shadow-lg transition-transform min-w-[44px] min-h-[44px]"
            title="Open Chat"
            aria-label="Open Chat"
          >
            <ChatBubbleLeftRightIcon className="h-5 w-5" />
          </motion.button>

          <motion.button
            key={jumpKey}
            initial={false}
            animate={
              hasUnread
                ? { y: [0, -20, 0], scale: [1, 1.1, 1] }
                : {}
            }
            transition={{ duration: 0.5, ease: "easeOut" }}
            onClick={() => {
              closeAll();
              setShowHistory(true);
            }}
            className="relative p-2.5 sm:p-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-full shadow-lg transition-transform min-w-[44px] min-h-[44px]"
            title="Chat History"
            aria-label="Chat History"
          >
            <ClockIcon className="h-5 w-5" />
            {hasUnread && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full px-1.5 py-[1px] shadow animate-pulse">
                NEW
              </span>
            )}
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              closeAll();
              router.push("/dashboard/member/notes");
            }}
            className="p-2.5 sm:p-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-full shadow-lg transition-transform min-w-[44px] min-h-[44px]"
            title="My Notes"
            aria-label="My Notes"
          >
            <DocumentTextIcon className="h-5 w-5" />
          </motion.button>
          <QuickCallInvite userDetails={userDetails} position={pos} closeAllModals={closeAll} />
            </>
          )}
        </div>

        <AnimatePresence>
          {showChatbox && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.25 }}
              className="bg-white rounded-2xl shadow-2xl border mt-2 flex flex-col z-50 w-[95vw] sm:w-[360px] max-h-[85vh] sm:max-h-[80vh] overflow-hidden"
            >
              <div className="chatbox-header flex justify-between items-center bg-gradient-to-r from-teal-500 to-cyan-600 text-white px-3 py-2 sm:px-4 sm:py-3">
                <h3 className="text-sm sm:text-base font-semibold">Messages</h3>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setShowChatbox(false);
                      if (setIsOpen) setIsOpen(false);
                    }}
                    className="text-white/90 hover:text-white text-lg"
                    aria-label="Close Chatbox"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-2 sm:p-3 space-y-2 sm:space-y-3 flex-1 flex flex-col overflow-hidden">
                <select
                  className="p-1.5 sm:p-2 border rounded-lg w-full bg-gray-50 text-xs sm:text-sm text-gray-900 focus:ring-2 focus:ring-cyan-500"
                  value={selectedRecipient}
                  onChange={(e) => setSelectedRecipient(e.target.value)}
                  aria-label="Select Recipient"
                >
                  <option value="">Select Recipient</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({getRole(u)})
                    </option>
                  ))}
                </select>

                <div
                  className="flex-1 overflow-y-auto pr-1"
                  ref={chatContainerRef}
                >
                  {selectedRecipient ? (
                    (() => {
                      const displayed = filteredMessages.reduce((acc, m, i) => {
                        const prev = filteredMessages[i - 1];
                        const date = new Date(m.createdAt).toDateString();
                        const prevDate = prev ? new Date(prev.createdAt).toDateString() : null;
                        if (date !== prevDate) {
                          acc.push({ type: 'date', date });
                        }
                        acc.push(m);
                        return acc;
                      }, []);

                      return (
                        <ul className="space-y-2">
                          {displayed.map((item, index) => {
                            if (item.type === 'date') {
                              return (
                                <li key={`date-${index}`} className="text-center my-2">
                                  <span className="bg-gray-200 px-2 py-1 rounded text-xs text-gray-600">
                                    {formatDate(item.date)}
                                  </span>
                                </li>
                              );
                            }

                            const m = item;
                            const sender = users.find((u) => u.id === m.senderId) || {
                              name: "Unknown",
                              image: "/default-avatar.png",
                            };
                            const isOwnMessage = m.senderId === Number(userDetails.id);
                            return (
                              <li
                                key={m.id}
                                className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                              >
                                <div
                                  className={`flex items-start gap-1.5 max-w-[85%] p-2 sm:p-2.5 rounded-xl border ${
                                    isOwnMessage ? "bg-teal-100 ml-4 sm:ml-6" : "bg-gray-100 mr-4 sm:mr-6"
                                  }`}
                                >
                                  {!isOwnMessage && (
                                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full overflow-hidden flex-shrink-0">
                                      <img
                                        src={getValidImageUrl(sender.image)}
                                        alt={`${sender.name}'s profile`}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          console.error("Chatbox sender image failed to load:", {
                                            senderId: m.senderId,
                                            senderName: sender.name,
                                            imageUrl: sender.image,
                                          });
                                          e.currentTarget.src = "/default-avatar.png";
                                        }}
                                      />
                                    </div>
                                  )}
                                  <div className="min-w-0 flex flex-col">
                                    <p
                                      className="text-xs sm:text-sm text-gray-900 break-words"
                                      dangerouslySetInnerHTML={{ __html: linkify(m.content) }}
                                      title={new Date(m.createdAt).toLocaleString()}
                                    />
                                    <div className="flex items-center justify-between mt-1">
                                      <p className="text-[10px] sm:text-xs text-gray-600">
                                        {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                      </p>
                                      {isOwnMessage && (
                                        <span className={`text-[10px] ${m.status === 'read' ? 'text-blue-500' : 'text-gray-500'}`}>
                                          {m.status === 'read' ? '✓✓' : '✓'}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {isOwnMessage && (
                                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full overflow-hidden flex-shrink-0">
                                      <img
                                        src={myImage}
                                        alt="Your profile"
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          console.error("Chatbox user image failed to load:", {
                                            userId: userDetails?.id,
                                            imageUrl: myImage,
                                          });
                                          e.currentTarget.src = "/default-avatar.png";
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                          <div ref={messagesEndRef} />
                        </ul>
                      );
                    })()
                  ) : (
                    <p className="text-gray-600 text-center mt-3 text-xs sm:text-sm">
                      Select a recipient to start chatting.
                    </p>
                  )}
                </div>

                <div className="flex gap-1.5">
                  <input
                    type="text"
                    className="flex-1 p-1.5 sm:p-2 border rounded-lg bg-gray-50 text-xs sm:text-sm text-gray-900 focus:ring-2 focus:ring-cyan-500"
                    placeholder="Type message..."
                    value={messageContent}
                    onChange={(e) => {
                      setMessageContent(e.target.value);
                      emitTyping(true);
                      clearTimeout(typingTimeoutRef.current);
                      typingTimeoutRef.current = setTimeout(() => emitTyping(false), 1500);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    aria-label="Type message"
                  />
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={sendMessage}
                    className="p-2 sm:p-2.5 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg min-w-[44px] min-h-[44px]"
                    aria-label="Send message"
                  >
                    <PaperAirplaneIcon className="h-5 w-5" />
                  </motion.button>
                </div>
                {!!typingMap[Number(selectedRecipient)] && (
                  <div className="text-[11px] text-gray-500 mt-1">Typing…</div>
                )}

                <div className="flex items-center mt-1 gap-1.5">
                  <select
                    value={recordLang}
                    onChange={(e) => setRecordLang(e.target.value)}
                    className="p-1 border rounded-lg bg-gray-50 text-xs text-gray-900 focus:ring-2 focus:ring-cyan-500"
                    aria-label="Select recording language"
                  >
                    <option value="hi-IN">Hindi</option>
                    <option value="en-US">English</option>
                  </select>
                  <motion.button
                    onClick={startVoiceRecording}
                    disabled={isRecording}
                    className={`px-2 py-1 rounded-lg text-xs font-medium ${
                      isRecording ? "bg-gray-400 cursor-not-allowed text-white" : "bg-teal-600 text-white hover:bg-teal-700"
                    } min-w-[44px] min-h-[36px]`}
                    whileHover={{ scale: isRecording ? 1 : 1.04 }}
                    whileTap={{ scale: isRecording ? 1 : 0.95 }}
                    aria-label={isRecording ? "Recording in progress" : "Start voice recording"}
                  >
                    {isRecording ? "Recording..." : "Record"}
                  </motion.button>
                  {recordLang === "hi-IN" && (
                    <motion.button
                      onClick={handleTranslateMessage}
                      className="px-2 py-1 rounded-lg text-xs font-medium bg-purple-600 text-white hover:bg-purple-700 min-w-[44px] min-h-[36px]"
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.95 }}
                      aria-label="Translate to English"
                    >
                      Translate → EN
                    </motion.button>
                  )}
                </div>
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
              transition={{ duration: 0.25 }}
              className="fixed bg-white rounded-2xl shadow-2xl border z-50 w-[95vw] sm:w-[340px] max-h-[75vh] overflow-y-auto mt-2 history-container"
              style={isMobile ? { left: 12, right: 12, bottom: 80 } : { right: `${pos.x}px`, bottom: `${-pos.y + 96}px` }}
              ref={historyContainerRef}
            >
              <div className="flex justify-between items-center bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-3 py-2 sm:px-4 sm:py-3 rounded-t-2xl">
                <h3 className="text-sm sm:text-base font-semibold">Chat History</h3>
                <div className="flex items-center gap-2">
                  {muteConfigLoaded && canMute && (
                    <button
                      onClick={toggleMute}
                      className={`rounded-full p-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-white/60 ${
                        isMuted ? "bg-white/20 hover:bg-white/30" : "bg-white/10 hover:bg-white/20"
                      }`}
                      aria-label={isMuted ? "Unmute chat alerts" : "Mute chat alerts"}
                      title={isMuted ? "Unmute chat alerts" : "Mute chat alerts"}
                    >
                      {isMuted ? (
                        <SpeakerXMarkIcon className="h-4 w-4 text-white" />
                      ) : (
                        <SpeakerWaveIcon className="h-4 w-4 text-white" />
                      )}
                    </button>
                  )}
                  <button
                    onClick={markAllRead}
                    className="text-[11px] sm:text-xs px-2.5 py-1 rounded-md bg-white/15 hover:bg-white/25 border border-white/25"
                    title="Mark all as read"
                  >
                    Read all
                  </button>
                  <button
                    onClick={() => setShowHistory(false)}
                    className="text-white/90 hover:text-white text-lg"
                    aria-label="Close Chat History"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-2 sm:p-3 space-y-2">
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

                  const partnerTimestamps = Array.from(partnerIds).map((partnerId) => {
                    const lastMsg = messages
                      .filter(
                        (m) =>
                          (m.senderId === partnerId && m.recipientId === Number(userDetails.id)) ||
                          (m.senderId === Number(userDetails.id) && m.recipientId === partnerId)
                      )
                      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
                    return {
                      partnerId,
                      lastMsgTime: lastMsg ? new Date(lastMsg.createdAt).getTime() : 0,
                      lastMsg
                    };
                  });

                  partnerTimestamps.sort((a, b) => b.lastMsgTime - a.lastMsgTime);

                  const sortedPartners = partnerTimestamps
                    .map(({ partnerId, lastMsg }) => ({
                      user: users.find((u) => u.id === partnerId),
                      lastMsg
                    }))
                    .filter(({ user }) => user);

                  if (!sortedPartners.length)
                    return <p className="text-gray-600 text-center text-xs sm:text-sm">No conversation history.</p>;

                  return sortedPartners.map(({ user: u, lastMsg }) => (
                    <div
                      key={u.id}
                      onClick={() => {
                        setSelectedRecipient(String(u.id));
                        closeAll();
                        setShowChatbox(true);
                        if (setIsOpen) setIsOpen(true);
                      }}
                      className="relative mb-2 p-2 sm:p-2.5 bg-gray-50 border rounded-lg cursor-pointer hover:bg-blue-50 flex items-center gap-2"
                    >
                      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden flex-shrink-0">
                        <img
                          src={getValidImageUrl(u.image)}
                          alt={`${u.name}'s profile`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            console.error("History image failed to load:", {
                              userId: u.id,
                              userName: u.name,
                              imageUrl: u.image,
                            });
                            e.currentTarget.src = "/default-avatar.png";
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate text-xs sm:text-sm text-gray-900">
                          {u.name} ({getRole(u)})
                        </p>
                        <p
                          className="text-xs text-gray-600 break-words"
                          style={{
                            wordBreak: "break-word",
                            overflowWrap: "break-word",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
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
                  ));
                })()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showTaskDetailsModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-3 z-50"
            >
              <motion.div
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="bg-white rounded-2xl shadow-2xl p-4 sm:p-5 w-full max-w-[90vw] sm:max-w-md border border-teal-300 relative modal-container"
              >
                <button
                  onClick={() => {
                    setShowTaskDetailsModal(false);
                    setSelectedTask(null);
                    setTaskLogs([]);
                  }}
                  className="absolute top-2 right-2 text-gray-600 hover:text-gray-800 text-lg font-bold"
                  aria-label="Close Task Details"
                >
                  ×
                </button>
                <h2 className="text-sm sm:text-base font-semibold text-gray-900 mb-2 sm:mb-3">
                  Task Details
                </h2>
                <div className="space-y-2">
                  <p className="text-xs sm:text-sm font-medium text-gray-800">
                    <strong>Title:</strong> {selectedTask?.title || "Untitled Task"}
                  </p>
                  <p className="text-xs sm:text-sm font-medium text-gray-800">
                    <strong>Description:</strong> {selectedTask?.description || "No description"}
                  </p>
                  <p className="text-xs sm:text-sm font-medium text-gray-800">
                    <strong>Assigned By:</strong>{" "}
                    {selectedTask?.createdBy
                      ? users.find((u) => u.id === selectedTask.createdBy)?.name || "Unknown"
                      : "Unknown"}
                  </p>
                  <p className="text-xs sm:text-sm font-medium text-gray-800">
                    <strong>Status:</strong> {(selectedTask?.status || "not_started").replace("_", " ")}
                  </p>
                  <p className="text-xs sm:text-sm font-medium text-gray-800">
                    <strong>Assigned Date:</strong>{" "}
                    {selectedTask?.assignedDate
                      ? new Date(selectedTask.assignedDate).toLocaleDateString()
                      : "N/A"}
                  </p>
                  <p className="text-xs sm:text-sm font-medium text-gray-800">
                    <strong>Deadline:</strong>{" "}
                    {selectedTask?.deadline
                      ? new Date(selectedTask.deadline).toLocaleDateString()
                      : "No deadline"}
                  </p>
                  <p className="text-xs sm:text-sm font-medium text-gray-800">
                    <strong>Resources:</strong> {selectedTask?.resources || "No resources"}
                  </p>

                  {selectedTask?.sprints?.length > 0 && (
                    <div>
                      <h3 className="text-xs sm:text-sm font-semibold text-gray-800">Sprints</h3>
                      <ul className="space-y-1.5">
                        {selectedTask.sprints.map((s) => (
                          <li key={s.id} className="p-1.5 sm:p-2 bg-gray-50 rounded border">
                            <p className="font-medium text-xs sm:text-sm text-gray-800">
                              {s.title || "Untitled Sprint"}
                            </p>
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
                    <h3 className="text-xs sm:text-sm font-semibold text-gray-800 mb-1.5">Discussion</h3>
                    <div className="max-h-32 sm:max-h-36 overflow-y-auto space-y-1.5">
                      {taskLogs.length === 0 ? (
                        <p className="text-xs sm:text-sm text-gray-600">No discussion yet.</p>
                      ) : (
                        taskLogs.map((log) => (
                          <div
                            key={log.id}
                            className="p-2 bg-gray-50 rounded-lg shadow-sm border border-gray-200"
                          >
                            <p className="text-[10px] sm:text-xs text-gray-600">
                              {users.find((u) => u.id === log.userId)?.name || "Unknown"} (
                              {new Date(log.createdAt).toLocaleString()}):
                            </p>
                            <p className="text-xs sm:text-sm text-gray-800">{log.details}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setShowTaskDetailsModal(false);
                        setSelectedTask(null);
                        setTaskLogs([]);
                      }}
                      className="px-3 py-1.5 bg-gray-500 text-white rounded-md text-xs sm:text-sm font-medium min-w-[44px] min-h-[36px]"
                      aria-label="Close Task Details"
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
              className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-3 z-50"
            >
              <motion.div
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="bg-white rounded-2xl shadow-2xl p-4 sm:p-5 w-full max-w-[90vw] border border-teal-300 relative modal-container"
              >
                <button
                  onClick={() => setShowComingSoonModal(false)}
                  className="absolute top-2 right-2 text-gray-600 hover:text-gray-800 text-lg font-bold"
                  aria-label="Close Coming Soon Modal"
                >
                  ×
                </button>
                <h2 className="text-sm sm:text-base font-semibold text-gray-900 mb-2">Coming Soon</h2>
                <p className="text-xs sm:text-sm text-gray-800">Translation is coming soon.</p>
                <div className="flex justify-end mt-3">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowComingSoonModal(false)}
                    className="px-3 py-1.5 bg-gray-500 text-white rounded-md text-xs sm:text-sm font-medium min-w-[44px] min-h-[36px]"
                    aria-label="Close Coming Soon Modal"
                  >
                    Close
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}
