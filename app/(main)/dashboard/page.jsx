"use client";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Clock,
  Bell,
  Video,
  Info,
  School,
  Calendar,
} from "lucide-react";
import ManageCalendar from "@/components/manageMeedian/ManageCalendar";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  });

const formatTimeLeft = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

export default function GeneralDashboard() {
  const { data: session } = useSession();
  const [slots, setSlots] = useState([]);
  const [members, setMembers] = useState([]);
  const [currentSlot, setCurrentSlot] = useState(null);
  const [currentBlock, setCurrentBlock] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [showTutorialsModal, setShowTutorialsModal] = useState(false);
  const [showNMRIsModal, setShowNMRIsModal] = useState(false);
  const [showKnowMIDModal, setShowKnowMIDModal] = useState(false);
  const [showMSPRModal, setShowMSPRModal] = useState(false);
  const [showMHCPModal, setShowMHCPModal] = useState(false);
  const [showNMRIPlanModal, setShowNMRIPlanModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showMrnModal, setShowMrnModal] = useState(false);
  const [mrrFeed, setMrrFeed] = useState([]);
  const [hideSelf, setHideSelf] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isLoadingSlots, setIsLoadingSlots] = useState(true);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(true);

  const { data: slotData, error: slotError } = useSWR("/api/admin/manageMeedian?section=slots", fetcher);
  const { data: userData, error: userError } = useSWR("/api/member/users", fetcher);
  const { data: calendarData, error: calendarError } = useSWR("/api/member/calendar", fetcher);
  const { data: announcementsData, error: announcementsError } = useSWR("/api/managersCommon/announcements", fetcher);
  const { data: mrrData, error: mrrError } = useSWR("/api/member/meRightNow?action=feed", fetcher, { refreshInterval: showMrnModal ? 0 : 12000, revalidateOnFocus: false });
  const searchParams = useSearchParams();

  useEffect(() => {
    if (slotData) {
      setSlots(slotData.slots || []);
      setIsLoadingSlots(false);
    }
    if (slotError) {
      setError("Failed to load slots.");
      setTimeout(() => setError(null), 3000);
      setIsLoadingSlots(false);
    }
    if (userData) {
      const users = Array.isArray(userData) ? userData : userData.users || [];
      setMembers(users);
    }
    if (userError) {
      setError("Failed to load members.");
      setTimeout(() => setError(null), 3000);
      setMembers([]);
    }
    if (calendarData) {
      setCalendar(calendarData.calendar || []);
      setIsLoadingCalendar(false);
    }
    if (calendarError) {
      setError("Failed to load calendar.");
      setTimeout(() => setError(null), 3000);
      setIsLoadingCalendar(false);
    }
    if (announcementsData) {
      setAnnouncements(announcementsData.announcements || []);
    }
    if (announcementsError) {
      setError("Failed to load announcements.");
      setTimeout(() => setError(null), 3000);
    }
    if (mrrData) {
      setMrrFeed(Array.isArray(mrrData.feed) ? mrrData.feed : []);
    }
  }, [slotData, slotError, userData, userError, calendarData, calendarError, announcementsData, announcementsError, mrrData]);

  // Open MRN modal if requested via query param (?open=mrn)
  useEffect(() => {
    const open = searchParams?.get("open");
    if (open === "mrn") setShowMrnModal(true);
  }, [searchParams]);

  useEffect(() => {
    let intervalId = null;
    const now = new Date();
    let foundSlot = null;
    let foundBlock = null;

    slots.forEach((slot) => {
      if (
        !slot.startTime ||
        !slot.endTime ||
        !/^\d{2}:\d{2}:\d{2}$/.test(slot.startTime) ||
        !/^\d{2}:\d{2}:\d{2}$/.test(slot.endTime)
      ) {
        return;
      }
      const startHours = parseInt(slot.startTime.split(":")[0], 10);
      const endHours = parseInt(slot.endTime.split(":")[0], 10);
      const isMidnightSpanning = endHours < startHours;
      let startDate = now.toDateString();
      let endDate = now.toDateString();
      if (isMidnightSpanning) {
        const prevDay = new Date(now);
        prevDay.setDate(now.getDate() - 1);
        startDate = prevDay.toDateString();
      }
      const startTime = new Date(`${startDate} ${slot.startTime}`);
      const endTime = new Date(`${endDate} ${slot.endTime}`);
      if (isNaN(startTime) || isNaN(endTime)) return;
      if (now >= startTime && now <= endTime) foundSlot = slot;
    });

    if (foundSlot) {
      const slotId = foundSlot.id;
      if (slotId >= 1 && slotId <= 6) foundBlock = `BLOCK 1: ${foundSlot.name}`;
      else if (slotId >= 7 && slotId <= 9) foundBlock = `BLOCK 2: ${foundSlot.name}`;
      else if (slotId >= 10 && slotId <= 11) foundBlock = `BLOCK 3: ${foundSlot.name}`;
      else if (slotId >= 12 && slotId <= 14) foundBlock = `BLOCK 4: ${foundSlot.name}`;
      else if (slotId >= 15 && slotId <= 16) foundBlock = `BLOCK 5: ${foundSlot.name}`;
      else if (slotId === 17) foundBlock = `BLOCK 6: ${foundSlot.name}`;
      const endDate = now.toDateString();
      const endTime = new Date(`${endDate} ${foundSlot.endTime}`);
      if (endTime < now) endTime.setDate(endTime.getDate() + 1);
      const secondsLeft = Math.max(0, Math.floor((endTime - now) / 1000));
      setTimeLeft(secondsLeft);
      const tick = () => {
        const currentTime = new Date();
        const newSecondsLeft = Math.max(0, Math.floor((endTime - currentTime) / 1000));
        setTimeLeft(newSecondsLeft);
        if (newSecondsLeft <= 0) {
          clearInterval(intervalId);
          setCurrentSlot(null);
          setCurrentBlock(null);
          setTimeLeft(null);
        }
      };
      intervalId = setInterval(tick, 1000);
    }
    setCurrentSlot(foundSlot);
    setCurrentBlock(foundBlock);
    return () => intervalId && clearInterval(intervalId);
  }, [slots]);

  const getCurrentWeekInfo = () => {
    const now = new Date();
    const currentEntry = calendar.find((entry) => {
      const start = new Date(entry.startDate);
      const end = new Date(entry.endDate);
      return now >= start && now <= end && !entry.isMajorTermBoundary;
    });
    if (!currentEntry)
      return {
        weekNumber: "N/A",
        majorTerm: "N/A",
        minorTerm: "N/A",
        weekType: "N/A",
        startDate: "N/A",
        endDate: "N/A",
      };
    const entries = calendar
      .filter((c) => !c.isMajorTermBoundary)
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    const weekNumber = entries.findIndex((e) => e.id === currentEntry.id) + 1;
    return {
      weekNumber: weekNumber || "N/A",
      majorTerm: currentEntry.majorTerm || "N/A",
      minorTerm: currentEntry.minorTerm || "N/A",
      weekType: currentEntry.name || "N/A",
      startDate: new Date(currentEntry.startDate).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
      }),
      endDate: new Date(currentEntry.endDate).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
      }),
    };
  };

  const getTODName = (slot) => {
    if (!slot || !slot.assignedMemberId) return "Unassigned";
    if (String(slot.assignedMemberId) === String(session?.user.id))
      return `${session.user.name} (you)`;
    const member = members.find((m) => String(m.id) === String(slot.assignedMemberId));
    return member?.name || "Unassigned";
  };

  if (!session) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-teal-100/50 to-purple-100/50 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-xl font-semibold text-gray-800"
        >
          Loading...
        </motion.div>
      </div>
    );
  }

  const weekInfo = getCurrentWeekInfo();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="bg-gradient-to-br from-teal-100/50 to-purple-100/50 backdrop-blur-md p-3 sm:p-6 overflow-x-hidden overflow-y-auto sm:overflow-hidden sm:fixed sm:inset-0 sm:flex sm:items-center sm:justify-center pb-safe"
    >
      <div className="w-full sm:h-full bg-white/80 backdrop-blur-lg rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-8 flex flex-col gap-4 sm:gap-6 relative border border-white/50">
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-3 left-3 right-3 sm:top-4 sm:left-4 sm:right-4 text-xs sm:text-sm font-medium bg-red-100/80 text-red-700 p-3 sm:p-4 rounded-2xl shadow-lg backdrop-blur-sm"
              onClick={() => setError(null)}
            >
              {error} (Tap to dismiss)
            </motion.p>
          )}
          {success && (
            <motion.p
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-3 left-3 right-3 sm:top-4 sm:left-4 sm:right-4 text-xs sm:text-sm font-medium bg-green-100/80 text-green-700 p-3 sm:p-4 rounded-2xl shadow-lg backdrop-blur-sm"
              onClick={() => setSuccess(null)}
            >
              {success} (Tap to dismiss)
            </motion.p>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <motion.div
            className="flex items-center gap-3 sm:gap-4"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <svg
              className="w-8 h-8 sm:w-10 sm:h-10 text-teal-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              General Dashboard
            </h1>
          </motion.div>

          <motion.div
            className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm font-medium text-gray-700 bg-white/60 backdrop-blur-sm px-3 py-2 sm:px-4 sm:py-2 rounded-xl sm:rounded-full shadow-md"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
          >
            <span>Week: {weekInfo.weekNumber}</span>
            <span className="hidden sm:inline">|</span>
            <span className="sm:ml-0">
              {weekInfo.startDate} - {weekInfo.endDate}
            </span>
            <span className="hidden sm:inline">|</span>
            <span>
              Term: {weekInfo.majorTerm} - {weekInfo.minorTerm}
            </span>
            <span className="hidden sm:inline">|</span>
            <span>Type: {weekInfo.weekType}</span>
            <motion.button
              onClick={() => setShowCalendarModal(true)}
              className="ml-auto sm:ml-0 p-2 bg-teal-600 text-white rounded-lg sm:rounded-full hover:bg-teal-700 shadow-md"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              aria-label="Open Calendar"
            >
              <Calendar size={18} />
            </motion.button>
            <motion.button
              onClick={() => setShowMrnModal(true)}
              className="p-2 bg-purple-600 text-white rounded-lg sm:rounded-full hover:bg-purple-700 shadow-md"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              aria-label="Open All MRNs"
            >
              All MRNs
            </motion.button>
            <motion.a
              href="/dashboard/member/meed-repo"
              className="p-2 bg-amber-500 text-white rounded-lg sm:rounded-full hover:bg-amber-600 shadow-md"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              aria-label="Open Meed Repo"
            >
              Meed Repo
            </motion.a>
          </motion.div>
        </div>

        {/* All MRNs Modal: Meedians in Action */}
        <AnimatePresence>
          {showMrnModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4"
              onClick={() => setShowMrnModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                transition={{ duration: 0.25 }}
                className="w-full max-w-5xl h-[80vh] max-h-[80vh] overflow-hidden rounded-3xl bg-white/90 backdrop-blur-xl border border-white/50 shadow-2xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-white/50 px-3 sm:px-5 py-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="w-6 h-6 text-purple-600" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" opacity=".1"/><path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900">Meedians in Action</h2>
                    </div>
                    <div className="flex items-center gap-3">
                      {session?.user?.role === "admin" && (
                        <label className="text-xs sm:text-sm text-gray-700 inline-flex items-center gap-2">
                          <input type="checkbox" className="accent-teal-600" checked={hideSelf} onChange={(e) => setHideSelf(e.target.checked)} />
                          Hide my card
                        </label>
                      )}
                      <button onClick={() => setShowMrnModal(false)} className="px-3 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm">Close</button>
                    </div>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
                {(() => {
                  const activeMap = new Map((mrrFeed || []).map((x) => [String(x.userId), x]));
                  const everyone = Array.isArray(members) ? members : [];
                  const visible = everyone.filter((u) => !(hideSelf && String(u.id) === String(session?.user?.id)));
                  const actives = visible.filter((u) => activeMap.has(String(u.id)));
                  const inactives = visible.filter((u) => !activeMap.has(String(u.id)));

                  const Card = ({ u, cur }) => {
                    const status = cur?.itemTitle ? cur.itemTitle : "Rest and Recover";
                    const since = cur?.startedAt ? new Date(cur.startedAt).toLocaleTimeString() : "";
                    const avatar = u.image || "/default-avatar.png";
                    const isActive = !!cur;
                    const titleWithNote = isActive && cur?.note ? `${status} - ${cur.note}` : status;
                    return (
                      <motion.div
                        key={`mrr-${u.id}`}
                        initial={false}
                        animate={{ opacity: 1, y: 0 }}
                        className={`rounded-2xl shadow ${isActive ? 'p-4' : 'p-2'} border flex items-center gap-3 ${
                          isActive
                            ? "bg-gradient-to-br from-teal-50 to-emerald-50 border-teal-200"
                            : "bg-gray-50 border-gray-200"
                        }`}
                      >
                        <img src={avatar} alt={u.name} className={`rounded-full border border-teal-200 object-cover ${isActive ? 'w-10 h-10' : 'w-8 h-8'}`} />
                        <div className="min-w-0 flex-1">
                          <div className={`${isActive ? 'text-sm' : 'text-[12px]'} font-semibold text-gray-900 truncate`}>{u.name}</div>
                          {isActive ? (
                            <>
                              <div className="text-xs text-gray-600 truncate">{(u.role || "").replace("_", " ")}</div>
                              <div className="text-xs mt-1 font-medium text-teal-700">
                                {titleWithNote} <span className="text-gray-500">· since {since}</span>
                              </div>
                            </>
                          ) : null}
                        </div>
                      </motion.div>
                    );
                  };

                  return (
                    <div className="space-y-5">
                      <div>
                        <h3 className="text-sm font-bold text-gray-800 mb-2">Active Now</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                          {actives.length === 0 ? (
                            <p className="text-xs text-gray-500">No one is active at the moment.</p>
                          ) : (
                            actives.map((u) => <Card key={u.id} u={u} cur={activeMap.get(String(u.id))} />)
                          )}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-800 mb-2">Rest and Recover</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                          {inactives.length === 0 ? (
                            <p className="text-xs text-gray-500">Everyone is active right now.</p>
                          ) : (
                            inactives.map((u) => <Card key={u.id} u={u} cur={null} />)
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
                {mrrError && (
                  <p className="text-xs text-red-600 mt-3">Couldn’t load MRN feed.</p>
                )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>


        {/* MOBILE STACKED CARDS */}
        <div className="grid grid-cols-1 gap-3 sm:hidden">
          <motion.button
            className="w-full bg-gradient-to-br from-teal-200/80 to-purple-200/80 rounded-2xl shadow ring-2 ring-white/50 backdrop-blur-sm p-5 flex items-center justify-center"
            initial={{ scale: 0.98, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            onClick={() => setShowTutorialsModal(true)}
          >
            <div className="text-center">
              <Video className="w-8 h-8 text-teal-600 mx-auto" />
              <h2 className="text-base font-bold text-gray-900 mt-2">Tutorials</h2>
            </div>
          </motion.button>

          {/* Block */}
          <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow p-4 border border-white/30">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-teal-600" />
              <h2 className="text-sm font-bold text-gray-900">Block</h2>
            </div>
            {isLoadingSlots ? (
              <div className="flex items-center justify-center mt-3">
                <div className="w-6 h-6 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="mt-2">
                <p className="text-base font-bold text-teal-700">
                  {currentBlock || "No Block"}
                </p>
                {currentSlot && (
                  <>
                    <p className="text-xs text-gray-700">
                      {`${currentSlot.startTime.slice(0, 5)} - ${currentSlot.endTime.slice(0, 5)}`}
                    </p>
                    <p className="text-xs text-gray-700">{getTODName(currentSlot)}</p>
                    <p className="text-xs text-teal-600 font-medium">
                      {timeLeft !== null ? `${formatTimeLeft(timeLeft)} left` : "Ended"}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Notices */}
          <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow p-4 border border-white/30">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-purple-600" />
              <h2 className="text-sm font-bold text-gray-900">Notices</h2>
            </div>
            <ul className="mt-2 list-disc pl-5 text-sm text-gray-700 space-y-1">
              {announcements.map((ann, i) => (
                <li
                  key={i}
                  className="truncate cursor-pointer hover:text-purple-600"
                  onClick={() => setSelectedAnnouncement(ann)}
                  title={`${ann.subject}: ${ann.content}`}
                >
                  {ann.subject}: {ann.content.slice(0, 40)}...
                </li>
              ))}
              {announcements.length === 0 && <p className="text-sm text-gray-600">No notices.</p>}
            </ul>
          </div>

          {/* About MEED */}
          <button
            className="bg-white/80 backdrop-blur-md rounded-2xl shadow p-4 border border-white/30 text-left"
            onClick={() => setShowKnowMIDModal(true)}
          >
            <div className="flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-600" />
              <h2 className="text-sm font-bold text-gray-900">About MEED</h2>
            </div>
            <p className="text-sm text-gray-700 mt-2">Meed Internal Dynamics</p>
          </button>

          {/* MRIs */}
          <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow p-4 border border-white/30">
            <div className="flex items-center gap-2">
              <School className="w-5 h-5 text-purple-600" />
              <h2 className="text-sm font-bold text-gray-900">MRIs</h2>
            </div>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
              <button
                className="text-xs text-gray-700 hover:text-purple-600"
                onClick={() => setShowNMRIsModal(true)}
              >
                N-MRIs
              </button>
              <button
                className="text-xs text-gray-700 hover:text-purple-600"
                onClick={() => setShowMSPRModal(true)}
              >
                MSPR
              </button>
              <button
                className="text-xs text-gray-700 hover:text-purple-600"
                onClick={() => setShowMHCPModal(true)}
              >
                MHCP
              </button>
              <button
                className="col-span-3 text-xs text-gray-700 hover:text-purple-600"
                onClick={() => setShowNMRIPlanModal(true)}
              >
                NMRI Plan (D/L by Day)
              </button>
            </div>
          </div>
        </div>

        {/* DESKTOP LAYOUT (original vibe) */}
        <div className="hidden sm:flex flex-1 items-center justify-center relative">
          <motion.div
            className="absolute w-56 h-56 sm:w-72 sm:h-72 bg-gradient-to-br from-teal-200/80 to-purple-200/80 rounded-full flex items-center justify-center shadow-xl ring-4 ring-white/50 backdrop-blur-sm"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.8, delay: 0.3, type: "spring" }}
            whileHover={{ scale: 1.05, rotate: 5 }}
            onClick={() => setShowTutorialsModal(true)}
          >
            <div className="text-center">
              <Video className="w-12 h-12 text-teal-600 mx-auto" />
              <h2 className="text-lg font-bold text-gray-900 mt-3">Tutorials</h2>
            </div>
          </motion.div>

          <motion.div
            className="absolute top-10 left-10 w-52 h-52 bg-white/70 backdrop-blur-md rounded-2xl shadow-xl p-5 border border-white/30"
            initial={{ opacity: 0, y: -30, rotate: -10 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 0.6, delay: 0.4, type: "spring" }}
            whileHover={{ scale: 1.05, rotate: 3 }}
          >
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-teal-600" />
              <h2 className="text-base font-bold text-gray-900">Block</h2>
            </div>
            {isLoadingSlots ? (
              <div className="flex items-center justify-center mt-4">
                <div className="w-6 h-6 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="mt-3">
                <p className="text-lg font-bold text-teal-700">
                  {currentBlock || "No Block"}
                </p>
                {currentSlot && (
                  <>
                    <p className="text-sm text-gray-700">
                      {`${currentSlot.startTime.slice(0, 5)} - ${currentSlot.endTime.slice(0, 5)}`}
                    </p>
                    <p className="text-sm text-gray-700">{getTODName(currentSlot)}</p>
                    <p className="text-sm text-teal-600 font-medium">
                      {timeLeft !== null ? `${formatTimeLeft(timeLeft)} left` : "Ended"}
                    </p>
                  </>
                )}
              </div>
            )}
          </motion.div>

          <motion.div
            className="absolute top-10 right-10 w-52 h-52 bg-white/70 backdrop-blur-md rounded-2xl shadow-xl p-5 border border-white/30 overflow-y-auto"
            initial={{ opacity: 0, y: -30, rotate: 10 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 0.6, delay: 0.5, type: "spring" }}
            whileHover={{ scale: 1.05, rotate: -3 }}
          >
            <div className="flex items-center gap-3">
              <Bell className="w-6 h-6 text-purple-600" />
              <h2 className="text-base font-bold text-gray-900">Notices</h2>
            </div>
            <ul className="mt-3 list-disc pl-5 text-sm text-gray-700 space-y-1">
              {announcements.map((ann, index) => (
                <li
                  key={index}
                  className="truncate cursor-pointer hover:text-purple-600"
                  onClick={() => setSelectedAnnouncement(ann)}
                  title={`${ann.subject}: ${ann.content}`}
                >
                  {ann.subject}: {ann.content.slice(0, 30)}...
                </li>
              ))}
              {announcements.length === 0 && <p>No notices.</p>}
            </ul>
          </motion.div>

          <motion.div
            className="absolute bottom-10 left-10 w-52 h-52 bg-white/70 backdrop-blur-md rounded-2xl shadow-xl p-5 border border-white/30"
            initial={{ opacity: 0, y: 30, rotate: 10 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 0.6, delay: 0.6, type: "spring" }}
            whileHover={{ scale: 1.05, rotate: -3 }}
            onClick={() => setShowKnowMIDModal(true)}
          >
            <div className="flex items-center gap-3">
              <Info className="w-6 h-6 text-blue-600" />
              <h2 className="text-base font-bold text-gray-900">About MEED</h2>
            </div>
            <p className="text-sm text-gray-700 mt-3">Meed Internal Dynamics</p>
          </motion.div>

          <motion.div
            className="absolute bottom-10 right-10 w-52 h-52 bg-white/70 backdrop-blur-md rounded-2xl shadow-xl p-5 border border-white/30"
            initial={{ opacity: 0, y: 30, rotate: -10 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 0.6, delay: 0.7, type: "spring" }}
            whileHover={{ scale: 1.05, rotate: 3 }}
          >
            <div className="flex items-center gap-3">
              <School className="w-6 h-6 text-purple-600" />
              <h2 className="text-base font-bold text-gray-900">MRIs</h2>
            </div>
            <div className="mt-3 space-y-2">
              <div
                className="text-sm text-gray-700 cursor-pointer hover:text-purple-600 transition-colors"
                onClick={() => setShowNMRIsModal(true)}
              >
                N-MRIs
              </div>
              <div
                className="text-sm text-gray-700 cursor-pointer hover:text-purple-600 transition-colors"
                onClick={() => setShowMSPRModal(true)}
              >
                MSPR
              </div>
              <div
                className="text-sm text-gray-700 cursor-pointer hover:text-purple-600 transition-colors"
                onClick={() => setShowMHCPModal(true)}
              >
                MHCP
              </div>
            </div>
          </motion.div>
        </div>

        {/* MODALS */}
        <AnimatePresence>
          {showTutorialsModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 flex items-center justify-center p-3 sm:p-6 z-50 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-white/90 backdrop-blur-lg rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-8 w-[95vw] sm:w-full sm:max-w-5xl max-h-[85vh] overflow-y-auto border border-white/50"
              >
                <div className="flex justify-between items-center mb-4 sm:mb-6">
                  <h2 className="text-lg sm:text-2xl font-bold text-gray-900">Tutorial Videos</h2>
                  <motion.button
                    onClick={() => setShowTutorialsModal(false)}
                    className="text-gray-700 hover:text-gray-900 p-2 sm:p-3 rounded-full bg-white/50 hover:bg-white/70 shadow-md"
                    whileHover={{ scale: 1.06, rotate: 90 }}
                    whileTap={{ scale: 0.97 }}
                    aria-label="Close"
                  >
                    <X size={22} className="sm:hidden" />
                    <X size={24} className="hidden sm:block" />
                  </motion.button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <iframe
                    className="rounded-2xl shadow-md w-full aspect-video"
                    src="https://www.youtube.com/embed/564g6DZTEzM?si=32_1RhgoD7sFzwYG"
                    title="Tutorial 1"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                  <iframe
                    className="rounded-2xl shadow-md w-full aspect-video"
                    src="https://www.youtube.com/embed/8mUFLqP5v04?si=_SrVZgC7UhGIVG_E"
                    title="Tutorial 2"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </motion.div>
            </motion.div>
          )}

          {showNMRIsModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 flex items-center justify-center p-3 sm:p-6 z-50 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-white/90 backdrop-blur-lg rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-8 w-[95vw] sm:w-full sm:max-w-5xl max-h-[85vh] overflow-y-auto border border-white/50"
              >
                <div className="flex justify-between items-center mb-4 sm:mb-6">
                  <h2 className="text-lg sm:text-2xl font-bold text-gray-900">N-MRIs Slot Allotments</h2>
                  <motion.button
                    onClick={() => setShowNMRIsModal(false)}
                    className="text-gray-700 hover:text-gray-900 p-2 sm:p-3 rounded-full bg-white/50 hover:bg-white/70 shadow-md"
                    whileHover={{ scale: 1.06, rotate: 90 }}
                    whileTap={{ scale: 0.97 }}
                    aria-label="Close"
                  >
                    <X size={22} className="sm:hidden" />
                    <X size={24} className="hidden sm:block" />
                  </motion.button>
                </div>

                {isLoadingSlots ? (
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-base font-medium text-gray-800 mt-3">Loading slots...</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {[
                      "Block 1 (Slots 1-6)",
                      "Block 2 (Slots 7-9)",
                      "Block 3 (Slots 10-11)",
                      "Block 4 (Slots 12-14)",
                      "Block 5 (Slots 15-16)",
                      "Block 6 (Slot 17)",
                    ].map((blockTitle, blockIndex) => (
                      <div key={blockIndex} className="mb-6">
                        <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3">
                          {blockTitle}
                        </h3>
                        <div className="hidden sm:grid grid-cols-12 gap-4 bg-teal-50/50 rounded-2xl p-4 shadow-inner">
                          <div className="col-span-2 font-bold text-gray-900 text-sm">Slot ID</div>
                          <div className="col-span-4 font-bold text-gray-900 text-sm">Slot Name</div>
                          <div className="col-span-3 font-bold text-gray-900 text-sm">Allotted TOD</div>
                          <div className="col-span-3 font-bold text-gray-900 text-sm">Time Slot</div>
                        </div>

                        {/* Mobile condensed list */}
                        <div className="sm:hidden space-y-2">
                          {slots
                            .filter((slot) => {
                              if (blockTitle === "Block 1 (Slots 1-6)") return slot.id >= 1 && slot.id <= 6;
                              if (blockTitle === "Block 2 (Slots 7-9)") return slot.id >= 7 && slot.id <= 9;
                              if (blockTitle === "Block 3 (Slots 10-11)") return slot.id >= 10 && slot.id <= 11;
                              if (blockTitle === "Block 4 (Slots 12-14)") return slot.id >= 12 && slot.id <= 14;
                              if (blockTitle === "Block 5 (Slots 15-16)") return slot.id >= 15 && slot.id <= 16;
                              if (blockTitle === "Block 6 (Slot 17)") return slot.id === 17;
                              return false;
                            })
                            .map((slot) => (
                              <div
                                key={slot.id}
                                className="rounded-xl border bg-white/80 p-3 shadow-sm"
                              >
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-semibold">Slot {slot.id}</p>
                                  <p className="text-xs text-gray-600">
                                    {slot.startTime.slice(0, 5)} - {slot.endTime.slice(0, 5)}
                                  </p>
                                </div>
                                <p className="text-sm text-gray-800 mt-1">{slot.name}</p>
                                <p className="text-xs text-gray-700">TOD: {getTODName(slot)}</p>
                              </div>
                            ))}
                        </div>

                        {/* Desktop grid rows */}
                        {slots.length > 0 && (
                          <div className="hidden sm:block">
                            {slots
                              .filter((slot) => {
                                if (blockTitle === "Block 1 (Slots 1-6)") return slot.id >= 1 && slot.id <= 6;
                                if (blockTitle === "Block 2 (Slots 7-9)") return slot.id >= 7 && slot.id <= 9;
                                if (blockTitle === "Block 3 (Slots 10-11)") return slot.id >= 10 && slot.id <= 11;
                                if (blockTitle === "Block 4 (Slots 12-14)") return slot.id >= 12 && slot.id <= 14;
                                if (blockTitle === "Block 5 (Slots 15-16)") return slot.id >= 15 && slot.id <= 16;
                                if (blockTitle === "Block 6 (Slot 17)") return slot.id === 17;
                                return false;
                              })
                              .map((slot, index) => (
                                <motion.div
                                  key={slot.id}
                                  className="grid grid-cols-12 gap-4 items-center p-4 rounded-lg hover:bg-gray-50/50 transition-colors"
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ duration: 0.25, delay: index * 0.04 }}
                                >
                                  <div className="col-span-2 text-sm font-medium text-gray-800">
                                    Slot {slot.id}
                                  </div>
                                  <div className="col-span-4 text-sm font-medium text-gray-800">
                                    {slot.name}
                                  </div>
                                  <div className="col-span-3 text-sm font-medium text-gray-800">
                                    {getTODName(slot)}
                                  </div>
                                  <div className="col-span-3 text-sm font-medium text-gray-800">
                                    {`${slot.startTime.slice(0, 5)} - ${slot.endTime.slice(0, 5)}`}
                                  </div>
                                </motion.div>
                              ))}
                          </div>
                        )}
                        {slots.length === 0 && (
                          <p className="text-sm font-medium text-gray-800 mt-3">No slots available.</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}

          {showNMRIPlanModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 flex items-center justify-center p-3 sm:p-6 z-50 backdrop-blur-sm"
              onClick={() => setShowNMRIPlanModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-white/90 backdrop-blur-lg rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 w-[95vw] sm:w-full sm:max-w-6xl max-h-[85vh] overflow-hidden border border-white/50"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-3 sm:mb-4">
                  <h2 className="text-lg sm:text-2xl font-bold text-gray-900">NMRI Plan — Day-wise D/L</h2>
                  <motion.button
                    onClick={() => setShowNMRIPlanModal(false)}
                    className="text-gray-700 hover:text-gray-900 p-2 sm:p-3 rounded-full bg-white/50 hover:bg-white/70 shadow-md"
                    whileHover={{ scale: 1.06, rotate: 90 }}
                    whileTap={{ scale: 0.97 }}
                    aria-label="Close"
                  >
                    <X size={22} className="sm:hidden" />
                    <X size={24} className="hidden sm:block" />
                  </motion.button>
                </div>

                {/* Content: responsive cards (mobile) + table (desktop) */}
                <NMRIPlanView slots={slots} members={members} slotData={slotData} />
              </motion.div>
            </motion.div>
          )}

          {showKnowMIDModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 flex items-center justify-center p-3 sm:p-6 z-50 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-white/90 backdrop-blur-lg rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-8 w-[95vw] sm:w-full sm:max-w-5xl max-h-[85vh] overflow-y-auto border border-white/50"
              >
                <div className="flex justify-between items-center mb-4 sm:mb-6">
                  <h2 className="text-lg sm:text-2xl font-bold text-gray-900">Know About MID</h2>
                  <motion.button
                    onClick={() => setShowKnowMIDModal(false)}
                    className="text-gray-700 hover:text-gray-900 p-2 sm:p-3 rounded-full bg-white/50 hover:bg-white/70 shadow-md"
                    whileHover={{ scale: 1.06, rotate: 90 }}
                    whileTap={{ scale: 0.97 }}
                    aria-label="Close"
                  >
                    <X size={22} className="sm:hidden" />
                    <X size={24} className="hidden sm:block" />
                  </motion.button>
                </div>
                <p className="text-sm sm:text-base font-medium text-gray-800">
                  Details about Meed Internal Dynamics (to be implemented).
                </p>
              </motion.div>
            </motion.div>
          )}

          {showMSPRModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 flex items-center justify-center p-3 sm:p-6 z-50 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-white/90 backdrop-blur-lg rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-8 w-[95vw] sm:w-full sm:max-w-6xl max-h-[85vh] overflow-y-auto border border-white/50"
              >
                <div className="flex justify-between items-center mb-4 sm:mb-6">
                  <h2 className="text-lg sm:text-2xl font-bold text-gray-900">MSP-R Schedule</h2>
                  <motion.button
                    onClick={() => setShowMSPRModal(false)}
                    className="text-gray-700 hover:text-gray-900 p-2 sm:p-3 rounded-full bg-white/50 hover:bg-white/70 shadow-md"
                    whileHover={{ scale: 1.06, rotate: 90 }}
                    whileTap={{ scale: 0.97 }}
                    aria-label="Close"
                  >
                    <X size={22} className="sm:hidden" />
                    <X size={24} className="hidden sm:block" />
                  </motion.button>
                </div>
                {/* MSP-R schedule content */}
                <MSPRSchedule fetcher={fetcher} />
              </motion.div>
            </motion.div>
          )}

          {showMHCPModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 flex items-center justify-center p-3 sm:p-6 z-50 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-white/90 backdrop-blur-lg rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-8 w-[95vw] sm:w-full sm:max-w-5xl max-h-[85vh] overflow-y-auto border border-white/50"
              >
                <div className="flex justify-between items-center mb-4 sm:mb-6">
                  <h2 className="text-lg sm:text-2xl font-bold text-gray-900">View MHCP</h2>
                  <motion.button
                    onClick={() => setShowMHCPModal(false)}
                    className="text-gray-700 hover:text-gray-900 p-2 sm:p-3 rounded-full bg-white/50 hover:bg-white/70 shadow-md"
                    whileHover={{ scale: 1.06, rotate: 90 }}
                    whileTap={{ scale: 0.97 }}
                    aria-label="Close"
                  >
                    <X size={22} className="sm:hidden" />
                    <X size={24} className="hidden sm:block" />
                  </motion.button>
                </div>
                <p className="text-sm sm:text-base font-medium text-gray-800">
                  Meed Hostel Coaching Program details.
                </p>
              </motion.div>
            </motion.div>
          )}

          {showCalendarModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 flex items-center justify-center p-3 sm:p-6 z-50 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-white/90 backdrop-blur-lg rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-8 w-[95vw] sm:w-full sm:max-w-6xl max-h-[85vh] overflow-y-auto border border-white/50"
              >
                <div className="flex justify-between items-center mb-4 sm:mb-6">
                  <h2 className="text-lg sm:text-2xl font-bold text-gray-900">School Calendar</h2>
                  <motion.button
                    onClick={() => setShowCalendarModal(false)}
                    className="text-gray-700 hover:text-gray-900 p-2 sm:p-3 rounded-full bg-white/50 hover:bg-white/70 shadow-md"
                    whileHover={{ scale: 1.06, rotate: 90 }}
                    whileTap={{ scale: 0.97 }}
                    aria-label="Close"
                  >
                    <X size={22} className="sm:hidden" />
                    <X size={24} className="hidden sm:block" />
                  </motion.button>
                </div>
                <ManageCalendar calendar={calendar} loading={isLoadingCalendar} viewOnly />
              </motion.div>
            </motion.div>
          )}

          {selectedAnnouncement && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 flex items-center justify-center p-3 sm:p-6 z-50 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-white/90 backdrop-blur-lg rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-8 w-[95vw] sm:w-full sm:max-w-3xl max-h-[85vh] overflow-y-auto border border-white/50"
              >
                <div className="flex justify-between items-center mb-4 sm:mb-6">
                  <h2 className="text-lg sm:text-2xl font-bold text-gray-900">School Notice</h2>
                  <motion.button
                    onClick={() => setSelectedAnnouncement(null)}
                    className="text-gray-700 hover:text-gray-900 p-2 sm:p-3 rounded-full bg-white/50 hover:bg-white/70 shadow-md"
                    whileHover={{ scale: 1.06, rotate: 90 }}
                    whileTap={{ scale: 0.97 }}
                    aria-label="Close"
                  >
                    <X size={22} className="sm:hidden" />
                    <X size={24} className="hidden sm:block" />
                  </motion.button>
                </div>
                <div className="border-2 border-gray-300 p-4 sm:p-6 rounded-lg bg-white shadow-inner">
                  <div className="text-center mb-3 sm:mb-4">
                    <h3 className="text-lg sm:text-xl font-bold uppercase">Notice</h3>
                    <p className="text-xs sm:text-sm text-gray-600">
                      Date: {new Date(selectedAnnouncement.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="mb-3 sm:mb-4">
                    <p className="font-bold text-sm sm:text-base">
                      Subject: {selectedAnnouncement.subject}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-600">
                      Program: {selectedAnnouncement.program} | Target: {selectedAnnouncement.target}
                    </p>
                  </div>
                  <div className="mb-3 sm:mb-4">
                    <p className="text-sm sm:text-base whitespace-pre-wrap">
                      {selectedAnnouncement.content}
                    </p>
                  </div>
                  {Array.isArray(selectedAnnouncement.attachments) &&
                    selectedAnnouncement.attachments.length > 0 && (
                      <div className="mb-3 sm:mb-4">
                        <p className="font-bold text-sm sm:text-base">Attachments:</p>
                        <ul className="list-disc pl-5">
                          {selectedAnnouncement.attachments.map((url, index) => (
                            <li key={index} className="break-all">
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-teal-600 hover:underline"
                              >
                                {url}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  <div className="text-right mt-4 sm:mt-6">
                    <p className="font-bold text-sm sm:text-base">
                      Posted by: {selectedAnnouncement.createdByName}
                    </p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Floating chat dock (mobile-only) */}
        <ChatDock />
      </div>
    </motion.div>
  );
}

// Inline component to render MSP-R schedule (MSP program matrix)
function MSPRSchedule({ fetcher }) {
  const { data: progData, error: progErr } = useSWR(
    "/api/admin/manageMeedian?section=metaPrograms",
    fetcher
  );

  const mspProgram = Array.isArray(progData?.programs)
    ? progData.programs.find((p) => String(p.programKey).toUpperCase() === "MSP")
    : null;
  const programId = mspProgram?.id;

  const { data: prePeriods } = useSWR(
    programId ? `/api/admin/manageMeedian?section=programPeriods&programId=${programId}&track=pre_primary` : null,
    fetcher
  );
  const { data: elePeriods } = useSWR(
    programId ? `/api/admin/manageMeedian?section=programPeriods&programId=${programId}&track=elementary` : null,
    fetcher
  );
  const { data: preCells } = useSWR(
    programId ? `/api/admin/manageMeedian?section=programScheduleCells&programId=${programId}&track=pre_primary` : null,
    fetcher
  );
  const { data: eleCells } = useSWR(
    programId ? `/api/admin/manageMeedian?section=programScheduleCells&programId=${programId}&track=elementary` : null,
    fetcher
  );

  const [track, setTrack] = useState("elementary");
  const [viewMode, setViewMode] = useState("class"); // class | teacher
  const todayIso = new Date().toISOString().slice(0, 10);
  const [ownersOpen, setOwnersOpen] = useState(false);

  // For teacher-wise view: fetch users, assignments, codes
  const { data: usersData } = useSWR("/api/member/users", fetcher);
  const { data: assignData } = useSWR(
    programId ? "/api/admin/manageMeedian?section=mspCodeAssignments" : null,
    fetcher
  );
  const { data: codesData } = useSWR(
    programId ? "/api/admin/manageMeedian?section=mspCodes" : null,
    fetcher
  );

  const programError = !!progErr;
  const programNotReady = !programId;

  const periods = (track === "pre_primary" ? prePeriods?.periods : elePeriods?.periods) || [];
  const cells = (track === "pre_primary" ? preCells?.cells : eleCells?.cells) || [];

  // Build class list and period keys
  const classNames = Array.from(
    new Set(cells.map((c) => String(c.className)))
  ).sort((a, b) => {
    // numeric classes first in order, then names
    const na = Number(a), nb = Number(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    if (!isNaN(na)) return -1;
    if (!isNaN(nb)) return 1;
    return a.localeCompare(b);
  });
  const periodKeys = Array.from(
    new Set(periods.map((p) => String(p.periodKey)))
  ).sort((a, b) => {
    // P1..P8 natural order
    const ai = parseInt(a.replace(/\D/g, "")) || 0;
    const bi = parseInt(b.replace(/\D/g, "")) || 0;
    if (ai !== bi) return ai - bi;
    return a.localeCompare(b);
  });
  const periodTimeMap = new Map(
    periods.map((p) => [String(p.periodKey), `${String(p.startTime || "").slice(0,5)}-${String(p.endTime || "").slice(0,5)}`])
  );

  const cellMap = new Map();
  for (const c of cells) {
    cellMap.set(`${c.className}__${c.periodKey}`, {
      code: c.mspCode || "",
      subject: c.subject || "",
    });
  }

  const loading = !prePeriods || !elePeriods || !preCells || !eleCells;

  // Build teacher -> set(codeIds)
  const activeAssignments = Array.isArray(assignData?.assignments)
    ? assignData.assignments.filter((a) => {
        const start = a.startDate ? String(a.startDate).slice(0, 10) : null;
        const end = a.endDate ? String(a.endDate).slice(0, 10) : null;
        const inRange = (!start || start <= todayIso) && (!end || todayIso <= end);
        return a.active !== false && inRange;
      })
    : [];
  const teacherCodeIds = new Map(); // userId -> Set(mspCodeId)
  for (const a of activeAssignments) {
    if (!teacherCodeIds.has(a.userId)) teacherCodeIds.set(a.userId, new Set());
    if (a.mspCodeId) teacherCodeIds.get(a.userId).add(a.mspCodeId);
  }
  // Build teacher options from users present in assignments
  const allUsers = Array.isArray(usersData) ? usersData : usersData?.users || [];
  const teacherOptions = Array.from(teacherCodeIds.keys())
    .map((uid) => ({ id: uid, name: allUsers.find((u) => String(u.id) === String(uid))?.name || `User ${uid}` }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const [selectedTeacher, setSelectedTeacher] = useState(teacherOptions[0]?.id || "");
  useEffect(() => {
    // Ensure selected teacher remains valid when options load/update
    if (!selectedTeacher && teacherOptions.length > 0) setSelectedTeacher(teacherOptions[0].id);
  }, [teacherOptions.length]);

  // Build ownership map for current track codes (after users and assignments are available)
  const codesById = new Map(
    (codesData?.codes || [])
      .filter((c) => String(c.track) === track)
      .map((c) => [c.id, c])
  );
  const ownersByCodeId = new Map(); // codeId -> [{id,name,isPrimary}]
  for (const a of activeAssignments) {
    if (!a.mspCodeId || !codesById.has(a.mspCodeId)) continue;
    const arr = ownersByCodeId.get(a.mspCodeId) || [];
    const user = allUsers.find((u) => String(u.id) === String(a.userId));
    arr.push({ id: a.userId, name: user?.name || `User ${a.userId}`, isPrimary: !!a.isPrimary });
    ownersByCodeId.set(a.mspCodeId, arr);
  }
  const codesInView = Array.from(new Set(cells.map((c) => c.mspCodeId).filter(Boolean)));

  return (
    <div className="flex flex-col gap-4">
      {programError && (
        <div className="text-sm text-red-700">Failed to load program list.</div>
      )}
      {programNotReady && !programError && (
        <div className="text-sm text-gray-700">MSP program not configured.</div>
      )}
      {!programError && !programNotReady && (
      <>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          className={`px-3 py-1.5 text-sm rounded-lg border ${
            track === "elementary" ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-800 border-gray-200"
          }`}
          onClick={() => setTrack("elementary")}
        >
          Elementary
        </button>
        <button
          className={`px-3 py-1.5 text-sm rounded-lg border ${
            track === "pre_primary" ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-800 border-gray-200"
          }`}
          onClick={() => setTrack("pre_primary")}
        >
          Pre-Primary
        </button>

        <div className="ml-2 flex items-center gap-2">
          <label className="text-sm font-medium text-gray-800">View:</label>
          <button
            className={`px-3 py-1.5 text-sm rounded-lg border ${
              viewMode === "class" ? "bg-purple-600 text-white border-purple-600" : "bg-white text-gray-800 border-gray-200"
            }`}
            onClick={() => setViewMode("class")}
          >
            Class-wise
          </button>
          <button
            className={`px-3 py-1.5 text-sm rounded-lg border ${
              viewMode === "teacher" ? "bg-purple-600 text-white border-purple-600" : "bg-white text-gray-800 border-gray-200"
            }`}
            onClick={() => setViewMode("teacher")}
          >
            Teacher-wise
          </button>
        </div>

        <button
          className="ml-auto px-3 py-1.5 text-sm rounded-lg border bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
          onClick={() => setOwnersOpen(true)}
        >
          Code owners
        </button>

        {viewMode === "teacher" && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">Teacher:</label>
            <select
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              className="px-2 py-1.5 text-sm rounded-lg border border-gray-200 bg-white"
            >
              {!teacherOptions.length && <option value="">No assignments</option>}
              {teacherOptions.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-gray-700">
          <div className="w-5 h-5 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading schedule…</span>
        </div>
      ) : cells.length === 0 ? (
        <p className="text-sm text-gray-700">Schedule not configured for this track.</p>
      ) : viewMode === "class" ? (
        <div className="w-full overflow-x-auto rounded-xl border border-gray-200 bg-white/70">
          {/* Mobile stacked view */}
          <div className="sm:hidden divide-y divide-gray-200">
            {classNames.map((cn) => (
              <div key={cn} className="p-3">
                <div className="font-semibold text-gray-900 mb-2">Class {cn}</div>
                <div className="grid grid-cols-2 gap-2">
                  {periodKeys.map((pk) => {
                    const v = cellMap.get(`${cn}__${pk}`) || {};
                    return (
                      <div key={pk} className="rounded-lg border p-2 bg-white">
                        <div className="text-xs text-gray-500 mb-0.5">{pk} · {periodTimeMap.get(pk) || "--:--"}</div>
                        <div className="text-sm font-semibold text-teal-700" title={v.code}>{v.code || "—"}</div>
                        {v.subject && <div className="text-xs text-gray-600">{v.subject}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <table className="min-w-full text-sm hidden sm:table">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-3 py-2 font-semibold text-gray-800 sticky left-0 bg-gray-50">Class</th>
                {periodKeys.map((pk) => (
                  <th key={pk} className="px-3 py-2 font-semibold text-gray-800 whitespace-nowrap">
                    <div>{pk}</div>
                    <div className="text-xs text-gray-500">{periodTimeMap.get(pk) || "--:--"}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {classNames.map((cn) => (
                <tr key={cn} className="even:bg-gray-50/50">
                  <td className="px-3 py-2 font-medium text-gray-900 sticky left-0 bg-white/90">
                    {cn}
                  </td>
                  {periodKeys.map((pk) => {
                    const v = cellMap.get(`${cn}__${pk}`) || {};
                    return (
                      <td key={pk} className="px-3 py-2 text-gray-800 align-top" title={v.code}>
                        <div className="font-semibold text-teal-700">{v.code || "—"}</div>
                        <div className="text-xs text-gray-600">{v.subject || ""}</div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="w-full overflow-x-auto rounded-xl border border-gray-200 bg-white/70">
          {/* Teacher-wise grid: same axes, cells filled only if teacher owns the code */}
          {!selectedTeacher ? (
            <div className="p-3 text-sm text-gray-700">Select a teacher to view schedule.</div>
          ) : (
            <>
            {/* Mobile stacked view – period-first (P1..P8 with classes owned) */}
            <div className="sm:hidden divide-y divide-gray-200">
              {periodKeys.map((pk) => {
                const owned = classNames
                  .map((cn) => {
                    const cell = cells.find((c) => String(c.className) === cn && String(c.periodKey) === pk);
                    const codeId = cell?.mspCodeId;
                    const owns = codeId && teacherCodeIds.get(Number(selectedTeacher))?.has(codeId);
                    return owns ? { cn, cell } : null;
                  })
                  .filter(Boolean);
                return (
                  <div key={pk} className="p-3">
                    <div className="font-semibold text-gray-900 mb-2">
                      {pk} · {periodTimeMap.get(pk) || "--:--"}
                    </div>
                    {owned.length === 0 ? (
                      <div className="text-xs text-gray-500">No classes this period.</div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2">
                        {owned.map(({ cn, cell }) => (
                          <div key={`${pk}__${cn}`} className="rounded-lg border p-2 bg-purple-50 border-purple-200">
                            <div className="text-xs text-gray-600 mb-0.5">Class {cn}</div>
                            <div className="text-sm font-semibold text-purple-700" title={cell?.mspCode || ""}>{cell?.mspCode || ""}</div>
                            {cell?.subject && <div className="text-xs text-gray-600">{cell.subject}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop table */}
            <table className="min-w-full text-sm hidden sm:table">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-3 py-2 font-semibold text-gray-800 sticky left-0 bg-gray-50">Class</th>
                  {periodKeys.map((pk) => (
                    <th key={pk} className="px-3 py-2 font-semibold text-gray-800 whitespace-nowrap">
                      <div>{pk}</div>
                      <div className="text-xs text-gray-500">{periodTimeMap.get(pk) || "--:--"}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* If the selected teacher has no ownership in the chosen track, show a hint row */}
                {(() => {
                  const stId = Number(selectedTeacher);
                  const ownsAnyInTrack = !!cells.find((c) => c.mspCodeId && teacherCodeIds.get(stId)?.has(c.mspCodeId));
                  if (!ownsAnyInTrack) {
                    const niceTrack = track === "elementary" ? "Elementary" : "Pre-Primary";
                    const altTrack = track === "elementary" ? "Pre-Primary" : "Elementary";
                    return (
                      <tr>
                        <td className="px-3 py-3 text-sm text-amber-700 bg-amber-50 border-b border-amber-100 rounded-l-lg" colSpan={periodKeys.length + 1}>
                          This teacher has no MSP‑R assignments in {niceTrack}. Please check {altTrack}.
                        </td>
                      </tr>
                    );
                  }
                  return null;
                })()}
                {classNames.map((cn) => (
                  <tr key={cn} className="even:bg-gray-50/50">
                    <td className="px-3 py-2 font-medium text-gray-900 sticky left-0 bg-white/90">
                      {cn}
                    </td>
                    {periodKeys.map((pk) => {
                      const cell = cells.find((c) => String(c.className) === cn && String(c.periodKey) === pk);
                      const codeId = cell?.mspCodeId;
                      const owns = codeId && teacherCodeIds.get(Number(selectedTeacher))?.has(codeId);
                      return (
                        <td key={pk} className="px-3 py-2 text-gray-800 align-top" title={cell?.mspCode || ""}>
                          {owns ? (
                            <>
                              <div className="font-semibold text-purple-700">{cell?.mspCode || ""}</div>
                              <div className="text-xs text-gray-600">{cell?.subject || ""}</div>
                            </>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            </>
          )}
        </div>
      )}

      {/* Owners modal */}
      <AnimatePresence>
        {ownersOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3"
            onClick={() => setOwnersOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="w-full max-w-2xl max-h-[80vh] overflow-y-auto bg-white/95 rounded-2xl border border-white/60 p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900">MSP‑R Code Owners ({track === "elementary" ? "Elementary" : "Pre‑Primary"})</h3>
                <button
                  onClick={() => setOwnersOpen(false)}
                  className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="text-xs text-gray-600 mb-3">Only codes present in the current schedule are shown.</div>
              <div className="divide-y divide-gray-200">
                {codesInView
                  .filter((id) => codesById.has(id))
                  .sort((a, b) => String(codesById.get(a)?.code || "").localeCompare(String(codesById.get(b)?.code || "")))
                  .map((id) => {
                    const code = codesById.get(id);
                    const owners = (ownersByCodeId.get(id) || []).sort((a, b) => (b.isPrimary - a.isPrimary) || a.name.localeCompare(b.name));
                    return (
                      <div key={id} className="py-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{code?.code || `Code ${id}`}</div>
                            {code?.title && <div className="text-xs text-gray-600">{code.title}</div>}
                          </div>
                          <div className="text-sm text-gray-800">
                            {owners.length ? (
                              owners.map((o, i) => (
                                <span key={o.id} className={`inline-block px-2 py-0.5 rounded-full border text-xs mr-1 ${o.isPrimary ? "bg-purple-50 border-purple-200 text-purple-700" : "bg-gray-50 border-gray-200"}`}>
                                  {o.name}{o.isPrimary ? " • Primary" : ""}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Unassigned</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                {!codesInView.length && (
                  <div className="py-6 text-sm text-gray-700">No codes found in the current schedule.</div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </>
      )}
    </div>
  );
}

// Read-only NMRI plan: day-wise Discipline/Language per slot
function NMRIPlanView({ slots, members, slotData }) {
  const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]; // Sunday optional
  const isAMRI = (id) => [0, 3, 4, 6, 10, 13, 14].includes(Number(id));
  const nmriSlots = (slots || []).filter((s) => !isAMRI(s.id));
  const nameById = new Map((members || []).map((m) => [String(m.id), m.name]));
  const assigns = Array.isArray(slotData?.slotAssignments) ? slotData.slotAssignments : [];

  const map = new Map(); // key: `${slotId}__${day}` -> { D: name, L: name }
  for (const a of assigns) {
    const sid = String(a.slotId);
    const day = String(a.dayOfWeek || "").toLowerCase();
    const role = String(a.role || "").toLowerCase();
    if (!sid || !day || !role) continue;
    const key = `${sid}__${day}`;
    const curr = map.get(key) || { D: "", L: "" };
    const nm = nameById.get(String(a.memberId)) || "";
    if (role.startsWith("d")) curr.D = nm;
    if (role.startsWith("l")) curr.L = nm;
    map.set(key, curr);
  }

  // Mobile cards
  return (
    <div className="w-full h-full overflow-auto">
      <div className="sm:hidden space-y-3 pr-1">
        {nmriSlots.map((s) => (
          <div key={s.id} className="rounded-xl border bg-white/90 p-3">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm font-semibold text-gray-900">Slot {s.id} · {s.name}</div>
                <div className="text-xs text-gray-600">{String(s.startTime).slice(0,5)} - {String(s.endTime).slice(0,5)}</div>
              </div>
            </div>
            <div className="mt-2 space-y-1">
              {DAYS.map((d) => {
                const v = map.get(`${s.id}__${d}`) || {};
                if (!v.D && !v.L) return null;
                return (
                  <div key={d} className="text-xs text-gray-800">
                    <span className="font-semibold capitalize">{d.slice(0,3)}:</span> D: {v.D || "—"} · L: {v.L || "—"}
                  </div>
                );
              })}
              {/* fallback if nothing set */}
              {!DAYS.some((d) => map.get(`${s.id}__${d}`)) && (
                <div className="text-xs text-gray-500">No day-wise assignment</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-auto rounded-xl border bg-white/90">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-3 py-2">Slot</th>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2">Time</th>
              {DAYS.map((d) => (
                <th key={d} className="text-left px-3 py-2 capitalize">{d.slice(0,3)} (D/L)</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {nmriSlots.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-3 py-2 font-medium text-gray-900">{s.id}</td>
                <td className="px-3 py-2 text-gray-800">{s.name}</td>
                <td className="px-3 py-2 text-gray-600 text-xs">{String(s.startTime).slice(0,5)} - {String(s.endTime).slice(0,5)}</td>
                {DAYS.map((d) => {
                  const v = map.get(`${s.id}__${d}`) || {};
                  return (
                    <td key={d} className="px-3 py-2 text-gray-800 text-xs whitespace-pre-wrap">
                      {v.D || v.L ? (
                        <>{v.D || "—"} / {v.L || "—"}</>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Floating chat dock: DELU GPT and Chat (collapsible)
function ChatDock() {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2 sm:hidden mb-safe">
      {open && (
        <div className="mb-2 w-56 rounded-2xl border bg-white/95 shadow-lg p-3 space-y-2 text-sm">
          <div className="font-semibold text-gray-900">Quick Chats</div>
          <button className="w-full text-left px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 text-gray-800">General Chat</button>
          <button className="w-full text-left px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 text-gray-800">Team Chat</button>
          <button className="w-full text-left px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 text-gray-800">Support</button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          title="DELU GPT"
          className="w-12 h-12 rounded-full shadow-md border bg-purple-600 text-white flex items-center justify-center hover:bg-purple-700"
        >
          AI
        </button>
        <button
          title="Chat Dock"
          onClick={() => setOpen((v) => !v)}
          className="w-12 h-12 rounded-full shadow-md border bg-white text-gray-800 flex items-center justify-center hover:bg-gray-50"
        >
          💬
        </button>
      </div>
    </div>
  );
}
