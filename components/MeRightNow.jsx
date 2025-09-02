"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Users,
  Send,
  Loader2,
  CheckCircle2,
  PlusCircle,
  ExternalLink,
  Trash2,
} from "lucide-react";

/* ================= Helpers ================= */

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
  } catch {
    return "";
  }
};

/* merge-by-userId for stable list & no flicker */
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
    if (!p) {
      prevMap.set(id, n);
    } else {
      if (
        p.itemTitle !== n.itemTitle ||
        p.note !== n.note ||
        p.startedAt !== n.startedAt ||
        p.avatar !== n.avatar ||
        p.userName !== n.userName
      ) {
        prevMap.set(id, { ...p, ...n });
      }
    }
  }
  // drop users not present in next anymore
  const nextIds = new Set(next.map((x) => String(x.userId)));
  for (const id of Array.from(prevMap.keys())) {
    if (!nextIds.has(id)) prevMap.delete(id);
  }
  // newest first
  return Array.from(prevMap.values()).sort(
    (a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0)
  );
}

/* small helper to remove my card locally when I stop */
function removeUserFromFeed(feed, myId) {
  return feed.filter((x) => String(x.userId) !== String(myId));
}

/* ================= API helpers ================= */

/* try correct path first, then the old typo just in case */
const MRR_PATHS = ["/api/member/meRightNow", "/api/memeber/meRightNow"];

async function mrrFetch(suffix, init) {
  let last = null;
  for (const base of MRR_PATHS) {
    try {
      const res = await fetch(`${base}${suffix}`, init);
      if (res.ok || res.status === 304) {
        return { base, res, json: res.status === 304 ? null : await res.json() };
      }
      last = { status: res.status, body: await safeMsg(res) };
    } catch (e) {
      last = { status: 0, body: e?.message || "network error" };
    }
  }
  throw new Error(
    `MRR request failed ${suffix} :: ${last ? `${last.status} ${last.body}` : ""}`
  );
}

async function safeMsg(res) {
  try {
    const j = await res.json();
    return j?.error || j?.message || "";
  } catch {
    try {
      return await res.text();
    } catch {
      return "";
    }
  }
}

/* legacy note-only custom endpoint (if your server supports it) */
const LEGACY_NOTE_ONLY = "/api/member/meRightNow";

/* ================= Component ================= */

export default function MeRightNow({ open, onClose }) {
  const { data: session } = useSession();
  const uid = session?.user?.id;

  /* ---- Feed state (stable, ETag, no flicker) ---- */
  const [feed, setFeed] = useState([]);
  const [feedErr, setFeedErr] = useState("");
  const [firstFeedLoad, setFirstFeedLoad] = useState(true);
  const [refreshingFeed, setRefreshingFeed] = useState(false);
  const feedCacheRef = useRef({ etag: null, feed: [] });

  /* ---- My current MRN ---- */
  const [current, setCurrent] = useState(null); // { itemTitle, note, startedAt, avatar, ... }
  const [loadingCurrent, setLoadingCurrent] = useState(false);
  const [stopConfirm, setStopConfirm] = useState(false);
  const [stopping, setStopping] = useState(false);

  /* ---- Success nudge ---- */
  const [justPushed, setJustPushed] = useState(false);

  /* ---- Slide-over state ---- */
  const [pushOpen, setPushOpen] = useState(false);
  const [mode, setMode] = useState("assigned"); // assigned | routine | mri | custom
  const [optsLoading, setOptsLoading] = useState(false);
  const [options, setOptions] = useState([]); // [{id,title}]
  const [selectedId, setSelectedId] = useState("");
  const [note, setNote] = useState("");
  const [pushing, setPushing] = useState(false);
  const [error, setError] = useState("");

  const clearErrorSoon = () => setTimeout(() => setError(""), 3500);

  /* ---- Effects: poll feed but never clear it ---- */
  useEffect(() => {
    if (!open) return;
    let t;
    (async () => {
      await Promise.all([loadFeed(false), loadCurrent()]);
      t = setInterval(() => {
        loadFeed(true);
        loadCurrent(true);
      }, 12000);
    })();
    return () => t && clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (pushOpen && (mode === "assigned" || mode === "routine")) {
      loadOptions(mode);
    }
  }, [pushOpen, mode]);

  async function loadCurrent(silent = false) {
    try {
      if (!silent) setLoadingCurrent(true);
      const { json } = await mrrFetch("?action=current", { cache: "no-store" });
      setCurrent(json?.current || null);
    } catch {
      setCurrent(null);
    } finally {
      if (!silent) setLoadingCurrent(false);
    }
  }

  async function loadFeed(silent = true) {
    try {
      if (!silent) setRefreshingFeed(true);
      const headers = {};
      if (feedCacheRef.current.etag) headers["If-None-Match"] = feedCacheRef.current.etag;

      // primary: action=feed
      const { res, json } = await mrrFetch("?action=feed", {
        cache: "no-store",
        headers,
      });

      if (res.status === 304) {
        setFeedErr("");
        return;
      }

      const etag = res.headers.get("etag");
      const fresh = Array.isArray(json?.feed) ? json.feed : [];

      if (etag) feedCacheRef.current.etag = etag;
      feedCacheRef.current.feed = fresh;

      setFeed((prev) => (prev.length ? mergeFeed(prev, fresh) : fresh));
      setFeedErr("");
    } catch (e1) {
      // fallback to old shape
      try {
        const { res, json } = await mrrFetch("?scope=board", { cache: "no-store" });
        if (res.status === 304) return;
        const fresh = Array.isArray(json) ? json : json?.items || [];
        setFeed((prev) => (prev.length ? mergeFeed(prev, fresh) : fresh));
        setFeedErr("");
      } catch (e2) {
        console.error("MRR feed error:", e1, e2);
        setFeedErr(
          "Couldn’t load “Meedians Right Now” feed. Check the API route /api/member/meRightNow."
        );
      }
    } finally {
      setFirstFeedLoad(false);
      setRefreshingFeed(false);
    }
  }

  async function loadOptions(type) {
    try {
      setOptsLoading(true);
      setOptions([]);
      setSelectedId("");
      const { json } = await mrrFetch(`?action=options&type=${encodeURIComponent(type)}`, {
        cache: "no-store",
      });
      const items = Array.isArray(json?.items) ? json.items : [];
      setOptions(items);
    } catch (e) {
      console.error("options error:", e);
      setOptions([]);
      setError(`Couldn’t load ${type} options from server.`);
      clearErrorSoon();
    } finally {
      setOptsLoading(false);
    }
  }

  async function stopCurrent() {
    try {
      setStopping(true);
      await mrrFetch("?action=stop", { method: "POST" });
      setCurrent(null);
      // remove myself from feed immediately (no flicker)
      if (uid) setFeed((prev) => removeUserFromFeed(prev, uid));
      // background refresh
      loadFeed(true);
    } catch (e) {
      setError("Couldn’t remove your current Me Right Now.");
      clearErrorSoon();
    } finally {
      setStopping(false);
      setStopConfirm(false);
    }
  }

  async function handlePushNow() {
    try {
      if (mode === "mri") {
        setError("MRI selection is coming soon. Use Assigned / Routine / Custom for now.");
        clearErrorSoon();
        return;
      }

      setPushing(true);

      if (mode === "assigned" || mode === "routine") {
        if (!selectedId) {
          setError(`Please choose a ${mode === "assigned" ? "task" : "routine"} first.`);
          clearErrorSoon();
          setPushing(false);
          return;
        }

        const body = {
          type: mode,
          itemId: String(selectedId),
          note: note?.trim() || "",
        };

        await mrrFetch("?action=start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        // optimistic add/refresh my card immediately
        const chosen = options.find((o) => String(o.id) === String(selectedId));
        const optimistic = {
          userId: Number(uid),
          userName: session?.user?.name || "You",
          avatar: session?.user?.image || "",
          itemTitle: chosen?.title || (mode === "assigned" ? "Assigned Task" : "Routine Task"),
          note: note?.trim() || "",
          startedAt: new Date().toISOString(),
        };
        setFeed((prev) => mergeFeed(prev, [optimistic]));
        // refresh current for the “Your current” card
        loadCurrent(true);
      } else if (mode === "custom") {
        const trimmed = note.trim();
        if (!trimmed) {
          setError("Write a short note for your custom status.");
          clearErrorSoon();
          setPushing(false);
          return;
        }

        // Try modern custom; if backend doesn't support, show friendly guidance + fallback
        let pushed = false;
        try {
          const r = await mrrFetch("?action=start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "custom", itemId: "__note__", note: trimmed }),
          });
          if (r?.res?.ok) pushed = true;
        } catch {
          /* ignore, try legacy next */
        }

        if (!pushed) {
          // legacy note-only (may not exist on your server)
          const r = await fetch(LEGACY_NOTE_ONLY, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ note: trimmed }),
          });
          if (!r.ok) {
            setError(
              "Custom MRN isn’t supported by the API yet. Either use Assigned/Routine, or add `type: 'custom'` to the backend."
            );
            clearErrorSoon();
            setPushing(false);
            return;
          }
        }

        // optimistic
        const optimistic = {
          userId: Number(uid),
          userName: session?.user?.name || "You",
          avatar: session?.user?.image || "",
          itemTitle: "Status",
          note: trimmed,
          startedAt: new Date().toISOString(),
        };
        setFeed((prev) => mergeFeed(prev, [optimistic]));
        loadCurrent(true);
      }

      setJustPushed(true);
      setPushOpen(false);
      setSelectedId("");
      setNote("");

      // background refresh (will 304 if nothing changed)
      loadFeed(true);
    } catch (e) {
      console.error("push error:", e);
      setError(e?.message || "Couldn’t push your Me Right Now.");
      clearErrorSoon();
    } finally {
      setPushing(false);
    }
  }

  const meOnBoard = useMemo(() => {
    const id = session?.user?.id;
    return id ? feed.find((b) => String(b.userId) === String(id)) : null;
  }, [feed, session]);

  const openTogether = () => window.open("/dashboard/member/workTogether", "_blank");

  if (!open) return null;

  /* ================= Render ================= */

  return (
    <AnimatePresence>
      <motion.div
        key="me-right-now"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ y: 24, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 24, opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-4xl rounded-3xl bg-[#0b1220] text-white border border-cyan-900/40 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-cyan-900/40">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg sm:text-xl font-extrabold bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent">
                Meedians Right Now
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPushOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                Me Right Now
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-white/10 transition"
                aria-label="Close"
                title="Close"
              >
                <X className="w-5 h-5 text-gray-300" />
              </button>
            </div>
          </div>

          {/* Success nudge */}
          <AnimatePresence>
            {(justPushed || meOnBoard) && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="mx-4 sm:mx-6 mt-3 mb-1 rounded-xl bg-emerald-900/30 text-emerald-200 border border-emerald-800/60 p-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <p className="text-sm">
                    {meOnBoard
                      ? "You're visible on Meedians Right Now."
                      : "Pushed! You're now visible on Meedians Right Now."}{" "}
                    Jump into the Together workspace to execute it with others.
                  </p>
                </div>
                <button
                  onClick={openTogether}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                >
                  Join MeedianTogether WORKSPACE
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* My current MRN card + remove selection */}
          <div className="mx-4 sm:mx-6 mt-3 mb-1">
            {loadingCurrent ? (
              <div className="rounded-xl bg-white/5 border border-cyan-900/40 p-3 text-sm text-cyan-200/90">
                Checking your current selection…
              </div>
            ) : current ? (
              <div className="rounded-xl bg-white/5 border border-cyan-900/40 p-3">
                <div className="flex items-start gap-3">
                  <img
                    className="w-9 h-9 rounded-full border border-cyan-600 object-cover"
                    src={getValidImageUrl(current.avatar || session?.user?.image)}
                    alt="Me"
                  />
                  <div className="min-w-0">
                    <p className="text-white font-semibold text-sm truncate">
                      {current.itemTitle || "…"}
                    </p>
                    {current.note ? (
                      <p className="text-xs text-cyan-200/90 break-words mt-0.5">{current.note}</p>
                    ) : null}
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Started {timeAgo(current.startedAt)} · broadcasting now
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3 justify-end">
                  <button
                    onClick={() => setStopConfirm(true)}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-rose-700 hover:bg-rose-800 text-white"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove selection
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Error (push/option errors) */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="mx-4 sm:mx-6 mt-3 mb-1 rounded-xl bg-rose-900/30 text-rose-200 border border-rose-800/60 p-3 text-sm"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Body: stable feed */}
          <div className="px-4 sm:px-6 py-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-400">What everyone is on, right now.</span>
              <div className="flex items-center gap-2">
                {refreshingFeed && <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />}
                <button
                  onClick={() => {
                    loadFeed(false);
                    loadCurrent(false);
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15"
                >
                  Refresh
                </button>
              </div>
            </div>

            {firstFeedLoad && feed.length === 0 ? (
              <div className="flex items-center gap-2 text-cyan-300 py-10">
                <Loader2 className="w-5 h-5 animate-spin" /> Loading…
              </div>
            ) : feedErr ? (
              <div className="text-sm text-rose-300 py-6">{feedErr}</div>
            ) : feed.length === 0 ? (
              <div className="text-sm text-cyan-300/80 py-6">
                Nobody has pushed their “Me Right Now” yet. Be the first!
              </div>
            ) : (
              <motion.ul layout className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <AnimatePresence initial={false}>
                  {feed.map((item) => (
                    <motion.li
                      layout
                      key={item.userId} // stable per user; avoids flicker on refresh
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ type: "spring", stiffness: 300, damping: 28 }}
                      className="rounded-2xl border border-cyan-900/40 bg-white/5 p-4 backdrop-blur-md"
                    >
                      <div className="flex items-start gap-3">
                        <img
                          src={getValidImageUrl(item.avatar)}
                          alt={item.userName || "User"}
                          className="w-10 h-10 rounded-full border border-cyan-600 object-cover"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-white truncate">
                              {item.userName || "Member"}
                            </p>
                            <span className="text-xs text-gray-400">
                              {timeAgo(item.startedAt)}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-cyan-200/90 break-words">
                            <span className="font-semibold">
                              {item.itemTitle || "…"}
                            </span>
                            {item.note ? ` — ${item.note}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-end">
                        <button
                          onClick={openTogether}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white"
                          title="Work together on this now"
                        >
                          Join Workspace
                          <Users className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </motion.ul>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 sm:px-6 py-4 border-t border-cyan-900/40 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              Tip: push your focus, then hop into Together to co-work.
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  loadFeed(false);
                  loadCurrent(false);
                }}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15"
              >
                Refresh
              </button>
              <button
                onClick={openTogether}
                className="text-xs px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white inline-flex items-center gap-1"
              >
                Open Together
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Slide-over: Push My Me Right Now */}
        <AnimatePresence>
          {pushOpen && (
            <motion.div
              initial={{ x: 24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 24, opacity: 0 }}
              className="fixed right-4 top-4 bottom-4 z-[1001] w-[92vw] max-w-md rounded-2xl bg-[#0b1220] text-white border border-cyan-900/40 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-900/40">
                <h3 className="font-bold text-cyan-300">Push “Me Right Now”</h3>
                <button
                  onClick={() => setPushOpen(false)}
                  className="p-2 rounded-xl hover:bg-white/10 transition"
                >
                  <X className="w-4 h-4 text-gray-300" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                {/* Mode selector (fetch options immediately) */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { k: "assigned", label: "Assigned" },
                    { k: "routine", label: "Routine" },
                    { k: "mri", label: "MRI" },
                    { k: "custom", label: "Custom" },
                  ].map((o) => (
                    <button
                      key={o.k}
                      onClick={() => {
                        setMode(o.k);
                        setSelectedId("");
                        if (o.k === "assigned" || o.k === "routine") {
                          loadOptions(o.k);
                        } else {
                          setOptions([]);
                        }
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${
                        mode === o.k
                          ? "bg-cyan-600 border-cyan-500"
                          : "bg-white/5 border-cyan-900/40 hover:bg-white/10"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>

                {/* Assigned/Routine options */}
                {(mode === "assigned" || mode === "routine") && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      {mode === "assigned"
                        ? "Choose one of your assigned tasks"
                        : "Choose one of your routine tasks"}
                    </label>
                    <div className="relative">
                      <select
                        value={selectedId}
                        onChange={(e) => setSelectedId(e.target.value)}
                        className="w-full bg-white/5 border border-cyan-900/40 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-600"
                        disabled={optsLoading}
                      >
                        <option value="">
                          {optsLoading ? "Loading…" : "— Select —"}
                        </option>
                        {options.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title}
                          </option>
                        ))}
                      </select>
                      {optsLoading && (
                        <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-2.5 text-cyan-400" />
                      )}
                    </div>
                  </div>
                )}

                {/* MRI coming soon */}
                {mode === "mri" && (
                  <div className="text-xs text-amber-200/90 rounded-lg border border-amber-700/50 bg-amber-900/20 p-3">
                    MRI selection is coming soon. For now, choose Assigned/Routine or use Custom note.
                  </div>
                )}

                {/* Note */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    {mode === "custom"
                      ? "Write what you’re doing right now (required)"
                      : "Add a short note (optional)"}
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={4}
                    placeholder={
                      mode === "custom"
                        ? "e.g., Finalizing exam schedule draft and syncing with team"
                        : "e.g., Reviewing PRs, focusing on analytics bug #231"
                    }
                    className="w-full bg-white/5 border border-cyan-900/40 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-600 placeholder:text-gray-500"
                  />
                </div>
              </div>

              <div className="px-4 py-3 border-t border-cyan-900/40 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  This will show up on “Meedians Right Now”.
                </span>
                <button
                  onClick={handlePushNow}
                  disabled={
                    pushing ||
                    mode === "mri" ||
                    ((mode === "assigned" || mode === "routine") && !selectedId)
                  }
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold disabled:opacity-60"
                >
                  {pushing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Pushing…
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Push Now
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Remove selection confirmation */}
        <AnimatePresence>
          {stopConfirm && (
            <motion.div
              key="stop-confirm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[1002]"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-cyan-950/80 backdrop-blur-xl rounded-2xl p-6 w-full max-w-md border border-cyan-900/50 text-cyan-100"
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-lg font-semibold">Remove your selection?</h3>
                  <button
                    onClick={() => setStopConfirm(false)}
                    className="p-2 rounded-xl hover:bg-white/10 transition"
                  >
                    <X className="w-4 h-4 text-gray-300" />
                  </button>
                </div>
                <p className="text-sm text-cyan-200/90 mt-2">
                  This will stop broadcasting your current “Me Right Now”.
                </p>
                <div className="mt-5 flex justify-end gap-3">
                  <button
                    onClick={() => setStopConfirm(false)}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={stopping}
                    onClick={stopCurrent}
                    className="px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-sm inline-flex items-center gap-1 disabled:opacity-60"
                  >
                    <Trash2 className="w-4 h-4" />
                    {stopping ? "Removing…" : "Remove"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
