"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Monitor, LogOut, X, Camera, Mic, ScreenShare,
  AlertCircle, Music, VolumeX, MessageSquare, Hand, Clipboard,
  Loader2, ExternalLink, Send, CheckCircle2, FileText
} from "lucide-react";
import MyNotes from "@/components/MyNotes";

/* ───────── helpers ───────── */
const getValidImageUrl = (url) => {
  if (!url || typeof url !== "string") return "/default-avatar.png";
  const clean = url.trim();
  if (!clean || clean.toLowerCase() === "null" || clean.toLowerCase() === "undefined") {
    return "/default-avatar.png";
  }
  return clean;
};
const timeAgo = (iso) => {
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const s = Math.max(1, Math.floor((now - then) / 1000));
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  } catch { return ""; }
};
const byId = (arr, key = "userId") => {
  const m = new Map();
  for (const x of arr) m.set(String(x[key]), x);
  return m;
};
function mergeFeed(prev, next) {
  const prevMap = byId(prev);
  for (const n of next) {
    const id = String(n.userId);
    const p = prevMap.get(id);
    if (!p) prevMap.set(id, n);
    else if (
      p.itemTitle !== n.itemTitle ||
      p.note !== n.note ||
      p.startedAt !== n.startedAt ||
      p.avatar !== n.avatar ||
      p.userName !== n.userName ||
      p.type !== n.type // ← include type for category pill
    ) prevMap.set(id, { ...p, ...n });
  }
  const nextIds = new Set(next.map((x) => String(x.userId)));
  for (const id of Array.from(prevMap.keys())) {
    if (!nextIds.has(id)) prevMap.delete(id);
  }
  return Array.from(prevMap.values()).sort(
    (a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0)
  );
}

/* category pill meta */
const typeMeta = (t) => {
  const k = String(t || "").toLowerCase();
  switch (k) {
    case "assigned":
      return { label: "Assigned", cls: "bg-blue-600/15 text-blue-200 border-blue-500/30" };
    case "routine":
      return { label: "Routine", cls: "bg-emerald-600/15 text-emerald-200 border-emerald-500/30" };
    case "mri":
      return { label: "MRI", cls: "bg-amber-600/15 text-amber-200 border-amber-500/30" };
    case "custom":
      return { label: "Custom", cls: "bg-purple-600/15 text-purple-200 border-purple-500/30" };
    default:
      return { label: "—", cls: "bg-white/10 text-gray-200 border-white/20" };
  }
};

/* ───────── MRN API helpers ───────── */
async function mrrFetch(suffix, init) {
  const res = await fetch(`/api/member/meRightNow${suffix}`, init);
  if (res.status === 304) return { status: 304, headers: res.headers, json: null };
  if (!res.ok) {
    let msg = "";
    try { msg = (await res.json())?.error || ""; } catch {}
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return { status: res.status, headers: res.headers, json: await res.json() };
}

/* ───────── music list ───────── */
const musicOptions = [
  { name: "Ambient Music Free", url: "https://orangefreesounds.com/wp-content/uploads/2023/06/Ambient-music-free.mp3" },
  { name: "Dreamy Ambient Music", url: "https://orangefreesounds.com/wp-content/uploads/2023/06/Dreamy-ambient-music.mp3" },
  { name: "Relaxation Ambient Music", url: "https://orangefreesounds.com/wp-content/uploads/2022/02/Relaxation-ambient-music.mp3" },
  { name: "Chill Ambient Electronic", url: "https://orangefreesounds.com/wp-content/uploads/2022/10/Chill-ambient-electronic-music.mp3" },
];

/* ───────── component ───────── */
export default function WorkTogether() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const uid = session?.user?.id;
  const name = session?.user?.name ?? "User";
  const isAdmin = role === "admin";
  const currentUserInfo = useMemo(() => {
    if (!uid) return null;
    return {
      id: Number.isNaN(Number(uid)) ? uid : parseInt(uid, 10),
      name,
      role,
    };
  }, [uid, name, role]);

  // jitsi
  const [jwt, setJwt] = useState(null);
  const [ready, setReady] = useState(false);
  const [api, setApi] = useState(null);
  const scriptRef = useRef(null);

  // ui + state
  const [modal, setModal] = useState(true);
  const [cam, setCam] = useState(true);
  const [mic, setMic] = useState(false);
  const [scr, setScr] = useState(false);
  const [err, setErr] = useState(null);

  const [ppl, setPpl] = useState([]);
  const [screens, setScreens] = useState([]);

  // Notes overlay state
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesUsers, setNotesUsers] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState("");
  const [notesFetched, setNotesFetched] = useState(false);
  const [notesSharePrompt, setNotesSharePrompt] = useState(false);
  const [notesShareActive, setNotesShareActive] = useState(false);
  const [notesFollowing, setNotesFollowing] = useState(false);
  const [notesHostId, setNotesHostId] = useState(null);
  const [notesHostName, setNotesHostName] = useState("");
  const [notesSelectedId, setNotesSelectedId] = useState(null);
  const [notesCurrentSelectedId, setNotesCurrentSelectedId] = useState(null);
  const notesMsgHandlerRef = useRef(null);
  const endpointListenerRef = useRef(null);

  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState(musicOptions[0].url);
  const audioRef = useRef(null);

  // (Notes overlay removed) — keep original layout

  // full-screen notes handled by MyNotes overlay; no local notebook state

  // MRN gate
  const [mrrChecking, setMrrChecking] = useState(false);
  const [mrrErr, setMrrErr] = useState("");
  const [mrrCurrent, setMrrCurrent] = useState(null);
  const [mode, setMode] = useState("assigned"); // assigned | routine
  const [optsLoading, setOptsLoading] = useState(false);
  const [options, setOptions] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [note, setNote] = useState("");

  // Right-Now feed (left panel)
  const [feed, setFeed] = useState([]);
  const [feedErr, setFeedErr] = useState("");
  const [firstFeedLoad, setFirstFeedLoad] = useState(true);
  const [refreshingFeed, setRefreshingFeed] = useState(false);
  const feedCacheRef = useRef({ etag: null });

  // Exit modal state
  const [exitOpen, setExitOpen] = useState(false);
  const [exitBusy, setExitBusy] = useState(false);
  const [exitErr, setExitErr] = useState("");

  // auto-enable screenshare for non-admins
  useEffect(() => {
    if (role && !isAdmin) setScr(true);
  }, [role, isAdmin]);

  useEffect(() => {
    if (!notesOpen || !uid || notesLoading || notesFetched) return;
    let cancelled = false;
    const loadUsers = async () => {
      try {
        setNotesLoading(true);
        const res = await fetch("/api/member/users", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        setNotesUsers(Array.isArray(data.users) ? data.users : []);
        setNotesError("");
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load note users", error);
        setNotesError(error.message || "Failed to load teammates");
      } finally {
        if (!cancelled) {
          setNotesLoading(false);
          setNotesFetched(true);
        }
      }
    };
    loadUsers();
    return () => {
      cancelled = true;
    };
  }, [notesOpen, uid, notesLoading, notesFetched]);

  useEffect(() => {
    notesMsgHandlerRef.current = (event) => {
      try {
        let message = null;
        if (!event) return;
        if (typeof event === "string") message = event;
        else if (typeof event?.data === "string") message = event.data;
        else if (typeof event?.data?.message === "string") message = event.data.message;
        else if (typeof event?.data?.text === "string") message = event.data.text;
        else if (typeof event?.data?.eventData?.text === "string") message = event.data.eventData.text;
        else if (typeof event?.message === "string") message = event.message;
        if (!message) return;
        let payload;
        try {
          payload = typeof message === "string" ? JSON.parse(message) : message;
        } catch {
          return;
        }
        if (payload?.type !== "notes-follow") return;
        if (payload.hostId === currentUserInfo?.id) return;
        switch (payload.action) {
          case "open": {
            setNotesHostId(payload.hostId || null);
            setNotesHostName(payload.hostName || "Presenter");
            setNotesShareActive(false);
            setNotesFollowing(true);
            setNotesSharePrompt(false);
            setNotesFetched(false);
            const noteId = payload.noteId ?? null;
            setNotesSelectedId(noteId);
            setNotesCurrentSelectedId(noteId);
            setNotesError("");
            setNotesOpen(true);
            break;
          }
          case "select": {
            if (payload.hostId === notesHostId || notesHostId === null) {
              const noteId = payload.noteId ?? null;
              setNotesHostId(payload.hostId || notesHostId);
              if (notesFollowing) {
                setNotesSelectedId(noteId);
              }
              setNotesCurrentSelectedId(noteId);
            }
            break;
          }
          case "close": {
            if (notesFollowing && notesHostId && payload.hostId === notesHostId) {
              setNotesFollowing(false);
              setNotesHostId(null);
              setNotesHostName("");
              setNotesSelectedId(null);
              setNotesShareActive(false);
              setNotesOpen(false);
            }
            break;
          }
          default:
            break;
        }
      } catch (error) {
        console.warn("Failed to handle notes message", error);
      }
    };
  }, [currentUserInfo?.id, notesFollowing, notesHostId]);

  /* Robust Jitsi external_api loader with fallbacks:
     1) https://8x8.vc/${tenant}/external_api.js
     2) https://8x8.vc/external_api.js
     3) https://cdn.jitsi.net/external_api.min.js
  */
  useEffect(() => {
    if (window.JitsiMeetExternalAPI || scriptRef.current) { setReady(true); return; }
    const tenant = process.env.NEXT_PUBLIC_JAAS_TENANT;

    const candidates = [
      `https://8x8.vc/${tenant}/external_api.js`,
      `https://8x8.vc/external_api.js`,
      `https://cdn.jitsi.net/external_api.min.js`,
    ];

    let cancelled = false;
    let idx = 0;

    const tryLoad = () =>
      new Promise((resolve, reject) => {
        if (cancelled) return;
        const src = candidates[idx];
        if (!src) return reject(new Error("All Jitsi script sources failed"));
        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.onload = () => resolve(src);
        s.onerror = () => reject(new Error(`load failed: ${src}`));
        document.body.appendChild(s);
        scriptRef.current = s;
      });

    (async () => {
      while (!cancelled && idx < candidates.length) {
        try {
          const okSrc = await tryLoad();
          if (cancelled) return;
          // small guard: make sure global is present
          const waitForAPI = (tries = 0) =>
            new Promise((res, rej) => {
              const t = setInterval(() => {
                if (window.JitsiMeetExternalAPI) {
                  clearInterval(t);
                  res(true);
                } else if (tries > 50) {
                  clearInterval(t);
                  rej(new Error("Jitsi API not present after script load"));
                }
              }, 100);
            });

          await waitForAPI();
          setReady(true);
          setErr(null);
          return;
        } catch (e) {
          idx += 1; // try next candidate
          if (idx >= candidates.length) {
            setErr("Couldn’t load Jitsi client (network / DNS issue).");
          }
        }
      }
    })();

    return () => {
      cancelled = true;
      if (scriptRef.current) {
        try { document.body.removeChild(scriptRef.current); } catch {}
        scriptRef.current = null;
      }
    };
  }, []);

  // fetch JWT after login
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/others/jaas-jwt")
      .then((r) => r.json())
      .then((j) => (j.jwt ? setJwt(j.jwt) : setErr("JWT fetch failed")))
      .catch(() => setErr("JWT fetch failed"));
  }, [status]);

  // check MRN + options for gate
  useEffect(() => {
    if (!modal) return; // only when modal is open
    checkMRN();
  }, [modal]);

  useEffect(() => {
    if (!modal) return;
    if (mode === "assigned" || mode === "routine") loadOptions(mode);
  }, [modal, mode]);

  async function checkMRN() {
    try {
      setMrrChecking(true);
      const { json } = await mrrFetch("?action=current", { cache: "no-store" });
      const next = json?.current || null;
      setMrrCurrent((prev) => {
        const same = !!prev && !!next &&
          prev.itemId === next.itemId &&
          prev.type === next.type &&
          prev.startedAt === next.startedAt &&
          prev.note === next.note;
        return same ? prev : next;
      });
      setMrrErr("");
    } catch {
      setMrrErr("Couldn’t check your Me Right Now status.");
    } finally {
      setMrrChecking(false);
    }
  }

  async function loadOptions(type) {
    try {
      setOptsLoading(true);
      setOptions([]); setSelectedId("");
      const { json } = await mrrFetch(`?action=options&type=${encodeURIComponent(type)}`, { cache: "no-store" });
      setOptions(Array.isArray(json?.items) ? json.items : []);
    } catch {
      setOptions([]); setMrrErr(`Couldn’t load ${type} options.`);
    } finally {
      setOptsLoading(false);
    }
  }

  async function startMRN() {
    if (!selectedId) {
      setMrrErr(`Please choose a ${mode === "assigned" ? "task" : "routine"} first.`);
      return;
    }
    try {
      await mrrFetch("?action=start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: mode,
          itemId: String(selectedId),
          note: note?.trim() || "",
        }),
      });
      await checkMRN();
      await loadFeed(true); // reflect immediately
    } catch (e) {
      setMrrErr(e?.message || "Failed to push Me Right Now.");
    }
  }

  // feed loader with ETag + no flicker
  async function loadFeed(silent = true) {
    try {
      setRefreshingFeed(true);
      const headers = {};
      if (feedCacheRef.current.etag) headers["If-None-Match"] = feedCacheRef.current.etag;

      const res = await fetch("/api/member/meRightNow?action=feed", {
        cache: "no-store",
        headers,
      });

      if (res.status === 304) { setFeedErr(""); return; }
      if (!res.ok) throw new Error(await res.text());

      const etag = res.headers.get("etag");
      if (etag) feedCacheRef.current.etag = etag;

      const { feed: fresh = [] } = await res.json();
      setFeed((prev) => (prev.length ? mergeFeed(prev, fresh) : fresh));
      setFeedErr("");
    } catch {
      setFeedErr("Couldn’t load “Meedians Right Now” feed.");
      // keep previous feed visible
    } finally {
      setFirstFeedLoad(false);
      setRefreshingFeed(false);
    }
  }

  // mount + poll feed
  useEffect(() => {
    let t;
    (async () => {
      await loadFeed(false);
      t = setInterval(() => loadFeed(true), 12000);
    })();
    return () => t && clearInterval(t);
  }, []);

  // jitsi config
  const tenant = (process.env.NEXT_PUBLIC_JAAS_TENANT || "meedian-dev").trim();
  const roomSlug = (process.env.NEXT_PUBLIC_JAAS_ROOM || "MeedianTogetherMain").trim();
  const roomName = `${tenant}/${roomSlug}`;

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
        whiteboard: { enabled: true }, // anyone can use whiteboard
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
      },
      userInfo: { displayName: `${name} | ${uid}` },
    });

    setApi(j);

    j.addEventListener("participantJoined", (e) => {
      setPpl((p) => (p.some((x) => x.id === e.id) ? p : [...p, e]));
    });
    j.addEventListener("participantLeft", (e) => {
      setPpl((p) => p.filter((x) => x.id !== e.id));
      setScreens((s) => s.filter((x) => x.id !== e.id));
    });
    j.addEventListener("videoConferenceJoined", () => {
      setPpl(j.getParticipantsInfo().map((p) => ({ id: p.participantId, displayName: p.displayName })));
      if (scr) j.executeCommand("toggleShareScreen");
    });

    const handleTrack = (track, add) => {
      if (!track || track.getType() !== "video" || track.videoType !== "desktop") return;
      const id = track.getParticipantId();
      if (!id) return;
      setScreens((s) => (add ? (s.some((x) => x.id === id) ? s : [...s, { id }]) : s.filter((x) => x.id !== id)));
    };
    j.addEventListener("trackAdded", (e) => handleTrack(e.track, true));
    j.addEventListener("trackRemoved", (e) => handleTrack(e.track, false));
    j.addEventListener("readyToClose", () => openExitModal());

    const endpointListener = (event) => {
      const handler = notesMsgHandlerRef.current;
      if (handler) handler(event);
    };
    j.addEventListener("endpointTextMessageReceived", endpointListener);
    endpointListenerRef.current = endpointListener;
  };

  const join = () => {
    if (!mrrCurrent) {
      setErr("Please push your Me Right Now first.");
      return;
    }
    setModal(false);
    init();
  };

  // split disposal so we can reuse it
  const disposeMeeting = () => {
    stopNotesShare();
    if (endpointListenerRef.current && api?.removeEventListener) {
      api.removeEventListener("endpointTextMessageReceived", endpointListenerRef.current);
      endpointListenerRef.current = null;
    }
    api?.removeAllListeners();
    api?.dispose();
    setApi(null);
    setPpl([]);
    setScreens([]);
    setModal(true);
    setNotesOpen(false);
    setNotesShareActive(false);
    setNotesFollowing(false);
    setNotesHostId(null);
    setNotesHostName("");
    setNotesSelectedId(null);
  };

  const openExitModal = () => {
    if (!mrrCurrent) { disposeMeeting(); return; }
    setExitErr("");
    setExitOpen(true);
  };

  const onClickHeaderLeave = () => {
    openExitModal();
  };

  const stopMRNAndLeave = async (openDash = false) => {
    try {
      setExitBusy(true);
      await mrrFetch("?action=stop", { method: "POST" });
      setMrrCurrent(null);
      await loadFeed(true);
      disposeMeeting();
      if (openDash) window.open("/dashboard/member", "_blank");
      setExitOpen(false);
    } catch (e) {
      setExitErr(e?.message || "Failed to stop Me Right Now.");
    } finally {
      setExitBusy(false);
    }
  };

  const leaveKeepMRN = () => {
    disposeMeeting();           // keep MRN active
    setExitOpen(false);
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
    if (!audioRef.current) return;
    if (isMusicPlaying) audioRef.current.pause();
    else audioRef.current.play();
    setIsMusicPlaying(!isMusicPlaying);
  };

  const sendNotesSignal = useCallback(
    (action, payload = {}) => {
      if (!api || !currentUserInfo?.id) return;
      try {
        api.executeCommand(
          "sendEndpointTextMessage",
          "",
          JSON.stringify({
            type: "notes-follow",
            action,
            hostId: currentUserInfo.id,
            hostName: currentUserInfo.name,
            timestamp: Date.now(),
            ...payload,
          })
        );
      } catch (error) {
        console.warn("Failed to send notes signal", error);
      }
    },
    [api, currentUserInfo]
  );

  const openNotesOverlay = useCallback(() => {
    setNotesError("");
    setNotesSharePrompt(false);
    setNotesFetched(false);
    setNotesOpen(true);
  }, []);

  const stopNotesShare = useCallback(
    (broadcast = true) => {
      if (!notesShareActive) return;
      if (broadcast) sendNotesSignal("close");
      setNotesShareActive(false);
      setNotesHostId(null);
      setNotesHostName("");
      setNotesSelectedId(null);
    },
    [notesShareActive, sendNotesSignal]
  );

  const followHost = useCallback(() => {
    if (!notesHostId) return;
    setNotesFollowing(true);
    if (notesCurrentSelectedId !== undefined) {
      setNotesSelectedId(notesCurrentSelectedId);
    }
  }, [notesHostId, notesCurrentSelectedId]);

  const openNotesOverlayPrivate = useCallback(() => {
    setNotesError("");
    setNotesSharePrompt(false);
    setNotesFetched(false);
    setNotesFollowing(false);
    setNotesOpen(true);
  }, []);

  const handleCloseNotes = useCallback(() => {
    if (notesShareActive && notesHostId === currentUserInfo?.id) {
      stopNotesShare();
    }
    setNotesFollowing(false);
    setNotesOpen(false);
    setNotesError("");
  }, [notesShareActive, notesHostId, currentUserInfo?.id, stopNotesShare]);

  const startNotesShare = useCallback(() => {
    const hostId = currentUserInfo?.id ?? null;
    setNotesHostId(hostId);
    setNotesHostName(currentUserInfo?.name || "Presenter");
    setNotesShareActive(true);
    setNotesFollowing(false);
    const noteId = notesCurrentSelectedId || null;
    setNotesSelectedId(noteId);
    setNotesError("");
    setNotesSharePrompt(false);
    setNotesFetched(false);
    setNotesOpen(true);
    sendNotesSignal("open", { noteId });
  }, [currentUserInfo, notesCurrentSelectedId, sendNotesSignal]);

  // guards
  if (status === "loading") return <div>Loading…</div>;
  if (status !== "authenticated" || !["admin", "team_manager", "member"].includes(role)) {
    return <div className="p-8 text-red-600 font-semibold">Access denied</div>;
  }

  const isHost = notesShareActive && notesHostId === currentUserInfo?.id;
  const hostActive = !!notesHostId && notesHostId !== currentUserInfo?.id;
  const isFollower = hostActive && notesFollowing;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 bg-gradient-to-br from-cyan-900 via-blue-900 to-purple-950 p-8 flex items-center justify-center overflow-hidden"
    >
      {/* neon background */}
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
            <button
              onClick={toggleMusic}
              className="p-2 bg-purple-600/80 text-white rounded-md hover:bg-purple-700/80 backdrop-blur-sm"
              title={isMusicPlaying ? "Pause Music" : "Play Music"}
            >
              {isMusicPlaying ? <VolumeX size={20} /> : <Music size={20} />}
            </button>
            <button
              onClick={() => {
                if (notesOpen) return;
                setNotesSharePrompt(true);
                setNotesError("");
              }}
              className="px-3 py-2 bg-emerald-500/80 text-white rounded-md hover:bg-emerald-600/90 backdrop-blur-sm flex items-center gap-1"
              title="Open collaborative notes"
            >
              <FileText size={18} /> Notes
            </button>
            {api && (
              <>
                <button onClick={() => api.executeCommand("toggleChat")}
                  className="p-2 bg-purple-600/80 text-white rounded-md hover:bg-purple-700/80 backdrop-blur-sm" title="Toggle Chat">
                  <MessageSquare size={20} />
                </button>
                <button onClick={() => api.executeCommand("toggleRaiseHand")}
                  className="p-2 bg-purple-600/80 text-white rounded-md hover:bg-purple-700/80 backdrop-blur-sm" title="Raise Hand">
                  <Hand size={20} />
                </button>
                {/* whiteboard open for everyone */}
                <button onClick={() => api.executeCommand("toggleWhiteboard")}
                  className="p-2 bg-purple-600/80 text-white rounded-md hover:bg-purple-700/80 backdrop-blur-sm" title="Toggle Whiteboard">
                  <Clipboard size={20} />
                </button>
                <button onClick={() => api.executeCommand("toggleShareScreen")}
                  className="p-2 bg-purple-600/80 text-white rounded-md hover:bg-purple-700/80 backdrop-blur-sm" title="Toggle Screen Share">
                  <ScreenShare size={20} />
                </button>
              </>
            )}
            {api ? (
              <button onClick={onClickHeaderLeave}
                className="flex items-center gap-1 px-3 py-1.5 bg-red-600/80 text-white rounded-md hover:bg-red-700/80 backdrop-blur-sm">
                <LogOut size={16}/> Leave
              </button>
            ) : (
              <button onClick={() => setModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-600/80 text-white rounded-md hover:bg-green-700/80 backdrop-blur-sm">
                <Users size={16}/> Join
              </button>
            )}
          </div>
        </header>

        <div className="flex flex-1 gap-4 min-h-0">
          {/* Left: Meedians Right Now feed (stable) */}
          <div className="w-72 h-full bg-cyan-900/20 backdrop-blur-md rounded-3xl shadow-md p-5 border border-purple-300/20 overflow-y-auto text-cyan-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Meedians Right Now</h2>
              <div className="flex items-center gap-2">
                {refreshingFeed && <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />}
                <button
                  onClick={() => loadFeed(true)}
                  className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/15"
                >
                  Refresh
                </button>
              </div>
            </div>

            {firstFeedLoad && feed.length === 0 ? (
              <div className="py-6 flex items-center gap-2 text-cyan-300">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : feedErr ? (
              <div className="text-sm text-rose-300 py-6">{feedErr}</div>
            ) : feed.length === 0 ? (
              <div className="text-sm text-cyan-300/80 py-6">No one has entered their Mission (MRN) yet.</div>
            ) : (
              <motion.ul layout className="space-y-3">
                <AnimatePresence initial={false}>
                  {feed.map((item) => (
                    <motion.li
                      layout
                      key={item.userId}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ type: "spring", stiffness: 300, damping: 28 }}
                      className="flex items-start gap-3 p-2 rounded-xl bg-white/5 border border-cyan-900/40"
                    >
                      <img
                        src={getValidImageUrl(item.avatar)}
                        alt={item.userName || "User"}
                        className="w-9 h-9 rounded-full border border-cyan-600 object-cover"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-white truncate">{item.userName || "Member"}</p>
                          <span className="text-xs text-gray-400">{timeAgo(item.startedAt)}</span>
                        </div>
                        {/* category pill + text */}
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${typeMeta(item.type).cls}`}
                          >
                            {typeMeta(item.type).label}
                          </span>
                          <p className="text-xs text-cyan-200/90 break-words">
                            <span className="font-semibold">{item.itemTitle || "…"}</span>
                            {item.note ? ` — ${item.note}` : ""}
                          </p>
                        </div>
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </motion.ul>
            )}

            <div className="mt-4 text-xs text-cyan-300/80">Tip: Enter your MRN on the main dashboard, or use the join gate below.</div>
          </div>

          {/* Center: Jitsi stage */}
          <div id="jitsi" className="flex-1 bg-black/50 rounded-lg shadow-lg border border-cyan-500/20 relative overflow-hidden" style={{ minHeight: "420px" }} />

          {/* Right: participants + screens */}
          <div className="w-72 h-full bg-cyan-900/20 backdrop-blur-md rounded-3xl shadow-md p-5 border border-purple-300/20 overflow-y-auto text-cyan-100">
            <h2 className="font-semibold mb-2">Cyber Colleagues ({ppl.length})</h2>
            <ul className="space-y-2">
              {ppl.map((p) => {
                const dn = p.displayName?.split("|")[0]?.trim() || "Unknown";
                return (
                  <li key={p.id} className="flex items-center justify-between p-2 bg-cyan-800/30 rounded border border-cyan-600/20">
                    <span>{dn}</span>
                  </li>
                );
              })}
            </ul>

            {isAdmin && (
              <>
                <h2 className="font-semibold mt-6 mb-2">Neon Screens ({screens.length})</h2>
                <ul className="space-y-2">
                  {screens.map((s) => {
                    const user = ppl.find((p) => p.id === s.id);
                    const dn = user ? user.displayName.split("|")[0]?.trim() : "User";
                    return (
                      <li key={s.id} className="flex items-center justify-between p-2 bg-cyan-800/30 rounded border border-cyan-600/20">
                        <span>{dn}</span>
                        <button
                          onClick={() => api?.executeCommand("pinParticipant", s.id)}
                          className="p-1 bg-purple-500/80 text-white rounded hover:bg-purple-600/80"
                          title="Pin screen"
                        >
                          <Monitor size={16} />
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
        <motion.div
          initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 bg-red-600/80 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 z-50 backdrop-blur-sm"
        >
      <AlertCircle size={18} /> {err}
      <button onClick={() => setErr(null)} className="ml-auto text-white hover:text-gray-200">
        <X size={16} />
      </button>
    </motion.div>
  )}

      <AnimatePresence>
        {notesSharePrompt && (
          <motion.div
            className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-lg bg-cyan-950/95 text-cyan-50 rounded-3xl border border-emerald-400/40 shadow-2xl p-5 space-y-4"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-emerald-100">Share the notes view?</h3>
                <p className="text-sm text-emerald-200/80">
                  Let teammates know you’re taking collaborative notes. Everyone listed below will see the shared workspace once they open the notes panel.
                </p>
              </div>
              <div className="max-h-52 overflow-y-auto rounded-2xl border border-emerald-500/20 bg-emerald-900/20 p-3 space-y-2 text-sm">
                {ppl.length ? (
                  ppl.map((p) => {
                    const dn = p.displayName?.split("|")[0]?.trim() || "Participant";
                    return (
                      <div key={p.id} className="flex items-center gap-2 text-emerald-100">
                        <Users size={16} className="text-emerald-300" /> {dn}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-emerald-200/70">No one else is in the room yet. You can still start notes and share later.</p>
                )}
              </div>
              <div className="text-xs text-emerald-200/70">
                Tip: Use the Share button inside the notes panel to invite additional teammates or give edit access.
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setNotesSharePrompt(false);
                    openNotesOverlayPrivate();
                  }}
                  className="px-4 py-1.5 rounded-lg bg-gray-200/80 text-gray-800 text-sm font-medium hover:bg-gray-200"
                >
                  View privately
                </button>
                <button
                  onClick={startNotesShare}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
                >
                  Share notes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {notesOpen && (
          <motion.div
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-6xl bg-cyan-950/95 text-cyan-50 rounded-3xl border border-emerald-400/30 shadow-2xl overflow-hidden"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-emerald-500/20 bg-emerald-900/30">
                <div>
                  <h3 className="text-lg font-semibold text-emerald-100">Collab Notes</h3>
                  <p className="text-xs text-emerald-200/70">Capture minutes while you’re in the room together.</p>
                </div>
                <div className="flex items-center gap-2">
                  {isHost ? (
                    <>
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-100 border border-emerald-500/40 animate-pulse">
                        Sharing live
                      </span>
                      <button
                        onClick={() => stopNotesShare()}
                        className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800"
                      >
                        Stop sharing
                      </button>
                    </>
                  ) : hostActive ? (
                    <div className="flex items-center gap-2 text-xs text-emerald-200/80">
                      {notesFollowing ? (
                        <>
                          <span>Following {notesHostName || "host"}</span>
                          <button
                            onClick={() => setNotesFollowing(false)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white font-semibold hover:bg-emerald-800"
                          >
                            Stop following
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={followHost}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
                        >
                          Follow {notesHostName || "host"}
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={startNotesShare}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                    >
                      Start sharing
                    </button>
                  )}
                  <button
                    onClick={handleCloseNotes}
                    className="p-2 rounded-lg bg-emerald-800/40 text-emerald-100 hover:bg-emerald-700/50"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
              {notesError && (
                <div className="px-5 py-2 text-sm text-red-200 bg-red-900/30 border-b border-red-700/40">
                  {notesError}
                </div>
              )}
              <div className="max-h-[80vh] overflow-y-auto bg-slate-950/40">
                {notesLoading && !notesUsers.length ? (
                  <div className="py-16 flex items-center justify-center text-sm text-emerald-200">
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" /> Loading teammates…
                  </div>
                ) : (
                  <MyNotes
                    userId={currentUserInfo?.id ?? null}
                    currentUser={currentUserInfo}
                    availableUsers={notesUsers}
                    twoPane
                    readOnly={isFollower}
                    selectedNoteIdProp={isFollower ? notesSelectedId : undefined}
                    onSelectedNoteChange={(noteId) => {
                      setNotesCurrentSelectedId(noteId);
                      if (isHost) {
                        setNotesSelectedId(noteId);
                        sendNotesSignal("select", { noteId });
                      } else if (!isFollower) {
                        setNotesSelectedId(noteId);
                      }
                    }}
                    setError={(msg) => setNotesError(msg)}
                    setSuccess={() => {}}
                  />
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Join modal with MRN gate */}
      <AnimatePresence>
        {modal && (
          <motion.div key="modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }} transition={{ duration: 0.25 }}
              className="bg-cyan-950/70 backdrop-blur-xl rounded-3xl p-6 w-full max-w-xl shadow-2xl border border-purple-300/30 text-cyan-100"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold">Join Meedian Together</h2>
                <button onClick={() => setModal(false)} className="p-2 text-cyan-300 hover:text-cyan-100">
                  <X size={22} />
                </button>
              </div>

              {/* MRN status */}
              <div className="rounded-xl border border-cyan-800/60 p-3 mb-4 bg-white/5">
                <div className="flex items-center justify-between">
                  <p className="text-sm">
                    {mrrChecking
                      ? "Checking your Me Right Now…"
                      : mrrCurrent
                        ? <>Active MRN: <span className="font-semibold">{mrrCurrent.itemTitle}</span> {mrrCurrent.note ? `— ${mrrCurrent.note}` : ""}</>
                        : "No active Me Right Now found."}
                  </p>
                  {mrrChecking && <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />}
                </div>
                {mrrErr && <p className="text-xs text-rose-300 mt-2">{mrrErr}</p>}
              </div>

              {/* Quick MRN push (required) */}
              {!mrrCurrent && (
                <div className="rounded-xl border border-cyan-800/60 p-3 mb-4 bg-white/5">
                  <p className="text-sm font-semibold mb-2">Push Me Right Now to enter</p>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    {["assigned", "routine"].map((k) => (
                      <button
                        key={k}
                        onClick={() => setMode(k)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${
                          mode === k ? "bg-cyan-600 border-cyan-500" : "bg-white/5 border-cyan-900/40 hover:bg-white/10"
                        }`}
                      >
                        {k === "assigned" ? "Assigned" : "Routine"}
                      </button>
                    ))}
                  </div>

                  <div className="relative mb-2">
                    <select
                      value={selectedId}
                      onChange={(e) => setSelectedId(e.target.value)}
                      className="w-full bg-white/5 border border-cyan-900/40 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-600"
                      disabled={optsLoading}
                    >
                      <option value="">{optsLoading ? "Loading…" : "— Select —"}</option>
                      {options.map((t) => (
                        <option key={t.id} value={t.id}>{t.title}</option>
                      ))}
                    </select>
                    {optsLoading && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-2.5 text-cyan-400" />}
                  </div>

                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    placeholder="Optional note…"
                    className="w-full bg-white/5 border border-cyan-900/40 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-600 placeholder:text-gray-500"
                  />

                  <div className="mt-2 flex items-center justify-end gap-2">
                    <button
                      onClick={startMRN}
                      disabled={!selectedId}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold disabled:opacity-60"
                    >
                      <Send className="w-4 h-4" />
                      Push MRN
                    </button>
                  </div>
                </div>
              )}

              {/* device toggles */}
              <div className="grid grid-cols-3 gap-3">
                <label className="flex items-center gap-2">
                  <Camera size={18} className={cam ? "text-purple-400" : "text-cyan-400"} />
                  <input type="checkbox" checked={cam} onChange={(e) => setCam(e.target.checked)} />
                  <span className="text-sm">Camera</span>
                </label>
                <label className="flex items-center gap-2">
                  <Mic size={18} className={mic ? "text-purple-400" : "text-cyan-400"} />
                  <input type="checkbox" checked={mic} onChange={(e) => setMic(e.target.checked)} />
                  <span className="text-sm">Audio</span>
                </label>
                <label className="flex items-center gap-2">
                  <ScreenShare size={18} className={scr ? "text-purple-400" : "text-cyan-400"} />
                  <input type="checkbox" checked={scr} onChange={(e) => setScr(e.target.checked)} />
                  <span className="text-sm">Share screen</span>
                </label>
              </div>

              <p className="mt-2 text-xs text-cyan-300">
                scriptReady: {String(ready)} · jwt: {jwt ? "yes" : "no"}
              </p>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={join}
                  disabled={!jwt || !ready || !mrrCurrent}
                  className={`px-4 py-2 rounded-xl font-semibold ${
                    jwt && ready && mrrCurrent
                      ? "bg-purple-600/80 text-white hover:bg-purple-700/80"
                      : "bg-cyan-800/50 text-cyan-400 cursor-not-allowed"
                  } backdrop-blur-sm`}
                >
                  {mrrCurrent ? "Connect" : "Enter MRN to continue"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* (Notes overlay removed) */}


      {/* Exit/Leave modal: Finished or Continue later */}
      <AnimatePresence>
        {exitOpen && (
          <motion.div key="exit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100]"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }} transition={{ duration: 0.22 }}
              className="bg-cyan-950/80 backdrop-blur-xl rounded-2xl p-6 w-full max-w-md border border-cyan-900/50 text-cyan-100"
            >
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-lg font-semibold">Wrap up before leaving?</h3>
                <button onClick={() => setExitOpen(false)} className="p-2 rounded-xl hover:bg-white/10 transition">
                  <X className="w-4 h-4 text-gray-300" />
                </button>
              </div>

              {mrrCurrent ? (
                <div className="mt-3 rounded-xl bg-white/5 border border-cyan-900/40 p-3">
                  <div className="flex items-start gap-3">
                    <img
                      className="w-9 h-9 rounded-full border border-cyan-600 object-cover"
                      src={getValidImageUrl(mrrCurrent.avatar || session?.user?.image)}
                      alt="Me"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {mrrCurrent.itemTitle || "Current MRN"}
                      </p>
                      {mrrCurrent.note && (
                        <p className="text-xs text-cyan-200/90 break-words mt-0.5">
                          {mrrCurrent.note}
                        </p>
                      )}
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Started {timeAgo(mrrCurrent.startedAt)} · broadcasting
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm mt-3">No active MRN found.</p>
              )}

              {exitErr && (
                <div className="mt-3 rounded-lg bg-rose-900/30 text-rose-200 border border-rose-800/60 p-2 text-sm">
                  {exitErr}
                </div>
              )}

              <div className="mt-5 grid grid-cols-1 gap-2">
                <button
                  disabled={exitBusy}
                  onClick={() => stopMRNAndLeave(false)}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-60"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Finished — Stop MRN & Leave
                </button>
                <button
                  disabled={exitBusy}
                  onClick={() => stopMRNAndLeave(true)}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-emerald-700/80 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-60"
                  title="Stop MRN, leave, and open dashboard to update task"
                >
                  <ExternalLink className="w-4 h-4" />
                  Stop, Leave & Open Dashboard
                </button>
                <button
                  disabled={exitBusy}
                  onClick={leaveKeepMRN}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm"
                >
                  Continue later — Leave (keep MRN)
                </button>
                <button
                  onClick={() => setExitOpen(false)}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-gray-700/70 hover:bg-gray-700 text-white text-sm"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <audio ref={audioRef} src={selectedMusic} loop preload="auto" />
    </motion.div>
  );
}
