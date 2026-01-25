"use client";

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
  const { data, error } = useSWR("/api/managersCommon/guardian-register?section=queue", fetcher, {
    refreshInterval: 5000,
    dedupingInterval: 1500,
  });

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
