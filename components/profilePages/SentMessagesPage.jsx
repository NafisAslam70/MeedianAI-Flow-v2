"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AllMessageHistory from "@/components/AllMessageHistory";

export default function SentMessagesPage({ basePath = "/dashboard/team_manager/profile" }) {
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let dead = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/member/sent-messages?mode=custom", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        if (!dead) setMessages(Array.isArray(data?.messages) ? data.messages : []);
      } catch (e) {
        if (!dead) setError(e.message || "Failed to load messages");
      } finally {
        if (!dead) setLoading(false);
      }
    })();
    return () => {
      dead = true;
    };
  }, []);

  return (
    <div className="max-w-5xl mx-auto bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 p-4 md:p-6 shadow-sm min-h-[70vh]">
      <div className="flex items-center justify-end mb-3">
        <button type="button" onClick={() => router.push(basePath)} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-slate-600">
          Back to Profile
        </button>
      </div>
      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : error ? (
        <p className="text-sm text-red-700 bg-red-100 rounded p-2">{error}</p>
      ) : (
        <AllMessageHistory sentMessages={messages} onClose={() => router.push(basePath)} />
      )}
    </div>
  );
}

