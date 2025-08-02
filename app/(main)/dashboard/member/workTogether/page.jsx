"use client";
import { useSession } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Monitor,
  LogOut,
  X,
  Camera,
  Mic,
  ScreenShare,
  AlertCircle
} from "lucide-react";
/* helper to build random room IDs for private links (kept for future) */
const makeRoom = (a, b) =>
  `mspace-${a}-${b}-${Math.random().toString(36).slice(2, 7)}-${Date.now()}`;
/* tenant + shared room slug from env */
const tenant = process.env.NEXT_PUBLIC_JAAS_TENANT;
const roomSlug = process.env.NEXT_PUBLIC_JAAS_ROOM || "MeedianTogetherMain";
const roomName = `${tenant}/${roomSlug}`;
export default function WorkTogether() {
  /* ── Auth info ───────────────────── */
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const uid = session?.user?.id;
  const name = session?.user?.name ?? "User";
  const isAdmin = role === "admin";
  /* ── React state ─────────────────── */
  const [jwt, setJwt] = useState(null);
  const [ready, setReady] = useState(false); // external_api.js loaded?
  const [api, setApi] = useState(null); // Jitsi API instance
  const [ppl, setPpl] = useState([]); // participant list
  const [screens, setScreens] = useState([]); // who is sharing
  const [err, setErr] = useState(null);
  const [modal, setModal] = useState(true);
  const [cam, setCam] = useState(true);
  const [mic, setMic] = useState(false);
  const [scr, setScr] = useState(false); // share-my-screen toggle
  /* default share-my-screen = ON for non-admins */
  useEffect(() => {
    if (role && !isAdmin) setScr(true);
  }, [role, isAdmin]);
  /* ── Load external_api.js once ───── */
  const scriptRef = useRef(null);
  useEffect(() => {
    if (window.JitsiMeetExternalAPI || scriptRef.current) { setReady(true); return; }
    const s = document.createElement("script");
    s.src = `https://8x8.vc/${tenant}/external_api.js`;
    s.async = true;
    s.onload = () => setReady(true);
    s.onerror = () => setErr("Failed to load Jitsi script");
    document.body.appendChild(s);
    scriptRef.current = s;
    return () => s.remove();
  }, []);
  /* ── Fetch JWT once logged in ─────── */
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/others/jaas-jwt")
      .then(r => r.json())
      .then(j => j.jwt ? setJwt(j.jwt) : setErr("JWT fetch failed"))
      .catch(() => setErr("JWT fetch failed"));
  }, [status]);
  /* ── Initialise Jitsi conference ──── */
  const init = () => {
    if (!ready || !jwt || api) return;
    const j = new window.JitsiMeetExternalAPI("8x8.vc", {
      roomName,
      jwt,
      parentNode: document.getElementById("jitsi"),
      width: "100%",
      height: "100%",
      configOverwrite: {
        startWithAudioMuted: !mic,
        startWithVideoMuted: !cam
      },
      userInfo: { displayName: `${name} | ${uid}` }
    });
    setApi(j);
    /* participants list */
    j.addEventListener("participantJoined", e =>
      setPpl(p => p.some(x => x.id === e.id) ? p : [...p, e]));
    j.addEventListener("participantLeft", e => {
      setPpl(p => p.filter(x => x.id !== e.id));
      setScreens(s => s.filter(x => x.id !== e.id));
    });
    j.addEventListener("videoConferenceJoined", () =>
      setPpl(j.getParticipantsInfo()
        .map(p => ({ id: p.participantId, displayName: p.displayName }))));
    /* screen-sharing feed */
    const updateScreen = (track, add) => {
      if (track.getType() !== "video" || track.videoType !== "desktop") return;
      const id = track.getParticipantId?.() ?? track.getParticipantId();
      setScreens(s =>
        add
          ? s.some(x => x.id === id) ? s : [...s, { id }]
          : s.filter(x => x.id !== id)
      );
    };
    j.addEventListener("trackAdded", e => updateScreen(e.track, true));
    j.addEventListener("trackRemoved", e => updateScreen(e.track, false));
    j.addEventListener("readyToClose", () => leave());
    /* auto-start share for non-admins */
    if (scr && !isAdmin) j.executeCommand("toggleShareScreen");
  };
  const join = () => { setModal(false); init(); };
  const leave = () => {
    api?.removeAllListeners(); api?.dispose();
    setApi(null); setPpl([]); setScreens([]); setModal(true);
  };
  /* ── Guards ──────────────────────── */
  if (status === "loading") return <div>Loading…</div>;
  if (status !== "authenticated" || !["admin", "team_manager", "member"].includes(role))
    return <div className="p-8 text-red-600 font-semibold">Access denied</div>;
  /* ── JSX ─────────────────────────── */
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 bg-gray-100 p-8 flex items-center justify-center">
      {/* main card */}
      <div className="w-full h-full bg-white rounded-2xl shadow-2xl p-8 flex flex-col gap-6">
        <header className="flex justify-between items-center">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users size={24} className="text-teal-600" /> Meedian Together Workspace
          </h1>
          {api && (
            <button onClick={leave}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white rounded-md hover:bg-red-600">
              <LogOut size={16}/> Leave
            </button>
          )}
        </header>
        <div className="flex flex-1 gap-4">
          {/* Jitsi stage */}
          <div id="jitsi" className="flex-1 bg-black rounded-lg shadow-lg" style={{ minHeight: 400 }} />
          {/* side panel */}
          <div className="w-64 bg-white/50 backdrop-blur-md rounded-3xl shadow-md p-6
                          border border-teal-100/50 overflow-y-auto">
            {/* participant list */}
            <h2 className="font-semibold mb-2">Participants ({ppl.length})</h2>
            <ul className="space-y-2">
              {ppl.map(p => {
                const dn = p.displayName.split("|")[0]?.trim() || "Unknown";
                return (
                  <li key={p.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span>{dn}</span>
                  </li>
                );
              })}
            </ul>
            {/* screen list (admin only) */}
            {isAdmin && (
              <>
                <h2 className="font-semibold mt-6 mb-2">Screens ({screens.length})</h2>
                <ul className="space-y-2">
                  {screens.map(s => {
                    const user = ppl.find(p => p.id === s.id);
                    const dn = user ? user.displayName.split("|")[0]?.trim() : "User";
                    return (
                      <li key={s.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span>{dn}</span>
                        <button
                          onClick={() => api.executeCommand("pinParticipant", s.id)}
                          className="p-1 bg-teal-500 text-white rounded hover:bg-teal-600"
                          title="Pin screen"
                        >
                          <Monitor size={16}/>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        </div>
        <footer className="text-center text-sm text-gray-600 mt-auto">
          © {new Date().getFullYear()} MeedianAI-Flow
        </footer>
      </div>
      {/* error toast */}
      {err && (
        <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 bg-red-600 text-white
                     px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 z-50">
          <AlertCircle size={18}/> {err}
        </motion.div>
      )}
      {/* join modal */}
      <AnimatePresence>
        {modal && (
          <motion.div key="modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }} transition={{ duration: 0.25 }}
              className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-xl font-bold">Join Meedian Together Workspace?</h2>
                <button onClick={() => setModal(false)}
                  className="p-2 text-gray-500 hover:text-gray-700">
                  <X size={22}/>
                </button>
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <Camera size={20} className={cam ? "text-teal-600" : "text-gray-400"} />
                  <input type="checkbox" checked={cam} onChange={e => setCam(e.target.checked)} />
                  Enable camera
                </label>
                <label className="flex items-center gap-2">
                  <Mic size={20} className={mic ? "text-teal-600" : "text-gray-400"} />
                  <input type="checkbox" checked={mic} onChange={e => setMic(e.target.checked)} />
                  Enable audio
                </label>
                {!isAdmin && (
                  <label className="flex items-center gap-2">
                    <ScreenShare
                      size={20}
                      className={scr ? "text-teal-600" : "text-gray-400"}
                    />
                    <input type="checkbox" checked={scr} onChange={e => setScr(e.target.checked)} />
                    Share my screen
                  </label>
                )}
              </div>
              {/* status probe */}
              <p className="mt-2 text-xs text-gray-500">
                scriptReady: {String(ready)} · jwt: {jwt ? "yes" : "no"}
              </p>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={join}
                disabled={!jwt || !ready}
                className={`w-full mt-5 py-3 rounded-xl font-semibold ${
                  jwt && ready
                    ? "bg-teal-600 text-white hover:bg-teal-700"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                {jwt && ready ? "Join" : "Loading…"}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}


// "use client";
// import { useSession } from "next-auth/react";
// import { useState, useEffect, useRef } from "react";
// import { motion, AnimatePresence } from "framer-motion";
// import {
//   Users,
//   Monitor,
//   LogOut,
//   X,
//   Camera,
//   Mic,
//   MicOff,
//   ScreenShare,
//   AlertCircle,
//   UserX
// } from "lucide-react";
// /* helper to build random room IDs for private links (kept for future) */
// const makeRoom = (a, b) =>
//   `mspace-${a}-${b}-${Math.random().toString(36).slice(2, 7)}-${Date.now()}`;
// /* tenant + shared room slug from env */
// const tenant = process.env.NEXT_PUBLIC_JAAS_TENANT;
// const roomSlug = process.env.NEXT_PUBLIC_JAAS_ROOM || "MeedianTogetherMain";
// const roomName = `${tenant}/${roomSlug}`;
// export default function WorkTogether() {
//   /* ── Auth info ───────────────────── */
//   const { data: session, status } = useSession();
//   const role = session?.user?.role;
//   const uid = session?.user?.id;
//   const name = session?.user?.name ?? "User";
//   const isAdmin = role === "admin";
//   /* ── React state ─────────────────── */
//   const [jwt, setJwt] = useState(null);
//   const [ready, setReady] = useState(false); // external_api.js loaded?
//   const [api, setApi] = useState(null); // Jitsi API instance
//   const [ppl, setPpl] = useState([]); // participant list
//   const [screens, setScreens] = useState([]); // who is sharing
//   const [mutedParticipants, setMutedParticipants] = useState(new Set());
//   const [err, setErr] = useState(null);
//   const [notification, setNotification] = useState(null);
//   const [modal, setModal] = useState(true);
//   const [cam, setCam] = useState(true);
//   const [mic, setMic] = useState(false);
//   const [scr, setScr] = useState(false); // share-my-screen toggle
//   const [myId, setMyId] = useState(null);
//   /* default share-my-screen = ON for non-admins */
//   useEffect(() => {
//     if (role && !isAdmin) setScr(true);
//   }, [role, isAdmin]);
//   /* ── Load external_api.js once ───── */
//   const scriptRef = useRef(null);
//   useEffect(() => {
//     if (window.JitsiMeetExternalAPI || scriptRef.current) { setReady(true); return; }
//     const s = document.createElement("script");
//     s.src = `https://8x8.vc/${tenant}/external_api.js`;
//     s.async = true;
//     s.onload = () => setReady(true);
//     s.onerror = () => setErr("Failed to load Jitsi script");
//     document.body.appendChild(s);
//     scriptRef.current = s;
//     return () => s.remove();
//   }, []);
//   /* ── Fetch JWT once logged in ─────── */
//   useEffect(() => {
//     if (status !== "authenticated") return;
//     fetch("/api/others/jaas-jwt")
//       .then(r => r.json())
//       .then(j => j.jwt ? setJwt(j.jwt) : setErr("JWT fetch failed"))
//       .catch(() => setErr("JWT fetch failed"));
//   }, [status]);
//   /* ── Initialise Jitsi conference ──── */
//   const init = () => {
//     if (!ready || !jwt || api) return;
//     const j = new window.JitsiMeetExternalAPI("8x8.vc", {
//       roomName,
//       jwt,
//       parentNode: document.getElementById("jitsi"),
//       width: "100%",
//       height: "100%",
//       configOverwrite: {
//         startWithAudioMuted: !mic,
//         startWithVideoMuted: !cam
//       },
//       userInfo: { displayName: `${name} | ${uid}` }
//     });
//     setApi(j);
//     /* participants list */
//     j.addEventListener("participantJoined", e =>
//       setPpl(p => p.some(x => x.id === e.id) ? p : [...p, { id: e.id, displayName: e.displayName }]));
//     j.addEventListener("participantLeft", e => {
//       setPpl(p => p.filter(x => x.id !== e.id));
//       setScreens(s => s.filter(x => x.id !== e.id));
//     });
//     j.addEventListener("videoConferenceJoined", (localUser) => {
//       setMyId(localUser.id);
//       const locals = [{ id: localUser.id, displayName: j.getDisplayName() }];
//       const remotes = j.getParticipantsInfo().map(p => ({ id: p.participantId, displayName: p.displayName }));
//       setPpl([...locals, ...remotes]);
//     });
//     /* screen-sharing feed */
//     const updateScreen = (track, add) => {
//       if (track.getType() !== "video" || track.videoType !== "desktop") return;
//       const id = track.getParticipantId?.() ?? track.getParticipantId();
//       setScreens(s =>
//         add
//           ? s.some(x => x.id === id) ? s : [...s, { id }]
//           : s.filter(x => x.id !== id)
//       );
//     };
//     j.addEventListener("trackAdded", e => updateScreen(e.track, true));
//     j.addEventListener("trackRemoved", e => updateScreen(e.track, false));
//     j.addEventListener("readyToClose", () => leave());
//     j.addEventListener('trackMuteChanged', (track) => {
//       if (track.getType() === 'audio' && !track.isLocal()) {
//         const id = track.getParticipantId();
//         setMutedParticipants(prev => {
//           const newSet = new Set(prev);
//           if (track.isMuted()) {
//             newSet.add(id);
//           } else {
//             newSet.delete(id);
//           }
//           return newSet;
//         });
//       }
//     });
//     j.addEventListener('endpointTextMessageReceived', (event) => {
//       const { senderInfo, eventData } = event.data;
//       if (senderInfo.id === myId) return;
//       const text = eventData.text;
//       const audioTrack = j.getLocalTracks().find(t => t.getType() === 'audio');
//       if (audioTrack) {
//         if (text === 'mute-audio' && !audioTrack.isMuted()) {
//           j.executeCommand('toggleAudio');
//         } else if (text === 'unmute-audio' && audioTrack.isMuted()) {
//           j.executeCommand('toggleAudio');
//         }
//       }
//     });
//     /* auto-start share for non-admins */
//     if (scr && !isAdmin) j.executeCommand("toggleShareScreen");
//   };
//   const join = () => { setModal(false); init(); };
//   const leave = () => {
//     api?.removeAllListeners(); api?.dispose();
//     setApi(null); setPpl([]); setScreens([]); setModal(true);
//   };
//   const requestLeave = () => {
//     api.executeCommand('sendChatMessage', `${name} requests to leave the meeting.`);
//     setNotification("Request sent to admin.");
//     setTimeout(() => setNotification(null), 5000);
//   };
//   const toggleMuteParticipant = (id) => {
//     const isMuted = mutedParticipants.has(id);
//     api.executeCommand('sendEndpointTextMessage', id, isMuted ? 'unmute-audio' : 'mute-audio');
//   };
//   /* Prevent tab close for non-admins */
//   useEffect(() => {
//     if (api && !isAdmin) {
//       const preventClose = (e) => {
//         e.preventDefault();
//         e.returnValue = 'Are you sure you want to leave? Please request permission from the admin first.';
//       };
//       window.addEventListener('beforeunload', preventClose);
//       return () => window.removeEventListener('beforeunload', preventClose);
//     }
//   }, [api, isAdmin]);
//   /* ── Guards ──────────────────────── */
//   if (status === "loading") return <div>Loading…</div>;
//   if (status !== "authenticated" || !["admin", "team_manager", "member"].includes(role))
//     return <div className="p-8 text-red-600 font-semibold">Access denied</div>;
//   /* ── JSX ─────────────────────────── */
//   return (
//     <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
//       className="fixed inset-0 bg-gray-100 p-8 flex items-center justify-center">
//       {/* main card */}
//       <div className="w-full h-full bg-white rounded-2xl shadow-2xl p-8 flex flex-col gap-6">
//         <header className="flex justify-between items-center">
//           <h1 className="text-2xl font-bold flex items-center gap-2">
//             <Users size={24} className="text-teal-600" /> Meedian Together Workspace
//           </h1>
//           {api && (
//             isAdmin ? (
//               <button onClick={leave}
//                 className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white rounded-md hover:bg-red-600">
//                 <LogOut size={16}/> Leave
//               </button>
//             ) : (
//               <button onClick={requestLeave}
//                 className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white rounded-md hover:bg-red-600">
//                 <LogOut size={16}/> Request to Leave
//               </button>
//             )
//           )}
//         </header>
//         <div className="flex flex-1 gap-4">
//           {/* Jitsi stage */}
//           <div id="jitsi" className="flex-1 bg-black rounded-lg shadow-lg" style={{ minHeight: 400 }} />
//           {/* side panel */}
//           <div className="w-64 bg-white/50 backdrop-blur-md rounded-3xl shadow-md p-6
//                           border border-teal-100/50 overflow-y-auto">
//             {/* participant list */}
//             <h2 className="font-semibold mb-2">Participants ({ppl.length})</h2>
//             <ul className="space-y-2">
//               {ppl.map(p => {
//                 const dn = (p.displayName || "").split("|")[0]?.trim() || "Unknown";
//                 const isMuted = mutedParticipants.has(p.id);
//                 return (
//                   <li key={p.id} className="flex items-center justify-between p-2 bg-gray-50 rounded gap-1">
//                     <span>{dn}</span>
//                     {isAdmin && p.id !== myId && (
//                       <>
//                         <button
//                           onClick={() => toggleMuteParticipant(p.id)}
//                           className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600"
//                           title={isMuted ? "Unmute" : "Mute"}
//                         >
//                           {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
//                         </button>
//                         <button
//                           onClick={() => api.executeCommand('kickParticipant', p.id)}
//                           className="p-1 bg-red-500 text-white rounded hover:bg-red-600"
//                           title="Kick participant"
//                         >
//                           <UserX size={16}/>
//                         </button>
//                       </>
//                     )}
//                   </li>
//                 );
//               })}
//             </ul>
//             {/* screen list (admin only) */}
//             {isAdmin && (
//               <>
//                 <h2 className="font-semibold mt-6 mb-2">Screens ({screens.length})</h2>
//                 <ul className="space-y-2">
//                   {screens.map(s => {
//                     const user = ppl.find(p => p.id === s.id);
//                     const dn = user ? (user.displayName || "").split("|")[0]?.trim() || "Unknown" : "Unknown";
//                     return (
//                       <li key={s.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
//                         <span>{dn}</span>
//                         <button
//                           onClick={() => api.executeCommand("pinParticipant", s.id)}
//                           className="p-1 bg-teal-500 text-white rounded hover:bg-teal-600"
//                           title="Pin screen"
//                         >
//                           <Monitor size={16}/>
//                         </button>
//                       </li>
//                     );
//                   })}
//                 </ul>
//               </>
//             )}
//           </div>
//         </div>
//         <footer className="text-center text-sm text-gray-600 mt-auto">
//           © {new Date().getFullYear()} MeedianAI-Flow
//         </footer>
//       </div>
//       {/* error toast */}
//       {err && (
//         <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
//           className="fixed top-6 left-1/2 -translate-x-1/2 bg-red-600 text-white
//                      px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 z-50">
//           <AlertCircle size={18}/> {err}
//         </motion.div>
//       )}
//       {/* notification toast */}
//       {notification && (
//         <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
//           className="fixed top-6 left-1/2 -translate-x-1/2 bg-teal-600 text-white
//                      px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 z-50">
//           {notification}
//         </motion.div>
//       )}
//       {/* join modal */}
//       <AnimatePresence>
//         {modal && (
//           <motion.div key="modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
//             className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
//             <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
//               exit={{ scale: 0.9, opacity: 0 }} transition={{ duration: 0.25 }}
//               className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
//               <div className="flex justify-between items-center mb-5">
//                 <h2 className="text-xl font-bold">Join Meedian Together Workspace?</h2>
//                 <button onClick={() => setModal(false)}
//                   className="p-2 text-gray-500 hover:text-gray-700">
//                   <X size={22}/>
//                 </button>
//               </div>
//               <div className="space-y-3">
//                 <label className="flex items-center gap-2">
//                   <Camera size={20} className={cam ? "text-teal-600" : "text-gray-400"} />
//                   <input type="checkbox" checked={cam} onChange={e => setCam(e.target.checked)} />
//                   Enable camera
//                 </label>
//                 <label className="flex items-center gap-2">
//                   <Mic size={20} className={mic ? "text-teal-600" : "text-gray-400"} />
//                   <input type="checkbox" checked={mic} onChange={e => setMic(e.target.checked)} />
//                   Enable audio
//                 </label>
//                 {!isAdmin && (
//                   <label className="flex items-center gap-2">
//                     <ScreenShare
//                       size={20}
//                       className={scr ? "text-teal-600" : "text-gray-400"}
//                     />
//                     <input type="checkbox" checked={scr} onChange={e => setScr(e.target.checked)} />
//                     Share my screen
//                   </label>
//                 )}
//               </div>
//               {/* status probe */}
//               <p className="mt-2 text-xs text-gray-500">
//                 scriptReady: {String(ready)} · jwt: {jwt ? "yes" : "no"}
//               </p>
//               <motion.button
//                 whileHover={{ scale: 1.02 }}
//                 whileTap={{ scale: 0.98 }}
//                 onClick={join}
//                 disabled={!jwt || !ready}
//                 className={`w-full mt-5 py-3 rounded-xl font-semibold ${
//                   jwt && ready
//                     ? "bg-teal-600 text-white hover:bg-teal-700"
//                     : "bg-gray-300 text-gray-500 cursor-not-allowed"
//                 }`}
//               >
//                 {jwt && ready ? "Join" : "Loading…"}
//               </motion.button>
//             </motion.div>
//           </motion.div>
//         )}
//       </AnimatePresence>
//     </motion.div>
//   );
// }