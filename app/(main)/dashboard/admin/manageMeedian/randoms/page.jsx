"use client";

import { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import { Loader2, Sparkles, Check, X, Eye, EyeOff, Lock, Smartphone, FileText } from "lucide-react";
import { useSession } from "next-auth/react";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });

export default function RandomsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const { data, error, mutate, isLoading } = useSWR("/api/admin/manageMeedian/randoms", fetcher);
  const [feedback, setFeedback] = useState(null);
  const [isSavingBypass, setIsSavingBypass] = useState(false);
  const [isSavingIpr, setIsSavingIpr] = useState(false);
  const [isSavingWaitFs, setIsSavingWaitFs] = useState(false);
  const [isSavingWait, setIsSavingWait] = useState(false);
  const [isSavingMobileBlock, setIsSavingMobileBlock] = useState(false);
  const [isSavingRoutineLogAll, setIsSavingRoutineLogAll] = useState(false);
  const [isSavingRoutineLogTeachers, setIsSavingRoutineLogTeachers] = useState(false);
  const [isSavingRoutineLogNonTeachers, setIsSavingRoutineLogNonTeachers] = useState(false);
  const [isSavingChatMuteAdmins, setIsSavingChatMuteAdmins] = useState(false);
  const [isSavingChatMuteManagers, setIsSavingChatMuteManagers] = useState(false);
  const [isSavingChatMuteMembers, setIsSavingChatMuteMembers] = useState(false);
  const [isSavingLeaveProof, setIsSavingLeaveProof] = useState(false);
  const [isSavingLeaveNotice, setIsSavingLeaveNotice] = useState(false);

  const showDayCloseBypass = data?.showDayCloseBypass ?? false;
  const showIprJourney = data?.showIprJourney ?? true;
  const dayCloseWaitCompulsory = data?.dayCloseWaitCompulsory ?? false;
  const dayCloseWaitFullscreen = data?.dayCloseWaitFullscreen ?? false;
  const blockMobileDayClose = data?.blockMobileDayClose ?? false;
  const routineLogRequiredAll = data?.routineLogRequiredAll ?? false;
  const routineLogRequiredTeachers = data?.routineLogRequiredTeachers ?? false;
  const routineLogRequiredNonTeachers = data?.routineLogRequiredNonTeachers ?? false;
  const routineLogRequiredMemberIds = Array.isArray(data?.routineLogRequiredMemberIds)
    ? data.routineLogRequiredMemberIds
    : [];
  const chatMuteAllowAdmins = data?.chatMuteAllowAdmins ?? true;
  const chatMuteAllowManagers = data?.chatMuteAllowManagers ?? true;
  const chatMuteAllowMembers = data?.chatMuteAllowMembers ?? true;
  const leaveProofRequired = data?.leaveProofRequired ?? false;
  const leaveNoticeAnytime = data?.leaveNoticeAnytime ?? false;
  const leaveNoticeOneDay = data?.leaveNoticeOneDay ?? false;
  const leaveNoticePolicy = leaveNoticeAnytime ? "anytime" : leaveNoticeOneDay ? "one_day" : "two_days";

  const updateFlag = async ({ payload, setSaving, successMessage }) => {
    if (setSaving) setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/manageMeedian/randoms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Failed to update flag");
      }
      await mutate();
      if (successMessage) {
        setFeedback({ type: "success", text: successMessage });
      }
    } catch (err) {
      setFeedback({ type: "error", text: err.message || "Failed to update." });
    } finally {
      if (setSaving) setSaving(false);
    }
  };

  const handleToggleBypass = () => {
    if (isSavingBypass) return;
    const nextValue = !showDayCloseBypass;
    updateFlag({
      payload: { showDayCloseBypass: nextValue },
      setSaving: setIsSavingBypass,
      successMessage: nextValue ? "Day Close bypass enabled." : "Day Close bypass hidden.",
    });
  };

  const handleToggleIpr = () => {
    if (isSavingIpr) return;
    const nextValue = !showIprJourney;
    updateFlag({
      payload: { showIprJourney: nextValue },
      setSaving: setIsSavingIpr,
      successMessage: nextValue
        ? "IPR section is now visible to members."
        : "IPR section hidden. Members will see the encouragement message instead.",
    });
  };

  const handleToggleWait = () => {
    if (isSavingWait) return;
    const nextValue = !dayCloseWaitCompulsory;
    updateFlag({
      payload: { dayCloseWaitCompulsory: nextValue },
      setSaving: setIsSavingWait,
      successMessage: nextValue
        ? "Navbar will be blocked during Day Close approval wait."
        : "Navbar will no longer be blocked during Day Close wait.",
    });
  };

  const handleToggleWaitFs = () => {
    if (isSavingWaitFs) return;
    const nextValue = !dayCloseWaitFullscreen;
    updateFlag({
      payload: { dayCloseWaitFullscreen: nextValue },
      setSaving: setIsSavingWaitFs,
      successMessage: nextValue
        ? "Full-screen lock during Day Close wait is ON."
        : "Full-screen lock is OFF.",
    });
  };

  const handleToggleMobileBlock = () => {
    if (isSavingMobileBlock) return;
    const nextValue = !blockMobileDayClose;
    updateFlag({
      payload: { blockMobileDayClose: nextValue },
      setSaving: setIsSavingMobileBlock,
      successMessage: nextValue
        ? "Members must use desktop to close their day."
        : "Mobile Day Close submissions are allowed again.",
    });
  };

  const handleToggleRoutineLogAll = () => {
    if (isSavingRoutineLogAll) return;
    const nextValue = !routineLogRequiredAll;
    updateFlag({
      payload: { routineLogRequiredAll: nextValue },
      setSaving: setIsSavingRoutineLogAll,
      successMessage: nextValue
        ? "Routine log is mandatory for everyone."
        : "Routine log is no longer mandatory for everyone.",
    });
  };

  const handleToggleRoutineLogTeachers = () => {
    if (isSavingRoutineLogTeachers) return;
    const nextValue = !routineLogRequiredTeachers;
    updateFlag({
      payload: { routineLogRequiredTeachers: nextValue },
      setSaving: setIsSavingRoutineLogTeachers,
      successMessage: nextValue
        ? "Routine log is mandatory for teachers."
        : "Routine log is no longer mandatory for teachers.",
    });
  };

  const handleToggleRoutineLogNonTeachers = () => {
    if (isSavingRoutineLogNonTeachers) return;
    const nextValue = !routineLogRequiredNonTeachers;
    updateFlag({
      payload: { routineLogRequiredNonTeachers: nextValue },
      setSaving: setIsSavingRoutineLogNonTeachers,
      successMessage: nextValue
        ? "Routine log is mandatory for non-teachers."
        : "Routine log is no longer mandatory for non-teachers.",
    });
  };

  const { data: teamData } = useSWR("/api/admin/manageMeedian?section=team", fetcher);
  const [routineMemberSearch, setRoutineMemberSearch] = useState("");
  const [selectedRoutineMemberIds, setSelectedRoutineMemberIds] = useState([]);

  useEffect(() => {
    const incoming = Array.isArray(routineLogRequiredMemberIds) ? routineLogRequiredMemberIds : [];
    setSelectedRoutineMemberIds((prev) => {
      const prevSorted = [...prev].sort((a, b) => a - b);
      const nextSorted = [...incoming].sort((a, b) => a - b);
      if (prevSorted.length === nextSorted.length && prevSorted.every((v, i) => v === nextSorted[i])) {
        return prev;
      }
      return incoming;
    });
  }, [routineLogRequiredMemberIds]);

  const routineMemberOptions = useMemo(() => {
    const rows = Array.isArray(teamData?.users) ? teamData.users : [];
    const q = routineMemberSearch.trim().toLowerCase();
    return rows
      .filter((m) => {
        if (!q) return true;
        return (
          String(m.id || "").includes(q) ||
          String(m.name || "").toLowerCase().includes(q) ||
          String(m.email || "").toLowerCase().includes(q)
        );
      })
      .slice()
      .sort((a, b) => (a.name || "").localeCompare(b.name || "") || a.id - b.id);
  }, [teamData, routineMemberSearch]);

  const handleSaveRoutineMemberIds = () => {
    updateFlag({
      payload: { routineLogRequiredMemberIds: selectedRoutineMemberIds },
      successMessage: "Routine log roster updated.",
    });
  };

  const handleToggleChatMuteAdmins = () => {
    if (!isAdmin) {
      setFeedback({ type: "error", text: "Only admins can update chat mute permissions." });
      return;
    }
    if (isSavingChatMuteAdmins) return;
    const nextValue = !chatMuteAllowAdmins;
    updateFlag({
      payload: { chatMuteAllowAdmins: nextValue },
      setSaving: setIsSavingChatMuteAdmins,
      successMessage: nextValue
        ? "Admins can mute chat notification sounds."
        : "Admins will always hear chat notification sounds.",
    });
  };

  const handleToggleChatMuteManagers = () => {
    if (!isAdmin) {
      setFeedback({ type: "error", text: "Only admins can update chat mute permissions." });
      return;
    }
    if (isSavingChatMuteManagers) return;
    const nextValue = !chatMuteAllowManagers;
    updateFlag({
      payload: { chatMuteAllowManagers: nextValue },
      setSaving: setIsSavingChatMuteManagers,
      successMessage: nextValue
        ? "Team Managers can mute chat notification sounds."
        : "Team Managers will always hear chat notification sounds.",
    });
  };

  const handleToggleChatMuteMembers = () => {
    if (!isAdmin) {
      setFeedback({ type: "error", text: "Only admins can update chat mute permissions." });
      return;
    }
    if (isSavingChatMuteMembers) return;
    const nextValue = !chatMuteAllowMembers;
    updateFlag({
      payload: { chatMuteAllowMembers: nextValue },
      setSaving: setIsSavingChatMuteMembers,
      successMessage: nextValue
        ? "Members can mute chat notification sounds."
        : "Members will always hear chat notification sounds.",
    });
  };

  const handleToggleLeaveProof = () => {
    if (isSavingLeaveProof) return;
    const nextValue = !leaveProofRequired;
    updateFlag({
      payload: { leaveProofRequired: nextValue },
      setSaving: setIsSavingLeaveProof,
      successMessage: nextValue
        ? "Supporting documents are now mandatory for new leave requests."
        : "Supporting documents are optional again for leave requests.",
    });
  };

  const handleLeaveNoticeChange = (event) => {
    if (isSavingLeaveNotice) return;
    const value = event.target.value;
    const nextAnytime = value === "anytime";
    const nextOneDay = value === "one_day";
    updateFlag({
      payload: { leaveNoticeAnytime: nextAnytime, leaveNoticeOneDay: nextOneDay },
      setSaving: setIsSavingLeaveNotice,
      successMessage: "Leave advance notice rule updated.",
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Sparkles className="w-6 h-6 text-teal-600" />
        <h1 className="text-2xl font-bold text-gray-800">Randoms Lab</h1>
      </div>
      <p className="text-sm text-gray-600 max-w-2xl">
        Experimental toggles that help us pilot odd features. Flip them thoughtfully; these settings update instantly for everyone.
      </p>

      <div className="max-w-xl rounded-2xl border border-teal-100 bg-white/90 shadow-sm p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Show Day Close Bypass</h2>
            <p className="text-sm text-gray-600">
              When enabled, members will see the <em>Bypass Close (Test)</em> button on the Day Close page. Disable to hide the button and enforced window check.
            </p>
          </div>
          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleToggleBypass}
            disabled={isLoading || isSavingBypass}
            className={`relative inline-flex h-9 w-16 items-center rounded-full border transition-colors duration-200 ${
              showDayCloseBypass ? "bg-teal-500 border-teal-500" : "bg-gray-200 border-gray-300"
            } ${isSavingBypass ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
            aria-pressed={showDayCloseBypass}
          >
            <span
              className={`ml-1 inline-flex h-7 w-7 transform items-center justify-center rounded-full bg-white shadow transition-transform duration-200 ${
                showDayCloseBypass ? "translate-x-7" : "translate-x-0"
              }`}
            >
              {isSavingBypass ? (
                <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
              ) : showDayCloseBypass ? (
                <Check className="h-4 w-4 text-teal-600" />
              ) : (
                <X className="h-4 w-4 text-gray-500" />
              )}
            </span>
          </motion.button>
        </div>
        <div className="text-sm text-gray-500">
          Status: {isLoading ? "Loading…" : showDayCloseBypass ? "Bypass button is visible to members." : "Bypass button is hidden."}
        </div>
      </div>

      <div className="max-w-xl rounded-2xl border border-indigo-100 bg-white/90 shadow-sm p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Show IPR Section</h2>
            <p className="text-sm text-gray-600">
              Controls the <em>Your IPR</em> card on the member Day Close page. Disable it to hide the scores and show an encouragement message with ticket guidance instead.
            </p>
          </div>
          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleToggleIpr}
            disabled={isLoading || isSavingIpr}
            className={`relative inline-flex h-9 w-16 items-center rounded-full border transition-colors duration-200 ${
              showIprJourney ? "bg-indigo-500 border-indigo-500" : "bg-gray-200 border-gray-300"
            } ${isSavingIpr ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
            aria-pressed={showIprJourney}
          >
            <span
              className={`ml-1 inline-flex h-7 w-7 transform items-center justify-center rounded-full bg-white shadow transition-transform duration-200 ${
                showIprJourney ? "translate-x-7" : "translate-x-0"
              }`}
            >
              {isSavingIpr ? (
                <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
              ) : showIprJourney ? (
                <Eye className="h-4 w-4 text-indigo-600" />
              ) : (
                <EyeOff className="h-4 w-4 text-gray-500" />
              )}
            </span>
          </motion.button>
        </div>
        <div className="text-sm text-gray-500">
          Status: {isLoading ? "Loading…" : showIprJourney ? "IPR card is visible to members." : "IPR card is hidden behind the encouragement message."}
        </div>
        {feedback && (
          <div
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              feedback.type === "success" ? "bg-teal-50 text-teal-700" : "bg-red-50 text-red-600"
            }`}
          >
            {feedback.text}
          </div>
        )}
        {error && !feedback && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
            Failed to load current value. Try refreshing.
          </div>
        )}
      </div>

      <div className="max-w-xl rounded-2xl border border-amber-100 bg-white/90 shadow-sm p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Require Leave Evidence</h2>
            <p className="text-sm text-gray-600">
              Force members to attach supporting documents whenever they request leave. Disable to return to optional uploads.
            </p>
          </div>
          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleToggleLeaveProof}
            disabled={isLoading || isSavingLeaveProof}
            className={`relative inline-flex h-9 w-16 items-center rounded-full border transition-colors duration-200 ${
              leaveProofRequired ? "bg-amber-500 border-amber-500" : "bg-gray-200 border-gray-300"
            } ${isSavingLeaveProof ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
            aria-pressed={leaveProofRequired}
          >
            <span
              className={`ml-1 inline-flex h-7 w-7 transform items-center justify-center rounded-full bg-white shadow transition-transform duration-200 ${
                leaveProofRequired ? "translate-x-7" : "translate-x-0"
              }`}
            >
              {isSavingLeaveProof ? (
                <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
              ) : leaveProofRequired ? (
                <FileText className="h-4 w-4 text-amber-600" />
              ) : (
                <X className="h-4 w-4 text-gray-500" />
              )}
            </span>
          </motion.button>
        </div>
        <div className="text-sm text-gray-500">
          Status:{" "}
          {isLoading
            ? "Loading…"
            : leaveProofRequired
            ? "Evidence upload is mandatory for new leave submissions."
            : "Members can submit leave without uploading evidence."}
        </div>
      </div>

      <div className="max-w-xl rounded-2xl border border-emerald-100 bg-white/90 shadow-sm p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Leave Advance Notice</h2>
            <p className="text-sm text-gray-600">
              Choose how early members must apply for non-health leave. Health leave stays same-day or next-day only.
            </p>
          </div>
          <div className="min-w-[190px]">
            <select
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
              value={leaveNoticePolicy}
              onChange={handleLeaveNoticeChange}
              disabled={isLoading || isSavingLeaveNotice}
            >
              <option value="two_days">Apply 2 days before</option>
              <option value="one_day">Apply 1 day before</option>
              <option value="anytime">Allow anytime</option>
            </select>
          </div>
        </div>
        <div className="text-sm text-gray-500">
          Status:{" "}
          {isLoading
            ? "Loading…"
            : leaveNoticePolicy === "anytime"
            ? "Members can apply for leave anytime."
            : leaveNoticePolicy === "one_day"
            ? "Members must apply at least 1 day in advance."
            : "Members must apply at least 2 days in advance."}
        </div>
      </div>

      <div className="max-w-xl rounded-2xl border border-rose-100 bg-white/90 shadow-sm p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Day Close Wait Compulsory</h2>
            <p className="text-sm text-gray-600">
              When enabled, the navbar is blocked while a member’s Day Close request is pending approval. Prevents navigating away until approved or rejected.
            </p>
          </div>
          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleToggleWait}
            disabled={isLoading || isSavingWait}
            className={`relative inline-flex h-9 w-16 items-center rounded-full border transition-colors duration-200 ${
              dayCloseWaitCompulsory ? "bg-rose-500 border-rose-500" : "bg-gray-200 border-gray-300"
            } ${isSavingWait ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
            aria-pressed={dayCloseWaitCompulsory}
          >
            <span
              className={`ml-1 inline-flex h-7 w-7 transform items-center justify-center rounded-full bg-white shadow transition-transform duration-200 ${
                dayCloseWaitCompulsory ? "translate-x-7" : "translate-x-0"
              }`}
            >
              {isSavingWait ? (
                <Loader2 className="h-4 w-4 animate-spin text-rose-600" />
              ) : dayCloseWaitCompulsory ? (
                <Lock className="h-4 w-4 text-rose-600" />
              ) : (
                <X className="h-4 w-4 text-gray-500" />
              )}
            </span>
          </motion.button>
        </div>
        <div className="text-sm text-gray-500">
          Status: {isLoading ? "Loading…" : dayCloseWaitCompulsory ? "Navbar blocking during Day Close wait is ON." : "Navbar blocking is OFF."}
        </div>
        <div className="flex items-start justify-between gap-4 pt-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Full-screen Lock (Level 2)</h3>
            <p className="text-xs text-gray-600">Blocks interaction across the entire app. Also warns before closing the tab.</p>
          </div>
          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleToggleWaitFs}
            disabled={isLoading || isSavingWaitFs}
            className={`relative inline-flex h-7 w-14 items-center rounded-full border transition-colors duration-200 ${
              dayCloseWaitFullscreen ? "bg-rose-500 border-rose-500" : "bg-gray-200 border-gray-300"
            } ${isSavingWaitFs ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
            aria-pressed={dayCloseWaitFullscreen}
          >
            <span
              className={`ml-1 inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-white shadow transition-transform duration-200 ${
                dayCloseWaitFullscreen ? "translate-x-7" : "translate-x-0"
              }`}
            >
              {isSavingWaitFs ? (
                <Loader2 className="h-4 w-4 animate-spin text-rose-600" />
              ) : dayCloseWaitFullscreen ? (
                <Lock className="h-4 w-4 text-rose-600" />
              ) : (
                <X className="h-4 w-4 text-gray-500" />
              )}
            </span>
          </motion.button>
      </div>
    </div>

      <div className="max-w-xl rounded-2xl border border-cyan-100 bg-white/90 shadow-sm p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Chatbox Mute Permissions</h2>
          <p className="text-sm text-gray-600">
            Choose which roles can silence the chat notification sound. Others will continue to hear alerts for new messages.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-800">Admins</h3>
              <p className="text-xs text-gray-500">Show or hide the mute toggle for admins.</p>
            </div>
            <motion.button
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleToggleChatMuteAdmins}
              disabled={isLoading || isSavingChatMuteAdmins || !isAdmin}
              className={`relative inline-flex h-8 w-14 items-center rounded-full border transition-colors duration-200 ${
                chatMuteAllowAdmins ? "bg-cyan-500 border-cyan-500" : "bg-gray-200 border-gray-300"
              } ${isSavingChatMuteAdmins || !isAdmin ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
              aria-pressed={chatMuteAllowAdmins}
            >
              <span
                className={`ml-1 inline-flex h-6 w-6 transform items-center justify-center rounded-full bg-white shadow transition-transform duration-200 ${
                  chatMuteAllowAdmins ? "translate-x-6" : "translate-x-0"
                }`}
              >
                {isSavingChatMuteAdmins ? (
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-600" />
                ) : chatMuteAllowAdmins ? (
                  <Check className="h-4 w-4 text-cyan-600" />
                ) : (
                  <X className="h-4 w-4 text-gray-500" />
                )}
              </span>
            </motion.button>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-800">Team Managers</h3>
              <p className="text-xs text-gray-500">Let managers mute chat audio during busy shifts.</p>
            </div>
            <motion.button
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleToggleChatMuteManagers}
              disabled={isLoading || isSavingChatMuteManagers || !isAdmin}
              className={`relative inline-flex h-8 w-14 items-center rounded-full border transition-colors duration-200 ${
                chatMuteAllowManagers ? "bg-cyan-500 border-cyan-500" : "bg-gray-200 border-gray-300"
              } ${isSavingChatMuteManagers || !isAdmin ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
              aria-pressed={chatMuteAllowManagers}
            >
              <span
                className={`ml-1 inline-flex h-6 w-6 transform items-center justify-center rounded-full bg-white shadow transition-transform duration-200 ${
                  chatMuteAllowManagers ? "translate-x-6" : "translate-x-0"
                }`}
              >
                {isSavingChatMuteManagers ? (
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-600" />
                ) : chatMuteAllowManagers ? (
                  <Check className="h-4 w-4 text-cyan-600" />
                ) : (
                  <X className="h-4 w-4 text-gray-500" />
                )}
              </span>
            </motion.button>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-800">Members</h3>
              <p className="text-xs text-gray-500">Keep the mute option available for members who need quiet focus.</p>
            </div>
            <motion.button
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleToggleChatMuteMembers}
              disabled={isLoading || isSavingChatMuteMembers || !isAdmin}
              className={`relative inline-flex h-8 w-14 items-center rounded-full border transition-colors duration-200 ${
                chatMuteAllowMembers ? "bg-cyan-500 border-cyan-500" : "bg-gray-200 border-gray-300"
              } ${isSavingChatMuteMembers || !isAdmin ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
              aria-pressed={chatMuteAllowMembers}
            >
              <span
                className={`ml-1 inline-flex h-6 w-6 transform items-center justify-center rounded-full bg-white shadow transition-transform duration-200 ${
                  chatMuteAllowMembers ? "translate-x-6" : "translate-x-0"
                }`}
              >
                {isSavingChatMuteMembers ? (
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-600" />
                ) : chatMuteAllowMembers ? (
                  <Check className="h-4 w-4 text-cyan-600" />
                ) : (
                  <X className="h-4 w-4 text-gray-500" />
                )}
              </span>
            </motion.button>
          </div>
        </div>

        <div className="text-sm text-gray-500">
          Status: {isLoading
            ? "Loading…"
            : `Admins ${chatMuteAllowAdmins ? "can" : "cannot"} mute · Managers ${
                chatMuteAllowManagers ? "can" : "cannot"
              } mute · Members ${chatMuteAllowMembers ? "can" : "cannot"} mute.`}
        </div>
        {!isAdmin && (
          <p className="text-xs text-gray-500">
            Only admins can change these permissions.
          </p>
        )}
      </div>

      <div className="max-w-xl rounded-2xl border border-amber-100 bg-white/90 shadow-sm p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Block Mobile Day Close</h2>
            <p className="text-sm text-gray-600">
              Forces members to complete Day Close from a desktop browser. Phones and tablets will see guidance to switch devices.
            </p>
          </div>
          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleToggleMobileBlock}
            disabled={isLoading || isSavingMobileBlock}
            className={`relative inline-flex h-9 w-16 items-center rounded-full border transition-colors duration-200 ${
              blockMobileDayClose ? "bg-amber-500 border-amber-500" : "bg-gray-200 border-gray-300"
            } ${isSavingMobileBlock ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
            aria-pressed={blockMobileDayClose}
          >
            <span
              className={`ml-1 inline-flex h-7 w-7 transform items-center justify-center rounded-full bg-white shadow transition-transform duration-200 ${
                blockMobileDayClose ? "translate-x-7" : "translate-x-0"
              }`}
            >
              {isSavingMobileBlock ? (
                <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
              ) : (
                <Smartphone className={`h-4 w-4 ${blockMobileDayClose ? "text-amber-600" : "text-gray-500"}`} />
              )}
            </span>
          </motion.button>
        </div>
        <div className="text-sm text-gray-500">
          Status: {isLoading ? "Loading…" : blockMobileDayClose ? "Mobile submissions are blocked." : "Members can submit Day Close on mobile."}
        </div>
      </div>

      <div className="max-w-xl rounded-2xl border border-rose-100 bg-white/90 shadow-sm p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Routine Log Required</h2>
            <p className="text-sm text-gray-600">
              Make the Routine Tasks log compulsory during Day Close. Choose who must fill it.
            </p>
          </div>
          <FileText className="w-5 h-5 text-rose-500" />
        </div>
        <div className="space-y-3">
          {[
            {
              key: "all",
              label: "All members",
              value: routineLogRequiredAll,
              onToggle: handleToggleRoutineLogAll,
              saving: isSavingRoutineLogAll,
            },
            {
              key: "teachers",
              label: "Teachers only",
              value: routineLogRequiredTeachers,
              onToggle: handleToggleRoutineLogTeachers,
              saving: isSavingRoutineLogTeachers,
            },
            {
              key: "non_teachers",
              label: "Non-teachers only",
              value: routineLogRequiredNonTeachers,
              onToggle: handleToggleRoutineLogNonTeachers,
              saving: isSavingRoutineLogNonTeachers,
            },
          ].map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-4">
              <span className="text-sm text-gray-700">{row.label}</span>
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={row.onToggle}
                disabled={isLoading || row.saving}
                className={`relative inline-flex h-9 w-16 items-center rounded-full border transition-colors duration-200 ${
                  row.value ? "bg-rose-500 border-rose-500" : "bg-gray-200 border-gray-300"
                } ${row.saving ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
                aria-pressed={row.value}
              >
                <span
                  className={`ml-1 inline-flex h-7 w-7 transform items-center justify-center rounded-full bg-white shadow transition-transform duration-200 ${
                    row.value ? "translate-x-7" : "translate-x-0"
                  }`}
                >
                  {row.saving ? (
                    <Loader2 className="h-4 w-4 animate-spin text-rose-600" />
                  ) : row.value ? (
                    <Check className="h-4 w-4 text-rose-600" />
                  ) : (
                    <X className="h-4 w-4 text-gray-500" />
                  )}
                </span>
              </motion.button>
            </div>
          ))}
        </div>
        <div className="mt-4 border-t border-rose-100 pt-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-700">Specific members</span>
            <span className="text-xs text-gray-500">{selectedRoutineMemberIds.length} selected</span>
          </div>
          <div className="flex gap-2">
            <input
              value={routineMemberSearch}
              onChange={(e) => setRoutineMemberSearch(e.target.value)}
              placeholder="Search by name or ID"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
            />
            <button
              type="button"
              className="px-3 py-2 rounded-lg bg-rose-100 text-xs text-rose-700"
              onClick={handleSaveRoutineMemberIds}
            >
              Save roster
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white">
            {routineMemberOptions.length === 0 ? (
              <div className="text-xs text-gray-500 px-3 py-2">No team data loaded.</div>
            ) : (
              routineMemberOptions.map((m) => {
                const checked = selectedRoutineMemberIds.includes(m.id);
                return (
                  <label
                    key={m.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-sm border-b border-gray-100 last:border-b-0"
                  >
                    <span className="flex flex-col">
                      <span className="font-medium text-gray-900">{m.name || `User #${m.id}`}</span>
                      <span className="text-xs text-gray-500">
                        #{m.id} {m.isTeacher ? "• Teacher" : ""}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-rose-600"
                      checked={checked}
                      onChange={() => {
                        setSelectedRoutineMemberIds((prev) =>
                          checked ? prev.filter((x) => x !== m.id) : [...prev, m.id]
                        );
                      }}
                    />
                  </label>
                );
              })
            )}
          </div>
          <p className="text-xs text-gray-500">Selected members are added on top of any group rules above.</p>
        </div>
        <div className="text-sm text-gray-500">
          Status: {isLoading
            ? "Loading…"
            : routineLogRequiredAll
            ? "Mandatory for everyone."
            : routineLogRequiredTeachers || routineLogRequiredNonTeachers
            ? `Mandatory for ${routineLogRequiredTeachers ? "teachers" : ""}${routineLogRequiredTeachers && routineLogRequiredNonTeachers ? " and " : ""}${routineLogRequiredNonTeachers ? "non-teachers" : ""}.`
            : "Optional for all."}
        </div>
      </div>
    </div>
  );
}
