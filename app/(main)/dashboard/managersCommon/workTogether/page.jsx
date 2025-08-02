/* WorkTogether – Together Workspace */
"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Monitor, LogOut, X, Camera, Mic, ScreenShare, AlertCircle
} from "lucide-react";

/* helpers */
const makeRoom = (a, b) =>
  `mspace-${a}-${b}-${Math.random().toString(36).slice(2, 7)}-${Date.now()}`;

/* tenant + default room */
const tenant =
  process.env.NEXT_PUBLIC_JAAS_TENANT ??
  "vpaas-magic-cookie-58a506731a10434e9eb9132ead8cfdaf";
const roomSlug = "MeedianTogetherMain";
const roomName = `${tenant}/${roomSlug}`;                 // tenant/slug

export default function WorkTogether() {
  /* auth */
  const { data: session, status } = useSession();
  const role   = session?.user?.role;
  const uid    = session?.user?.id;
  const name   = session?.user?.name ?? "User";
  const isAdmin = role === "admin";

  /* state */
  const [jwt, setJwt]     = useState(null);
  const [ready, setReady] = useState(false);      // script loaded?
  const [api, setApi]     = useState(null);
  const [ppl, setPpl]     = useState([]);
  const [err, setErr]     = useState(null);

  const [modal, setModal] = useState(true);
  const [cam, setCam]     = useState(true);
  const [mic, setMic]     = useState(false);
  const [scr, setScr]     = useState(false);

  /* load external_api.js */
  const sRef = useRef(null);
  useEffect(() => {
    if (window.JitsiMeetExternalAPI || sRef.current) { setReady(true); return; }
    const s = document.createElement("script");
    s.src = `https://8x8.vc/${tenant}/external_api.js`;   // tenant only
    s.async = true;
    s.onload = () => setReady(true);
    s.onerror = () => setErr("Failed to load Jitsi script");
    document.body.appendChild(s);
    sRef.current = s;
    return () => s.remove();
  }, []);

  /* fetch JWT */
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/others/jaas-jwt")
      .then(r => r.json())
      .then(j => j.jwt ? setJwt(j.jwt) : setErr("JWT fetch failed"))
      .catch(() => setErr("JWT fetch failed"));
  }, [status]);

  /* init Jitsi once */
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

    j.addEventListener("participantJoined", e =>
      setPpl(p => p.some(x => x.id === e.id) ? p : [...p, e]));
    j.addEventListener("participantLeft", e =>
      setPpl(p => p.filter(x => x.id !== e.id)));
    j.addEventListener("videoConferenceJoined", () =>
      setPpl(j.getParticipantsInfo()
        .map(p => ({ id: p.participantId, displayName: p.displayName }))));

    j.addEventListener("readyToClose", () => leave());

    if (scr && !isAdmin) j.executeCommand("toggleShareScreen");
  };

  const join  = () => { setModal(false); init(); };
  const leave = () => {
    api?.removeAllListeners(); api?.dispose();
    setApi(null); setPpl([]); setModal(true);
  };

  if (status === "loading") return <div>Loading…</div>;
  if (status !== "authenticated" || !["admin", "team_manager"].includes(role))
    return <div className="p-8 text-red-600 font-semibold">Access denied</div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 bg-gray-100 p-8 flex items-center justify-center">
      {/* card */}
      <div className="w-full h-full bg-white rounded-2xl shadow-2xl p-8 flex flex-col gap-6">

        <header className="flex justify-between items-center">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users size={24} className="text-teal-600"/> Together Workspace
          </h1>
          {api && (
            <button onClick={leave}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white rounded-md hover:bg-red-600">
              <LogOut size={16}/> Leave
            </button>
          )}
        </header>

        <div className="flex flex-1 gap-4">
          <div id="jitsi" className="flex-1 bg-black rounded-lg shadow-lg" style={{ minHeight: 400 }}/>
          <div className="w-64 bg-white/50 backdrop-blur-md rounded-3xl shadow-md p-6
                          border border-teal-100/50 overflow-y-auto">
            <h2 className="font-semibold mb-2">Participants ({ppl.length})</h2>
            <ul className="space-y-2">
              {ppl.map(p => {
                const dn = p.displayName.split("|")[0]?.trim() || "Unknown";
                return (
                  <li key={p.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span>{dn}</span>
                    {isAdmin && api && (
                      <button onClick={() => {
                        const [, rid] = p.displayName.split("|").map(s => s.trim());
                        const priv = `${tenant}/${makeRoom(uid, rid)}#config.startScreenSharing=true`;
                        window.open(`https://8x8.vc/${priv}`, "_blank", "width=800,height=600");
                      }}
                      className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600">
                        <Monitor size={16}/>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <footer className="text-center text-sm text-gray-600 mt-auto">
          © {new Date().getFullYear()} MeedianAI-Flow
        </footer>
      </div>

      {/* error banner */}
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
                  <Camera size={20} className={cam ? "text-teal-600" : "text-gray-400"}/>
                  <input type="checkbox" checked={cam} onChange={e => setCam(e.target.checked)}/> Enable camera
                </label>
                <label className="flex items-center gap-2">
                  <Mic size={20} className={mic ? "text-teal-600" : "text-gray-400"}/>
                  <input type="checkbox" checked={mic} onChange={e => setMic(e.target.checked)}/> Enable audio
                </label>
                {!isAdmin && (
                  <label className="flex items-center gap-2">
                    <ScreenShare size={20} className={scr ? "text-teal-600" : "text-gray-400"}/>
                    <input type="checkbox" checked={scr} onChange={e => setScr(e.target.checked)}/> Share my screen
                  </label>
                )}
              </div>

              <p className="mt-2 text-xs text-gray-500">
                scriptReady: {String(ready)} · jwt: {jwt ? "yes" : "no"}
              </p>

              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={join} disabled={!jwt || !ready}
                className={`w-full mt-5 py-3 rounded-xl font-semibold
                            ${jwt && ready
                              ? "bg-teal-600 text-white hover:bg-teal-700"
                              : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}>
                {jwt && ready ? "Join" : "Loading…"}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
