"use client";

import { useState } from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import { Loader2, Sparkles, Check, X } from "lucide-react";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });

export default function RandomsPage() {
  const { data, error, mutate, isLoading } = useSWR("/api/admin/manageMeedian/randoms", fetcher);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const showDayCloseBypass = data?.showDayCloseBypass ?? false;

  const handleToggleBypass = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setFeedback(null);
    try {
      const nextValue = !showDayCloseBypass;
      const res = await fetch("/api/admin/manageMeedian/randoms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showDayCloseBypass: nextValue }),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Failed to update flag");
      }
      await mutate();
      setFeedback({ type: "success", text: nextValue ? "Day Close bypass enabled." : "Day Close bypass hidden." });
    } catch (err) {
      setFeedback({ type: "error", text: err.message || "Failed to update." });
    } finally {
      setIsSaving(false);
    }
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
            disabled={isLoading || isSaving}
            className={`relative inline-flex h-9 w-16 items-center rounded-full border transition-colors duration-200 ${
              showDayCloseBypass ? "bg-teal-500 border-teal-500" : "bg-gray-200 border-gray-300"
            } ${isSaving ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
            aria-pressed={showDayCloseBypass}
          >
            <span
              className={`ml-1 inline-flex h-7 w-7 transform items-center justify-center rounded-full bg-white shadow transition-transform duration-200 ${
                showDayCloseBypass ? "translate-x-7" : "translate-x-0"
              }`}
            >
              {isSaving ? (
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
    </div>
  );
}
