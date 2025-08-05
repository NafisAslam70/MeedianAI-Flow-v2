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
  AlertCircle,
  Music,
  VolumeX,
  MessageSquare,
  Hand,
  Clipboard
} from "lucide-react";
/* helper to build random room IDs for private links (kept for future) */
const makeRoom = (a, b) =>
  `mspace-${a}-${b}-${Math.random().toString(36).slice(2, 7)}-${Date.now()}`;
/* tenant + shared room slug from env */
const tenant = process.env.NEXT_PUBLIC_JAAS_TENANT;
const roomSlug = process.env.NEXT_PUBLIC_JAAS_ROOM || "MeedianTogetherMain";
const roomName = `${tenant}/${roomSlug}`;
const musicOptions = [
  { name: "Ambient Music Free", url: "https://orangefreesounds.com/wp-content/uploads/2023/06/Ambient-music-free.mp3" },
  { name: "Dreamy Ambient Music", url: "https://orangefreesounds.com/wp-content/uploads/2023/06/Dreamy-ambient-music.mp3" },
  { name: "Relaxation Ambient Music", url: "https://orangefreesounds.com/wp-content/uploads/2022/02/Relaxation-ambient-music.mp3" },
  { name: "Chill Ambient Electronic", url: "https://orangefreesounds.com/wp-content/uploads/2022/10/Chill-ambient-electronic-music.mp3" },
  { name: "Ambient Background Music", url: "https://orangefreesounds.com/wp-content/uploads/2017/01/Ambient-background-music.mp3" },
  { name: "Ambient Electronica", url: "https://orangefreesounds.com/wp-content/uploads/2023/04/Ambient-electronica-atmospheric-and-ethereal-sound.mp3" },
  { name: "Ambient Music Loop", url: "https://orangefreesounds.com/wp-content/uploads/2018/09/Ambient-music-loop.mp3" },
];
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
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState(musicOptions[0].url);
  const audioRef = useRef(null);
  const [logs, setLogs] = useState([]); // now array of {time, user, action, duration?}
  const [joinTimes, setJoinTimes] = useState({});
  const [localJoinTime, setLocalJoinTime] = useState(null);
  const [historicalLogs, setHistoricalLogs] = useState(() => JSON.parse(localStorage.getItem('historicalWorkspaceLogs') || '[]'));
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [justLeft, setJustLeft] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
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
        startWithVideoMuted: !cam,
        disablePolls: false,
        disableReactions: false,
        whiteboard: { enabled: true }
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false
      },
      userInfo: { displayName: `${name} | ${uid}` }
    });
    setApi(j);
    /* participants list */
    j.addEventListener("participantJoined", e => {
      const joinTime = new Date();
      const dn = e.displayName ? e.displayName.split("|")[0]?.trim() : "Unknown";
      setLogs(p => [...p, { time: joinTime.toLocaleString(), user: dn, action: "joined" }]);
      setJoinTimes(p => ({ ...p, [e.id]: joinTime }));
      setPpl(p => p.some(x => x.id === e.id) ? p : [...p, e]);
    });
    j.addEventListener("participantLeft", e => {
      const leaveTime = new Date();
      const joinTime = joinTimes[e.id];
      let duration = '';
      if (joinTime) {
        const diff = leaveTime - joinTime;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        duration = `${hours}h ${minutes % 60}m ${seconds % 60}s`;
      }
      const dn = ppl.find(p => p.id === e.id)?.displayName.split("|")[0]?.trim() || "Unknown";
      setLogs(p => [...p, { time: leaveTime.toLocaleString(), user: dn, action: "left", duration }]);
      setHistoricalLogs(p => [...p, { user: dn, joinTime: joinTime.toLocaleString(), leaveTime: leaveTime.toLocaleString(), duration }]);
      setPpl(p => p.filter(x => x.id !== e.id));
      setScreens(s => s.filter(x => x.id !== e.id));
      setJoinTimes(p => { const newP = { ...p }; delete newP[e.id]; return newP; });
    });
    j.addEventListener("videoConferenceJoined", e => {
      const joinTime = new Date();
      setLocalJoinTime(joinTime);
      setLogs(p => [...p, { time: joinTime.toLocaleString(), user: "You", action: "joined" }]);
      setPpl(j.getParticipantsInfo()
        .map(p => ({ id: p.participantId, displayName: p.displayName })));
      // Log existing participants
      j.getParticipantsInfo().forEach(p => {
        const dn = p.displayName.split("|")[0]?.trim() || "Unknown";
        setLogs(prev => [...prev, { time: joinTime.toLocaleString(), user: dn, action: "present" }]);
        setJoinTimes(prev => ({ ...prev, [p.participantId]: joinTime }));
      });
    });
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
    /* check moderator */
    j.addEventListener('participantRoleChanged', (event) => {
      if (event.role === 'moderator') {
        setIsModerator(true);
      }
    });
  };
  const join = () => { setModal(false); setJustLeft(false); init(); };
  const leave = () => {
    const leaveTime = new Date();
    let duration = '';
    if (localJoinTime) {
      const diff = leaveTime - localJoinTime;
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      duration = `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }
    setLogs(p => [...p, { time: leaveTime.toLocaleString(), user: "You", action: "left", duration }]);
    setHistoricalLogs(p => [...p, { user: name, joinTime: localJoinTime.toLocaleString(), leaveTime: leaveTime.toLocaleString(), duration }]);
    api?.removeAllListeners(); api?.dispose();
    setApi(null); setPpl([]); setScreens([]); setModal(true); setJustLeft(true); setShowLeaveConfirm(false);
  };
  const handleMusicChange = (e) => {
    const newUrl = e.target.value;
    setSelectedMusic(newUrl);
    if (audioRef.current) {
      if (isMusicPlaying) {
        audioRef.current.pause();
        audioRef.current.src = newUrl;
        audioRef.current.load();
        audioRef.current.play();
      } else {
        audioRef.current.src = newUrl;
        audioRef.current.load();
      }
    }
  };
  const toggleMusic = () => {
    if (audioRef.current) {
      if (isMusicPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsMusicPlaying(!isMusicPlaying);
    }
  };
  /* ── Guards ──────────────────────── */
  if (status === "loading") return <div>Loading…</div>;
  if (status !== "authenticated" || !["admin", "team_manager", "member"].includes(role))
    return <div className="p-8 text-red-600 font-semibold">Access denied</div>;
  /* ── JSX ─────────────────────────── */
  const groupedHistory = historicalLogs.reduce((acc, log) => {
    if (!acc[log.user]) acc[log.user] = [];
    acc[log.user].push({ time: log.joinTime, action: 'joined' });
    acc[log.user].push({ time: log.leaveTime, action: 'left', duration: log.duration });
    return acc;
  }, {});
  ppl.forEach(p => {
    const dn = p.displayName.split("|")[0]?.trim() || "Unknown";
    const joinTime = joinTimes[p.id];
    if (joinTime) {
      if (!groupedHistory[dn]) groupedHistory[dn] = [];
      groupedHistory[dn].push({ time: joinTime.toLocaleString(), action: 'joined' });
      groupedHistory[dn].push({ time: 'Online now', action: 'online', duration: 'ongoing' });
    }
  });
  useEffect(() => {
    localStorage.setItem('historicalWorkspaceLogs', JSON.stringify(historicalLogs));
  }, [historicalLogs]);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 bg-gradient-to-br from-cyan-900 via-blue-900 to-purple-950 p-8 flex items-center justify-center overflow-hidden">
      {/* cyberpunk neon rain animation */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(50)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute bg-cyan-300 rounded-full opacity-30 blur-sm"
            style={{
              width: '2px',
              height: `${Math.random() * 20 + 10}px`,
              left: `${Math.random() * 100}%`,
              top: '-50px',
            }}
            animate={{
              y: window.innerHeight + 50,
              opacity: [0.1, 0.4, 0.1],
            }}
            transition={{
              duration: Math.random() * 1 + 1,
              repeat: Infinity,
              ease: 'linear',
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>
      {/* subtle neon glow */}
      <div className="absolute inset-0 bg-gradient-radial from-cyan-500/10 to-transparent pointer-events-none" />
      {/* main card */}
      <div className="w-full h-full bg-cyan-950/30 backdrop-blur-xl rounded-2xl shadow-2xl p-8 flex flex-col gap-6 border border-cyan-400/20">
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-cyan-100">
              <Users size={24} className="text-purple-400" /> MeedianAI Together Workspace
            </h1>
            <p className="text-sm text-cyan-300 italic">"As a Team, We Lead the World"</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedMusic}
              onChange={handleMusicChange}
              className="p-2 bg-purple-600/80 text-white rounded-md hover:bg-purple-700/80 backdrop-blur-sm"
            >
              {musicOptions.map((opt, i) => (
                <option key={i} value={opt.url}>{opt.name}</option>
              ))}
            </select>
            <button onClick={toggleMusic}
              className="p-2 bg-purple-600/80 text-white rounded-md hover:bg-purple-700/80 backdrop-blur-sm"
              title={isMusicPlaying ? "Pause Music" : "Play Music"}>
              {isMusicPlaying ? <VolumeX size={20} /> : <Music size={20} />}
            </button>
            {api && (
              <>
                <button onClick={() => api.executeCommand('toggleChat')}
                  className="p-2 bg-purple-600/80 text-white rounded-md hover:bg-purple-700/80 backdrop-blur-sm"
                  title="Toggle Chat">
                  <MessageSquare size={20} />
                </button>
                <button onClick={() => api.executeCommand('toggleRaiseHand')}
                  className="p-2 bg-purple-600/80 text-white rounded-md hover:bg-purple-700/80 backdrop-blur-sm"
                  title="Raise Hand">
                  <Hand size={20} />
                </button>
                <button onClick={() => {
                  if (isModerator) {
                    api.executeCommand('toggleWhiteboard');
                  } else {
                    setErr("Only moderators can open the whiteboard");
                  }
                }}
                  className="p-2 bg-purple-600/80 text-white rounded-md hover:bg-purple-700/80 backdrop-blur-sm"
                  title="Toggle Whiteboard">
                  <Clipboard size={20} />
                </button>
              </>
            )}
            {api ? (
              <button onClick={() => setShowLeaveConfirm(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-red-600/80 text-white rounded-md hover:bg-red-700/80 backdrop-blur-sm">
                <LogOut size={16}/> Leave
              </button>
            ) : (
              <button onClick={join}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-600/80 text-white rounded-md hover:bg-green-700/80 backdrop-blur-sm">
                <Users size={16}/> Join
              </button>
            )}
          </div>
        </header>
        <div className="flex flex-1 gap-4">
          {/* left panel - activity log by names */}
          <div className="w-64 bg-cyan-900/20 backdrop-blur-md rounded-3xl shadow-md p-6
                          border border-purple-300/20 overflow-y-auto text-cyan-100">
            <h2 className="font-semibold mb-2">Meedian History</h2>
            <ul className="space-y-4 text-sm">
              {Object.entries(groupedHistory).map(([user, userLogs]) => (
                <li key={user}>
                  <span className="font-medium">{user}</span>
                  <ul className="ml-4 space-y-1">
                    {userLogs.map((log, i) => (
                      <li key={i}>
                        {log.time}: {log.action} {log.duration ? `(${log.duration})` : ''}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
          {/* Jitsi stage */}
          <div id="jitsi" className="flex-1 bg-black/50 rounded-lg shadow-lg border border-cyan-500/20" style={{ minHeight: 400 }} />
          {/* right panel */}
          <div className="w-64 bg-cyan-900/20 backdrop-blur-md rounded-3xl shadow-md p-6
                          border border-purple-300/20 overflow-y-auto text-cyan-100">
            {/* participant list */}
            <h2 className="font-semibold mb-2">Cyber Colleagues ({ppl.length})</h2>
            <ul className="space-y-2">
              {ppl.map(p => {
                const dn = p.displayName.split("|")[0]?.trim() || "Unknown";
                return (
                  <li key={p.id} className="flex items-center justify-between p-2 bg-cyan-800/30 rounded border border-cyan-600/20">
                    <span>{dn}</span>
                  </li>
                );
              })}
            </ul>
            {/* screen list (admin only) */}
            {isAdmin && (
              <>
                <h2 className="font-semibold mt-6 mb-2">Neon Screens ({screens.length})</h2>
                <ul className="space-y-2">
                  {screens.map(s => {
                    const user = ppl.find(p => p.id === s.id);
                    const dn = user ? user.displayName.split("|")[0]?.trim() : "User";
                    return (
                      <li key={s.id} className="flex items-center justify-between p-2 bg-cyan-800/30 rounded border border-cyan-600/20">
                        <span>{dn}</span>
                        <button
                          onClick={() => api.executeCommand("pinParticipant", s.id)}
                          className="p-1 bg-purple-500/80 text-white rounded hover:bg-purple-600/80"
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
        <footer className="text-center text-sm text-cyan-300 mt-auto">
          © {new Date().getFullYear()} MeedianAI-Flow | Hacking the Future Together
        </footer>
      </div>
      {/* error toast */}
      {err && (
        <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 bg-red-600/80 text-white
                     px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 z-50 backdrop-blur-sm">
          <AlertCircle size={18}/> {err}
          <button onClick={() => setErr(null)} className="ml-auto text-white hover:text-gray-200">
            <X size={16}/>
          </button>
        </motion.div>
      )}
      {/* join modal */}
      <AnimatePresence>
        {modal && (
          <motion.div key="modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }} transition={{ duration: 0.25 }}
              className="bg-cyan-950/70 backdrop-blur-xl rounded-3xl p-8 w-full max-w-md shadow-2xl border border-purple-300/30 text-cyan-100">
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-xl font-bold">{justLeft ? "Join Again Meedian Together Workspace?" : "Jack into the Cyber Workspace?"}</h2>
                <button onClick={() => setModal(false)}
                  className="p-2 text-cyan-300 hover:text-cyan-100">
                  <X size={22}/>
                </button>
              </div>
              <p className="text-sm text-cyan-300 italic mb-4">"United in Code, We Conquer Realms"</p>
              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <Camera size={20} className={cam ? "text-purple-400" : "text-cyan-400"} />
                  <input type="checkbox" checked={cam} onChange={e => setCam(e.target.checked)} />
                  Enable camera
                </label>
                <label className="flex items-center gap-2">
                  <Mic size={20} className={mic ? "text-purple-400" : "text-cyan-400"} />
                  <input type="checkbox" checked={mic} onChange={e => setMic(e.target.checked)} />
                  Enable audio
                </label>
                {!isAdmin && (
                  <label className="flex items-center gap-2">
                    <ScreenShare
                      size={20}
                      className={scr ? "text-purple-400" : "text-cyan-400"}
                    />
                    <input type="checkbox" checked={scr} onChange={e => setScr(e.target.checked)} />
                    Share my screen
                  </label>
                )}
              </div>
              {/* status probe */}
              <p className="mt-2 text-xs text-cyan-300">
                scriptReady: {String(ready)} · jwt: {jwt ? "yes" : "no"}
              </p>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={join}
                disabled={!jwt || !ready}
                className={`w-full mt-5 py-3 rounded-xl font-semibold ${
                  jwt && ready
                    ? "bg-purple-600/80 text-white hover:bg-purple-700/80"
                    : "bg-cyan-800/50 text-cyan-400 cursor-not-allowed"
                } backdrop-blur-sm`}
              >
                {jwt && ready ? "Connect" : "Loading…"}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* leave confirmation modal */}
      <AnimatePresence>
        {showLeaveConfirm && (
          <motion.div key="leave-confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }} transition={{ duration: 0.25 }}
              className="bg-cyan-950/70 backdrop-blur-xl rounded-3xl p-8 w-full max-w-md shadow-2xl border border-purple-300/30 text-cyan-100">
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-xl font-bold">Are you sure you want to leave?</h2>
                <button onClick={() => setShowLeaveConfirm(false)}
                  className="p-2 text-cyan-300 hover:text-cyan-100">
                  <X size={22}/>
                </button>
              </div>
              <div className="flex justify-end gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={leave}
                  className="px-4 py-2 bg-red-600/80 text-white rounded-xl hover:bg-red-700/80 backdrop-blur-sm"
                >
                  Yes
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowLeaveConfirm(false)}
                  className="px-4 py-2 bg-gray-600/80 text-white rounded-xl hover:bg-gray-700/80 backdrop-blur-sm"
                >
                  No
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <audio ref={audioRef} src={selectedMusic} loop preload="auto" />
    </motion.div>
  );
}