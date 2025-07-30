"use client";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, Bell, Video, Info, School, Calendar, Edit, Trash, ChevronDown } from "lucide-react";
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
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null); // ADDED: For modal
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isLoadingSlots, setIsLoadingSlots] = useState(true);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(true);

  const { data: slotData, error: slotError } = useSWR("/api/admin/manageMeedian?section=slots", fetcher);
  const { data: userData, error: userError } = useSWR("/api/member/users", fetcher);
  const { data: calendarData, error: calendarError } = useSWR("/api/member/calendar", fetcher);
  const { data: announcementsData, error: announcementsError } = useSWR("/api/managersCommon/announcements", fetcher);

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
  }, [slotData, slotError, userData, userError, calendarData, calendarError, announcementsData, announcementsError]);

  useEffect(() => {
    let intervalId = null;
    const now = new Date();
    let foundSlot = null;
    let foundBlock = null;

    slots.forEach((slot) => {
      if (!slot.startTime || !slot.endTime || !/^\d{2}:\d{2}:\d{2}$/.test(slot.startTime) || !/^\d{2}:\d{2}:\d{2}$/.test(slot.endTime)) {
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
      intervalId = setInterval(() => {
        const currentTime = new Date();
        const newSecondsLeft = Math.max(0, Math.floor((endTime - currentTime) / 1000));
        setTimeLeft(newSecondsLeft);
        if (newSecondsLeft <= 0) {
          clearInterval(intervalId);
          setCurrentSlot(null);
          setCurrentBlock(null);
          setTimeLeft(null);
        }
      }, 1000);
    }
    setCurrentSlot(foundSlot);
    setCurrentBlock(foundBlock);
    return () => intervalId && clearInterval(intervalId);
  }, [slots]);

  const getCurrentWeekInfo = () => {
    const now = new Date("2025-07-28T06:26:00+08:00");
    const currentEntry = calendar.find((entry) => {
      const start = new Date(entry.startDate);
      const end = new Date(entry.endDate);
      return now >= start && now <= end && !entry.isMajorTermBoundary;
    });
    if (!currentEntry) return { weekNumber: "N/A", majorTerm: "N/A", minorTerm: "N/A", weekType: "N/A", startDate: "N/A", endDate: "N/A" };
    const entries = calendar
      .filter((c) => !c.isMajorTermBoundary)
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    const weekNumber = entries.findIndex((e) => e.id === currentEntry.id) + 1;
    return {
      weekNumber: weekNumber || "N/A",
      majorTerm: currentEntry.majorTerm || "N/A",
      minorTerm: currentEntry.minorTerm || "N/A",
      weekType: currentEntry.name || "N/A",
      startDate: new Date(currentEntry.startDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      endDate: new Date(currentEntry.endDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
    };
  };

  const getTODName = (slot) => {
    if (!slot || !slot.assignedMemberId) return "Unassigned";
    if (String(slot.assignedMemberId) === String(session?.user.id)) return `${session.user.name} (you)`;
    const member = members.find((m) => String(m.id) === String(slot.assignedMemberId));
    return member?.name || "Unassigned";
  };

  if (!session) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-teal-100/50 to-purple-100/50 backdrop-blur-md">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-xl font-semibold text-gray-800">
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
      transition={{ duration: 0.7, ease: "easeOut" }}
      className="fixed inset-0 bg-gradient-to-br from-teal-100/50 to-purple-100/50 backdrop-blur-md p-6 flex items-center justify-center overflow-hidden"
    >
      <div className="w-full h-full bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl p-8 flex flex-col gap-6 relative border border-white/50">
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 left-4 right-4 text-sm font-medium bg-red-100/80 text-red-700 p-4 rounded-2xl shadow-lg backdrop-blur-sm"
              onClick={() => setError(null)}
            >
              {error} (Click to dismiss)
            </motion.p>
          )}
          {success && (
            <motion.p
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 left-4 right-4 text-sm font-medium bg-green-100/80 text-green-700 p-4 rounded-2xl shadow-lg backdrop-blur-sm"
              onClick={() => setSuccess(null)}
            >
              {success} (Click to dismiss)
            </motion.p>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between">
          <motion.div
            className="flex items-center gap-4"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <svg className="w-10 h-10 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <h1 className="text-2xl font-bold text-gray-900">General Dashboard</h1>
          </motion.div>
          <motion.div
            className="flex items-center gap-4 text-sm font-medium text-gray-700 bg-white/50 backdrop-blur-sm px-4 py-2 rounded-full shadow-md"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
          >
            <span>Week: {weekInfo.weekNumber}</span> | <span>{weekInfo.startDate} - {weekInfo.endDate}</span> | <span>Term: {weekInfo.majorTerm} - {weekInfo.minorTerm}</span> | <span>Type: {weekInfo.weekType}</span>
            <motion.button
              onClick={() => setShowCalendarModal(true)}
              className="p-2 bg-teal-600 text-white rounded-full hover:bg-teal-700 shadow-md"
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
            >
              <Calendar size={20} />
            </motion.button>
          </motion.div>
        </div>

        <div className="flex-1 flex items-center justify-center relative">
          <motion.div
            className="absolute w-56 h-56 sm:w-72 sm:h-72 bg-gradient-to-br from-teal-200/80 to-purple-200/80 rounded-full flex items-center justify-center shadow-xl ring-4 ring-white/50 backdrop-blur-sm"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.8, delay: 0.3, type: "spring" }}
            whileHover={{ scale: 1.05, rotate: 5, boxShadow: "0 12px 24px rgba(0, 128, 128, 0.4)" }}
            onClick={() => setShowTutorialsModal(true)}
          >
            <div className="text-center">
              <Video className="w-12 h-12 text-teal-600 mx-auto" />
              <h2 className="text-lg font-bold text-gray-900 mt-3">Tutorials</h2>
            </div>
          </motion.div>
          <motion.div
            className="absolute top-8 left-8 sm:top-10 sm:left-10 w-40 h-40 sm:w-52 sm:h-52 bg-white/70 backdrop-blur-md rounded-2xl shadow-xl p-5 border border-white/30"
            initial={{ opacity: 0, y: -30, rotate: -10 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 0.6, delay: 0.4, type: "spring" }}
            whileHover={{ scale: 1.05, rotate: 3, boxShadow: "0 8px 16px rgba(0, 0, 0, 0.1)" }}
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
                <p className="text-lg font-bold text-teal-700">{currentBlock || "No Block"}</p>
                {currentSlot && (
                  <>
                    <p className="text-sm text-gray-700">{`${currentSlot.startTime.slice(0, 5)} - ${currentSlot.endTime.slice(0, 5)}`}</p>
                    <p className="text-sm text-gray-700">{getTODName(currentSlot)}</p>
                    <p className="text-sm text-teal-600 font-medium">{timeLeft !== null ? `${formatTimeLeft(timeLeft)} left` : "Ended"}</p>
                  </>
                )}
              </div>
            )}
          </motion.div>
          <motion.div
            className="absolute top-8 right-8 sm:top-10 sm:right-10 w-40 h-40 sm:w-52 sm:h-52 bg-white/70 backdrop-blur-md rounded-2xl shadow-xl p-5 border border-white/30 overflow-y-auto" // ADDED: overflow-y-auto for long lists
            initial={{ opacity: 0, y: -30, rotate: 10 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 0.6, delay: 0.5, type: "spring" }}
            whileHover={{ scale: 1.05, rotate: -3, boxShadow: "0 8px 16px rgba(0, 0, 0, 0.1)" }}
          >
            <div className="flex items-center gap-3">
              <Bell className="w-6 h-6 text-purple-600" />
              <h2 className="text-base font-bold text-gray-900">Notices</h2>
            </div>
            <ul className="mt-3 list-disc pl-5 text-sm text-gray-700 space-y-1">
              {announcements.map((ann, index) => (
                <li 
                  key={index} 
                  className="truncate cursor-pointer hover:text-purple-600" // ADDED: clickable
                  onClick={() => setSelectedAnnouncement(ann)}
                >
                  {ann.subject}: {ann.content.slice(0, 30)}...
                </li>
              ))}
              {announcements.length === 0 && <p>No notices.</p>}
            </ul>
          </motion.div>
          <motion.div
            className="absolute bottom-8 left-8 sm:bottom-10 sm:left-10 w-40 h-40 sm:w-52 sm:h-52 bg-white/70 backdrop-blur-md rounded-2xl shadow-xl p-5 border border-white/30"
            initial={{ opacity: 0, y: 30, rotate: 10 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 0.6, delay: 0.6, type: "spring" }}
            whileHover={{ scale: 1.05, rotate: -3, boxShadow: "0 8px 16px rgba(0, 0, 0, 0.1)" }}
            onClick={() => setShowKnowMIDModal(true)}
          >
            <div className="flex items-center gap-3">
              <Info className="w-6 h-6 text-blue-600" />
              <h2 className="text-base font-bold text-gray-900">About MID</h2>
            </div>
            <p className="text-sm text-gray-700 mt-3">Meed Internal Dynamics</p>
          </motion.div>
          <motion.div
            className="absolute bottom-8 right-8 sm:bottom-10 sm:right-10 w-40 h-40 sm:w-52 sm:h-52 bg-white/70 backdrop-blur-md rounded-2xl shadow-xl p-5 border border-white/30"
            initial={{ opacity: 0, y: 30, rotate: -10 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 0.6, delay: 0.7, type: "spring" }}
            whileHover={{ scale: 1.05, rotate: 3, boxShadow: "0 8px 16px rgba(0, 0, 0, 0.1)" }}
          >
            <div className="flex items-center gap-3">
              <School className="w-6 h-6 text-purple-600" />
              <h2 className="text-base font-bold text-gray-900">MRIs</h2>
            </div>
            <div className="mt-3 space-y-2">
              <div className="text-sm text-gray-700 cursor-pointer hover:text-purple-600 transition-colors" onClick={() => setShowNMRIsModal(true)}>N-MRIs</div>
              <div className="text-sm text-gray-700 cursor-pointer hover:text-purple-600 transition-colors" onClick={() => setShowMSPRModal(true)}>MSPR</div>
              <div className="text-sm text-gray-700 cursor-pointer hover:text-purple-600 transition-colors" onClick={() => setShowMHCPModal(true)}>MHCP</div>
            </div>
          </motion.div>
        </div>

        <AnimatePresence>
          {showTutorialsModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 flex items-center justify-center p-6 z-50 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-white/90 backdrop-blur-lg rounded-3xl shadow-2xl p-8 w-full max-w-5xl max-h-[85vh] overflow-y-auto border border-white/50"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Tutorial Videos</h2>
                  <motion.button
                    onClick={() => setShowTutorialsModal(false)}
                    className="text-gray-700 hover:text-gray-900 p-3 rounded-full bg-white/50 hover:bg-white/70 shadow-md"
                    whileHover={{ scale: 1.1, rotate: 90 }}
                   whileTap={{ scale: 0.95 }}
                  >
                    <X size={24} />
                  </motion.button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <iframe width="100%" height="315" src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Tutorial 1" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="rounded-2xl shadow-md" />
                  <iframe width="100%" height="315" src="https://www.youtube.com/embed/3tmd-ClpJxA" title="Tutorial 2" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="rounded-2xl shadow-md" />
                </div>
              </motion.div>
            </motion.div>
          )}
          {showNMRIsModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 flex items-center justify-center p-6 z-50 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-white/90 backdrop-blur-lg rounded-3xl shadow-2xl p-8 w-full max-w-5xl max-h-[85vh] overflow-y-auto border border-white/50"
              >
                <div className="flex justify-between items-center mb-6"
>
                  <h2 className="text-2xl font-bold text-gray-900">N-MRIs Slot Allotments</h2>
                  <motion.button
                    onClick={() => setShowNMRIsModal(false)}
                    className="text-gray-700 hover:text-gray-900 p-3 rounded-full bg-white/50 hover:bg-white/70 shadow-md"
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <X size={24} />
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
                        <h3 className="text-lg font-bold text-gray-900 mb-3">{blockTitle}</h3>
                        <div className="grid grid-cols-12 gap-4 bg-teal-50/50 rounded-2xl p-4 shadow-inner">
                          <div className="col-span-2 font-bold text-gray-900 text-sm">Slot ID</div>
                          <div className="col-span-4 font-bold text-gray-900 text-sm">Slot Name</div>
                          <div className="col-span-3 font-bold text-gray-900 text-sm">Allotted TOD</div>
                          <div className="col-span-3 font-bold text-gray-900 text-sm">Time Slot</div>
                        </div>
                        {slots.length === 0 ? (
                          <p className="text-sm font-medium text-gray-800 mt-3">No slots available.</p>
                        ) : (
                          slots
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
                                transition={{ duration: 0.3, delay: index * 0.05 }}
                              >
                                <div className="col-span-2 text-sm font-medium text-gray-800">Slot {slot.id}</div>
                                <div className="col-span-4 text-sm font-medium text-gray-800">{slot.name}</div>
                                <div className="col-span-3 text-sm font-medium text-gray-800">{getTODName(slot)}</div>
                                <div className="col-span-3 text-sm font-medium text-gray-800">{`${slot.startTime.slice(0, 5)} - ${slot.endTime.slice(0, 5)}`}</div>
                              </motion.div>
                            ))
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
          {showKnowMIDModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 flex items-center justify-center p-6 z-50 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-white/90 backdrop-blur-lg rounded-3xl shadow-2xl p-8 w-full max-w-5xl max-h-[85vh] overflow-y-auto border border-white/50"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Know About MID</h2>
                  <motion.button
                    onClick={() => setShowKnowMIDModal(false)}
                    className="text-gray-700 hover:text-gray-900 p-3 rounded-full bg-white/50 hover:bg-white/70 shadow-md"
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <X size={24} />
                  </motion.button>
                </div>
                <p className="text-base font-medium text-gray-800">Details about Meed Internal Dynamics (to be implemented).</p>
              </motion.div>
            </motion.div>
          )}
          {showMSPRModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 flex items-center justify-center p-6 z-50 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-white/90 backdrop-blur-lg rounded-3xl shadow-2xl p-8 w-full max-w-5xl max-h-[85vh] overflow-y-auto border border-white/50"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">View MSPR</h2>
                  <motion.button
                    onClick={() => setShowMSPRModal(false)}
                    className="text-gray-700 hover:text-gray-900 p-3 rounded-full bg-white/50 hover:bg-white/70 shadow-md"
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <X size={24} />
                  </motion.button>
                </div>
                <p className="text-base font-medium text-gray-800">Meed School Program details.</p>
              </motion.div>
            </motion.div>
          )}
          {showMHCPModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 flex items-center justify-center p-6 z-50 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-white/90 backdrop-blur-lg rounded-3xl shadow-2xl p-8 w-full max-w-5xl max-h-[85vh] overflow-y-auto border border-white/50"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">View MHCP</h2>
                  <motion.button
                    onClick={() => setShowMHCPModal(false)}
                    className="text-gray-700 hover:text-gray-900 p-3 rounded-full bg-white/50 hover:bg-white/70 shadow-md"
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <X size={24} />
                  </motion.button>
                </div>
                <p className="text-base font-medium text-gray-800">Meed Hostel Coaching Program details.</p>
              </motion.div>
            </motion.div>
          )}
          {showCalendarModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 flex items-center justify-center p-6 z-50 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-white/90 backdrop-blur-lg rounded-3xl shadow-2xl p-8 w-full max-w-6xl max-h-[85vh] overflow-y-auto border border-white/50"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">School Calendar</h2>
                  <motion.button
                    onClick={() => setShowCalendarModal(false)}
                    className="text-gray-700 hover:text-gray-900 p-3 rounded-full bg-white/50 hover:bg-white/70 shadow-md"
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <X size={24} />
                  </motion.button>
                </div>
                <ManageCalendar
                  calendar={calendar}
                  loading={isLoadingCalendar}
                  viewOnly={true}
                />
              </motion.div>
            </motion.div>
          )}
          {selectedAnnouncement && ( // ADDED: Modal for announcement details in school notice format
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 flex items-center justify-center p-6 z-50 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-white/90 backdrop-blur-lg rounded-3xl shadow-2xl p-8 w-full max-w-3xl max-h-[85vh] overflow-y-auto border border-white/50"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">School Notice</h2>
                  <motion.button
                    onClick={() => setSelectedAnnouncement(null)}
                    className="text-gray-700 hover:text-gray-900 p-3 rounded-full bg-white/50 hover:bg-white/70 shadow-md"
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <X size={24} />
                  </motion.button>
                </div>
                <div className="border-2 border-gray-300 p-6 rounded-lg bg-white shadow-inner">
                  <div className="text-center mb-4">
                    <h3 className="text-xl font-bold uppercase">Notice</h3>
                    <p className="text-sm text-gray-600">Date: {new Date(selectedAnnouncement.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="mb-4">
                    <p className="font-bold">Subject: {selectedAnnouncement.subject}</p>
                    <p className="text-sm text-gray-600">Program: {selectedAnnouncement.program} | Target: {selectedAnnouncement.target}</p>
                  </div>
                  <div className="mb-4">
                    <p>{selectedAnnouncement.content}</p>
                  </div>
                  {selectedAnnouncement.attachments.length > 0 && (
                    <div className="mb-4">
                      <p className="font-bold">Attachments:</p>
                      <ul className="list-disc pl-5">
                        {selectedAnnouncement.attachments.map((url, index) => (
                          <li key={index}>
                            <a href={url} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">
                              {url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="text-right mt-6">
                    <p className="font-bold">Posted by: {selectedAnnouncement.createdByName}</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}