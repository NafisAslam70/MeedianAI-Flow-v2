"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import QrScanner from "@/components/QrScanner";
import { ArrowLeft, Loader2, Scan } from "lucide-react";

const INFO_POINTS = [
  "Stand in front of your moderator's screen so the QR is centered.",
  "Keep your device steady; the scanner will capture automatically.",
  "Once scanned, wait for the confirmation before leaving the page.",
];

export default function TakeAttendancePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [scannerActive, setScannerActive] = useState(false);
  const [personalToken, setPersonalToken] = useState("");
  const [fetchingToken, setFetchingToken] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.replace("/auth/signin?callbackUrl=/dashboard/member/take-attendance");
    }
  }, [status, session, router]);

  const ensurePersonalToken = useMemo(() => {
    return async () => {
      if (personalToken) return personalToken;
      setFetchingToken(true);
      try {
        const res = await fetch("/api/attendance?section=personalToken", { cache: "no-store" });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
        const token = body.token || "";
        setPersonalToken(token);
        return token;
      } finally {
        setFetchingToken(false);
      }
    };
  }, [personalToken]);

  const startScanning = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await ensurePersonalToken();
      setScannerActive(true);
    } catch (err) {
      setErrorMessage(err.message || "Unable to prepare scanner. Try again.");
    }
  };

  const handleDecode = async (sessionToken) => {
    if (!sessionToken || ingesting || successMessage) return;
    setIngesting(true);
    setErrorMessage("");
    try {
      const userToken = await ensurePersonalToken();
      const res = await fetch("/api/attendance?section=ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken, userToken }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setScannerActive(false);
      setSuccessMessage("You're marked present for this session. Have a great class!");
    } catch (err) {
      setErrorMessage(err.message || "We couldn't record your attendance. Please try again.");
      setScannerActive(false);
    } finally {
      setIngesting(false);
    }
  };

  const resetAndRescan = () => {
    setSuccessMessage("");
    startScanning();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 hover:text-teal-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="mt-6 rounded-3xl bg-white dark:bg-slate-900 shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
          <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-teal-500/10 to-sky-500/10 dark:from-teal-500/10 dark:to-sky-500/10">
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Take Attendance</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Scan the moderator's session QR to register your attendance for the correct program.
            </p>
          </div>

          <div className="px-6 py-8 space-y-6">
            {errorMessage && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {errorMessage}
              </div>
            )}

            {successMessage ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-6 text-center">
                <h2 className="text-lg font-semibold text-emerald-700">Attendance Recorded</h2>
                <p className="mt-2 text-sm text-emerald-600">{successMessage}</p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => router.push("/dashboard/member")}
                    className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
                  >
                    Go back to Dashboard
                  </button>
                  <button
                    onClick={resetAndRescan}
                    className="inline-flex items-center justify-center rounded-lg border border-emerald-400 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
                  >
                    Scan another QR
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 px-4 py-5">
                  <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                    Before you start
                  </h2>
                  <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    {INFO_POINTS.map((point, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-teal-500" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {scannerActive ? (
                  <div className="relative mx-auto w-full max-w-lg">
                    <div className="aspect-square overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-black/80">
                      <QrScanner
                        onDecode={handleDecode}
                        onError={() => setErrorMessage("Unable to access the camera. Check permissions and try again.")}
                        width={480}
                        height={480}
                        scanBox={320}
                        className="h-full w-full object-cover"
                        autoStopOnDecode
                        active={scannerActive && !ingesting}
                      />
                    </div>
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="relative h-64 w-64 rounded-2xl border-2 border-teal-400/90">
                        <div className="absolute inset-0 overflow-hidden">
                          <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-teal-400 to-transparent animate-pulse" />
                        </div>
                        <span className="absolute -top-1 -left-1 h-6 w-1 bg-teal-400" />
                        <span className="absolute -top-1 -left-1 h-1 w-6 bg-teal-400" />
                        <span className="absolute -top-1 -right-1 h-6 w-1 bg-teal-400" />
                        <span className="absolute -top-1 -right-1 h-1 w-6 bg-teal-400" />
                        <span className="absolute -bottom-1 -left-1 h-6 w-1 bg-teal-400" />
                        <span className="absolute -bottom-1 -left-1 h-1 w-6 bg-teal-400" />
                        <span className="absolute -bottom-1 -right-1 h-6 w-1 bg-teal-400" />
                        <span className="absolute -bottom-1 -right-1 h-1 w-6 bg-teal-400" />
                      </div>
                    </div>
                    {ingesting && (
                      <div className="mt-3 flex items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Recording attendance…
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <button
                      type="button"
                      onClick={startScanning}
                      disabled={fetchingToken || status !== "authenticated"}
                      className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-medium text-white shadow-lg hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-teal-400"
                    >
                      {fetchingToken ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Preparing scanner…
                        </>
                      ) : (
                        <>
                          <Scan className="h-4 w-4" />
                          Start scanning
                        </>
                      )}
                    </button>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Camera access is required to scan the moderator's QR code.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
