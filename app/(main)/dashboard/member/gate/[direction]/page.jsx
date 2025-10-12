"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { ArrowLeft, CheckCircle2, ChevronRight } from "lucide-react";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });

const allowedRoles = new Set(["admin", "team_manager", "member"]);

const formatTime = (value) => {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export default function StaffGateScanPage({ params }) {
  const direction = String(params?.direction || "").toLowerCase();
  const isDirectionValid = direction === "out" || direction === "in";

  const { data: session, status } = useSession();
  const [purpose, setPurpose] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const { data: recentData, mutate } = useSWR(
    status === "authenticated" ? "/api/campus-gate/staff?limit=5" : null,
    fetcher,
    { dedupingInterval: 15000 }
  );

  const recentLogs = recentData?.logs || [];

  useEffect(() => {
    if (direction === "out") {
      setPurpose("");
    }
  }, [direction]);

  if (!isDirectionValid) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-900 text-slate-100">
        <div className="max-w-md rounded-2xl bg-slate-800/80 p-8 text-center shadow-xl">
          <h1 className="text-2xl font-semibold">Invalid gate code</h1>
          <p className="mt-3 text-sm text-slate-300">
            This link is not recognised. Please scan the official Gate IN or Gate OUT QR code provided at the campus entrance.
          </p>
          <Link href="/dashboard/member" className="mt-6 inline-flex items-center text-teal-300 hover:text-teal-200">
            <ChevronRight className="mr-1 h-4 w-4" /> Go to dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-100">
        <div className="text-sm text-slate-300">Checking your session…</div>
      </main>
    );
  }

  if (status !== "authenticated" || !session?.user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-900 text-slate-100">
        <div className="max-w-md rounded-2xl bg-slate-800/80 p-8 text-center shadow-xl">
          <h1 className="text-2xl font-semibold">Sign in required</h1>
          <p className="mt-3 text-sm text-slate-300">Log in with your Meedian account before scanning the gate QR code.</p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link href="/login">
              <Button variant="primary">Go to Login</Button>
            </Link>
            <Link href="/dashboard/member">
              <Button variant="ghost" className="text-slate-200">
                <ArrowLeft className="mr-1 h-4 w-4" /> Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!allowedRoles.has(session.user.role || "")) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-900 text-slate-100">
        <div className="max-w-md rounded-2xl bg-slate-800/80 p-8 text-center shadow-xl">
          <h1 className="text-2xl font-semibold">Access restricted</h1>
          <p className="mt-3 text-sm text-slate-300">
            Gate logging is available only for Meedian team members. Please contact the admin team if you need access.
          </p>
          <Link href="/dashboard/member" className="mt-6 inline-flex items-center text-teal-300 hover:text-teal-200">
            <ChevronRight className="mr-1 h-4 w-4" /> Return to dashboard
          </Link>
        </div>
      </main>
    );
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setError("");
    setFeedback("");

    if (direction === "out" && !purpose.trim()) {
      setError("Add a reason before stepping out of campus.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/campus-gate/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction, purpose }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || `HTTP ${res.status}`);
      setFeedback(direction === "out" ? "Logged OUT — stay safe!" : "Welcome back — logged IN.");
      setPurpose("");
      mutate();
    } catch (err) {
      console.error(err);
      setError(err.message || "Could not log the entry.");
    } finally {
      setSubmitting(false);
      setTimeout(() => setFeedback(""), 3000);
    }
  };

  const heading = direction === "out" ? "Gate OUT" : "Gate IN";
  const helperText =
    direction === "out"
      ? "Tell us why you are stepping out. This note is visible to the admin team."
      : "Tap the button to record your return time.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100">
      <div className="w-full max-w-md rounded-3xl border border-slate-700/60 bg-slate-900/80 p-8 shadow-xl backdrop-blur">
        <div className="flex flex-col gap-6">
          <div>
            <div className="text-xs uppercase tracking-wide text-teal-300">Meedian campus</div>
            <h1 className="mt-1 text-3xl font-semibold text-white">{heading}</h1>
            <p className="mt-2 text-sm text-slate-300">{helperText}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {direction === "out" && (
              <div>
                <label htmlFor="purpose" className="block text-sm font-medium text-slate-200">
                  Reason for stepping out
                </label>
                <textarea
                  id="purpose"
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-800/70 px-3 py-2 text-sm text-slate-100 shadow-inner focus:border-teal-400 focus:outline-none"
                  placeholder="e.g. Parent meeting, medical, admin errand"
                  value={purpose}
                  onChange={(event) => setPurpose(event.target.value)}
                />
              </div>
            )}

            {error && <div className="rounded-xl border border-red-400/60 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}
            {feedback && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-400/60 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                <CheckCircle2 className="h-4 w-4" /> {feedback}
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={submitting}>
              {submitting ? "Logging…" : direction === "out" ? "Confirm OUT" : "Confirm IN"}
            </Button>
          </form>

          <div className="rounded-2xl border border-slate-700/60 bg-slate-800/60 p-4 text-sm text-slate-300">
            <div className="text-xs uppercase tracking-wide text-slate-400">Recent activity</div>
            <ul className="mt-2 space-y-2">
              {recentLogs.length ? (
                recentLogs.map((log) => (
                  <li key={log.id} className="flex items-center justify-between rounded-xl bg-slate-900/70 px-3 py-2">
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-100 capitalize">{log.direction}</span>
                      {log.purpose && <span className="text-xs text-slate-400">{log.purpose}</span>}
                    </div>
                    <div className="text-xs text-slate-400">{formatTime(log.recordedAt)}</div>
                  </li>
                ))
              ) : (
                <li className="rounded-xl bg-slate-900/70 px-3 py-2 text-xs text-slate-400">Your next scan will appear here.</li>
              )}
            </ul>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400">
            <Link href="/dashboard/member" className="inline-flex items-center gap-1 text-slate-300 hover:text-slate-100">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
            </Link>
            <span>Signed in as {session.user.name || session.user.email}</span>
          </div>
        </div>
      </div>
    </main>
  );
}
