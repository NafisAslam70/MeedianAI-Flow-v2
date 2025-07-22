"use client";
import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import Peer from "simple-peer";

export default function ScheduleMeet({ userDetails, position, closeAllModals, socket }) {
  const [isOpen, setIsOpen] = useState(false);
  const [scheduleNow, setScheduleNow] = useState(false);
  const [meetingDetails, setMeetingDetails] = useState({
    title: "",
    date: "",
    time: "",
    participants: "",
    description: "",
  });
  const [users, setUsers] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [meetingLink, setMeetingLink] = useState(null);
  const [isMeetingActive, setIsMeetingActive] = useState(false);
  const peerRefs = useRef([]);
  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef({});

  useEffect(() => {
    if (!userDetails?.id || !socket) return;

    socket.on("connect", () => {
      console.log("Connected to WebSocket");
      setError(null);
    });

    socket.on("connect_error", (err) => {
      console.error("Socket.IO connection error:", err);
      setError("Failed to connect to meeting server. Please try again later.");
    });

    socket.on("webrtc-signal", ({ signal, userId }) => {
      const peer = peerRefs.current.find((p) => p.initiator);
      if (peer) {
        peer.signal(signal);
      }
    });

    return () => {
      socket.off("connect");
      socket.off("connect_error");
      socket.off("webrtc-signal");
      peerRefs.current.forEach((peer) => peer.destroy());
      peerRefs.current = [];
    };
  }, [userDetails?.id, socket]); // Removed peers from dependencies

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersRes = await fetch("/api/member/users");
        const usersData = await usersRes.json();
        if (usersData.error) {
          console.error("Error fetching users:", usersData.error);
          setError("Failed to fetch users.");
          setUsers([]);
        } else {
          console.log("Fetched users:", usersData.users);
          setUsers(usersData.users || []);
        }
      } catch (error) {
        console.error("Error fetching users:", error);
        setError("Error fetching users. Please try again.");
        setUsers([]);
      }
    };
    fetchUsers();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setMeetingDetails((prev) => ({ ...prev, [name]: value }));
  };

  const handleScheduleNow = async () => {
    if (!userDetails?.id) {
      setError("User not authenticated");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const recipientIds = meetingDetails.participants
        .split(",")
        .map((email) => {
          const user = users.find((u) => u.email === email.trim());
          return user ? user.id : null;
        })
        .filter((id) => id && id !== parseInt(userDetails.id));

      if (recipientIds.length === 0) {
        throw new Error("No valid recipients found");
      }

      const meetingId = `meet-${Date.now()}-${userDetails.id}`;
      const link = `${window.location.origin}/meet/${meetingId}`;
      setMeetingLink(link);

      const chatResponse = await fetch("/api/others/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userDetails.id,
          recipientId: recipientIds[0],
          message: `Join my meeting now: ${link}`,
        }),
      });

      if (!chatResponse.ok) {
        throw new Error("Failed to send meeting link via chat");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const peer = new Peer({ initiator: true, stream });
      peer.on("signal", (data) => {
        recipientIds.forEach((recipientId) => {
          socket.emit("webrtc-signal", {
            signal: data,
            userId: userDetails.id,
            recipientId,
          });
        });
      });

      peer.on("stream", (remoteStream) => {
        const peerId = `peer-${Date.now()}`;
        remoteVideoRefs.current[peerId] = { stream: remoteStream };
        // Trigger re-render by updating a state if needed
      });

      peerRefs.current = [peer];
      setIsMeetingActive(true);
      setSuccess(`Meeting created! Link: ${link}`);
    } catch (err) {
      setError(`Error creating meeting: ${err.message}`);
      setIsMeetingActive(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScheduleLater = async (e) => {
    e.preventDefault();
    if (!userDetails?.id) {
      setError("User not authenticated");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/others/schedule-meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...meetingDetails,
          userId: userDetails.id,
          role: userDetails.role,
        }),
      });
      if (!response.ok) throw new Error("Failed to schedule meeting");
      const data = await response.json();
      setSuccess(`Meeting scheduled successfully! Meeting ID: ${data.meetingId}`);
      setMeetingDetails({ title: "", date: "", time: "", participants: "", description: "" });
      setIsOpen(false);
    } catch (err) {
      setError(`Error scheduling meeting: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEndMeeting = () => {
    setIsMeetingActive(false);
    peerRefs.current.forEach((peer) => peer.destroy());
    peerRefs.current = [];
    setMeetingLink(null);
    if (localVideoRef.current?.srcObject) {
      localVideoRef.current.srcObject.getTracks().forEach((track) => track.stop());
    }
  };

  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <AnimatePresence>
      {!isOpen ? (
        <motion.button
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={() => {
            closeAllModals();
            setIsOpen(true);
          }}
          className="p-4 bg-gradient-to-r from-green-500 to-lime-600 text-white rounded-full shadow-lg hover:from-green-600 hover:to-lime-700 transition-all duration-300 transform hover:scale-105"
          title="Schedule a Meeting"
          disabled={isSubmitting}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </motion.button>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="fixed bg-white p-4 rounded-lg shadow-xl w-[400px] max-h-[60vh] overflow-y-auto border border-green-100 z-50"
          style={{ right: `${position.x}px`, bottom: `${-position.y + 160}px` }}
        >
          <div className="flex justify-between items-center mb-4 bg-gradient-to-r from-green-500 to-lime-600 text-white p-4 rounded-t-xl">
            <h2 className="text-xl font-semibold">Schedule Meeting</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:text-gray-200 transition-colors"
            >
              ✕
            </button>
          </div>
          <div className="space-y-3">
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-500 text-sm"
              >
                {error}
              </motion.p>
            )}
            {success && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-green-500 text-sm"
              >
                {success}
              </motion.p>
            )}
            <button
              onClick={handleScheduleNow}
              disabled={isSubmitting}
              className={`w-full p-2 rounded-md text-white ${
                isSubmitting ? "bg-gray-400" : "bg-green-600 hover:bg-green-700"
              } transition-all duration-300`}
            >
              {isSubmitting ? "Processing..." : "Schedule Now"}
            </button>
            <button
              onClick={() => setScheduleNow(false)}
              disabled={isSubmitting}
              className={`w-full p-2 rounded-md ${
                isSubmitting ? "bg-gray-200" : "bg-gray-200 hover:bg-gray-300"
              } text-gray-800 transition-all duration-300`}
            >
              Schedule Later
            </button>
            {!scheduleNow && (
              <form onSubmit={handleScheduleLater} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Meeting Title</label>
                  <input
                    type="text"
                    name="title"
                    value={meetingDetails.title}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Enter meeting title"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Date</label>
                  <input
                    type="date"
                    name="date"
                    value={meetingDetails.date}
                    onChange={handleInputChange}
                    min={today}
                    className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Time</label>
                  <input
                    type="time"
                    name="time"
                    value={meetingDetails.time}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Participants</label>
                  <input
                    type="text"
                    name="participants"
                    value={meetingDetails.participants}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Enter email addresses (comma-separated)"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    name="description"
                    value={meetingDetails.description}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Optional description"
                    rows="3"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full p-2 rounded-md text-white ${
                    isSubmitting ? "bg-gray-400" : "bg-green-600 hover:bg-green-700"
                  } transition-all duration-300`}
                >
                  {isSubmitting ? "Scheduling..." : "Schedule Meeting"}
                </button>
              </form>
            )}
          </div>
        </motion.div>
      )}
      {isMeetingActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-30"
        >
          <div className="bg-white p-4 rounded-lg w-[90vw] h-[60vh] max-w-5xl flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Meeting</h2>
              <button
                onClick={handleEndMeeting}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700">You</h3>
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  className="w-full h-48 bg-black rounded-md"
                />
              </div>
              {Object.keys(remoteVideoRefs.current).map((peerId) => (
                <div key={peerId}>
                  <h3 className="text-sm font-medium text-gray-700">Participant</h3>
                  <video
                    ref={(el) => {
                      if (el && remoteVideoRefs.current[peerId]) {
                        el.srcObject = remoteVideoRefs.current[peerId].stream;
                      }
                    }}
                    autoPlay
                    className="w-full h-48 bg-black rounded-md"
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-center space-x-4">
              <button
                onClick={handleEndMeeting}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
              >
                End Meeting
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}