/* ───── lib/hooks/useOpenCloseTimes.js ─────
   Fetches default/custom open-close times for the
   logged-in user and provides live “canClose?” + countdown. */

"use client";
import { useState, useEffect, useCallback } from "react";

export default function useOpenCloseTimes() {
  const [canClose,   setCanClose]   = useState(false);
  const [secsLeft,   setSecsLeft]   = useState(0);
  const [wStart,     setWStart]     = useState("");
  const [wEnd,       setWEnd]       = useState("");

  const fetchTimes = useCallback(async () => {
    try {
      const res = await fetch("/api/member/openCloseTimes");
      const { times } = await res.json();

      const now   = new Date();
      const base  = now.toISOString().split("T")[0];
      const ws    = new Date(`${base}T${times.closingWindowStart}`);
      const we    = new Date(`${base}T${times.closingWindowEnd}`);
      if (we < ws) we.setDate(we.getDate() + 1);   // spans midnight

      setWStart(times.closingWindowStart);
      setWEnd  (times.closingWindowEnd);

      if (now >= ws && now <= we) {
        setCanClose(true);
        setSecsLeft(Math.round((we - now) / 1000));
      } else {
        setCanClose(true);
        setSecsLeft(0);
      }
    } catch (e) {
      console.error("openCloseTimes fetch failed:", e);
    }
  }, []);

  /* fetch once + tick every second */
  useEffect(() => {
    fetchTimes();
    const id = setInterval(() => {
      setSecsLeft((s) => Math.max(s - 1, 0));
      if (secsLeft <= 1) fetchTimes();   // refresh when countdown expires
    }, 1000);
    return () => clearInterval(id);
  }, [fetchTimes, secsLeft]);

  return {
    canClose,
    secsLeft,
    windowStart: wStart,
    windowEnd:   wEnd,
    refetch:     fetchTimes,
  };
}
