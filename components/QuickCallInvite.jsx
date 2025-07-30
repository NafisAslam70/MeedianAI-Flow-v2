"use client";
import { useState, useEffect } from "react";
import {
  PhoneIcon,
  XMarkIcon,
  ClipboardIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/solid";
import { motion, AnimatePresence } from "framer-motion";

/* create unique Jitsi room: mspace-<uid>-<rand>-<ts> */
const makeRoom = (uid) =>
  `mspace-${uid}-${Math.random().toString(36).slice(2, 7)}-${Date.now()}`;

export default function QuickCallInvite({
  userDetails,
  position,
  closeAllModals,
}) {
  const [showModal, setShowModal] = useState(false);
  const [room] = useState(() => makeRoom(userDetails?.id || "guest"));
  const meetUrl = `https://meet.jit.si/${room}#config.startScreenSharing=true`;

  const [users, setUsers] = useState([]);
  const [recipient, setRecipient] = useState("");

  /* fetch teammates once */
  useEffect(() => {
    fetch("/api/member/users")
      .then((r) => r.json())
      .then(({ users }) =>
        setUsers(users.filter((u) => u.id !== userDetails.id))
      )
      .catch(() => {});
  }, [userDetails.id]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(meetUrl);
      alert("Link copied!");
    } catch {
      alert("Unable to copy");
    }
  };

  const sendInviteMessage = async () => {
    if (!recipient) return;
    await fetch("/api/others/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: userDetails.id,
        recipientId: recipient,
        message: `🔔 Quick call invitation: ${meetUrl}`,
      }),
    });
  };

  const startCall = async () => {
    if (!recipient) return alert("Pick someone to call!");
    await sendInviteMessage();
    window.open(meetUrl, "_blank");
    setShowModal(false);
    closeAllModals?.();
  };

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowModal(true)}
        className="p-4 bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-full shadow-lg"
        title="Quick Call / Screen‑Share"
      >
        <PhoneIcon className="h-6 w-6" />
      </motion.button>

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.25 }}
            className="fixed z-[999] inset-0 bg-black/40 flex items-center justify-center"
            style={{
              right: `${position?.x ?? 0}px`,
              bottom: `${-position?.y ?? 0}px`,
            }}
          >
            <div className="bg-white w-[340px] rounded-2xl shadow-xl p-6 relative">
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>

              <h2 className="text-lg font-semibold mb-4">Start Quick Call</h2>

              <select
                className="w-full mb-4 p-3 border rounded-lg bg-gray-50"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              >
                <option value="">Select teammate to invite</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>

              <div className="bg-gray-100 p-3 rounded-lg flex items-center justify-between mb-4">
                <span className="truncate break-all text-sm">{meetUrl}</span>
                <button
                  onClick={copyLink}
                  className="ml-2 text-gray-600 hover:text-gray-800"
                  title="Copy link"
                >
                  <ClipboardIcon className="h-5 w-5" />
                </button>
              </div>

              <button
                onClick={startCall}
                disabled={!recipient}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-rose-500 to-pink-600 text-white p-3 rounded-lg hover:opacity-90 transition disabled:opacity-50"
              >
                <PaperAirplaneIcon className="h-5 w-5" />
                Start Call &amp; Invite
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
