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
        setMessages(messagesData.messages);
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
        <button
          onClick={() => {
            closeAllModals();
            setShowHistory(true);
          }}
          className="p-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-full shadow-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105"
          title="Chat History"
        >
          <ClockIcon className="h-6 w-6" />
        </button>
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
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-semibold text-blue-900">
                          {user.name} ({getUserDisplayRole(user)})
                        </p>
                        <p className="text-xs text-gray-500 truncate max-w-[250px]">
                          {user.lastMessage?.content || "No messages"}
                        </p>
                      </div>
                      <p className="text-xs text-gray-400">
                        {user.lastMessage
                          ? new Date(user.lastMessage.createdAt).toLocaleDateString()
                          : ""}
                      </p>
                    </div>
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

// "use client";
// import { useEffect, useState, useRef } from "react";
// import { ChatBubbleLeftRightIcon, PaperAirplaneIcon, ClockIcon, VideoCameraIcon } from "@heroicons/react/24/solid";
// import { motion, AnimatePresence } from "framer-motion";
// import ScheduleMeet from "@/components/ScheduleMeet";
// import Peer from "peerjs";

// export default function ChatBox({ userDetails, socket }) {
//   const [messages, setMessages] = useState([]);
//   const [users, setUsers] = useState([]);
//   const [onlineUsers, setOnlineUsers] = useState([]);
//   const [selectedRecipient, setSelectedRecipient] = useState("");
//   const [messageContent, setMessageContent] = useState("");
//   const [showChatbox, setShowChatbox] = useState(false);
//   const [showHistory, setShowHistory] = useState(false);
//   const [showCallModal, setShowCallModal] = useState(false);
//   const [isCalling, setIsCalling] = useState(false);
//   const [peer, setPeer] = useState(null);
//   const [call, setCall] = useState(null);
//   const [error, setError] = useState(null);
//   const [isTyping, setIsTyping] = useState(false);
//   const [typingUsers, setTypingUsers] = useState([]);
//   const chatboxRef = useRef(null);
//   const messagesEndRef = useRef(null);
//   const localVideoRef = useRef(null);
//   const remoteVideoRef = useRef(null);
//   const [chatboxPosition, setChatboxPosition] = useState({ x: 20, y: -20 });
//   const [isDragging, setIsDragging] = useState(false);
//   const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

//   useEffect(() => {
//     if (!userDetails?.id || !socket) return;

//     const peerInstance = new Peer(userDetails.id.toString(), {
//       host: process.env.NEXT_PUBLIC_API_URL ? new URL(process.env.NEXT_PUBLIC_API_URL).hostname : "localhost",
//       port: process.env.NEXT_PUBLIC_PEERJS_PORT || 9000,
//       path: "/peerjs",
//     });

//     setPeer(peerInstance);

//     peerInstance.on("open", (id) => {
//       console.log(`PeerJS connected with ID: ${id}`);
//     });

//     peerInstance.on("call", (incomingCall) => {
//       navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
//         localVideoRef.current.srcObject = stream;
//         incomingCall.answer(stream);
//         setCall(incomingCall);
//         incomingCall.on("stream", (remoteStream) => {
//           remoteVideoRef.current.srcObject = remoteStream;
//         });
//         setIsCalling(true);
//         setShowChatbox(false);
//         setShowHistory(false);
//         setShowCallModal(false);
//       }).catch((err) => {
//         setError(`Error accessing media devices: ${err.message}`);
//         setIsCalling(false);
//       });
//     });

//     socket.on("connect", () => {
//       console.log("Connected to WebSocket");
//       setError(null);
//     });

//     socket.on("connect_error", (err) => {
//       console.error("Socket.IO connection error:", err);
//       setError("Failed to connect to chat server. Please try again later.");
//     });

//     socket.on("message", (newMessage) => {
//       if (!newMessage?.id || !newMessage.senderId || !newMessage.recipientId) return;
//       setMessages((prev) => [...prev, newMessage]);
//     });

//     socket.on("typing", ({ userId, isTyping }) => {
//       setTypingUsers((prev) => {
//         if (isTyping) {
//           return [...new Set([...prev, userId])];
//         }
//         return prev.filter((id) => id !== userId);
//       });
//     });

//     socket.on("messageRead", ({ messageId }) => {
//       setMessages((prev) =>
//         prev.map((msg) =>
//           msg.id === messageId ? { ...msg, status: "read" } : msg
//         )
//       );
//     });

//     socket.on("onlineUsers", (userIds) => {
//       setOnlineUsers(userIds || []);
//     });

//     socket.on("webrtc-signal", ({ signal, userId }) => {
//       if (peer && signal) {
//         peer.signal(signal);
//       }
//     });

//     return () => {
//       socket.off("connect");
//       socket.off("connect_error");
//       socket.off("message");
//       socket.off("typing");
//       socket.off("messageRead");
//       socket.off("onlineUsers");
//       socket.off("webrtc-signal");
//       if (peer) peer.destroy();
//       if (call) call.close();
//     };
//   }, [userDetails?.id, socket]);

//   const fetchData = async () => {
//     try {
//       const usersRes = await fetch("/api/member/users");
//       const usersData = await usersRes.json();
//       if (usersData.error || !usersData.users) {
//         console.error("Error fetching users:", usersData.error);
//         setError("Failed to fetch users.");
//         setUsers([]);
//       } else {
//         setUsers(usersData.users);
//       }

//       const messagesRes = await fetch(`/api/others/chat?userId=${userDetails.id}`);
//       const messagesData = await messagesRes.json();
//       if (messagesData.error || !Array.isArray(messagesData.messages)) {
//         console.error("Error fetching messages:", messagesData.error);
//         setError(messagesData.error || "Failed to fetch messages.");
//         setMessages([]);
//       } else {
//         setMessages(messagesData.messages);
//       }
//     } catch (error) {
//       console.error("Error fetching data:", error);
//       setError(error.message || "Error fetching data. Please try again.");
//       setUsers([]);
//       setMessages([]);
//     }
//   };

//   const handleSendMessage = async () => {
//     if (!selectedRecipient || !messageContent.trim()) {
//       setError("Please select a recipient and enter a message.");
//       return;
//     }

//     try {
//       const newMessage = {
//         senderId: parseInt(userDetails.id),
//         recipientId: parseInt(selectedRecipient),
//         content: messageContent,
//         createdAt: new Date().toISOString(),
//         status: "sent",
//         id: `temp-${Date.now()}`,
//       };

//       socket.emit("message", newMessage);
//       setMessages((prev) => [...prev, newMessage]);
//       setMessageContent("");
//       setError(null);

//       const res = await fetch("/api/others/chat", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           userId: userDetails.id,
//           recipientId: selectedRecipient,
//           message: messageContent,
//         }),
//       });

//       if (!res.ok) {
//         const errorData = await res.json();
//         throw new Error(errorData.error || "Failed to send message");
//       }

//       const { message: serverMessage } = await res.json();
//       setMessages((prev) =>
//         prev.map((msg) =>
//           msg.id === newMessage.id ? { ...msg, id: serverMessage.id } : msg
//         )
//       );
//     } catch (error) {
//       console.error("Error sending message:", error);
//       setError(error.message || "Failed to send message.");
//     }
//   };

//   const handleTyping = (e) => {
//     setMessageContent(e.target.value);
//     const typing = e.target.value.length > 0;
//     if (typing !== isTyping) {
//       setIsTyping(typing);
//       socket.emit("typing", { userId: userDetails.id, isTyping: typing });
//     }
//   };

//   const handleCallUser = async (recipientId) => {
//     if (!userDetails?.id || !peer) {
//       setError("User not authenticated or PeerJS not initialized");
//       return;
//     }

//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
//       localVideoRef.current.srcObject = stream;

//       const callInstance = peer.call(recipientId.toString(), stream);
//       setCall(callInstance);

//       callInstance.on("stream", (remoteStream) => {
//         remoteVideoRef.current.srcObject = remoteStream;
//       });

//       callInstance.on("close", () => {
//         setIsCalling(false);
//         setCall(null);
//         if (localVideoRef.current?.srcObject) {
//           localVideoRef.current.srcObject.getTracks().forEach((track) => track.stop());
//         }
//       });

//       setIsCalling(true);
//       setShowChatbox(false);
//       setShowHistory(false);
//       setShowCallModal(false);

//       const link = `${window.location.origin}/call/${Date.now()}-${userDetails.id}`;
//       const res = await fetch("/api/others/chat", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           userId: userDetails.id,
//           recipientId,
//           message: `Join my call now: ${link}`,
//         }),
//       });

//       if (!res.ok) {
//         throw new Error("Failed to send call link");
//       }
//     } catch (err) {
//       console.error("Error initiating call:", err);
//       setError(`Error initiating call: ${err.message}`);
//       setIsCalling(false);
//     }
//   };

//   const handleMouseDown = (e) => {
//     if (e.target.closest(".chatbox-header")) {
//       setIsDragging(true);
//       setDragStart({
//         x: e.clientX - chatboxPosition.x,
//         y: e.clientY - chatboxPosition.y,
//       });
//     }
//   };

//   const handleMouseMove = (e) => {
//     if (isDragging) {
//       setChatboxPosition({
//         x: e.clientX - dragStart.x,
//         y: e.clientY - dragStart.y,
//       });
//     }
//   };

//   const handleMouseUp = () => {
//     setIsDragging(false);
//   };

//   useEffect(() => {
//     fetchData();
//     window.addEventListener("mousemove", handleMouseMove);
//     window.addEventListener("mouseup", handleMouseUp);

//     return () => {
//       window.removeEventListener("mousemove", handleMouseMove);
//       window.removeEventListener("mouseup", handleMouseUp);
//       if (peer) peer.destroy();
//       if (call) call.close();
//     };
//   }, [isDragging, dragStart, userDetails.id]);

//   const scrollToBottom = () => {
//     messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
//   };

//   useEffect(() => {
//     scrollToBottom();
//   }, [messages]);

//   const getUserDisplayRole = (user) => {
//     if (user.role === "admin") return "Admin";
//     if (user.role === "team_manager") {
//       return `Team Manager${user.team_manager_type ? ` (${user.team_manager_type.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")})` : ""}`;
//     }
//     return user.type
//       ? user.type
//           .split("_")
//           .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
//           .join(" ")
//       : "Member";
//   };

//   const getChatHistoryUsers = () => {
//     const chattedUserIds = new Set(
//       messages
//         .filter(
//           (msg) =>
//             msg.senderId === parseInt(userDetails.id) ||
//             msg.recipientId === parseInt(userDetails.id)
//         )
//         .map((msg) =>
//           msg.senderId === parseInt(userDetails.id)
//             ? msg.recipientId
//             : msg.senderId
//         )
//         .filter((id) => id !== parseInt(userDetails.id))
//     );

//     return users
//       .filter((user) => chattedUserIds.has(user.id))
//       .map((user) => {
//         const userMessages = messages
//           .filter(
//             (msg) =>
//               (msg.senderId === parseInt(userDetails.id) &&
//                 msg.recipientId === user.id) ||
//               (msg.senderId === user.id &&
//                 msg.recipientId === parseInt(userDetails.id))
//           )
//           .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
//         return {
//           ...user,
//           lastMessage: userMessages[0],
//         };
//       });
//   };

//   const closeAllModals = () => {
//     setShowChatbox(false);
//     setShowHistory(false);
//     setShowCallModal(false);
//     if (call) {
//       call.close();
//       setCall(null);
//       setIsCalling(false);
//       if (localVideoRef.current?.srcObject) {
//         localVideoRef.current.srcObject.getTracks().forEach((track) => track.stop());
//       }
//     }
//   };

//   return (
//     <motion.div
//       initial={{ opacity: 0, x: 20 }}
//       animate={{ opacity: 1, x: 0 }}
//       transition={{ duration: 0.3 }}
//       className="fixed z-50"
//       style={{ right: `${chatboxPosition.x}px`, bottom: `${-chatboxPosition.y + 40}px` }}
//       ref={chatboxRef}
//     >
//       {error && (
//         <motion.p
//           initial={{ opacity: 0, y: -20 }}
//           animate={{ opacity: 1, y: 0 }}
//           exit={{ opacity: 0, y: -20 }}
//           className="absolute top-4 left-4 right-4 text-red-600 text-sm font-medium bg-red-50 p-3 rounded-lg shadow-md z-10"
//         >
//           {error}
//         </motion.p>
//       )}
//       <div className="flex gap-2">
//         <button
//           onClick={() => {
//             closeAllModals();
//             setShowChatbox(true);
//           }}
//           className="p-4 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-full shadow-lg hover:from-teal-600 hover:to-cyan-700 transition-all duration-300 transform hover:scale-105"
//           title="Open Chat"
//         >
//           <ChatBubbleLeftRightIcon className="h-6 w-6" />
//         </button>
//         <button
//           onClick={() => {
//             closeAllModals();
//             setShowHistory(true);
//           }}
//           className="p-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-full shadow-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105"
//           title="Chat History"
//         >
//           <ClockIcon className="h-6 w-6" />
//         </button>
//         <ScheduleMeet userDetails={userDetails} position={chatboxPosition} closeAllModals={closeAllModals} socket={socket} />
//         <button
//           onClick={() => {
//             closeAllModals();
//             setShowCallModal(true);
//           }}
//           className="p-4 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-full shadow-lg hover:from-purple-600 hover:to-pink-700 transition-all duration-300 transform hover:scale-105"
//           title="Call Now"
//         >
//           <VideoCameraIcon className="h-6 w-6" />
//         </button>
//       </div>
//       <AnimatePresence>
//         {showChatbox && (
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             exit={{ opacity: 0, y: 20 }}
//             transition={{ duration: 0.3 }}
//             className="bg-white rounded-2xl shadow-2xl p-6 w-[400px] max-h-[70vh] overflow-hidden border border-teal-100 mt-4 flex flex-col"
//           >
//             <div
//               className="chatbox-header flex justify-between items-center mb-4 cursor-move bg-gradient-to-r from-teal-500 to-cyan-600 text-white p-4 rounded-t-xl"
//               onMouseDown={handleMouseDown}
//             >
//               <h3 className="text-xl font-semibold">Messages</h3>
//               <button
//                 onClick={() => setShowChatbox(false)}
//                 className="text-white hover:text-gray-200 transition-colors"
//               >
//                 ✕
//               </button>
//             </div>
//             <div className="mb-4">
//               <select
//                 className="p-3 border border-gray-200 rounded-lg w-full text-md bg-gray-50 focus:ring-2 focus:ring-teal-500 transition-all"
//                 value={selectedRecipient}
//                 onChange={(e) => setSelectedRecipient(e.target.value)}
//               >
//                 <option value="">Select Recipient</option>
//                 {users
//                   .filter((user) => user.id !== parseInt(userDetails.id))
//                   .map((user) => (
//                     <motion.option
//                       key={user.id}
//                       value={user.id}
//                       initial={{ opacity: 0 }}
//                       animate={{ opacity: 1 }}
//                       transition={{ duration: 0.2 }}
//                     >
//                       {user.name} ({getUserDisplayRole(user)})
//                       {onlineUsers.includes(user.id) && " • Online"}
//                     </motion.option>
//                   ))}
//               </select>
//             </div>
//             <div className="flex-1 max-h-[50vh] overflow-y-auto pr-2">
//               {messages.length === 0 || !selectedRecipient ? (
//                 <p className="text-gray-500 text-md text-center">
//                   {selectedRecipient ? "No messages yet." : "Select a recipient to view messages."}
//                 </p>
//               ) : (
//                 <ul className="space-y-3">
//                   {messages
//                     .filter(
//                       (msg) =>
//                         (msg.senderId === parseInt(userDetails.id) &&
//                           msg.recipientId === parseInt(selectedRecipient)) ||
//                         (msg.senderId === parseInt(selectedRecipient) &&
//                           msg.recipientId === parseInt(userDetails.id))
//                     )
//                     .slice(-20)
//                     .map((msg, index) => (
//                       <motion.li
//                         key={msg.id || index}
//                         initial={{ opacity: 0, y: 10 }}
//                         animate={{ opacity: 1, y: 0 }}
//                         transition={{ duration: 0.3, delay: index * 0.05 }}
//                         className={`p-4 rounded-xl ${
//                           msg.senderId === parseInt(userDetails.id)
//                             ? "bg-teal-100 text-right ml-8"
//                             : "bg-gray-100 text-left mr-8"
//                         } border border-teal-100 relative`}
//                       >
//                         <p className="text-sm font-semibold text-teal-900">
//                           {msg.senderId === parseInt(userDetails.id)
//                             ? "You"
//                             : users.find((u) => u.id === msg.senderId)?.name || "Unknown"}
//                         </p>
//                         <p className="text-sm">{msg.content}</p>
//                         <div className="flex justify-between items-center mt-1">
//                           <p className="text-xs text-gray-400">
//                             {new Date(msg.createdAt).toLocaleTimeString()}
//                           </p>
//                           {msg.senderId === parseInt(userDetails.id) && (
//                             <span className="text-xs text-gray-500">
//                               {msg.status === "sent" ? "✓" : msg.status === "read" ? "✓✓" : ""}
//                             </span>
//                           )}
//                         </div>
//                       </motion.li>
//                     ))}
//                   <div ref={messagesEndRef} />
//                 </ul>
//               )}
//               {typingUsers.length > 0 && selectedRecipient && (
//                 <p className="text-xs text-gray-500 mt-2 animate-pulse">
//                   {users.find((u) => typingUsers.includes(u.id) && u.id === parseInt(selectedRecipient))?.name ||
//                     "Someone"} is typing...
//                 </p>
//               )}
//             </div>
//             <div className="mt-4">
//               <div className="flex gap-2">
//                 <input
//                   type="text"
//                   className="p-3 border border-gray-200 rounded-lg flex-1 text-md bg-gray-50 focus:ring-2 focus:ring-teal-500 transition-all"
//                   placeholder="Type your message..."
//                   value={messageContent}
//                   onChange={handleTyping}
//                   onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
//                 />
//                 <button
//                   onClick={handleSendMessage}
//                   className="p-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg hover:from-teal-600 hover:to-cyan-700 transition-all duration-300"
//                 >
//                   <PaperAirplaneIcon className="h-5 w-5" />
//                 </button>
//               </div>
//             </div>
//           </motion.div>
//         )}
//       </AnimatePresence>
//       <AnimatePresence>
//         {showHistory && (
//           <motion.div
//             initial={{ opacity: 0, scale: 0.95 }}
//             animate={{ opacity: 1, scale: 1 }}
//             exit={{ opacity: 0, scale: 0.95 }}
//             transition={{ duration: 0.3 }}
//             className="fixed bg-white rounded-2xl shadow-2xl p-6 w-[400px] max-h-[60vh] overflow-y-auto border border-blue-100 mt-4 z-50"
//             style={{ right: `${chatboxPosition.x}px`, bottom: `${-chatboxPosition.y + 100}px` }}
//           >
//             <div className="flex justify-between items-center mb-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-4 rounded-t-xl">
//               <h3 className="text-xl font-semibold">Chat History</h3>
//               <button
//                 onClick={() => setShowHistory(false)}
//                 className="text-white hover:text-gray-200 transition-colors"
//               >
//                 ✕
//               </button>
//             </div>
//             <div className="space-y-3">
//               {getChatHistoryUsers().length === 0 ? (
//                 <p className="text-gray-500 text-md text-center">No chat history yet.</p>
//               ) : (
//                 getChatHistoryUsers().map((user) => (
//                   <motion.div
//                     key={user.id}
//                     initial={{ opacity: 0, y: 10 }}
//                     animate={{ opacity: 1, y: 0 }}
//                     transition={{ duration: 0.3 }}
//                     className="p-4 bg-gray-50 rounded-lg border border-blue-100 cursor-pointer hover:bg-blue-50 transition-all"
//                     onClick={() => {
//                       setSelectedRecipient(user.id.toString());
//                       closeAllModals();
//                       setShowChatbox(true);
//                     }}
//                   >
//                     <div className="flex justify-between items-center">
//                       <div>
//                         <p className="text-sm font-semibold text-blue-900">
//                           {user.name} ({getUserDisplayRole(user)})
//                         </p>
//                         <p className="text-xs text-gray-500 truncate max-w-[250px]">
//                           {user.lastMessage?.content || "No messages"}
//                         </p>
//                       </div>
//                       <div className="flex items-center gap-2">
//                         <p className="text-xs text-gray-400">
//                           {user.lastMessage
//                             ? new Date(user.lastMessage.createdAt).toLocaleDateString()
//                             : ""}
//                         </p>
//                         {onlineUsers.includes(user.id) && (
//                           <span className="w-3 h-3 bg-green-500 rounded-full" />
//                         )}
//                       </div>
//                     </div>
//                   </motion.div>
//                 ))
//               )}
//             </div>
//           </motion.div>
//         )}
//       </AnimatePresence>
//       <AnimatePresence>
//         {showCallModal && (
//           <motion.div
//             initial={{ opacity: 0, scale: 0.95 }}
//             animate={{ opacity: 1, scale: 1 }}
//             exit={{ opacity: 0, scale: 0.95 }}
//             transition={{ duration: 0.3 }}
//             className="fixed bg-white rounded-2xl shadow-2xl p-6 w-[400px] max-h-[60vh] overflow-y-auto border border-purple-100 mt-4 z-50"
//             style={{ right: `${chatboxPosition.x}px`, bottom: `${-chatboxPosition.y + 100}px` }}
//           >
//             <div className="flex justify-between items-center mb-4 bg-gradient-to-r from-purple-500 to-pink-600 text-white p-4 rounded-t-xl">
//               <h3 className="text-xl font-semibold">Call an Online User</h3>
//               <button
//                 onClick={() => setShowCallModal(false)}
//                 className="text-white hover:text-gray-200 transition-colors"
//               >
//                 ✕
//               </button>
//             </div>
//             <div className="space-y-3">
//               {onlineUsers.length === 0 ? (
//                 <p className="text-gray-500 text-md text-center">No users online.</p>
//               ) : (
//                 users
//                   .filter((user) => onlineUsers.includes(user.id) && user.id !== parseInt(userDetails.id))
//                   .map((user) => (
//                     <motion.div
//                       key={user.id}
//                       initial={{ opacity: 0, y: 10 }}
//                       animate={{ opacity: 1, y: 0 }}
//                       transition={{ duration: 0.3 }}
//                       className="p-4 bg-gray-50 rounded-lg border border-purple-100 cursor-pointer hover:bg-purple-50 transition-all"
//                       onClick={() => {
//                         handleCallUser(user.id);
//                         closeAllModals();
//                       }}
//                     >
//                       <div className="flex justify-between items-center">
//                         <p className="text-sm font-semibold text-purple-900">
//                           {user.name} ({getUserDisplayRole(user)})
//                         </p>
//                         <span className="w-3 h-3 bg-green-500 rounded-full" />
//                       </div>
//                     </motion.div>
//                   ))
//               )}
//             </div>
//           </motion.div>
//         )}
//       </AnimatePresence>
//       {isCalling && (
//         <motion.div
//           initial={{ opacity: 0 }}
//           animate={{ opacity: 1 }}
//           exit={{ opacity: 0 }}
//           transition={{ duration: 0.3 }}
//           className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-30"
//         >
//           <div className="bg-white p-4 rounded-lg w-[90vw] h-[60vh] max-w-5xl flex flex-col">
//             <div className="flex justify-between items-center mb-4">
//               <h2 className="text-lg font-semibold text-gray-800">Video Call</h2>
//               <button
//                 onClick={closeAllModals}
//                 className="text-gray-500 hover:text-gray-700"
//               >
//                 <svg
//                   xmlns="http://www.w3.org/2000/svg"
//                   className="h-5 w-5"
//                   fill="none"
//                   viewBox="0 0 24 24"
//                   stroke="currentColor"
//                 >
//                   <path
//                     strokeLinecap="round"
//                     strokeLinejoin="round"
//                     strokeWidth={2}
//                     d="M6 18L18 6M6 6l12 12"
//                   />
//                 </svg>
//               </button>
//             </div>
//             <div className="flex-1 grid grid-cols-2 gap-4">
//               <div>
//                 <h3 className="text-sm font-medium text-gray-700">You</h3>
//                 <video ref={localVideoRef} autoPlay muted className="w-full h-48 bg-black rounded-md" />
//               </div>
//               <div>
//                 <h3 className="text-sm font-medium text-gray-700">Participant</h3>
//                 <video ref={remoteVideoRef} autoPlay className="w-full h-48 bg-black rounded-md" />
//               </div>
//             </div>
//             <div className="mt-4 flex justify-center space-x-4">
//               <button
//                 onClick={closeAllModals}
//                 className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
//               >
//                 End Call
//               </button>
//             </div>
//           </div>
//         </motion.div>
//       )}
//     </motion.div>
//   );
// }