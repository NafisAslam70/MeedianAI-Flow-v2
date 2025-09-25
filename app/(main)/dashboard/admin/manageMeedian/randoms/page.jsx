"use client";

import { useState } from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import { Loader2, Sparkles, Check, X, Eye, EyeOff, Lock } from "lucide-react";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });

export default function RandomsPage() {
  const { data, error, mutate, isLoading } = useSWR("/api/admin/manageMeedian/randoms", fetcher);
  const [feedback, setFeedback] = useState(null);
  const [isSavingBypass, setIsSavingBypass] = useState(false);
  const [isSavingIpr, setIsSavingIpr] = useState(false);
  const [isSavingWait, setIsSavingWait] = useState(false);

  const showDayCloseBypass = data?.showDayCloseBypass ?? false;
  const showIprJourney = data?.showIprJourney ?? true;
  const dayCloseWaitCompulsory = data?.dayCloseWaitCompulsory ?? false;

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
      </div>
    </div>
  );
}
