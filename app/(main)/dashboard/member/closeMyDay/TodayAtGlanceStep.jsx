"use client";

import { useMemo, useState } from "react";
import { format, parseISO, addDays } from "date-fns";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Award, Clock, Activity, AlertCircle, BookOpen, X, Sparkles } from "lucide-react";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  });

const METRIC_ORDER = [
  { key: "punctuality", label: "Punctuality" },
  { key: "academics", label: "Academics" },
  { key: "obedienceDiscipline", label: "Obedience & Discipline" },
  { key: "languagePersonality", label: "Language & Personality" },
  { key: "willSkill", label: "Will-Skill Level" },
];

function formatTimeString(timeStr) {
  if (!timeStr) return "--";
  const [h = "0", m = "0", s = "0"] = timeStr.split(":");
  const date = new Date();
  date.setHours(Number(h), Number(m), Number(s), 0);
  try {
    return format(date, "hh:mm a");
  } catch {
    return timeStr;
  }
}

function formatDateTime(value) {
  if (!value) return "--";
  try {
    return format(parseISO(value), "hh:mm a");
  } catch {
    return value;
  }
}

export default function TodayAtGlanceStep({ handleNextStep, handlePrevStep, showIprJourney = true }) {
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [showJourneyModal, setShowJourneyModal] = useState(false);
  const selectedIso = useMemo(() => format(selectedDate, "yyyy-MM-dd"), [selectedDate]);

  const shouldFetchIpr = showIprJourney !== false;
  const { data: iprData, isLoading: isLoadingIpr, error: iprError } = useSWR(
    shouldFetchIpr ? `/api/member/ipr?date=${selectedIso}` : null,
    fetcher
  );

  const { data: journalData, isLoading: isLoadingJournal, error: journalError } = useSWR(
    `/api/member/meRightNow/journal?date=${selectedIso}`,
    fetcher
  );

  const { data: openCloseData } = useSWR(
    `/api/member/dayOpenClose/history?from=${selectedIso}&to=${selectedIso}&type=both`,
    fetcher
  );

  const ipr = iprData?.ipr || null;
  const sessions = Array.isArray(journalData?.sessions) ? journalData.sessions : [];
  const openCloseEntry = Array.isArray(openCloseData?.history) ? openCloseData.history[0] : null;

  const openTime = openCloseEntry?.openedAt ? formatTimeString(openCloseEntry.openedAt) : "Not recorded";
  const recordedCloseTime = openCloseEntry?.closedAt ? formatTimeString(openCloseEntry.closedAt) : null;
  const closingNow = format(new Date(), "hh:mm a");

  const groupedSessions = useMemo(() => {
    const summary = new Map();
    sessions.forEach((session) => {
      const key = session.type || "other";
      const prev = summary.get(key) || { count: 0, durationMinutes: 0 };
      const started = session.startedAt ? new Date(session.startedAt) : null;
      const ended = session.endedAt ? new Date(session.endedAt) : null;
      let minutes = 0;
      if (started && ended && !Number.isNaN(started.getTime()) && !Number.isNaN(ended.getTime())) {
        minutes = Math.max(0, Math.round((ended.getTime() - started.getTime()) / 60000));
      }
      summary.set(key, {
        count: prev.count + 1,
        durationMinutes: prev.durationMinutes + minutes,
      });
    });
    return Array.from(summary.entries()).map(([key, stats]) => ({
      type: key,
      count: stats.count,
      durationMinutes: stats.durationMinutes,
    }));
  }, [sessions]);

  const sessionTypeLabel = (type) => {
    const normalized = String(type || '').toLowerCase();
    switch (normalized) {
      case 'assigned':
        return 'Assigned Tasks';
      case 'routine':
        return 'Routine Tasks';
      case 'mri':
        return 'MRI';
      case 'rmri':
        return 'R-MRI Sessions';
      case 'amri':
        return 'A-MRI Sessions';
      case 'nmri':
        return 'N-MRI Sessions';
      case 'omri':
        return 'O-MRI Sessions';
      default:
        return type ? type.toString().toUpperCase() : 'Other';
    }
  };

  const formatDurationMinutes = (minutes) => {
    if (!minutes) return null;
    if (minutes < 60) return `${minutes} min`;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (!mins) return `${hrs} hr${hrs > 1 ? 's' : ''}`;
    return `${hrs}h ${mins}m`;
  };

  const renderSessionItem = (session) => (
    <div key={session.id || `${session.type}-${session.startedAt}`} className="border border-gray-100 rounded-2xl px-4 py-3 bg-white/90">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-800">{session.itemTitle || "Untitled"}</span>
        <span className="text-xs uppercase tracking-wide text-gray-400">{session.type}</span>
      </div>
      <div className="mt-2 text-xs text-gray-600 flex items-center gap-2">
        <Clock className="w-4 h-4 text-blue-400" />
        <span>
          {formatDateTime(session.startedAt)}
          {session.endedAt ? ` — ${formatDateTime(session.endedAt)}` : " (ongoing)"}
        </span>
      </div>
      {session.note && <p className="mt-2 text-xs text-gray-500">Note: {session.note}</p>}
    </div>
  );

  return (
    <motion.div
      key="today-glance"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-6 transform scale-[0.9] origin-center mx-auto w-full"
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-teal-50/80 border border-teal-100 rounded-3xl p-5">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Today at a Glance</h2>
          <p className="text-sm text-gray-600">Review your Individual Performance Report and MRI journey before submitting the day close.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 rounded-lg bg-white border border-teal-200 text-sm text-teal-700 hover:bg-teal-100"
            onClick={() => setSelectedDate((d) => {
              const prev = addDays(d, -1);
              prev.setHours(0,0,0,0);
              return prev;
            })}
          >
            Previous Day
          </button>
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-teal-800">
              {format(selectedDate, "EEE, MMM d, yyyy")}
            </div>
            <input
              type="date"
              value={selectedIso}
              max={format(new Date(), "yyyy-MM-dd")}
              onChange={(e) => {
                if (!e.target.value) return;
                const next = new Date(e.target.value);
                if (Number.isNaN(next.getTime())) return;
                next.setHours(0,0,0,0);
                const today = new Date();
                today.setHours(0,0,0,0);
                if (next > today) {
                  setSelectedDate(today);
                } else {
                  setSelectedDate(next);
                }
              }}
              className="border border-teal-200 rounded-lg px-3 py-1.5 text-sm text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
          </div>
          <button
            className="px-3 py-1.5 rounded-lg bg-white border border-teal-200 text-sm text-teal-700 hover:bg-teal-100"
            onClick={() => {
              const today = new Date();
              today.setHours(0,0,0,0);
              if (selectedDate < today) {
                const next = addDays(selectedDate, 1);
                next.setHours(0,0,0,0);
                setSelectedDate(next > today ? today : next);
              }
            }}
            disabled={selectedIso === format(new Date(), "yyyy-MM-dd")}
          >
            Next Day
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white/90 border border-teal-100 rounded-2xl px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Day opened at</p>
            <p className="text-lg font-semibold text-teal-700">{openTime}</p>
          </div>
          <div className="bg-white/90 border border-teal-100 rounded-2xl px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Closing now</p>
            <p className="text-lg font-semibold text-teal-700">
              {recordedCloseTime ? `${recordedCloseTime} (recorded)` : `${closingNow} (current)`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <motion.div
          className="bg-white/85 backdrop-blur rounded-3xl border border-teal-100/60 p-6 shadow-md flex flex-col"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <Award className="w-6 h-6 text-amber-500" />
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Your IPR </h3>
              <p className="text-xs text-gray-500">Know how you've been doing as a teacher at Meed.</p>
            </div>
          </div>

          {!showIprJourney ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-gray-600">
              <Sparkles className="w-10 h-10 text-amber-500 mb-3" />
              <p className="text-sm font-medium">
                <b>You&apos;re doing very good, keep going! If any issue, “Raise a ticket”, We're always there to help you. You MATTER to us!</b> 
              </p>
            </div>
          ) : isLoadingIpr ? (
            <div className="flex items-center justify-center py-8 text-teal-600"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : iprError ? (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-xl">
              <AlertCircle className="w-5 h-5" />
              <p className="text-sm">Unable to load IPR. Please try again later.</p>
            </div>
          ) : ipr ? (
            <>
              <div className="flex flex-wrap items-center gap-2 mb-6">
                <motion.span
                  className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 border border-amber-100 px-3 py-1.5 rounded-full text-sm font-semibold"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.25 }}
                >
                  <Activity className="w-4 h-4" />
                  Total Score: {ipr.total}/50
                </motion.span>
                {ipr.evaluator?.name && (
                  <span className="text-xs text-gray-500">Evaluated by {ipr.evaluator.name}</span>
                )}
              </div>

              <div className="space-y-4">
                {METRIC_ORDER.map((metric) => {
                  const value = Number(ipr.metrics?.[metric.key] ?? 0);
                  const percentage = Math.min(100, Math.max(0, (value / 10) * 20)); // convert out of 50 -> 0-100
                  return (
                    <div key={metric.key} className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-gray-700">{metric.label}</span>
                        <span className="text-gray-600 font-semibold">{value}/10</span>
                      </div>
                      <div className="h-2 rounded-full bg-teal-100 overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-teal-500 to-teal-600"
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 0.4, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {ipr.remarks && (
                <div className="mt-6 bg-teal-50/70 border border-teal-100 rounded-2xl p-4 text-sm text-gray-700">
                  <p className="font-semibold text-teal-700 mb-1">Evaluator Remarks</p>
                  <p>{ipr.remarks}</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center text-gray-600">
              <BookOpen className="w-10 h-10 text-teal-500 mb-3" />
              <p className="text-sm font-medium">Your IPR for today will appear once the Team Day Close moderator submits the leaderboard.</p>
            </div>
          )}
        </motion.div>

        <motion.div
          className="bg-white/85 backdrop-blur rounded-3xl border border-teal-100/60 p-6 shadow-md flex flex-col"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-6 h-6 text-blue-500" />
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Your MRI Journey Today</h3>
              <p className="text-xs text-gray-500">Snapshot of Me Right Now sessions logged across the day.</p>
            </div>
          </div>

          {isLoadingJournal ? (
            <div className="flex items-center justify-center py-8 text-blue-600"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : journalError ? (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-xl">
              <AlertCircle className="w-5 h-5" />
              <p className="text-sm">Unable to load MRI sessions.</p>
            </div>
          ) : sessions.length ? (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {groupedSessions.map((item) => (
                  <div key={item.type} className="bg-blue-50/70 border border-blue-100 rounded-2xl px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-blue-500">{sessionTypeLabel(item.type)}</p>
                    <p className="text-sm text-gray-700">{item.count} session{item.count === 1 ? '' : 's'}</p>
                    {item.durationMinutes > 0 && (
                      <p className="text-xs text-gray-500">{formatDurationMinutes(item.durationMinutes)}</p>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <button
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                  onClick={() => setShowJourneyModal(true)}
                >
                  Show full journey
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center text-gray-600">
              <Activity className="w-10 h-10 text-blue-500 mb-3" />
              <p className="text-sm font-medium">No MRI sessions logged yet for today.</p>
            </div>
          )}
        </motion.div>
      </div>

      <div className="flex justify-between mt-4 gap-3">
        {handlePrevStep ? (
          <motion.button
            onClick={handlePrevStep}
            className="bg-gray-200 text-gray-800 px-6 py-3 rounded-xl font-semibold shadow-sm hover:bg-gray-300 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Previous
          </motion.button>
        ) : <span />}
        <motion.button
          onClick={handleNextStep}
          className="bg-teal-600 text-white px-6 py-3 rounded-xl font-semibold shadow-md hover:bg-teal-700 transition-colors"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Continue to General Log
        </motion.button>
      </div>
      <AnimatePresence>
        {showJourneyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setShowJourneyModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="bg-white/95 backdrop-blur-md rounded-3xl shadow-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden border border-blue-100/60"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800">Full MRI Journey – {format(selectedDate, "EEE, MMM d, yyyy")}</h3>
                <motion.button
                  onClick={() => setShowJourneyModal(false)}
                  className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <X size={20} />
                </motion.button>
              </div>
              {sessions.length ? (
                <div className="space-y-3 overflow-auto pr-2 max-h-[60vh]">
                  {sessions.map(renderSessionItem)}
                </div>
              ) : (
                <div className="text-sm text-gray-600">No sessions recorded for this day.</div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
