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
  const baseId = useId().replace(/[:]/g, "");
  const containerRef = useRef(null);
  const scannerRef = useRef(null);
  const decodeRef = useRef(onDecode);
  const errorRef = useRef(onError);
  const [err, setErr] = useState("");

  // Keep latest handlers without restarting scanner
  useEffect(() => { decodeRef.current = onDecode; }, [onDecode]);
  useEffect(() => { errorRef.current = onError; }, [onError]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let stopping = false;

    async function start() {
      try {
        if (!navigator?.mediaDevices?.getUserMedia || !window.isSecureContext) {
          throw new Error("Camera not available or insecure context");
        }
        const mod = await import("html5-qrcode");
        const { Html5Qrcode } = mod;
        if (cancelled) return;
        const id = `qr_${baseId}`;
        const el = containerRef.current;
        if (!el) return;
        const scanner = new Html5Qrcode(id);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: { exact: "environment" } },
          { fps, qrbox: scanBox },
          async (decodedText) => {
            try {
              if (autoStopOnDecode && !stopping && scannerRef.current) {
                stopping = true;
                await scannerRef.current.stop().catch(() => {});
              }
            } finally {
              try { decodeRef.current?.(decodedText); } catch {}
            }
          },
          () => {}
        );
      } catch (e) {
        setErr(e?.message || String(e));
        try { errorRef.current?.(e); } catch {}
      }
    }

    const tid = setTimeout(start, 0);
    return () => {
      cancelled = true;
      clearTimeout(tid);
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        Promise.resolve().then(() => s.stop().catch(() => {}));
      }
    };
  }, [active, baseId, scanBox, fps, autoStopOnDecode]);

  return (
    <div className={className}>
      <div
        ref={containerRef}
        id={`qr_${baseId}`}
        style={{ width, height }}
        className="bg-black/60 rounded overflow-hidden flex items-center justify-center text-white text-xs"
      >
        {err ? `Scanner error: ${err}` : "Starting camera…"}
      </div>
    </div>
  );
}
