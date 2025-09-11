"use client";
import { useEffect, useId, useRef, useState } from "react";

export default function QrScanner({
  onDecode,
  onError,
  width = 280,
  height = 220,
  className = "",
  scanBox = 200,
  fps = 10,
  autoStopOnDecode = true,
  active = true,
}) {
  const divId = useId().replace(/[:]/g, "");
  const containerRef = useRef(null);
  const scannerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        if (!active) return; // don't start unless active
        if (!navigator?.mediaDevices?.getUserMedia || !window.isSecureContext) {
          throw new Error("Camera not available or insecure context");
        }
        const mod = await import("html5-qrcode");
        const { Html5Qrcode } = mod;
        if (cancelled) return;
        const id = `qr_${divId}`;
        // Ensure container id exists
        if (containerRef.current) {
          containerRef.current.id = id;
        }
        scannerRef.current = new Html5Qrcode(id);
        setReady(true);
        const scanner = scannerRef.current;
        await scanner.start(
          { facingMode: { exact: "environment" } },
          { fps, qrbox: scanBox },
          async (decodedText) => {
            try {
              if (autoStopOnDecode && scannerRef.current) {
                try { await scannerRef.current.stop(); } catch {}
                try { await scannerRef.current.clear(); } catch {}
              }
              onDecode?.(decodedText);
            } catch (e) {
              // ignore
            }
          },
          () => {}
        );
      } catch (e) {
        setErr(e?.message || String(e));
        try { onError?.(e); } catch {}
      }
    }
    // Defer start to next tick to let modal/layout settle
    const tid = setTimeout(start, 0);
    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        try { s.stop().catch(()=>{}); } catch {}
        try { s.clear().catch(()=>{}); } catch {}
      }
      clearTimeout(tid);
    };
  }, [divId, onDecode, onError, scanBox, fps, active, autoStopOnDecode]);

  return (
    <div className={className}>
      <div
        ref={containerRef}
        style={{ width, height }}
        className="bg-black/60 rounded overflow-hidden flex items-center justify-center text-white text-xs"
      >
        {!ready && !err ? "Starting camera…" : null}
        {err ? `Scanner error: ${err}` : null}
      </div>
    </div>
  );
}
