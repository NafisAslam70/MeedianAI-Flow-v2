"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useState } from "react";
import {
  ArrowLeft,
  Camera,
  LogIn,
  LogOut,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import QrScanner from "@/components/QrScanner";
import Button from "@/components/ui/Button";

export default function MemberGateHubPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const name = session?.user?.name || "Meedian Team";

  const [activeScanner, setActiveScanner] = useState(null); // "out" | "in" | null
  const [scanError, setScanError] = useState("");

  const closeScanner = () => {
    setActiveScanner(null);
    setScanError("");
  };

  const handleDecode = useCallback(
    (decoded) => {
      if (!decoded) return;
      try {
        const trimmed = String(decoded).trim();
        if (!trimmed) return;
        router.push(trimmed);
      } finally {
        closeScanner();
      }
    },
    [router]
  );

  const handleScanError = useCallback((err) => {
    if (!err) return;
    setScanError(err?.message || String(err));
  }, []);

  const showScanner = (mode) => {
    setScanError("");
    setActiveScanner(mode);
  };

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-10 text-slate-100">
      <div className="w-full max-w-4xl space-y-8 rounded-3xl border border-slate-700/60 bg-slate-900/75 p-8 shadow-2xl backdrop-blur">
        <header className="space-y-3">
          <div className="text-xs uppercase tracking-wide text-teal-300">Hi {name}</div>
          <h1 className="text-3xl font-semibold">Campus In / Out</h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            Scan the physical QR codes placed at the campus checkpoint. There are two codes —{" "}
            <span className="font-semibold text-teal-200">Campus Out</span> (log reason before leaving)
            and <span className="font-semibold text-emerald-200">Campus In</span> (mark that you are back).
            You can scan directly with your phone camera, or use the scanner inside this page.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col justify-between rounded-2xl border border-amber-300/40 bg-amber-500/10 p-5">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-amber-300/60 bg-amber-500/20">
                  <LogOut className="h-5 w-5 text-amber-100" />
                </span>
                <div>
                  <h2 className="text-xl font-semibold text-amber-100">Campus Out</h2>
                  <p className="text-xs text-amber-100/80">
                    Scan the OUT code before stepping outside and share the reason with admin.
                  </p>
                </div>
              </div>
              <ul className="mt-3 space-y-2 text-xs text-amber-100/85">
                <li className="flex items-start gap-2">
                  <AlertTriangle className="mt-[2px] h-3.5 w-3.5" />
                  Use the printed <strong>CAMPUS OUT</strong> QR pasted at the exit.
                </li>
                <li className="flex items-start gap-2">
                  <ShieldCheck className="mt-[2px] h-3.5 w-3.5" />
                  Purpose is required — helps office track movements during the day.
                </li>
              </ul>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Button
                variant="light"
                size="sm"
                onClick={() => showScanner("out")}
                className="bg-amber-200/20 text-amber-100 hover:bg-amber-200/30"
              >
                <Camera className="mr-2 h-4 w-4" />
                Scan Campus Out
              </Button>
              <Link href="/dashboard/member/gate/out" className="text-xs text-amber-100/70 hover:text-amber-100">
                Need fallback? open form
              </Link>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-emerald-300/40 bg-emerald-500/10 p-5">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-emerald-300/60 bg-emerald-500/20">
                  <LogIn className="h-5 w-5 text-emerald-100" />
                </span>
                <div>
                  <h2 className="text-xl font-semibold text-emerald-100">Campus In</h2>
                  <p className="text-xs text-emerald-100/80">
                    When you return, scan the IN code. No extra form — we just note the timestamp.
                  </p>
                </div>
              </div>
              <ul className="mt-3 space-y-2 text-xs text-emerald-100/85">
                <li className="flex items-start gap-2">
                  <AlertTriangle className="mt-[2px] h-3.5 w-3.5" />
                  Look for the <strong>CAMPUS IN</strong> QR near the entry point.
                </li>
                <li className="flex items-start gap-2">
                  <ShieldCheck className="mt-[2px] h-3.5 w-3.5" />
                  We automatically record the time you re-enter. No notes needed.
                </li>
              </ul>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Button
                variant="light"
                size="sm"
                onClick={() => showScanner("in")}
                className="bg-emerald-200/20 text-emerald-100 hover:bg-emerald-200/30"
              >
                <Camera className="mr-2 h-4 w-4" />
                Scan Campus In
              </Button>
              <Link href="/dashboard/member/gate/in" className="text-xs text-emerald-100/70 hover:text-emerald-100">
                Need fallback? open form
              </Link>
            </div>
          </div>
        </section>

        {activeScanner && (
          <div className="rounded-2xl border border-slate-600/60 bg-slate-900/85 p-6">
            <div className="flex items-center justify-between text-sm text-slate-200">
              <strong>
                {activeScanner === "out" ? "Scanning Campus Out code…" : "Scanning Campus In code…"}
              </strong>
              <Button variant="ghost" size="sm" onClick={closeScanner} className="text-slate-300 hover:text-white">
                Cancel
              </Button>
            </div>
            <div className="mt-4 flex justify-center">
              <QrScanner
                active
                width={320}
                height={260}
                scanBox={240}
                onDecode={handleDecode}
                onError={handleScanError}
              />
            </div>
            {scanError && (
              <p className="mt-3 text-center text-xs text-red-300">
                {scanError}. You can also scan using your phone camera — the QR opens the right page automatically.
              </p>
            )}
          </div>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <Link href="/dashboard/member" className="inline-flex items-center gap-1 text-slate-200 hover:text-slate-50">
            <ArrowLeft className="h-3 w-3" /> Back to dashboard
          </Link>
          <span>Tip: Phone camera scan also works — it will open the right page instantly.</span>
        </footer>
      </div>
    </main>
  );
}
