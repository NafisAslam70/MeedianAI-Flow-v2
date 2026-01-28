"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";

const fetcher = async (url) => {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload?.error || `HTTP ${res.status}`);
  }
  return res.json();
};

const formatToken = (value) => {
  if (!value || Number.isNaN(Number(value))) return "-";
  return `G-${String(value).padStart(3, "0")}`;
};

export default function GuardianQueueDisplay() {
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState(true);
  const audioRef = useRef(null);
  const voicesRef = useRef([]);
  const lastCallRef = useRef(null);
  const { data, error } = useSWR("/api/managersCommon/guardian-register?section=queue", fetcher, {
    refreshInterval: 5000,
    dedupingInterval: 1500,
  });

  const primeAudio = async () => {
    if (typeof window === "undefined") return;
    if (!audioRef.current) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioRef.current = ctx;
    }
    if (audioRef.current.state === "suspended") {
      await audioRef.current.resume();
    }
  };

  const playChime = async () => {
    if (typeof window === "undefined") return;
    await primeAudio();
    const ctx = audioRef.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.65);
  };

  const loadVoices = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setVoiceAvailable(false);
      return;
    }
    const voices = window.speechSynthesis.getVoices();
    voicesRef.current = voices;
    setVoiceAvailable(voices.length > 0);
  };

  const speakText = (text) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const voices = voicesRef.current || [];
    if (!voices.length) return false;
    const utter = new SpeechSynthesisUtterance(text);
    const preferred =
      voices.find((voice) => voice.lang?.toLowerCase().startsWith("hi")) ||
      voices.find((voice) => voice.lang?.toLowerCase().startsWith("en")) ||
      voices[0];
    if (preferred) utter.voice = preferred;
    utter.rate = 0.95;
    utter.pitch = 1;
    utter.volume = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
    return true;
  };

  useEffect(() => {
    loadVoices();
    if (typeof window === "undefined" || !window.speechSynthesis) return undefined;
    const handleVoicesChanged = () => loadVoices();
    window.speechSynthesis.onvoiceschanged = handleVoicesChanged;
    return () => {
      if (window.speechSynthesis.onvoiceschanged === handleVoicesChanged) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!soundEnabled) return;
    const nowServing = data?.nowServing;
    if (!nowServing?.tokenNumber) {
      lastCallRef.current = null;
      return;
    }
    const callKey = nowServing.calledAt
      ? `${nowServing.tokenNumber}-${nowServing.calledAt}`
      : String(nowServing.tokenNumber);
    if (lastCallRef.current === callKey) return;
    lastCallRef.current = callKey;
    const tokenLabel = formatToken(nowServing.tokenNumber);
    playChime().then(() => {
      speakText(`कृपया टोकन ${tokenLabel} वाले अभिभावक आगे आएं`);
    });
  }, [data?.nowServing, soundEnabled]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-slate-200">
        <div>
          <h1 className="text-2xl font-semibold">Queue display unavailable</h1>
          <p className="mt-2 text-sm text-slate-400">{error.message}</p>
        </div>
      </div>
    );
  }

  const nowServing = data?.nowServing;
  const nextUp = data?.nextUp || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Guardian & Visitor</p>
          <h1 className="text-3xl font-semibold text-white">Queue Display</h1>
        </header>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={async () => {
              await primeAudio();
              const next = !soundEnabled;
              setSoundEnabled(next);
              if (next) {
                const spoke = speakText("ध्वनि चालू हो गई है।");
                if (!spoke) setVoiceAvailable(false);
              }
            }}
            className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
              soundEnabled
                ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                : "border-slate-700 bg-slate-900 text-slate-300"
            }`}
          >
            {soundEnabled ? "Sound on" : "Enable sound"}
          </button>
          <button
            type="button"
            onClick={async () => {
              await playChime();
              speakText("कृपया टोकन G-001 वाले अभिभावक आगे आएं");
            }}
            className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-slate-500"
          >
            Test sound
          </button>
          {!soundEnabled && (
            <span className="text-xs text-slate-500">Tap enable sound once for announcements.</span>
          )}
          {!voiceAvailable && (
            <span className="text-xs text-amber-300">
              Voice not available on this screen. Use a PC display for announcements.
            </span>
          )}
        </div>

        <div className="grid flex-1 gap-6 md:grid-cols-2">
          <div className="flex flex-col justify-center rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Now Serving</p>
            <div className="mt-4 text-7xl font-bold text-white">{formatToken(nowServing?.tokenNumber)}</div>
            <p className="mt-3 text-sm text-slate-400">
              {nowServing?.guardianName || "Waiting for the next token"}
            </p>
          </div>

          <div className="flex flex-col rounded-3xl border border-slate-800 bg-slate-900/70 p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Next Up</p>
            <div className="mt-5 flex flex-wrap gap-4">
              {nextUp.length === 0 ? (
                <span className="rounded-full border border-dashed border-slate-700 px-4 py-2 text-sm text-slate-400">
                  Queue is clear
                </span>
              ) : (
                nextUp.map((entry) => (
                  <span
                    key={entry.id}
                    className="rounded-full bg-white/10 px-4 py-2 text-2xl font-semibold text-white"
                  >
                    {formatToken(entry.tokenNumber)}
                  </span>
                ))
              )}
            </div>
            <p className="mt-auto pt-8 text-xs text-slate-500">Auto-refreshes every few seconds.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
