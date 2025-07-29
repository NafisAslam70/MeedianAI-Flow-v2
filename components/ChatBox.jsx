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

  /*──── notification / jump tracking ────*/
  const [jumpKey, setJumpKey] = useState(0);
  const [lastNotifiedId, setLastNotifiedId] = useState(null); // stop repeat sound

  /*──── refs ────*/
  const audioRef = useRef(null);
  const messagesEndRef = useRef(null);

  /*──── floating position + drag ────*/
  const [pos, setPos] = useState({ x: 20, y: -20 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

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
      return `Team Manager${u.team_manager_type ? ` (${toTitle(u.team_manager_type)})` : ""}`;
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
          m.status === "sent" &&
          m.senderId !== Number(userDetails.id) // Exclude sender's own messages
        ) {
          acc[m.senderId] = (acc[m.senderId] || 0) + 1;
        }
        return acc;
      }, {});
      setUnreadCounts(counts);
      setHasUnread(Object.values(counts).some((c) => c > 0));

      /* latest incoming msg */
      const latestIncoming = fetchedMsgs
        .filter((m) => m.recipientId === Number(userDetails.id) && m.senderId !== Number(userDetails.id))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

      if (
        latestIncoming &&
        latestIncoming.id !== lastNotifiedId &&
        !showChatbox &&
        !showHistory
      ) {
        playSound();
        setJumpKey(Date.now());
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
        m.recipientId === Number(userDetails.id) && m.status === "sent" && m.senderId !== Number(userDetails.id)
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
          key={jumpKey}
          initial={false}
          animate={hasUnread ? { 
            y: [0, -50, 0, -40, 0, -30, 0],
            rotate: [0, -15, 15, -15, 15, -10, 10, 0],
            scale: [1, 1.4, 1, 1.3, 1, 1.2, 1],
            boxShadow: [
              "0 4px 10px rgba(0,0,0,0.2)",
              "0 8px 20px rgba(255,69,0,0.5)",
              "0 4px 10px rgba(0,0,0,0.2)",
              "0 8px 20px rgba(255,69,0,0.5)",
              "0 4px 10px rgba(0,0,0,0.2)",
              "0 6px 15px rgba(255,69,0,0.4)",
              "0 4px 10px rgba(0,0,0,0.2)"
            ]
          } : {}}
          transition={{ duration: 0.5, ease: "easeOut", times: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1] }}
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
    </motion.div>
  );
}

// "use client";
// import { useEffect, useState, useRef } from "react";
// import {
//   ChatBubbleLeftRightIcon,
//   PaperAirplaneIcon,
//   ClockIcon,
// } from "@heroicons/react/24/solid";
// import { motion, AnimatePresence } from "framer-motion";
// import ScheduleMeet from "@/components/ScheduleMeet";

// /* ────────── helpers ────────── */
// const toTitle = (str = "") =>
//   str
//     .split("_")
//     .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
//     .join(" ");

// export default function ChatBox({ userDetails }) {
//   /*────────────────────── state ──────────────────────*/
//   const [messages, setMessages] = useState([]);
//   const [users, setUsers] = useState([]);
//   const [selectedRecipient, setSelectedRecipient] = useState("");
//   const [messageContent, setMessageContent] = useState("");

//   const [showChatbox, setShowChatbox] = useState(false);
//   const [showHistory, setShowHistory] = useState(false);

//   const [unreadCounts, setUnreadCounts] = useState({});
//   const [hasUnread, setHasUnread] = useState(false);

//   const [error, setError] = useState(null);

//   /*──── notification / jump tracking ────*/
//   const [jumpKey, setJumpKey] = useState(0);
//   const [lastNotifiedId, setLastNotifiedId] = useState(null); // stop repeat sound

//   /*──── refs ────*/
//   const audioRef = useRef(null);
//   const messagesEndRef = useRef(null);

//   /*──── floating position + drag ────*/
//   const [pos, setPos] = useState({ x: 20, y: -20 });
//   const [dragging, setDragging] = useState(false);
//   const dragStart = useRef({ x: 0, y: 0 });

//   /*────────────────────── helpers ──────────────────────*/
//   const playSound = () => {
//     if (!audioRef.current) return;
//     audioRef.current.currentTime = 0;
//     audioRef.current.play().catch(console.error);
//   };

//   const scrollBottom = () =>
//     messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

//   const closeAll = () => {
//     setShowChatbox(false);
//     setShowHistory(false);
//   };

//   const getRole = (u) => {
//     if (u.role === "admin") return "Admin";
//     if (u.role === "team_manager")
//       return `Team Manager${u.team_manager_type ? ` (${toTitle(u.team_manager_type)})` : ""}`;
//     return u.type ? toTitle(u.type) : "Member";
//   };

//   const getInitials = (name) => {
//     return name
//       .split(" ")
//       .map((word) => word[0])
//       .join("")
//       .toUpperCase();
//   };

//   /*────────────────────── polling ──────────────────────*/
//   const fetchData = async () => {
//     if (!userDetails?.id) return;
//     try {
//       /* users list */
//       const usersRes = await fetch("/api/member/users");
//       const { users: fetchedUsers = [] } = await usersRes.json();
//       setUsers(fetchedUsers);

//       /* messages list */
//       const msgRes = await fetch(`/api/others/chat?userId=${userDetails.id}`);
//       const { messages: fetchedMsgs = [] } = await msgRes.json();
//       setMessages(fetchedMsgs);

//       /* compute unread counts */
//       const counts = fetchedMsgs.reduce((acc, m) => {
//         if (
//           m.recipientId === Number(userDetails.id) &&
//           m.status === "sent" &&
//           m.senderId !== Number(userDetails.id) // Exclude sender's own messages
//         ) {
//           acc[m.senderId] = (acc[m.senderId] || 0) + 1;
//         }
//         return acc;
//       }, {});
//       setUnreadCounts(counts);
//       setHasUnread(Object.values(counts).some((c) => c > 0));

//       /* latest incoming msg */
//       const latestIncoming = fetchedMsgs
//         .filter((m) => m.recipientId === Number(userDetails.id) && m.senderId !== Number(userDetails.id))
//         .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

//       if (
//         latestIncoming &&
//         latestIncoming.id !== lastNotifiedId &&
//         !showChatbox &&
//         !showHistory
//       ) {
//         playSound();
//         setJumpKey(Date.now());
//         setLastNotifiedId(latestIncoming.id);
//       }
//     } catch (e) {
//       console.error(e);
//       setError("Chat fetch error.");
//     }
//   };

//   /* mark ALL unread → read (bulk) */
//   const markAllRead = async () => {
//     const toMark = messages.filter(
//       (m) =>
//         m.recipientId === Number(userDetails.id) && m.status === "sent" && m.senderId !== Number(userDetails.id)
//     );

//     if (toMark.length) {
//       await Promise.all(
//         toMark.map((m) =>
//           fetch("/api/others/chat", {
//             method: "PUT",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify({ messageId: m.id, status: "read" }),
//           })
//         )
//       );
//     }
//     setUnreadCounts({});
//     setHasUnread(false);

//     // ensure no repeat alert for the same batch
//     const latest = toMark.sort(
//       (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
//     )[0];
//     if (latest) setLastNotifiedId(latest.id);
//   };

//   /*────────────────────── send ──────────────────────*/
//   const sendMessage = async () => {
//     if (!selectedRecipient || !messageContent.trim()) {
//       setError("Pick a recipient and write something.");
//       return;
//     }
//     try {
//       const tempId = `tmp-${Date.now()}`;
//       const optimistic = {
//         id: tempId,
//         senderId: Number(userDetails.id),
//         recipientId: Number(selectedRecipient),
//         content: messageContent,
//         createdAt: new Date().toISOString(),
//         status: "sent",
//       };
//       setMessages((p) => [...p, optimistic]);
//       setMessageContent("");

//       const res = await fetch("/api/others/chat", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           userId: userDetails.id,
//           recipientId: selectedRecipient,
//           message: optimistic.content,
//         }),
//       });
//       const { message: saved } = await res.json();
//       setMessages((p) => p.map((m) => (m.id === tempId ? saved : m)));
//     } catch (e) {
//       console.error(e);
//       setError("Send failed.");
//     }
//   };

//   /*────────────────────── drag ──────────────────────*/
//   const mouseDown = (e) => {
//     if (e.target.closest(".chatbox-header")) {
//       setDragging(true);
//       dragStart.current = {
//         x: e.clientX - pos.x,
//         y: e.clientY - pos.y,
//       };
//     }
//   };
//   const mouseMove = (e) => {
//     if (dragging)
//       setPos({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
//   };
//   const mouseUp = () => setDragging(false);

//   /*────────────────────── effects ──────────────────────*/
//   useEffect(() => {
//     audioRef.current = new Audio("/sms.mp3");
//     audioRef.current.preload = "auto";
//     audioRef.current.loop = false;
//   }, []);

//   useEffect(() => {
//     fetchData();
//     const id = setInterval(fetchData, 5000);
//     return () => clearInterval(id);
//   }, [userDetails?.id, showChatbox, showHistory]);

//   /* clear badge + mark read when opening any chat UI */
//   useEffect(() => {
//     if ((showChatbox || showHistory) && hasUnread) markAllRead();
//   }, [showChatbox, showHistory]);

//   useEffect(() => {
//     window.addEventListener("mousemove", mouseMove);
//     window.addEventListener("mouseup", mouseUp);
//     return () => {
//       window.removeEventListener("mousemove", mouseMove);
//       window.removeEventListener("mouseup", mouseUp);
//     };
//   }, [dragging]);

//   useEffect(scrollBottom, [messages]);

//   /*────────────────────── render ──────────────────────*/
//   return (
//     <motion.div
//       initial={{ opacity: 0, x: 20 }}
//       animate={{ opacity: 1, x: 0 }}
//       transition={{ duration: 0.3 }}
//       className="fixed z-50"
//       style={{ right: `${pos.x}px`, bottom: `${-pos.y + 40}px` }}
//       onMouseDown={mouseDown}
//     >
//       {/* error banner */}
//       {error && (
//         <motion.p
//           initial={{ opacity: 0, y: -20 }}
//           animate={{ opacity: 1, y: 0 }}
//           exit={{ opacity: 0, y: -20 }}
//           className="absolute top-6 left-6 right-6 bg-red-100/90 backdrop-blur-md text-red-700 text-sm p-4 rounded-xl shadow-xl border border-red-200/50 ring-1 ring-red-300/30"
//         >
//           {error}
//         </motion.p>
//       )}

//       {/* action buttons */}
//       <div className="flex gap-4">
//         {/* open chat */}
//         <motion.button
//           whileHover={{ scale: 1.15, rotate: 10, boxShadow: "0 12px 24px rgba(0, 200, 200, 0.4)" }}
//           whileTap={{ scale: 0.9 }}
//           onClick={() => {
//             closeAll();
//             setShowChatbox(true);
//           }}
//           className="p-5 bg-gradient-to-br from-teal-500 to-cyan-600 text-white rounded-full shadow-2xl hover:shadow-cyan-400/60 transition-all duration-200 border-2 border-teal-300/50"
//           title="Open Chat"
//         >
//           <ChatBubbleLeftRightIcon className="h-8 w-8" />
//         </motion.button>

//         {/* history */}
//         <motion.button
//           key={jumpKey}
//           initial={false}
//           animate={hasUnread ? { 
//             y: [0, -70, 0, -60, 0, -50, 0],
//             rotate: [0, -25, 25, -25, 25, -15, 15, 0],
//             scale: [1, 1.6, 1, 1.5, 1, 1.4, 1],
//             boxShadow: [
//               "0 4px 12px rgba(0,0,0,0.3)",
//               "0 15px 35px rgba(255,69,0,0.7)",
//               "0 4px 12px rgba(0,0,0,0.3)",
//               "0 15px 35px rgba(255,69,0,0.7)",
//               "0 4px 12px rgba(0,0,0,0.3)",
//               "0 10px 25px rgba(255,69,0,0.6)",
//               "0 4px 12px rgba(0,0,0,0.3)"
//             ]
//           } : {}}
//           transition={{ duration: 0.4, ease: "easeOut", times: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1] }}
//           whileHover={{ scale: 1.15, rotate: -10, boxShadow: "0 12px 24px rgba(100, 0, 255, 0.4)" }}
//           whileTap={{ scale: 0.9 }}
//           onClick={() => {
//             closeAll();
//             setShowHistory(true);
//           }}
//           className="relative p-5 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-full shadow-2xl hover:shadow-indigo-400/60 transition-all duration-200 border-2 border-indigo-300/50"
//           title="Chat History"
//         >
//           <ClockIcon className="h-8 w-8" />
//           {hasUnread && (
//             <motion.span
//               initial={{ scale: 0 }}
//               animate={{ scale: [1, 1.2, 1], transition: { duration: 0.5, repeat: Infinity } }}
//               className="absolute -top-3 -right-3 bg-gradient-to-r from-red-500 to-orange-600 text-white text-xs font-bold rounded-full px-4 py-1 shadow-xl ring-2 ring-red-400/40"
//             >
//               NEW
//             </motion.span>
//           )}
//         </motion.button>

//         {/* schedule meet */}
//         <ScheduleMeet
//           userDetails={userDetails}
//           position={pos}
//           closeAllModals={closeAll}
//         />
//       </div>

//       {/* CHATBOX PANEL */}
//       <AnimatePresence>
//         {showChatbox && (
//           <motion.div
//             initial={{ opacity: 0, y: 120, scale: 0.85 }}
//             animate={{ opacity: 1, y: 0, scale: 1 }}
//             exit={{ opacity: 0, y: 120, scale: 0.85 }}
//             transition={{ duration: 0.5, type: "spring", stiffness: 200 }}
//             className="bg-white/85 backdrop-blur-2xl rounded-3xl shadow-2xl p-8 w-[480px] max-h-[85vh] overflow-hidden border-2 border-teal-300/40 mt-8 flex flex-col ring-2 ring-teal-200/50"
//           >
//             <div className="chatbox-header flex justify-between items-center mb-8 bg-gradient-to-r from-teal-600/95 to-cyan-600/95 backdrop-blur-md text-white p-6 -mx-8 -mt-8 rounded-t-3xl shadow-xl ring-1 ring-teal-300/50">
//               <h3 className="text-2xl font-extrabold tracking-tight">Messages</h3>
//               <motion.button
//                 whileHover={{ scale: 1.3, rotate: 360 }}
//                 whileTap={{ scale: 0.8 }}
//                 onClick={() => setShowChatbox(false)}
//                 className="text-white hover:text-teal-100 transition-colors text-lg"
//               >
//                 ✕
//               </motion.button>
//             </div>

//             {/* recipient select */}
//             <select
//               className="p-4 border-2 border-teal-200/50 rounded-2xl w-full mb-8 bg-white/40 backdrop-blur-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-300 text-gray-900 font-medium shadow-inner hover:shadow-teal-200/50"
//               value={selectedRecipient}
//               onChange={(e) => setSelectedRecipient(e.target.value)}
//             >
//               <option value="">Select Recipient</option>
//               {users
//                 .filter((u) => u.id !== Number(userDetails.id))
//                 .map((u) => (
//                   <option key={u.id} value={u.id}>
//                     {u.name} ({getRole(u)})
//                   </option>
//                 ))}
//             </select>

//             {/* msgs */}
//             <div className="flex-1 overflow-y-auto pr-4 mb-8 space-y-5 scrollbar-thin scrollbar-thumb-teal-400/80 scrollbar-track-gray-100/50">
//               {selectedRecipient ? (
//                 <ul className="space-y-5">
//                   {messages
//                     .filter(
//                       (m) =>
//                         (m.senderId === Number(userDetails.id) &&
//                           m.recipientId === Number(selectedRecipient)) ||
//                         (m.senderId === Number(selectedRecipient) &&
//                           m.recipientId === Number(userDetails.id))
//                     )
//                     .slice(-20)
//                     .map((m) => {
//                       const sender = users.find((u) => u.id === m.senderId);
//                       const isMe = m.senderId === Number(userDetails.id);
//                       return (
//                         <motion.li
//                           initial={{ opacity: 0, y: 30, scale: 0.9 }}
//                           animate={{ opacity: 1, y: 0, scale: 1 }}
//                           key={m.id}
//                           className={`flex ${isMe ? "justify-end" : "justify-start"}`}
//                         >
//                           <div
//                             className={`max-w-[80%] p-5 rounded-2xl shadow-lg transition-all duration-200 border-2 ${
//                               isMe
//                                 ? "bg-gradient-to-r from-teal-200/80 to-cyan-200/80 border-teal-300/50 hover:shadow-teal-300/40"
//                                 : "bg-gradient-to-r from-gray-100/80 to-gray-200/80 border-gray-300/50 hover:shadow-gray-300/40"
//                             }`}
//                           >
//                             <div className="flex items-center mb-3">
//                               {!isMe && (
//                                 <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 text-white flex items-center justify-center font-bold text-base mr-3 shadow-md">
//                                   {getInitials(sender?.name || "U")}
//                                 </div>
//                               )}
//                               <p className="text-xs text-gray-600 font-medium">
//                                 {new Date(m.createdAt).toLocaleTimeString()}
//                               </p>
//                               {isMe && (
//                                 <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-teal-500 text-white flex items-center justify-center font-bold text-base ml-3 shadow-md">
//                                   {getInitials(userDetails.name || "Me")}
//                                 </div>
//                               )}
//                             </div>
//                             <p className="font-medium text-gray-900 text-base">{m.content}</p>
//                           </div>
//                         </motion.li>
//                       );
//                     })}
//                   <div ref={messagesEndRef} />
//                 </ul>
//               ) : (
//                 <p className="text-gray-600 text-center mt-20 font-semibold text-lg">
//                   Select a recipient to start chatting.
//                 </p>
//               )}
//             </div>

//             {/* input */}
//             <div className="flex gap-4">
//               <input
//                 type="text"
//                 className="flex-1 p-4 border-2 border-teal-200/50 rounded-2xl bg-white/40 backdrop-blur-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-300 text-gray-900 font-medium shadow-inner hover:shadow-teal-200/50"
//                 placeholder="Type your message..."
//                 value={messageContent}
//                 onChange={(e) => setMessageContent(e.target.value)}
//                 onKeyDown={(e) => e.key === "Enter" && sendMessage()}
//               />
//               <motion.button
//                 whileHover={{ scale: 1.15, boxShadow: "0 8px 20px rgba(0, 200, 200, 0.5)" }}
//                 whileTap={{ scale: 0.85 }}
//                 onClick={sendMessage}
//                 className="p-4 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-2xl shadow-lg hover:shadow-cyan-400/60 transition-all duration-200 border-2 border-teal-300/50"
//               >
//                 <PaperAirplaneIcon className="h-6 w-6" />
//               </motion.button>
//             </div>
//           </motion.div>
//         )}
//       </AnimatePresence>

//       {/* HISTORY PANEL */}
//       <AnimatePresence>
//         {showHistory && (
//           <motion.div
//             initial={{ opacity: 0, y: 120, scale: 0.85 }}
//             animate={{ opacity: 1, y: 0, scale: 1 }}
//             exit={{ opacity: 0, y: 120, scale: 0.85 }}
//             transition={{ duration: 0.5, type: "spring", stiffness: 200 }}
//             className="fixed bg-white/85 backdrop-blur-2xl rounded-3xl shadow-2xl p-8 w-[480px] max-h-[75vh] overflow-y-auto border-2 border-blue-300/40 mt-8 z-50 ring-2 ring-blue-200/50 scrollbar-thin scrollbar-thumb-blue-400/80 scrollbar-track-gray-100/50"
//             style={{ right: `${pos.x}px`, bottom: `${-pos.y + 100}px` }}
//           >
//             <div className="flex justify-between items-center mb-8 bg-gradient-to-r from-blue-600/95 to-indigo-600/95 backdrop-blur-md text-white p-6 -mx-8 -mt-8 rounded-t-3xl shadow-xl ring-1 ring-blue-300/50">
//               <h3 className="text-2xl font-extrabold tracking-tight">Chat History</h3>
//               <motion.button
//                 whileHover={{ scale: 1.3, rotate: 360 }}
//                 whileTap={{ scale: 0.8 }}
//                 onClick={() => setShowHistory(false)}
//                 className="text-white hover:text-blue-100 transition-colors text-lg"
//               >
//                 ✕
//               </motion.button>
//             </div>

//             {/* build history list */}
//             {(() => {
//               const partnerIds = new Set(
//                 messages
//                   .filter(
//                     (m) =>
//                       m.senderId === Number(userDetails.id) ||
//                       m.recipientId === Number(userDetails.id)
//                   )
//                   .map((m) =>
//                     m.senderId === Number(userDetails.id)
//                       ? m.recipientId
//                       : m.senderId
//                   )
//               );
//               const partners = users.filter((u) => partnerIds.has(u.id));
//               if (!partners.length)
//                 return (
//                   <p className="text-center text-gray-600 font-semibold text-lg mt-12">No history yet.</p>
//                 );

//               return partners.map((u) => {
//                 const thread = messages.filter(
//                   (m) =>
//                     (m.senderId === Number(userDetails.id) &&
//                       m.recipientId === u.id) ||
//                     (m.senderId === u.id &&
//                       m.recipientId === Number(userDetails.id))
//                 );
//                 const lastMsg = thread.sort(
//                   (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
//                 )[0];

//                 return (
//                   <motion.div
//                     key={u.id}
//                     initial={{ opacity: 0, x: -30 }}
//                     animate={{ opacity: 1, x: 0 }}
//                     whileHover={{ scale: 1.04, boxShadow: "0 8px 20px rgba(0, 0, 255, 0.2)" }}
//                     className="relative mb-6 p-6 bg-white/50 backdrop-blur-lg rounded-2xl border-2 border-blue-200/40 cursor-pointer transition-all duration-200 shadow-lg hover:shadow-blue-300/40 flex items-start gap-4"
//                     onClick={() => {
//                       setSelectedRecipient(u.id.toString());
//                       closeAll();
//                       setShowChatbox(true);
//                     }}
//                   >
//                     <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 text-white flex items-center justify-center font-bold text-lg shadow-lg">
//                       {getInitials(u.name)}
//                     </div>
//                     <div className="flex-1">
//                       <p className="font-semibold text-gray-900 text-lg">
//                         {u.name} <span className="text-gray-600 text-sm">({getRole(u)})</span>
//                       </p>
//                       <p className="text-sm text-gray-700 truncate mt-2">{lastMsg?.content || "No messages"}</p>
//                     </div>
//                     {unreadCounts[u.id] > 0 && (
//                       <motion.span
//                         initial={{ scale: 0 }}
//                         animate={{ scale: [1, 1.3, 1], transition: { duration: 0.5, repeat: Infinity } }}
//                         className="absolute -top-3 -right-3 bg-gradient-to-r from-red-500 to-orange-600 text-white text-xs font-bold rounded-full px-4 py-1 shadow-xl ring-2 ring-red-400/40"
//                       >
//                         {unreadCounts[u.id]}
//                       </motion.span>
//                     )}
//                   </motion.div>
//                 );
//               });
//             })()}
//           </motion.div>
//         )}
//       </AnimatePresence>
//     </motion.div>
//   );
// }