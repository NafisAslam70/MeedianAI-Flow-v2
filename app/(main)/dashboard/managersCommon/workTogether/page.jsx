"use client";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Monitor, AlertCircle, Camera, Mic, ScreenShare, X } from "lucide-react";

const makeRoom = (uid1, uid2) =>
  `mspace-${uid1}-${uid2}-${Math.random().toString(36).slice(2, 7)}-${Date.now()}`;

export default function WorkTogether() {
  const { data: session, status } = useSession();
  const [api, setApi] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [users, setUsers] = useState([]);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [showJoinModal, setShowJoinModal] = useState(true);
  const [enableCamera, setEnableCamera] = useState(true);
  const [enableAudio, setEnableAudio] = useState(false);
  const [enableScreenShare, setEnableScreenShare] = useState(false);
  const roomName = "MeedianTogetherMain"; // Fixed room for the workspace; make unique if needed, e.g., append workspace ID

  const role = session?.user?.role;
  const userId = session?.user?.id;
  const userName = session?.user?.name || "User";
  const isAdmin = role === "admin";

  /* Fetch teammates once */
  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/member/users")
        .then((r) => r.json())
        .then(({ users }) => setUsers(users))
        .catch(() => setError("Failed to load users."));
    }
  }, [status]);

  /* Load Jitsi External API script */
  useEffect(() => {
    if (typeof window !== "undefined" && !window.JitsiMeetExternalAPI) {
      const script = document.createElement("script");
      script.src = "https://meet.jit.si/external_api.js";
      script.async = true;
      script.onload = () => setScriptLoaded(true);
      document.body.appendChild(script);

      return () => {
        document.body.removeChild(script);
      };
    } else if (window.JitsiMeetExternalAPI) {
      setScriptLoaded(true);
    }
  }, []);

  /* Initialize Jitsi API after user confirmation */
  const initializeJitsi = () => {
    if (scriptLoaded && window.JitsiMeetExternalAPI && !api) {
      const domain = "meet.jit.si";
      const options = {
        roomName,
        width: "100%",
        height: "100%",
        parentNode: document.querySelector("#jitsi-container"),
        configOverwrite: {
          startWithAudioMuted: !enableAudio,
          startWithVideoMuted: !enableCamera,
          disableModeratorIndicator: false,
        },
        userInfo: {
          displayName: `${userName} | ${userId}`,
        },
      };

      const jitsiApi = new window.JitsiMeetExternalAPI(domain, options);
      setApi(jitsiApi);

      jitsiApi.addEventListener("participantJoined", ({ id, displayName }) => {
        setParticipants((prev) => [...prev, { id, displayName }]);
      });

      jitsiApi.addEventListener("participantLeft", ({ id }) => {
        setParticipants((prev) => prev.filter((p) => p.id !== id));
      });

      // Get initial participants after ready
      jitsiApi.addEventListener("readyToClose", () => {
        setApi(null);
        setParticipants([]);
      });

      // Fetch initial participants (after a delay to ensure ready)
      setTimeout(() => {
        const initialParticipants = jitsiApi.getParticipantsInfo();
        setParticipants(initialParticipants.map((p) => ({ id: p.participantId, displayName: p.displayName })));
      }, 2000);

      // Handle screen sharing if enabled (non-admin)
      if (enableScreenShare && !isAdmin) {
        navigator.mediaDevices.getDisplayMedia({ video: true })
          .then((stream) => {
            jitsiApi.executeCommand("replaceTrack", { oldTrack: null, newTrack: stream.getTracks()[0] });
          })
          .catch((err) => {
            console.error("Screen share error:", err);
            setError("Failed to start screen sharing.");
            setTimeout(() => setError(null), 3000);
          });
      }

      return () => {
        jitsiApi.dispose();
      };
    }
  };

  const handleJoin = () => {
    setShowJoinModal(false);
    initializeJitsi();
  };

  const handleViewScreen = async (participant) => {
    const parts = participant.displayName.split("|");
    const targetName = parts[0]?.trim();
    const targetId = parts[1]?.trim();

    if (!targetId) return alert("Unable to identify user.");

    const privateRoom = makeRoom(userId, targetId);
    const privateUrl = `https://meet.jit.si/${privateRoom}#config.startScreenSharing=true`;

    try {
      await fetch("/api/others/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          recipientId: targetId,
          message: `🖥️ Screen view request from ${userName}: Please join ${privateUrl} and share your screen.`,
        }),
      });

      // Open private room for admin
      window.open(privateUrl, "_blank", "width=800,height=600");
    } catch (error) {
      setError("Failed to send request.");
      setTimeout(() => setError(null), 3000);
    }
  };

  if (status === "loading") return <div>Loading...</div>;
  if (status !== "authenticated" || !["admin", "team_manager"].includes(role)) {
    return <div>Access Denied</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 bg-gray-100 p-8 flex items-center justify-center"
    >
      <div className="w-full h-full bg-white rounded-2xl shadow-2xl p-8 flex flex-col gap-8 overflow-y-auto">
        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 left-4 right-4 bg-red-50 text-red-600 p-4 rounded-xl shadow-md flex items-center gap-2"
              onClick={() => setError(null)}
            >
              <AlertCircle size={20} />
              <p className="text-sm font-medium">{error} (Click to dismiss)</p>
            </motion.div>
          )}
        </AnimatePresence>

        <h1 className="text-2xl font-bold mb-4 flex items-center gap-2 text-gray-800">
          <Users size={24} className="text-teal-600" />
          Together Workspace
        </h1>

        <div className="flex flex-1 gap-4">
          {/* Jitsi Video Container */}
          <div id="jitsi-container" className="flex-1 bg-black rounded-lg shadow-lg" style={{ minHeight: "400px" }} />

          {/* Participants List */}
          <div className="w-64 bg-white/50 backdrop-blur-sm rounded-3xl shadow-md p-6 border border-teal-100/50 overflow-y-auto">
            <h2 className="font-semibold mb-2 text-gray-800">Participants ({participants.length})</h2>
            <ul className="space-y-2">
              {participants.map((p) => {
                const parts = p.displayName.split("|");
                const displayName = parts[0]?.trim() || "Unknown";
                return (
                  <li key={p.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span>{displayName}</span>
                    {role === "admin" && (
                      <button
                        onClick={() => handleViewScreen(p)}
                        className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                        title="View Screen"
                      >
                        <Monitor size={16} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Footer for consistency */}
        <footer className="mt-auto text-center text-sm text-gray-600">
          © {new Date().getFullYear()} MeedianAI-Flow. All rights reserved.
        </footer>
      </div>

      {/* Join Confirmation Modal */}
      <AnimatePresence>
        {showJoinModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white/90 backdrop-blur-md rounded-3xl shadow-xl p-6 w-full max-w-md border border-teal-100/50"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">Join Meedian Together Workspace?</h2>
                <motion.button
                  onClick={() => setShowJoinModal(false)}
                  className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-all duration-200"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <X size={24} />
                </motion.button>
              </div>
              <div className="space-y-4">
                <label className="flex items-center gap-2">
                  <Camera size={20} className={enableCamera ? "text-teal-600" : "text-gray-400"} />
                  <input
                    type="checkbox"
                    checked={enableCamera}
                    onChange={(e) => setEnableCamera(e.target.checked)}
                    className="form-checkbox"
                  />
                  Enable Camera
                </label>
                <label className="flex items-center gap-2">
                  <Mic size={20} className={enableAudio ? "text-teal-600" : "text-gray-400"} />
                  <input
                    type="checkbox"
                    checked={enableAudio}
                    onChange={(e) => setEnableAudio(e.target.checked)}
                    className="form-checkbox"
                  />
                  Enable Audio
                </label>
                {!isAdmin && (
                  <label className="flex items-center gap-2">
                    <ScreenShare size={20} className={enableScreenShare ? "text-teal-600" : "text-gray-400"} />
                    <input
                      type="checkbox"
                      checked={enableScreenShare}
                      onChange={(e) => setEnableScreenShare(e.target.checked)}
                      className="form-checkbox"
                    />
                    Share My Screen
                  </label>
                )}
              </div>
              <motion.button
                onClick={handleJoin}
                className="w-full bg-teal-600 text-white py-3 rounded-xl font-semibold hover:bg-teal-700 transition-all duration-300 mt-6"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Join
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}